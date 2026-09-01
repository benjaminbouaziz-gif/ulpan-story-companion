import { lirePlanChapitres } from "./recit-calibrage";

/**
 * LE CONTRÔLE DU PLAN — MODULE PUR.
 *
 * Aucun secret, aucun client, aucune base : ce fichier ne fait que MESURER et
 * LIRE. Deux principes, tenus ici et nulle part ailleurs :
 *
 *  1. LES CONTRÔLES OBJECTIFS SONT MESURÉS PAR LE CODE. Chapitres numérotés et
 *     complets, titres présents, nombre attendu, gabarit lisible, champs requis :
 *     on ne demande pas au modèle de compter, on compte.
 *  2. UN RAPPORT INEXPLOITABLE NE PASSE PAS. JSON invalide, verdict illisible,
 *     code inconnu, entrée manquante : la lecture échoue et aucun plan ne
 *     franchit l'étape.
 *
 * Le contrôleur ne rend AUCUNE note : la synthèse est calculée ici.
 */

export type Gravite = "bloquant" | "signalement";
export type Verdict = "valide" | "echoue";

/** Un critère de la grille active, tel qu'il vit en base. */
export type CritereGrille = {
  code: string;
  label: string;
  question: string;
  family: string;
  isBlocking: boolean;
  species: "juge" | "mecanique";
  mechanicKey: string | null;
};

/** Un verdict, mesuré par le code ou rendu par le contrôleur. */
export type VerdictComplet = {
  code: string;
  label: string;
  family: string;
  species: "juge" | "mecanique";
  verdict: Verdict;
  /** La gravité EFFECTIVE : la grille commande, le modèle ne peut pas l'adoucir. */
  severity: Gravite;
  location: string;
  evidence: string;
  requiredFix: string;
  suggestion: string;
};

export type Synthese = {
  total: number;
  valides: number;
  bloquants: number;
  signalements: number;
  /** Vrai quand aucun écart bloquant n'a été relevé. */
  passe: boolean;
};

export function synthetiser(verdicts: VerdictComplet[]): Synthese {
  const echecs = verdicts.filter((v) => v.verdict === "echoue");
  const bloquants = echecs.filter((v) => v.severity === "bloquant").length;
  return {
    total: verdicts.length,
    valides: verdicts.length - echecs.length,
    bloquants,
    signalements: echecs.length - bloquants,
    passe: bloquants === 0,
  };
}

/* ------------------------------------------------------------------ */
/* 1. CE QUE LE CODE MESURE LUI-MÊME                                   */
/* ------------------------------------------------------------------ */

const SECTION_POINTS = /^#{1,6}\s*points?\s+à\s+trancher\s*:?\s*$/i;

function verdictMecanique(
  critere: CritereGrille,
  echoue: boolean,
  detail: { location?: string; evidence?: string; requiredFix?: string },
): VerdictComplet {
  return {
    code: critere.code,
    label: critere.label,
    family: critere.family,
    species: "mecanique",
    verdict: echoue ? "echoue" : "valide",
    severity: critere.isBlocking ? "bloquant" : "signalement",
    location: echoue ? (detail.location ?? "") : "",
    evidence: echoue ? (detail.evidence ?? "") : "",
    requiredFix: echoue ? (detail.requiredFix ?? "") : "",
    suggestion: "",
  };
}

/**
 * LA MESURE. Un critère mécanique dont la clé est inconnue de ce code n'est pas
 * silencieusement validé : il est rendu en échec, avec la raison écrite. Le
 * silence est le seul verdict interdit.
 */
export function mesurerMecaniques(
  markdown: string,
  criteres: CritereGrille[],
  chapitresAttendus: number | null,
): VerdictComplet[] {
  const lecture = lirePlanChapitres(markdown);
  const lignes = markdown.split(/\r?\n/);
  const aSectionPoints = lignes.some((l) => SECTION_POINTS.test(l.trim()));
  const sansTitre = lecture.chapitres.filter((c) => c.titre.trim().length === 0);
  const trous = lecture.problems.filter((p) => /numérotation/i.test(p));
  const sansPages = lecture.problems.filter((p) => /nombre de pages/i.test(p));

  return criteres
    .filter((c) => c.species === "mecanique")
    .map((critere) => {
      switch (critere.mechanicKey) {
        case "plan_structure": {
          const vide = lecture.chapitres.length === 0;
          return verdictMecanique(critere, vide, {
            location: "Ensemble du plan",
            evidence: vide ? "Aucun titre au format « ## Chapitre N · titre » n'a été trouvé." : "",
            requiredFix:
              "Structurer le plan en « ## Chapitre N · titre », avec une ligne « Pages : n » sous chaque chapitre.",
          });
        }
        case "plan_numerotation":
          return verdictMecanique(critere, trous.length > 0, {
            location: "Numérotation des chapitres",
            evidence: trous.join(" "),
            requiredFix: "Renuméroter les chapitres de 1 à N, sans trou ni doublon.",
          });
        case "plan_titres":
          return verdictMecanique(critere, sansTitre.length > 0, {
            location: sansTitre.map((c) => `Chapitre ${c.chapterNo}`).join(", "),
            evidence: `${sansTitre.length} chapitre(s) annoncé(s) sans titre.`,
            requiredFix: "Donner un titre non vide à chaque chapitre annoncé.",
          });
        case "plan_nombre": {
          if (chapitresAttendus === null || chapitresAttendus < 1)
            return {
              ...verdictMecanique(critere, false, {}),
              evidence: "La fiche du livre ne déclare aucun nombre de chapitres attendu.",
            };
          const trouve = lecture.chapitres.length;
          return verdictMecanique(critere, trouve !== chapitresAttendus, {
            location: "Ensemble du plan",
            evidence: `${chapitresAttendus} chapitre(s) attendu(s), ${trouve} annoncé(s).`,
            requiredFix: `Ramener le plan à ${chapitresAttendus} chapitre(s).`,
          });
        }
        case "plan_champs": {
          const manques = [
            ...sansPages,
            aSectionPoints ? null : "La section « Points à trancher » est absente du plan.",
          ].filter((s): s is string => s !== null);
          return verdictMecanique(critere, manques.length > 0, {
            location: "Champs requis",
            evidence: manques.join(" "),
            requiredFix:
              "Ajouter la ligne « Pages : n » sous chaque chapitre et la section « ## Points à trancher ».",
          });
        }
        default:
          return verdictMecanique(critere, true, {
            location: "Grille de contrôle",
            evidence: `Le critère mécanique « ${critere.code} » n'a aucune mesure dans le code (clé « ${critere.mechanicKey ?? "absente"} »).`,
            requiredFix: "Corriger la grille de contrôle ou implémenter la mesure.",
          });
      }
    });
}

