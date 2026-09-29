import { slugProbleme } from "@/lib/slug";
import { NUANCIER } from "@/lib/nuancier";

/**
 * Analyse PURE d'une fiche livre JSON (contrat : docs/contrat-fiche-livre.md).
 * Aucune base ici : le serveur ajoute ensuite les contrôles qui en dépendent.
 */
export type Langue = "fr" | "en";
export type ProblemeFiche = { champ: string; langue: Langue | null; probleme: string };

export type FicheCollection = {
  slug: string;
  couleur: string | null;
  ordre: number | null;
  textes: Partial<Record<Langue, { nom: string; accroche: string | null; description: string | null; pourQui: string | null }>>;
};
export type FicheTitre = { chapitre: number; titre: string };
export type FicheEdition = {
  titre: string;
  sousTitre: string | null;
  resume: string | null;
  noteNiveau: string | null;
  apprendrez: string[];
  pagesImprimees: number | null;
  lienAmazon: string | null;
  titresChapitre: FicheTitre[];
};
export type Fiche = {
  collection: FicheCollection | null;
  livre: {
    slug: string;
    ancienSlug: string | null;
    collection: string;
    tome: number | null;
    titreHebreu: string | null;
    nombreChapitres: number | null;
    nombreMotsVocabulaire: number | null;
    titresChapitreHebreu: FicheTitre[];
  };
  editions: Partial<Record<Langue, FicheEdition>>;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const LANGS: Langue[] = ["fr", "en"];

export function analyserFicheJson(src: string): { fiche: Fiche | null; erreurs: ProblemeFiche[] } {
  const erreurs: ProblemeFiche[] = [];
  const err = (champ: string, langue: Langue | null, probleme: string) => erreurs.push({ champ, langue, probleme });

  let root: unknown;
  try {
    root = JSON.parse(src);
  } catch {
    err("(fichier)", null, "JSON illisible");
    return { fiche: null, erreurs };
  }
  if (!isObj(root)) {
    err("(fichier)", null, "le fichier doit être un objet { collection, livre, editions }");
    return { fiche: null, erreurs };
  }

  const inconnus = (o: Obj, permis: string[], chemin: string, langue: Langue | null) => {
    for (const k of Object.keys(o)) if (!permis.includes(k)) err(`${chemin}${chemin ? "." : ""}${k}`, langue, "champ inconnu");
  };
  const texte = (o: Obj, k: string, chemin: string, max: number, langue: Langue | null, oblig: boolean): string | null => {
    const v = o[k];
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
      if (oblig) err(`${chemin}.${k}`, langue, "champ obligatoire manquant");
      return null;
    }
    if (typeof v !== "string") { err(`${chemin}.${k}`, langue, "doit être un texte"); return null; }
    const t = v.trim();
    if (t.length > max) { err(`${chemin}.${k}`, langue, `trop long : ${t.length} caractères (maximum ${max})`); return null; }
    return t;
  };
  const entier = (o: Obj, k: string, chemin: string, min: number, max: number, langue: Langue | null): number | null => {
    const v = o[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
      err(`${chemin}.${k}`, langue, `doit être un nombre entier entre ${min} et ${max}`);
      return null;
    }
    return v;
  };
  const titres = (o: Obj, k: string, chemin: string, langue: Langue | null): FicheTitre[] => {
    const v = o[k];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.length > 1000) { err(`${chemin}.${k}`, langue, "doit être une liste (1000 au plus) de { chapitre, titre }"); return []; }
    const out: FicheTitre[] = [];
    const vus = new Set<number>();
    v.forEach((t, i) => {
      const c = `${chemin}.${k}[${i}]`;
      if (!isObj(t)) { err(c, langue, "doit être un objet { chapitre, titre }"); return; }
      inconnus(t, ["chapitre", "titre"], c, langue);
      const n = t["chapitre"];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 10000) { err(`${c}.chapitre`, langue, "doit être un nombre entier entre 1 et 10000"); return; }
      if (vus.has(n)) { err(`${c}.chapitre`, langue, `chapitre ${n} en double`); return; }
      vus.add(n);
      const ti = texte(t, "titre", c, 500, langue, true);
      if (ti) out.push({ chapitre: n, titre: ti });
    });
    return out;
  };
  const slug = (v: unknown, champ: string, oblig: boolean): string | null => {
    if (v === undefined || v === null || v === "") { if (oblig) err(champ, null, "champ obligatoire manquant"); return null; }
    if (typeof v !== "string") { err(champ, null, "doit être un texte"); return null; }
    if (v.length > 80) { err(champ, null, "trop long (maximum 80 caractères)"); return null; }
    const p = slugProbleme(v);
    if (p === "SLUG_FORMAT") { err(champ, null, "format invalide : minuscules, chiffres et tirets seulement (ex. eli-cohen)"); return null; }
    if (p === "SLUG_RESERVED") { err(champ, null, "adresse réservée par le site"); return null; }
    return v;
  };

  inconnus(root, ["collection", "livre", "editions"], "", null);

  /* collection (facultatif) */
  let collection: FicheCollection | null = null;
  const rc = root["collection"];
  if (rc !== undefined && rc !== null) {
    if (!isObj(rc)) err("collection", null, "doit être un objet");
    else {
      inconnus(rc, ["slug", "couleur", "ordre", "fr", "en"], "collection", null);
      const s = slug(rc["slug"], "collection.slug", true);
      let couleur: string | null = null;
      if (rc["couleur"] !== undefined && rc["couleur"] !== null) {
        const c = typeof rc["couleur"] === "string" ? rc["couleur"].toLowerCase() : "";
        if (!(NUANCIER as readonly string[]).includes(c)) err("collection.couleur", null, `doit être une couleur du nuancier : ${NUANCIER.join(", ")}`);
        else couleur = c;
      }
      const ordre = entier(rc, "ordre", "collection", 0, 100000, null);
      const textes: FicheCollection["textes"] = {};
      for (const l of LANGS) {
        const t = rc[l];
        if (t === undefined || t === null) continue;
        if (!isObj(t)) { err(`collection.${l}`, l, "doit être un objet"); continue; }
        inconnus(t, ["nom", "accroche", "description", "pour_qui"], `collection.${l}`, l);
        const nom = texte(t, "nom", `collection.${l}`, 300, l, true);
        const accroche = texte(t, "accroche", `collection.${l}`, 500, l, false);
        const description = texte(t, "description", `collection.${l}`, 10000, l, false);
        const pourQui = texte(t, "pour_qui", `collection.${l}`, 5000, l, false);
        if (nom) textes[l] = { nom, accroche, description, pourQui };
      }
      if (s) collection = { slug: s, couleur, ordre, textes };
    }
  }

  /* livre (obligatoire) */
  let livre: Fiche["livre"] | null = null;
  const rl = root["livre"];
  if (!isObj(rl)) err("livre", null, rl === undefined ? "bloc obligatoire manquant" : "doit être un objet");
  else {
    inconnus(rl, ["slug", "ancien_slug", "collection", "tome", "titre_hebreu", "nombre_chapitres", "nombre_mots_vocabulaire", "titres_chapitre_hebreu"], "livre", null);
    const s = slug(rl["slug"], "livre.slug", true);
    const ancien = slug(rl["ancien_slug"], "livre.ancien_slug", false);
    const col = slug(rl["collection"], "livre.collection", true);
    if (collection && col && collection.slug !== col) err("collection.slug", null, `diffère de livre.collection (« ${col} »)`);
    const l = {
      tome: entier(rl, "tome", "livre", 0, 100000, null),
      titreHebreu: texte(rl, "titre_hebreu", "livre", 500, null, false),
      nombreChapitres: entier(rl, "nombre_chapitres", "livre", 0, 100000, null),
      nombreMotsVocabulaire: entier(rl, "nombre_mots_vocabulaire", "livre", 0, 100000, null),
      titresChapitreHebreu: titres(rl, "titres_chapitre_hebreu", "livre", null),
    };
    if (s && col) livre = { slug: s, ancienSlug: ancien && ancien !== s ? ancien : null, collection: col, ...l };
  }

  /* éditions (au moins une) */
  const editions: Fiche["editions"] = {};
  const re = root["editions"];
  if (!isObj(re)) err("editions", null, re === undefined ? "bloc obligatoire manquant" : "doit être un objet { fr, en }");
  else {
    inconnus(re, LANGS, "editions", null);
    if (!LANGS.some((l) => re[l] !== undefined && re[l] !== null)) err("editions", null, "au moins une édition (fr ou en) est obligatoire");
    for (const l of LANGS) {
      const e = re[l];
      if (e === undefined || e === null) continue;
      const c = `editions.${l}`;
      if (!isObj(e)) { err(c, l, "doit être un objet"); continue; }
      inconnus(e, ["titre", "sous_titre", "resume", "note_niveau", "ce_que_vous_apprendrez", "pages_imprimees", "lien_amazon", "titres_chapitre"], c, l);
      const titre = texte(e, "titre", c, 300, l, true);
      const sousTitre = texte(e, "sous_titre", c, 300, l, false);
      const resume = texte(e, "resume", c, 5000, l, false);
      const noteNiveau = texte(e, "note_niveau", c, 500, l, false);
      const apprendrez: string[] = [];
      const ap = e["ce_que_vous_apprendrez"];
      if (ap !== undefined && ap !== null) {
        if (!Array.isArray(ap) || ap.length > 50) err(`${c}.ce_que_vous_apprendrez`, l, "doit être une liste de 50 textes au plus");
        else ap.forEach((x, i) => {
          if (typeof x !== "string") err(`${c}.ce_que_vous_apprendrez[${i}]`, l, "doit être un texte");
          else if (x.trim().length > 500) err(`${c}.ce_que_vous_apprendrez[${i}]`, l, `trop long : ${x.trim().length} caractères (maximum 500)`);
          else if (x.trim()) apprendrez.push(x.trim());
        });
      }
      const pagesImprimees = entier(e, "pages_imprimees", c, 1, 10000, l);
      let lienAmazon = texte(e, "lien_amazon", c, 1000, l, false);
      if (lienAmazon && !/^https:\/\/\S+$/.test(lienAmazon)) { err(`${c}.lien_amazon`, l, "doit commencer par https:// et ne contenir aucun espace"); lienAmazon = null; }
      const titresChapitre = titres(e, "titres_chapitre", c, l);
      if (titre) editions[l] = { titre, sousTitre, resume, noteNiveau, apprendrez, pagesImprimees, lienAmazon, titresChapitre };
    }
  }

  return { fiche: erreurs.length || !livre ? null : { collection, livre, editions }, erreurs };
}

export function ligneProbleme(p: ProblemeFiche): string {
  return `${p.champ}${p.langue ? ` [${p.langue.toUpperCase()}]` : ""} — ${p.probleme}`;
}
