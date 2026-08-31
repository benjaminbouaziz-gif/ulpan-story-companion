/**
 * LA GRILLE DE CONTRÔLE DU PLAN — lue, jamais réécrite.
 *
 * La grille EST le prompt « Règles de contrôle » : on ne la duplique pas en
 * base, on la lit. Chaque point y est écrit sur une ligne :
 *
 *   code · question · famille · BLOQUANT|non [· mesuré par le code]
 *
 * Les points marqués « mesuré par le code » ne sont PAS attendus du modèle :
 * c'est le code qui les tranche. Module pur : aucun secret, aucun client.
 */

export type CritereGrille = {
  code: string;
  question: string;
  famille: string;
  bloquant: boolean;
  /** Tranché par le code, jamais demandé au modèle. */
  mesureParLeCode: boolean;
};

const CODE = /^plan_[a-z0-9_]+$/;

/** Lit la grille active. Jette si elle est illisible ou vide. */
export function lireGrille(contenu: string): CritereGrille[] {
  const criteres: CritereGrille[] = [];
  const vus = new Set<string>();

  for (const ligne of contenu.split(/\r?\n/)) {
    const parts = ligne
      .split("·")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length < 4) continue;
    const code = parts[0] ?? "";
    if (!CODE.test(code)) continue;
    if (vus.has(code)) throw new Error(`La grille de contrôle porte deux fois le point « ${code} ».`);
    vus.add(code);
    const reste = parts.slice(1);
    // Le dernier segment peut être la mention « mesuré par le code ».
    const mesureParLeCode = reste.some((p) => /mesur\w*\s+par\s+le\s+code/i.test(p));
    const sansMention = reste.filter((p) => !/mesur\w*\s+par\s+le\s+code/i.test(p));
    const question = sansMention[0] ?? "";
    const bloquant = sansMention.some((p) => /^bloquant$/i.test(p));
    // La famille : le segment qui n'est ni la question ni le verdict bloquant.
    const famille =
      sansMention.slice(1).find((p) => !/^(bloquant|non)$/i.test(p)) ?? "Autre";
    criteres.push({ code, question, famille, bloquant, mesureParLeCode });
  }

  if (criteres.length === 0)
    throw new Error("La grille de contrôle du plan est illisible : aucun point « code · question · famille » trouvé.");
  return criteres;
}

/** Les points attendus du modèle : tout sauf ceux mesurés par le code. */
export function criteresDuModele(grille: CritereGrille[]): CritereGrille[] {
  return grille.filter((c) => !c.mesureParLeCode);
}

/** Les points tranchés par le code. */
export function criteresDuCode(grille: CritereGrille[]): CritereGrille[] {
  return grille.filter((c) => c.mesureParLeCode);
}

/** Les familles, dans l'ordre où la grille les présente. */
export function famillesDeLaGrille(grille: CritereGrille[]): string[] {
  const out: string[] = [];
  for (const c of grille) if (!out.includes(c.famille)) out.push(c.famille);
  return out;
}