/* ------------------------------------------------------------------ */
/* 2. LA LECTURE DU RAPPORT DU CONTRÔLEUR                              */
/* ------------------------------------------------------------------ */

export type LectureRapport = {
  ok: boolean;
  verdicts: VerdictComplet[];
  /** Ce qui rend le rapport inexploitable, en français, prêt à afficher. */
  erreurs: string[];
};

/** Le JSON, même enveloppé de bavardage ou d'une balise de code. */
function extraireJson(texte: string): unknown {
  const nettoye = texte.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
  const debut = nettoye.indexOf("{");
  const fin = nettoye.lastIndexOf("}");
  if (debut === -1 || fin <= debut) throw new Error("aucun objet JSON dans la réponse");
  return JSON.parse(nettoye.slice(debut, fin + 1));
}

function chaine(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Lit le rapport et le confronte à la grille. Un rapport est REFUSÉ s'il manque
 * une entrée, s'il en ajoute une inconnue, s'il rend un verdict illisible ou s'il
 * n'est pas du JSON. Aucun repli silencieux : dans ce cas, aucun plan ne passe.
 */
export function lireRapportControleur(texte: string, criteres: CritereGrille[]): LectureRapport {
  const juges = criteres.filter((c) => c.species === "juge");
  const attendus = new Map(juges.map((c) => [c.code, c]));
  const erreurs: string[] = [];

  let brut: unknown;
  try {
    brut = extraireJson(texte);
  } catch (e) {
    return {
      ok: false,
      verdicts: [],
      erreurs: [
        `Le rapport du contrôleur n'est pas exploitable : ${e instanceof Error ? e.message : String(e)}.`,
      ],
    };
  }

  const liste = (brut as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(liste))
    return {
      ok: false,
      verdicts: [],
      erreurs: ["Le rapport du contrôleur ne contient aucune liste « verdicts »."],
    };

  const verdicts: VerdictComplet[] = [];
  const vus = new Set<string>();

  for (const entree of liste) {
    const e = entree as Record<string, unknown>;
    const code = chaine(e["code"]);
    const critere = attendus.get(code);
    if (!critere) {
      erreurs.push(
        `Le rapport juge un critère inconnu de la grille : « ${code || "(sans code)"} ».`,
      );
      continue;
    }
    if (vus.has(code)) {
      erreurs.push(`Le rapport rend deux verdicts pour le critère « ${code} ».`);
      continue;
    }
    const verdict = chaine(e["verdict"]).toLowerCase();
    if (verdict !== "valide" && verdict !== "echoue") {
      erreurs.push(`Verdict illisible pour « ${code} » : « ${chaine(e["verdict"]) || "(vide)"} ».`);
      continue;
    }
    vus.add(code);

    // LA GRILLE COMMANDE, ET ELLE SEULE. Le contrôleur annonce une gravité,
    // on la lit, mais elle ne peut ni durcir ni adoucir la grille : sinon un
    // simple signalement déclencherait une réécriture, et l'inverse aussi.
    const severity: Gravite = critere.isBlocking ? "bloquant" : "signalement";

    verdicts.push({
      code,
      label: critere.label,
      family: critere.family,
      species: "juge",
      verdict,
      severity,

      location: chaine(e["location"]),
      evidence: chaine(e["evidence"]) || chaine(e["explanation"]),
      requiredFix: chaine(e["required_fix"]) || chaine(e["requiredFix"]),
      suggestion: chaine(e["suggestion"]) || chaine(e["proposition"]),
    });
  }

  for (const c of juges)
    if (!vus.has(c.code))
      erreurs.push(`Le rapport ne juge pas le critère « ${c.code} » (${c.label}).`);

  // Un échec sans correction exigée n'est pas exploitable par le réécriteur.
  for (const v of verdicts)
    if (v.verdict === "echoue" && v.requiredFix.length === 0 && v.evidence.length === 0)
      erreurs.push(`L'échec du critère « ${v.code} » n'est ni situé ni motivé : rien à corriger.`);

  return { ok: erreurs.length === 0, verdicts, erreurs };
}

/** Le texte conservé en base pour un verdict : lisible, complet, sans JSON. */
export function texteVerdict(v: VerdictComplet): string {
  return [
    v.evidence ? `Constat : ${v.evidence}` : null,
    v.requiredFix ? `Correction exigée : ${v.requiredFix}` : null,
    v.suggestion ? `Suggestion : ${v.suggestion}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");
}
