import { RESERVED_SLUGS } from "@/i18n/routes";

/** Contrôle de forme d'un slug (partagé écran / serveur). Renvoie un code d'erreur ou null. */
export function slugProbleme(slug: string): "SLUG_EMPTY" | "SLUG_FORMAT" | "SLUG_RESERVED" | null {
  if (!slug) return "SLUG_EMPTY";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "SLUG_FORMAT";
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return "SLUG_RESERVED";
  return null;
}

/** Numéro de page lu dans un nom de fichier : le dernier nombre du nom (sans extension). */
export function pageDepuisNomFichier(name: string): number | null {
  const base = name.replace(/\.[^.]+$/, "");
  const m = /(\d+)(?!.*\d)/.exec(base);
  return m ? Number(m[1]) : null;
}

export function extensionAudio(name: string): "mp3" | "m4a" | null {
  const n = name.toLowerCase();
  if (n.endsWith(".mp3")) return "mp3";
  if (n.endsWith(".m4a")) return "m4a";
  return null;
}
