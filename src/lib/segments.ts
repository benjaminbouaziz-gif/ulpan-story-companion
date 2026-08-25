import type { Lang } from "@/i18n/dictionaries";

/**
 * Le miroir : un segment d'hébreu vocalisé, sa traduction de soutien, et
 * l'alignement mot à mot entre les deux. Tout ce fichier est sans effet de
 * bord : il sert au composant comme à l'outil d'alignement.
 */

export type MirrorToken = {
  he_nikud: string;
  he_plain?: string | null;
  translit?: string | null;
  gloss_fr?: string | null;
  gloss_en?: string | null;
  note_fr?: string | null;
  note_en?: string | null;
  support_range_fr?: [number, number] | null;
  support_range_en?: [number, number] | null;
  is_hard?: boolean;
};

export type MirrorSegment = {
  id: string;
  chapter_no: number;
  sort_order: number;
  he_nikud: string;
  he_plain: string;
  translit: string | null;
  support_fr: string | null;
  support_en: string | null;
  hard_words_fr: string | null;
  hard_words_en: string | null;
  tokens: MirrorToken[];
};

/** Les six crans du soutien, du plus porté au plus nu. */
export type SupportLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const SUPPORT_LEVELS: SupportLevel[] = [1, 2, 3, 4, 5, 6];

export const LEVEL_LABELS: Record<Lang, Record<SupportLevel, string>> = {
  fr: {
    1: "Mot à mot",
    2: "Phrase traduite",
    3: "Mots difficiles",
    4: "Glossaire seul",
    5: "Sans voyelles",
    6: "Hébreu seul",
  },
  en: {
    1: "Word by word",
    2: "Sentence translated",
    3: "Hard words only",
    4: "Glossary only",
    5: "Without nikud",
    6: "Hebrew alone",
  },
};

export const LEVEL_HINTS: Record<Lang, Record<SupportLevel, string>> = {
  fr: {
    1: "Chaque mot hébreu répond à un morceau de la traduction. Touchez un mot.",
    2: "La phrase entière est traduite, mais plus mot à mot.",
    3: "Seuls les mots que vous ne pouvez pas encore deviner restent traduits.",
    4: "Plus de traduction sur la page : touchez un mot pour ouvrir le glossaire.",
    5: "Les nekoudot disparaissent. Vous avez déjà entendu ces mots.",
    6: "L'hébreu seul. C'est là que le livre vous laisse.",
  },
  en: {
    1: "Every Hebrew word maps to a piece of the translation. Tap a word.",
    2: "The whole sentence is translated, but no longer word by word.",
    3: "Only the words you cannot guess yet stay translated.",
    4: "No translation on the page: tap a word to open the glossary.",
    5: "The nikud is gone. You have already heard these words.",
    6: "Hebrew alone. This is where the book leaves you.",
  },
};

const NIKUD = /[\u0591-\u05C7]/g;

/** Retire les nekoudot et la cantillation, sans toucher aux lettres. */
export function stripNikud(text: string): string {
  return text.replace(NIKUD, "");
}

export function parseTokens(raw: unknown): MirrorToken[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const t = item as Record<string, unknown>;
    if (typeof t["he_nikud"] !== "string") return [];
    return [
      {
        he_nikud: t["he_nikud"],
        he_plain: typeof t["he_plain"] === "string" ? t["he_plain"] : stripNikud(t["he_nikud"]),
        translit: typeof t["translit"] === "string" ? t["translit"] : null,
        gloss_fr: typeof t["gloss_fr"] === "string" ? t["gloss_fr"] : null,
        gloss_en: typeof t["gloss_en"] === "string" ? t["gloss_en"] : null,
        note_fr: typeof t["note_fr"] === "string" ? t["note_fr"] : null,
        note_en: typeof t["note_en"] === "string" ? t["note_en"] : null,
        support_range_fr: parseRange(t["support_range_fr"]),
        support_range_en: parseRange(t["support_range_en"]),
        is_hard: t["is_hard"] === true,
      },
    ];
  });
}

function parseRange(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b] = value;
  if (typeof a !== "number" || typeof b !== "number" || b <= a || a < 0) return null;
  return [a, b];
}

export function tokenHebrew(token: MirrorToken, plain: boolean): string {
  if (!plain) return token.he_nikud;
  return token.he_plain && token.he_plain.length > 0 ? token.he_plain : stripNikud(token.he_nikud);
}

export function tokenGloss(token: MirrorToken, lang: Lang): string | null {
  const primary = lang === "en" ? token.gloss_en : token.gloss_fr;
  const fallback = lang === "en" ? token.gloss_fr : token.gloss_en;
  return primary ?? fallback ?? null;
}

export function tokenNote(token: MirrorToken, lang: Lang): string | null {
  return (lang === "en" ? token.note_en : token.note_fr) ?? null;
}

export function tokenRange(token: MirrorToken, lang: Lang): [number, number] | null {
  return (lang === "en" ? token.support_range_en : token.support_range_fr) ?? null;
}

export function segmentSupport(segment: MirrorSegment, lang: Lang): string | null {
  const primary = lang === "en" ? segment.support_en : segment.support_fr;
  const fallback = lang === "en" ? segment.support_fr : segment.support_en;
  return primary ?? fallback ?? null;
}

export function segmentHardWords(segment: MirrorSegment, lang: Lang): string | null {
  return (lang === "en" ? segment.hard_words_en : segment.hard_words_fr) ?? null;
}

export type SupportPiece = { text: string; tokenIndex: number | null };

/**
 * Découpe la traduction de soutien selon les bornes déclarées par les jetons,
 * pour que toucher un mot hébreu allume exactement le morceau correspondant.
 * Les bornes qui se chevauchent sont ignorées : le premier arrivé gagne.
 */
export function splitSupport(
  support: string,
  tokens: MirrorToken[],
  lang: Lang,
): SupportPiece[] {
  const ranges = tokens
    .map((token, tokenIndex) => ({ range: tokenRange(token, lang), tokenIndex }))
    .flatMap(({ range, tokenIndex }) =>
      range && range[1] <= support.length ? [{ start: range[0], end: range[1], tokenIndex }] : [],
    )
    .sort((a, b) => a.start - b.start);

  const pieces: SupportPiece[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue;
    if (r.start > cursor) pieces.push({ text: support.slice(cursor, r.start), tokenIndex: null });
    pieces.push({ text: support.slice(r.start, r.end), tokenIndex: r.tokenIndex });
    cursor = r.end;
  }
  if (cursor < support.length) pieces.push({ text: support.slice(cursor), tokenIndex: null });
  return pieces;
}

/** Ce que le cran de soutien affiche à droite (ou dessous, sur mobile). */
export function levelShows(level: SupportLevel): {
  plainHebrew: boolean;
  wordByWord: boolean;
  sentence: boolean;
  hardWords: boolean;
} {
  switch (level) {
    case 1:
      return { plainHebrew: false, wordByWord: true, sentence: true, hardWords: false };
    case 2:
      return { plainHebrew: false, wordByWord: false, sentence: true, hardWords: false };
    case 3:
      return { plainHebrew: false, wordByWord: false, sentence: false, hardWords: true };
    case 4:
      return { plainHebrew: false, wordByWord: false, sentence: false, hardWords: false };
    case 5:
      return { plainHebrew: true, wordByWord: false, sentence: false, hardWords: true };
    case 6:
    default:
      return { plainHebrew: true, wordByWord: false, sentence: false, hardWords: false };
  }
}
