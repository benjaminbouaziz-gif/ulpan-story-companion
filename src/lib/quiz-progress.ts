import type { LastAnswer, QuizQuestion } from "./companion.functions";

/**
 * BRIQUE 9 — les états de l'entraînement. Module pur : tout se calcule depuis
 * la dernière réponse du lecteur à chaque question.
 */
export type Answers = Record<string, LastAnswer>;

/** L'ordre du livre : chapitre, page, puis position dans le fichier. */
export function ordreLivre(a: QuizQuestion, b: QuizQuestion): number {
  return (
    (a.chapter_no ?? 0) - (b.chapter_no ?? 0) ||
    (a.page_no ?? 0) - (b.page_no ?? 0) ||
    a.sort_order - b.sort_order
  );
}

export function aRevoir(questions: QuizQuestion[], last: Answers): QuizQuestion[] {
  return questions.filter((q) => last[q.id] && !last[q.id]!.is_correct).sort(ordreLivre);
}

export function questionsDuChapitre(questions: QuizQuestion[], chapter: number): QuizQuestion[] {
  return questions
    .filter((q) => q.chapter_no === chapter)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function etatChapitre(questions: QuizQuestion[], last: Answers, chapter: number) {
  const qs = questionsDuChapitre(questions, chapter);
  const justes = qs.filter((q) => last[q.id]?.is_correct).length;
  const commence = qs.some((q) => !!last[q.id]);
  const complet = qs.length > 0 && qs.every((q) => !!last[q.id]);
  return { n: qs.length, justes, reussite: qs.length ? justes / qs.length : 0, commence, complet };
}

/** Le premier chapitre qui a des questions dont au moins une est sans réponse. */
export function chapitrePropose(
  chapters: number[],
  questions: QuizQuestion[],
  last: Answers,
): number | null {
  for (const c of [...chapters].sort((a, b) => a - b)) {
    const e = etatChapitre(questions, last, c);
    if (e.n > 0 && !e.complet) return c;
  }
  return null;
}

export function toutEnHebreu(options: string[]): boolean {
  return options.length > 0 && options.every((o) => /[\u0590-\u05FF]/.test(o));
}
