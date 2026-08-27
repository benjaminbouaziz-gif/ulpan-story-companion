import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";

/**
 * BRIQUE 7 — LES DÉCISIONS DE L'ÉDITEUR.
 *
 * Ce fichier tient trois choses, et rien d'autre :
 *  1. LA LECTURE de la section « Points à trancher » d'un livrable ;
 *  2. LA SYNCHRONISATION du registre après chaque dépôt de robot — sans jamais
 *     rien effacer ni dupliquer ;
 *  3. LE BLOC ENVOYÉ AUX ROBOTS, écrit une seule fois ici, pour que toutes les
 *     briques suivantes le réutilisent sans le réécrire.
 *
 * Le registre n'est jamais écrasé : une question qui disparaît d'une version
 * est marquée `stale`, jamais supprimée.
 */

export type PointTrouve = {
  question: string;
  contexte: string;
};

export type LectureDesPoints = {
  /** Faux quand la section est absente ou mal formée : on le DIT à l'écran. */
  ok: boolean;
  points: PointTrouve[];
  /** Vrai quand le livrable dit explicitement « Aucun point à trancher. ». */
  aucun: boolean;
};

/**
 * LA CLÉ D'IDENTITÉ D'UNE QUESTION. Deux versions d'un livrable réécrivent
 * rarement une question au caractère près : on compare donc sur une forme
 * réduite — sans accents, sans ponctuation, sans casse, espaces normalisés.
 * C'est cette clé qui empêche à la fois le doublon et la perte d'une décision.
 */
export function questionKey(question: string): string {
  return question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 300);
}

const TITRE_SECTION = /^#{1,6}\s*points?\s+à\s+trancher\s*:?\s*$/i;
const TITRE_POINT = /^#{1,6}\s*point\s*\d*\s*:?.*$/i;

const ETIQUETTES: { champ: "question" | "sources" | "autorite" | "reco"; motif: RegExp }[] = [
  { champ: "question", motif: /^\**\s*question\s*\**\s*:\s*(.*)$/i },
  { champ: "sources", motif: /^\**\s*sources?\s*\**\s*:\s*(.*)$/i },
  { champ: "autorite", motif: /^\**\s*autorit[ée]\s*\**\s*:\s*(.*)$/i },
  { champ: "reco", motif: /^\**\s*recommandation\s*\**\s*:\s*(.*)$/i },
];

