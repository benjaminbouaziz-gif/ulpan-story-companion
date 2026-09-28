CREATE TYPE public.edition_etat AS ENUM ('absente','preparation','publiee');
ALTER TABLE public.books
  ADD COLUMN edition_fr public.edition_etat NOT NULL DEFAULT 'preparation',
  ADD COLUMN edition_en public.edition_etat NOT NULL DEFAULT 'absente',
  ADD COLUMN glossaire_fr_path text,
  ADD COLUMN glossaire_en_path text;
UPDATE public.books SET edition_fr = CASE WHEN status = 'published' THEN 'publiee'::public.edition_etat ELSE 'preparation'::public.edition_etat END, edition_en = 'absente';

DROP POLICY IF EXISTS books_public_read_published ON public.books;
CREATE POLICY books_public_read_published ON public.books FOR SELECT
  USING (edition_fr = 'publiee' OR edition_en = 'publiee');
DROP POLICY IF EXISTS "Public reads showcase glossary of published books" ON public.glossary_entries;
CREATE POLICY "Public reads showcase glossary of published books" ON public.glossary_entries FOR SELECT
  USING (is_showcase = true AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = glossary_entries.book_id AND (b.edition_fr = 'publiee' OR b.edition_en = 'publiee')));
DROP POLICY IF EXISTS "Public reads the double page of published books" ON public.spread_paragraphs;
CREATE POLICY "Public reads the double page of published books" ON public.spread_paragraphs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = spread_paragraphs.book_id AND (b.edition_fr = 'publiee' OR b.edition_en = 'publiee')));

ALTER TABLE public.quiz_questions ADD COLUMN lang text NOT NULL DEFAULT 'fr';
UPDATE public.quiz_questions SET lang = CASE WHEN coalesce(prompt_en,'') <> '' AND coalesce(prompt_fr,'') = '' THEN 'en' ELSE 'fr' END;
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_lang_check CHECK (lang IN ('fr','en'));
CREATE INDEX quiz_questions_book_lang_idx ON public.quiz_questions (book_id, lang);

DROP FUNCTION public.remplacer_quiz_livre(uuid, jsonb);
CREATE FUNCTION public.remplacer_quiz_livre(p_book_id uuid, p_lang text, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_n integer;
begin
  if p_lang is null or p_lang not in ('fr','en') then
    raise exception 'Langue de quiz invalide : %', p_lang;
  end if;
  delete from public.quiz_questions where book_id = p_book_id and lang = p_lang;
  insert into public.quiz_questions (book_id, lang, chapter_no, page_no, kind, prompt_fr, prompt_en, prompt_he, options, answer, explain_fr, explain_en, sort_order)
  select p_book_id, p_lang, (r->>'chapter_no')::int, nullif(r->>'page_no','')::int, (r->>'kind')::quiz_kind,
         r->>'prompt_fr', r->>'prompt_en', r->>'prompt_he', r->'options', r->'answer',
         r->>'explain_fr', r->>'explain_en', (r->>'sort_order')::int
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
REVOKE ALL ON FUNCTION public.remplacer_quiz_livre(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remplacer_quiz_livre(uuid, text, jsonb) TO service_role;

CREATE POLICY "glossaires lecture editeurs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'glossaires' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "glossaires ecriture editeurs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'glossaires' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "glossaires maj editeurs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'glossaires' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "glossaires suppression editeurs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'glossaires' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));