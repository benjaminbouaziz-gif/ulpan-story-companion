import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { analyserQuizJson, exporterQuizJson, type QuizAnalyse } from "./quiz-json";

/**
 * BRIQUE 9 — L'ONGLET QUIZ DE LA FICHE LIVRE.
 * Chaîne : requireSupabaseAuth → assertEditor (rôle lu en base) → getAdminClient.
 * L'import est tout ou rien, et l'analyse est toujours relancée ici.
 */

const idInput = z.object({ bookId: z.string().uuid() });
const contenuInput = z.object({ bookId: z.string().uuid(), contenu: z.string().max(2_000_000) });

type Admin = Awaited<ReturnType<typeof getAdminClient>>;

async function lireLivre(admin: Admin, bookId: string) {
  const { data: book } = await admin
    .from("books")
    .select("id, slug")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) throw new Error("BOOK_NOT_FOUND");
  const { data: pages } = await admin
    .from("book_pages")
    .select("page_no, chapter_no")
    .eq("book_id", bookId);
  return { slug: book.slug, pages: pages ?? [] };
}

export type AnalyseReponse = Omit<QuizAnalyse, "lignes">;

export const analyserQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => contenuInput.parse(d))
  .handler(async ({ context, data }): Promise<AnalyseReponse> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { slug, pages } = await lireLivre(admin, data.bookId);
    const { lignes: _l, ...rest } = analyserQuizJson(data.contenu, slug, pages);
    return rest;
  });

export const importerQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => contenuInput.parse(d))
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { slug, pages } = await lireLivre(admin, data.bookId);
    const a = analyserQuizJson(data.contenu, slug, pages);
    if (a.erreurs.length > 0) throw new Error("QUIZ_INVALID");
    const { data: n, error } = await admin.rpc("remplacer_quiz_livre", {
      p_book_id: data.bookId,
      p_rows: a.lignes as unknown as never,
    });
    if (error) throw new Error("QUIZ_WRITE_FAILED");
    return { inserted: (n as number) ?? 0 };
  });

export const exporterQuiz = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { slug } = await lireLivre(admin, data.bookId);
    const { data: rows } = await admin
      .from("quiz_questions")
      .select(
        "chapter_no, page_no, kind, prompt_fr, prompt_en, prompt_he, options, answer, explain_fr, explain_en",
      )
      .eq("book_id", data.bookId)
      .order("sort_order", { ascending: true });
    return { slug, json: exporterQuizJson(slug, rows ?? []) };
  });

export type QuizStatChapitre = {
  chapitre: number;
  titre: string | null;
  questions: number;
  reponses: number;
  tauxJuste: number | null;
  pireQuestion: { texte: string; tauxEchec: number } | null;
};

export const statsQuiz = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const [{ data: qs }, { data: ans }, { data: pages }] = await Promise.all([
      admin
        .from("quiz_questions")
        .select("id, chapter_no, prompt_he, prompt_fr, prompt_en")
        .eq("book_id", data.bookId),
      admin.from("quiz_answers").select("question_id, is_correct").eq("book_id", data.bookId),
      admin
        .from("book_pages")
        .select("chapter_no, chapter_title_fr, page_no")
        .eq("book_id", data.bookId)
        .order("page_no", { ascending: true }),
    ]);
    const titres = new Map<number, string | null>();
    for (const p of pages ?? [])
      if (p.chapter_no != null && !titres.get(p.chapter_no))
        titres.set(p.chapter_no, p.chapter_title_fr);

    const parQ = new Map<string, { n: number; ok: number }>();
    for (const a of ans ?? []) {
      const s = parQ.get(a.question_id) ?? { n: 0, ok: 0 };
      s.n++;
      if (a.is_correct) s.ok++;
      parQ.set(a.question_id, s);
    }
    const chap = new Map<number, QuizStatChapitre>();
    for (const q of qs ?? []) {
      const c = q.chapter_no ?? 0;
      const cur =
        chap.get(c) ??
        ({
          chapitre: c,
          titre: titres.get(c) ?? null,
          questions: 0,
          reponses: 0,
          tauxJuste: null,
          pireQuestion: null,
          _ok: 0,
        } as QuizStatChapitre & { _ok: number });
      cur.questions++;
      const s = parQ.get(q.id);
      if (s) {
        cur.reponses += s.n;
        (cur as QuizStatChapitre & { _ok: number })._ok += s.ok;
        if (s.n >= 5) {
          const echec = (s.n - s.ok) / s.n;
          if (!cur.pireQuestion || echec > cur.pireQuestion.tauxEchec)
            cur.pireQuestion = {
              texte: q.prompt_he || q.prompt_fr || q.prompt_en || "",
              tauxEchec: echec,
            };
        }
      }
      chap.set(c, cur);
    }
    const chapitres = [...chap.values()]
      .sort((a, b) => a.chapitre - b.chapitre)
      .map((c) => {
        const ok = (c as QuizStatChapitre & { _ok: number })._ok;
        return {
          chapitre: c.chapitre,
          titre: c.titre,
          questions: c.questions,
          reponses: c.reponses,
          tauxJuste: c.reponses > 0 ? ok / c.reponses : null,
          pireQuestion: c.pireQuestion,
        } satisfies QuizStatChapitre;
      });
    return { total: (qs ?? []).length, chapitres };
  });