function niveauTitre(ligne: string): number {
  const m = /^(#{1,6})\s/.exec(ligne);
  return m ? m[1]!.length : 0;
}

/**
 * LA DÉCOUPE. On repère la ligne de titre « ## Points à trancher », on garde
 * tout jusqu'au prochain titre de niveau inférieur ou égal qui ne soit pas un
 * « ### Point N », puis on découpe ce corps sur chaque « ### Point ». Dans
 * chaque bloc, les quatre étiquettes sont lues ligne à ligne : une valeur
 * continue jusqu'à l'étiquette suivante.
 */
export function lirePointsATrancher(markdown: string): LectureDesPoints {
  const lignes = markdown.split(/\r?\n/);
  const debut = lignes.findIndex((l) => TITRE_SECTION.test(l.trim()));
  if (debut === -1) return { ok: false, points: [], aucun: false };

  const niveauSection = niveauTitre(lignes[debut]!.trim()) || 2;
  const corps: string[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const ligne = lignes[i]!;
    const niveau = niveauTitre(ligne.trim());
    if (niveau > 0 && niveau <= niveauSection && !TITRE_POINT.test(ligne.trim())) break;
    corps.push(ligne);
  }

  const texte = corps.join("\n");
  const aucun = /aucun\s+point\s+à\s+trancher/i.test(texte);

  // Découpe en blocs sur chaque titre « Point … ».
  const blocs: string[][] = [];
  let courant: string[] | null = null;
  for (const ligne of corps) {
    if (TITRE_POINT.test(ligne.trim())) {
      courant = [];
      blocs.push(courant);
      continue;
    }
    if (courant) courant.push(ligne);
  }

  if (blocs.length === 0) {
    // « Aucun point à trancher. » est une réponse valide et complète.
    return { ok: aucun, points: [], aucun };
  }

  const points: PointTrouve[] = [];
  let malForme = false;

  for (const bloc of blocs) {
    const valeurs: Record<string, string[]> = {};
    let champCourant: string | null = null;
    for (const ligne of bloc) {
      let touche = false;
      for (const e of ETIQUETTES) {
        const m = e.motif.exec(ligne.trim());
        if (m) {
          champCourant = e.champ;
          valeurs[e.champ] = [m[1] ?? ""];
          touche = true;
          break;
        }
      }
      if (touche) continue;
      if (champCourant && ligne.trim().length > 0) valeurs[champCourant]!.push(ligne.trim());
    }

    const assemble = (k: string) => (valeurs[k] ?? []).join("\n").trim();
    const question = assemble("question");
    if (question.length === 0) {
      malForme = true;
      continue;
    }
    const contexte = [
      assemble("sources") ? `Sources : ${assemble("sources")}` : null,
      assemble("autorite") ? `Autorité : ${assemble("autorite")}` : null,
      assemble("reco") ? `Recommandation : ${assemble("reco")}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join("\n\n");
    points.push({ question, contexte });
  }

  return { ok: !malForme && points.length > 0, points, aucun };
}

/** Marqueur de lecture, pour dire à l'écran ce qui s'est passé sans mentir. */
async function ecrireMarqueur(
  ctx: EditorContext,
  stepId: string,
  snapshot: { ok: boolean; at: string; points?: number },
): Promise<void> {
  const admin = await getAdminClient(ctx);
  await admin.from("content_versions").insert({
    entity: "book_decisions_parse",
    entity_id: stepId,
    snapshot,
    created_by: ctx.userId,
  });
}

/**
 * LA SYNCHRONISATION, appelée JUSTE APRÈS le dépôt d'un artefact de robot.
 *
 *  - question déjà connue (même clé) : rien n'est touché — ma décision reste,
 *    et le drapeau `stale` est retiré puisqu'elle réapparaît ;
 *  - question nouvelle : créée « ouverte », décision vide ;
 *  - question disparue : marquée `stale`, jamais supprimée.
 */
export async function synchroniserDecisions(
  ctx: EditorContext,
  args: { bookId: string; bookStepId: string; markdown: string },
): Promise<{ ok: boolean; created: number; stale: number; aucun: boolean }> {
  const admin = await getAdminClient(ctx);
  const lecture = lirePointsATrancher(args.markdown);

  if (!lecture.ok) {
    await ecrireMarqueur(ctx, args.bookStepId, { ok: false, at: new Date().toISOString() });
    return { ok: false, created: 0, stale: 0, aucun: false };
  }
  await ecrireMarqueur(ctx, args.bookStepId, {
    ok: true,
    points: lecture.points.length,
    at: new Date().toISOString(),
  });

  // Les décisions ARCHIVÉES sont hors jeu : une question identique repart
  // ouverte, elle n'est jamais rattachée à un plan abandonné.
  const { data: existantes } = await admin
    .from("book_decisions")
    .select("id, question_key, stale, sort_order")
    .eq("book_id", args.bookId)
    .eq("book_step_id", args.bookStepId)
    .is("archived_at", null);


  const parCle = new Map((existantes ?? []).map((d) => [d.question_key, d]));
  const clesVues = new Set<string>();
  let created = 0;
  let rang = Math.max(0, ...(existantes ?? []).map((d) => d.sort_order));

  for (const point of lecture.points) {
    const cle = questionKey(point.question);
    if (cle.length === 0) continue;
    clesVues.add(cle);
    const deja = parCle.get(cle);
    if (deja) {
      // Elle réapparaît : elle n'est plus périmée. Ma décision n'est pas touchée.
      if (deja.stale) await admin.from("book_decisions").update({ stale: false }).eq("id", deja.id);
      continue;
    }
    rang += 1;
    const { error } = await admin.from("book_decisions").insert({
      book_id: args.bookId,
      book_step_id: args.bookStepId,
      question: point.question,
      contexte: point.contexte || null,
      question_key: cle,
      status: "ouverte",
      sort_order: rang,
      created_by: ctx.userId,
    });
    if (!error) created += 1;
  }

  const perimees = (existantes ?? []).filter((d) => !clesVues.has(d.question_key) && !d.stale);
  if (perimees.length > 0) {
    await admin
      .from("book_decisions")
      .update({ stale: true })
      .in(
        "id",
        perimees.map((d) => d.id),
      );
  }

  return { ok: true, created, stale: perimees.length, aucun: lecture.aucun };
}

/**
 * LE BLOC ENVOYÉ AUX ROBOTS. Écrit ici une seule fois : tout robot à venir
 * appelle cette fonction et concatène son retour après la matière du livre.
 * Seules les décisions tranchées ou écartées partent ; les ouvertes non.
 */
export async function blocDecisionsPourRobot(
  ctx: EditorContext,
  bookId: string,
): Promise<string | null> {
  const admin = await getAdminClient(ctx);
  // Une décision archivée ne part JAMAIS, quel que soit son statut.
  const { data } = await admin
    .from("book_decisions")
    .select("question, decision, status, sort_order, created_at")
    .eq("book_id", bookId)
    .is("archived_at", null)
    .in("status", ["tranchee", "ecartee"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const lignes = (data ?? [])
    .map((d) => {
      const question = d.question.trim();
      if (question.length === 0) return null;
      if (d.status === "ecartee") return `${question} → écarté : ne pas utiliser`;
      const decision = (d.decision ?? "").trim();
      if (decision.length === 0) return null;
      return `${question} → ${decision}`;
    })
    .filter((s): s is string => s !== null);

  if (lignes.length === 0) return null;

  return [
    "DÉCISIONS DE L'ÉDITEUR — elles font foi, elles ne se rediscutent pas :",
    ...lignes.map((l, i) => `${i + 1}. ${l}`),
  ].join("\n");
}
