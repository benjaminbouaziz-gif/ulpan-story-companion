
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS spread_running_head_fr text,
  ADD COLUMN IF NOT EXISTS spread_running_head_en text,
  ADD COLUMN IF NOT EXISTS spread_chapter_fr text,
  ADD COLUMN IF NOT EXISTS spread_chapter_en text,
  ADD COLUMN IF NOT EXISTS spread_folio_left int DEFAULT 42;

CREATE TABLE IF NOT EXISTS public.spread_paragraphs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 1,
  stage_no int NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
  he text NOT NULL,
  he_has_nikud boolean NOT NULL DEFAULT true,
  support_kind text NOT NULL DEFAULT 'translation'
    CHECK (support_kind IN ('translation','cloze','vocabulary','nikud')),
  support_fr text,
  support_en text,
  support_he text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spread_paragraphs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spread_paragraphs TO authenticated;
GRANT ALL ON public.spread_paragraphs TO service_role;

ALTER TABLE public.spread_paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads the double page of published books"
ON public.spread_paragraphs FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.books b
  WHERE b.id = spread_paragraphs.book_id AND b.status = 'published'
));

CREATE POLICY "Editors manage the double page"
ON public.spread_paragraphs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX IF NOT EXISTS spread_paragraphs_book_order_idx
  ON public.spread_paragraphs (book_id, sort_order);

CREATE TRIGGER update_spread_paragraphs_updated_at
  BEFORE UPDATE ON public.spread_paragraphs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.books SET
  spread_running_head_fr = COALESCE(spread_running_head_fr, title_fr),
  spread_running_head_en = COALESCE(spread_running_head_en, title_en),
  spread_chapter_fr = COALESCE(spread_chapter_fr, 'Chapitre trois'),
  spread_chapter_en = COALESCE(spread_chapter_en, 'Chapter three'),
  spread_folio_left = COALESCE(spread_folio_left, 42);

INSERT INTO public.spread_paragraphs
  (book_id, sort_order, stage_no, he, he_has_nikud, support_kind, support_fr, support_en, support_he)
SELECT b.id, 1, 1,
  'אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם, בְּבַיִת שֶׁדִּבְּרוּ בּוֹ עִבְרִית וְעַרְבִית.',
  true, 'translation',
  'Eli Cohen est né en Égypte, dans une maison où l''on parlait hébreu et arabe.',
  'Eli Cohen was born in Egypt, in a house where Hebrew and Arabic were spoken.',
  NULL
FROM public.books b WHERE b.slug = 'eli-cohen';

INSERT INTO public.spread_paragraphs
  (book_id, sort_order, stage_no, he, he_has_nikud, support_kind, support_fr, support_en, support_he)
SELECT b.id, 2, 2,
  'הוּא לָמַד עִבְרִית בַּבַּיִת וְעַרְבִית בָּרְחוֹב, וְאִישׁ לֹא רָאָה בּוֹ דָּבָר מְיֻחָד.',
  true, 'cloze',
  'Il a appris l''hébreu à la [[bayit]] et l''arabe dans la [[rehov]], et personne ne voyait en lui rien de [[meyouhad]].',
  'He learned Hebrew at [[bayit]] and Arabic in the [[rehov]], and no one saw anything [[meyouhad]] about him.',
  NULL
FROM public.books b WHERE b.slug = 'eli-cohen';

INSERT INTO public.spread_paragraphs
  (book_id, sort_order, stage_no, he, he_has_nikud, support_kind, support_fr, support_en, support_he)
SELECT b.id, 3, 3,
  'בְּיוֹם אֶחָד הוּא עָלָה לְיִשְׂרָאֵל, וּשְׁמוֹ הָיָה עוֹד שֵׁם אֶחָד בָּרְשִׁימָה.',
  true, 'vocabulary',
  'עָלָה — est monté, a fait son alya · רְשִׁימָה — une liste · שֵׁם — un nom',
  'עָלָה — went up, made aliyah · רְשִׁימָה — a list · שֵׁם — a name',
  NULL
FROM public.books b WHERE b.slug = 'eli-cohen';

INSERT INTO public.spread_paragraphs
  (book_id, sort_order, stage_no, he, he_has_nikud, support_kind, support_fr, support_en, support_he)
SELECT b.id, 4, 4,
  'אחרי חודשים של אימונים הוא נסע לדמשק, לבד, עם שם חדש.',
  false, 'nikud', NULL, NULL,
  'אַחֲרֵי חֳדָשִׁים שֶׁל אִימּוּנִים הוּא נָסַע לְדַמֶּשֶׂק, לְבַד, עִם שֵׁם חָדָשׁ.'
FROM public.books b WHERE b.slug = 'eli-cohen';

DROP TABLE IF EXISTS public.excerpt_paragraphs;
