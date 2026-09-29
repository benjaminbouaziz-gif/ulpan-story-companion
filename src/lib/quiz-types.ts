/** Types neutres du quiz, partagés par l'admin (aperçu) et le compagnon (phase 7). */
export type QuizQuestion = {
  id: string;
  sort_order: number;
  chapter_no: number;
  page_no: number | null;
  kind: "qcm" | "trou";
  question: string;
  hebrew: string | null;
  options: string[];
  answer_index: number;
  explanation: string | null;
};

/** Dernière réponse d'un lecteur à une question. */
export type LastAnswer = { chosen_index: number; is_correct: boolean };
