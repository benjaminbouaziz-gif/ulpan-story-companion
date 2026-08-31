/**
 * LES POINTS MESURÉS PAR LE CODE.
 *
 * Deux points de la grille ne sont pas soumis au modèle : ils se comptent.
 * Le code les tranche ici, et leurs verdicts rejoignent ceux du modèle dans
 * le même rapport. Module pur : il ne parle qu'au texte du plan.
 */

export type MesureCode = {
  verdict: "valide" | "echoue";
  location: string;
  explanation: string;
};

export type ChapitreLu = { numero: number; titre: string; pages: number | null; ligne: string };

/** Découpe le plan en chapitres : « ## Chapitre N · titre » puis son bloc. */
export function lireChapitres(plan: string): ChapitreLu[] {
  const lignes = plan.split(/\r?\n/);
  const out: ChapitreLu[] = [];
  let courant: { numero: number; titre: string; ligne: string; bloc: string[] } | null = null;

  const pousser = () => {
    if (!courant) return;
    const bloc = courant.bloc.join("\n");
    const m = bloc.match(/pages?\s*[:·=]?\s*(\d+)/i);
    out.push({
      numero: courant.numero,
      titre: courant.titre,
      pages: m?.[1] ? Number(m[1]) : null,
      ligne: courant.ligne,
    });
  };

  for (const ligne of lignes) {
    const t = ligne.match(/^\s*#{1,6}\s*Chapitre\s+(\d+)\s*(?:[·:•—-]\s*)?(.*)$/i);
    if (t) {
      pousser();
      courant = { numero: Number(t[1]), titre: (t[2] ?? "").trim(), ligne: ligne.trim(), bloc: [] };
    } else if (courant) {
      courant.bloc.push(ligne);
    }
  }
  pousser();
  return out;
}

const CHAPITRES_ATTENDUS = 10;
const PAGES_ATTENDUES = 28;

/**
 * Le verdict du code pour un point de la grille. Null si ce point n'a pas de
 * mesure écrite : l'appelant en fait alors une erreur, jamais un silence.
 */
export function mesurerCritere(code: string, plan: string): MesureCode | null {
  const chapitres = lireChapitres(plan);

  if (code === "plan_structure") {
    if (chapitres.length === 0)
      return {
        verdict: "echoue",
        location: "Plan entier",
        explanation: "Aucun titre de la forme « ## Chapitre N · titre » n'a été trouvé dans le plan.",
      };
    const sansPages = chapitres.filter((c) => c.pages === null);
    if (sansPages.length > 0)
      return {
        verdict: "echoue",
        location: sansPages.map((c) => `Chapitre ${c.numero}`).join(", "),
        explanation: `${chapitres.length} chapitre(s) titrés, mais ${sansPages.length} sans ligne de pages lisible.`,
      };
    return {
      verdict: "valide",
      location: "Plan entier",
      explanation: `${chapitres.length} chapitres titrés « ## Chapitre N · titre », chacun avec sa ligne de pages.`,
    };
  }

  if (code === "plan_numerotation") {
    const numeros = chapitres.map((c) => c.numero);
    const attendus = Array.from({ length: CHAPITRES_ATTENDUS }, (_, i) => i + 1);
    const doublons = numeros.filter((n, i) => numeros.indexOf(n) !== i);
    const manquants = attendus.filter((n) => !numeros.includes(n));
    const surnumeraires = numeros.filter((n) => !attendus.includes(n));
    if (doublons.length > 0 || manquants.length > 0 || surnumeraires.length > 0)
      return {
        verdict: "echoue",
        location: "Plan entier",
        explanation: [
          `Numérotation lue : ${numeros.join(", ") || "aucune"}.`,
          doublons.length > 0 ? `Doublons : ${[...new Set(doublons)].join(", ")}.` : "",
          manquants.length > 0 ? `Manquants : ${manquants.join(", ")}.` : "",
          surnumeraires.length > 0 ? `Hors 1–10 : ${[...new Set(surnumeraires)].join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    return {
      verdict: "valide",
      location: "Plan entier",
      explanation: `Numérotation continue de 1 à ${CHAPITRES_ATTENDUS}, sans doublon ni saut.`,
    };
  }

  if (code === "plan_somme_pages") {
    const connues = chapitres.filter((c) => c.pages !== null);
    const somme = connues.reduce((a, c) => a + (c.pages ?? 0), 0);
    if (connues.length !== chapitres.length || chapitres.length === 0)
      return {
        verdict: "echoue",
        location: "Plan entier",
        explanation: "Les pages ne sont pas lisibles pour tous les chapitres : la somme n'est pas mesurable.",
      };
    return {
      verdict: somme === PAGES_ATTENDUES ? "valide" : "echoue",
      location: "Plan entier",
      explanation: `Somme des pages allouées : ${somme} (attendu ${PAGES_ATTENDUES}) — ${connues
        .map((c) => `ch.${c.numero}=${c.pages}`)
        .join(", ")}.`,
    };
  }

  return null;
}
