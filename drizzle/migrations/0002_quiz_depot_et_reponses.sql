ALTER TABLE public.quiz_questions ADD COLUMN page_no integer NULL;

CREATE OR REPLACE FUNCTION public.remplacer_quiz_livre(p_book_id uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_n integer;
begin
  delete from public.quiz_questions where book_id = p_book_id;
  insert into public.quiz_questions (book_id, chapter_no, page_no, kind, prompt_fr, prompt_en, prompt_he, options, answer, explain_fr, explain_en, sort_order)
  select p_book_id, (r->>'chapter_no')::int, nullif(r->>'page_no','')::int, (r->>'kind')::quiz_kind,
         r->>'prompt_fr', r->>'prompt_en', r->>'prompt_he', r->'options', r->'answer',
         r->>'explain_fr', r->>'explain_en', (r->>'sort_order')::int
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
REVOKE ALL ON FUNCTION public.remplacer_quiz_livre(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remplacer_quiz_livre(uuid, jsonb) TO service_role;

CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  chosen_index integer NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_answers_user_book_idx ON public.quiz_answers (user_id, book_id);
CREATE INDEX quiz_answers_question_idx ON public.quiz_answers (question_id);
GRANT SELECT, INSERT ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecteur lit ses réponses" ON public.quiz_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Lecteur ajoute ses réponses" ON public.quiz_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);