DROP TABLE IF EXISTS public.excerpt_segments CASCADE;

CREATE TABLE public.excerpt_paragraphs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  stage_no integer NOT NULL DEFAULT 1,
  stage_label_fr text,
  stage_label_en text,
  he text NOT NULL,
  has_nikud boolean NOT NULL DEFAULT true,
  support_fr text,
  support_en text,
  audio_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX excerpt_paragraphs_book_order_idx ON public.excerpt_paragraphs (book_id, sort_order);

GRANT SELECT ON public.excerpt_paragraphs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.excerpt_paragraphs TO authenticated;
GRANT ALL ON public.excerpt_paragraphs TO service_role;

ALTER TABLE public.excerpt_paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads paragraphs of published books"
  ON public.excerpt_paragraphs FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = excerpt_paragraphs.book_id AND b.status = 'published'));

CREATE POLICY "Admins manage paragraphs"
  ON public.excerpt_paragraphs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER excerpt_paragraphs_updated_at BEFORE UPDATE ON public.excerpt_paragraphs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.glossary_entries ADD COLUMN IF NOT EXISTS is_showcase boolean NOT NULL DEFAULT false;
GRANT SELECT ON public.glossary_entries TO anon;
CREATE POLICY "Public reads showcase glossary of published books"
  ON public.glossary_entries FOR SELECT TO anon, authenticated
  USING (is_showcase = true AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = glossary_entries.book_id AND b.status = 'published'));

INSERT INTO public.excerpt_paragraphs (book_id, sort_order, stage_no, stage_label_fr, stage_label_en, he, has_nikud, support_fr, support_en)
SELECT b.id, v.sort_order, v.stage_no, v.lf, v.le, v.he, v.nik, v.sfr, v.sen
FROM public.books b, (VALUES
  (1, 1, 'Traduction complète', 'Full translation', 'אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם, בְּבַיִת שֶׁדִּבְּרוּ בּוֹ עִבְרִית וְעַרְבִית.', true, 'Eli Cohen est né en Égypte, dans une maison où l''on parlait hébreu et arabe.', 'Eli Cohen was born in Egypt, in a house where Hebrew and Arabic were spoken.'),
  (2, 2, 'Traduction complète', 'Full translation', 'הוּא לָמַד עִבְרִית בַּבַּיִת וְעַרְבִית בָּרְחוֹב, וְאִיש לֹא רָאָה בּוֹ דָּבָר מְיֻחָד.', true, 'Il a appris l''hébreu à la maison et l''arabe dans la rue, et personne ne voyait en lui rien de particulier.', 'He learned Hebrew at home and Arabic in the street, and no one saw anything special in him.'),
  (3, 3, 'Mots difficiles', 'Hard words', 'בְּיוֹם אֶחָד הוּא עָלָה לְיִשְׂרָאֵל, וּשְׁמוֹ הָיָה עוֹד שֵׁם אֶחָד בָּרְשִׁימָה.', true, 'עָלָה — est monté (a fait son alya) · בָּרְשִׁימָה — sur la liste', 'עָלָה — went up (made aliyah) · בָּרְשִׁימָה — on the list'),
  (4, 4, 'Mots difficiles', 'Hard words', 'אֲנָשִׁים בָּאוּ אֵלָיו וְשָׁאֲלוּ אוֹתוֹ שְׁאֵלוֹת, וְהוּא עָנָה בְּשֶׁקֶט.', true, 'שְׁאֵלוֹת — des questions · בְּשֶׁקֶט — calmement', 'שְׁאֵלוֹת — questions · בְּשֶׁקֶט — quietly'),
  (5, 5, 'Sans nekoudot', 'Without nikud', 'אחרי חודשים של אימונים הוא נסע לדמשק, לבד, עם שם חדש.', false, 'אימונים — des entraînements · לבד — seul', 'אימונים — training · לבד — alone'),
  (6, 6, 'Hébreu seul', 'Hebrew alone', 'בדמשק קראו לו כאמל אמין תאבת.', false, NULL, NULL)
) AS v(sort_order, stage_no, lf, le, he, nik, sfr, sen)
WHERE b.slug = 'eli-cohen';

INSERT INTO public.glossary_entries (book_id, sort_order, chapter_no, lemma_he, sense_fr, sense_en, is_showcase)
SELECT b.id, v.so, 1, v.lemma, v.fr, v.en, true
FROM public.books b, (VALUES
  (1, 'נוֹלַד', 'est né', 'was born'),
  (2, 'לָמַד', 'a appris', 'learned'),
  (3, 'בָּרְחוֹב', 'dans la rue', 'in the street'),
  (4, 'עָלָה', 'est monté, a fait son alya', 'went up, made aliyah'),
  (5, 'רְשִׁימָה', 'liste', 'list'),
  (6, 'שְׁאֵלָה', 'question', 'question'),
  (7, 'שֶׁקֶט', 'calme, silence', 'quiet, silence'),
  (8, 'אִימוּן', 'entraînement', 'training'),
  (9, 'לְבַד', 'seul', 'alone'),
  (10, 'קָרְאוּ לוֹ', 'on l''appelait', 'they called him')
) AS v(so, lemma, fr, en)
WHERE b.slug = 'eli-cohen';