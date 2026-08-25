-- Le miroir : segments alignés hébreu / soutien.
CREATE TABLE public.excerpt_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_no int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 1,
  he_nikud text NOT NULL,
  he_plain text NOT NULL DEFAULT '',
  translit text,
  support_fr text,
  support_en text,
  hard_words_fr text,
  hard_words_en text,
  tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_start_ms int,
  audio_end_ms int,
  is_showcase boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX excerpt_segments_book_idx ON public.excerpt_segments (book_id, chapter_no, sort_order);
CREATE INDEX excerpt_segments_showcase_idx ON public.excerpt_segments (book_id) WHERE is_showcase;

GRANT SELECT ON public.excerpt_segments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.excerpt_segments TO authenticated;
GRANT ALL ON public.excerpt_segments TO service_role;

ALTER TABLE public.excerpt_segments ENABLE ROW LEVEL SECURITY;

-- Rôles applicatifs (table dédiée, jamais sur le profil).
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Lecture publique des segments des livres publiés.
CREATE POLICY "Public reads segments of published books" ON public.excerpt_segments
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = excerpt_segments.book_id AND b.status = 'published'
  ));

CREATE POLICY "Admins manage segments" ON public.excerpt_segments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER excerpt_segments_updated_at
  BEFORE UPDATE ON public.excerpt_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.excerpt_segments (book_id, chapter_no, sort_order, he_nikud, he_plain, translit, support_fr, support_en, hard_words_fr, hard_words_en, tokens, is_showcase) VALUES
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 1, 'אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם.', 'אלי כהן נולד במצרים.', 'Eli Cohen nolad be-Mitsrayim.', 'Eli Cohen est né en Égypte.', 'Eli Cohen was born in Egypt.', 'נוֹלַד — est né', 'נוֹלַד — was born', '[{"he_nikud": "אֵלִי", "he_plain": "אלי", "translit": "Eli", "gloss_fr": "Eli", "gloss_en": "Eli", "support_range_fr": [0, 3], "support_range_en": [0, 3], "is_hard": false}, {"he_nikud": "כֹּהֵן", "he_plain": "כהן", "translit": "Cohen", "gloss_fr": "Cohen", "gloss_en": "Cohen", "support_range_fr": [4, 9], "support_range_en": [4, 9], "is_hard": false}, {"he_nikud": "נוֹלַד", "he_plain": "נולד", "translit": "nolad", "gloss_fr": "est né", "gloss_en": "was born", "support_range_fr": [10, 16], "support_range_en": [10, 18], "is_hard": true}, {"he_nikud": "בְּמִצְרַיִם", "he_plain": "במצרים", "translit": "be-Mitsrayim", "gloss_fr": "en Égypte", "gloss_en": "in Egypt", "support_range_fr": [17, 26], "support_range_en": [19, 27], "is_hard": true}]'::jsonb, true),
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 2, 'הוּא לָמַד עִבְרִית בַּבַּיִת.', 'הוא למד עברית בבית.', 'Hou lamad ivrit ba-bayit.', 'Il a appris l''hébreu à la maison.', 'He learned Hebrew at home.', 'לָמַד — a appris · בַּבַּיִת — à la maison', 'לָמַד — learned · בַּבַּיִת — at home', '[{"he_nikud": "הוּא", "he_plain": "הוא", "translit": "hou", "gloss_fr": "Il", "gloss_en": "He", "support_range_fr": [0, 2], "support_range_en": [0, 2], "is_hard": false}, {"he_nikud": "לָמַד", "he_plain": "למד", "translit": "lamad", "gloss_fr": "a appris", "gloss_en": "learned", "support_range_fr": [3, 11], "support_range_en": [3, 10], "is_hard": true}, {"he_nikud": "עִבְרִית", "he_plain": "עברית", "translit": "ivrit", "gloss_fr": "l''hébreu", "gloss_en": "Hebrew", "support_range_fr": [12, 20], "support_range_en": [11, 17], "is_hard": false}, {"he_nikud": "בַּבַּיִת", "he_plain": "בבית", "translit": "ba-bayit", "gloss_fr": "à la maison", "gloss_en": "at home", "support_range_fr": [21, 32], "support_range_en": [18, 25], "is_hard": true}]'::jsonb, true),
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 3, 'וְעַרְבִית בָּרְחוֹב.', 'וערבית ברחוב.', 'Ve-arvit ba-rehov.', 'Et l''arabe dans la rue.', 'And Arabic in the street.', 'בָּרְחוֹב — dans la rue', 'בָּרְחוֹב — in the street', '[{"he_nikud": "וְעַרְבִית", "he_plain": "וערבית", "translit": "ve-arvit", "gloss_fr": "Et l''arabe", "gloss_en": "And Arabic", "support_range_fr": [0, 10], "support_range_en": [0, 10], "is_hard": false}, {"he_nikud": "בָּרְחוֹב", "he_plain": "ברחוב", "translit": "ba-rehov", "gloss_fr": "dans la rue", "gloss_en": "in the street", "support_range_fr": [11, 22], "support_range_en": [11, 24], "is_hard": true}]'::jsonb, true),
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 4, 'בְּיוֹם אֶחָד הוּא עָלָה לְיִשְׂרָאֵל.', 'ביום אחד הוא עלה לישראל.', 'Be-yom ehad hou ala le-Yisrael.', 'Un jour, il est monté en Israël.', 'One day, he came up to Israel.', 'עָלָה — est monté (a fait son alya)', 'עָלָה — came up (made aliyah)', '[{"he_nikud": "בְּיוֹם", "he_plain": "ביום", "translit": "be-yom", "gloss_fr": "Un jour", "gloss_en": "One day", "support_range_fr": [0, 7], "support_range_en": [0, 7], "is_hard": false}, {"he_nikud": "אֶחָד", "he_plain": "אחד", "translit": "ehad", "gloss_fr": "un", "gloss_en": "one", "support_range_fr": null, "support_range_en": null, "is_hard": false}, {"he_nikud": "הוּא", "he_plain": "הוא", "translit": "hou", "gloss_fr": "il", "gloss_en": "he", "support_range_fr": [9, 11], "support_range_en": [9, 11], "is_hard": false}, {"he_nikud": "עָלָה", "he_plain": "עלה", "translit": "ala", "gloss_fr": "est monté", "gloss_en": "came up", "support_range_fr": [12, 21], "support_range_en": [12, 19], "is_hard": true}, {"he_nikud": "לְיִשְׂרָאֵל", "he_plain": "לישראל", "translit": "le-Yisrael", "gloss_fr": "en Israël", "gloss_en": "to Israel", "support_range_fr": [22, 31], "support_range_en": [20, 29], "is_hard": false}]'::jsonb, true),
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 5, 'וּשְׁמוֹ הָיָה עוֹד שֵׁם אֶחָד בָּרְשִׁימָה.', 'ושמו היה עוד שם אחד ברשימה.', 'Ou-shmo haya od shem ehad ba-reshima.', 'Et son nom n''était qu''un nom de plus sur la liste.', 'And his name was just one more name on the list.', 'בָּרְשִׁימָה — sur la liste · עוֹד — de plus', 'בָּרְשִׁימָה — on the list · עוֹד — more', '[{"he_nikud": "וּשְׁמוֹ", "he_plain": "ושמו", "translit": "ou-shmo", "gloss_fr": "son nom", "gloss_en": "his name", "support_range_fr": [3, 10], "support_range_en": [4, 12], "is_hard": true}, {"he_nikud": "הָיָה", "he_plain": "היה", "translit": "haya", "gloss_fr": "n''était", "gloss_en": "was", "support_range_fr": [11, 18], "support_range_en": [13, 16], "is_hard": false}, {"he_nikud": "עוֹד", "he_plain": "עוד", "translit": "od", "gloss_fr": "de plus", "gloss_en": "more", "support_range_fr": [29, 36], "support_range_en": [26, 30], "is_hard": true}, {"he_nikud": "שֵׁם", "he_plain": "שם", "translit": "shem", "gloss_fr": "un nom", "gloss_en": "name", "support_range_fr": [22, 28], "support_range_en": [31, 35], "is_hard": false}, {"he_nikud": "אֶחָד", "he_plain": "אחד", "translit": "ehad", "gloss_fr": null, "gloss_en": null, "support_range_fr": null, "support_range_en": null, "is_hard": false}, {"he_nikud": "בָּרְשִׁימָה", "he_plain": "ברשימה", "translit": "ba-reshima", "gloss_fr": "sur la liste", "gloss_en": "on the list", "support_range_fr": [37, 49], "support_range_en": [36, 47], "is_hard": true}]'::jsonb, true),
  ((SELECT id FROM public.books WHERE slug = 'eli-cohen'), 1, 6, 'בְּדַמֶּשֶׂק קָרְאוּ לוֹ כָּאמֶל אָמִין תַּאבֶּת.', 'בדמשק קראו לו כאמל אמין תאבת.', 'Be-Damesek karou lo Kamel Amin Thabet.', 'À Damas, on l''appelait Kamel Amin Thaabet.', 'In Damascus, they called him Kamel Amin Thaabet.', 'קָרְאוּ לוֹ — on l''appelait', 'קָרְאוּ לוֹ — they called him', '[{"he_nikud": "בְּדַמֶּשֶׂק", "he_plain": "בדמשק", "translit": "be-Damesek", "gloss_fr": "À Damas", "gloss_en": "In Damascus", "support_range_fr": [0, 7], "support_range_en": [0, 11], "is_hard": true}, {"he_nikud": "קָרְאוּ", "he_plain": "קראו", "translit": "karou", "gloss_fr": "on l''appelait", "gloss_en": "they called", "support_range_fr": [9, 22], "support_range_en": [13, 24], "is_hard": true}, {"he_nikud": "לוֹ", "he_plain": "לו", "translit": "lo", "gloss_fr": null, "gloss_en": "him", "support_range_fr": null, "support_range_en": [25, 28], "is_hard": false}, {"he_nikud": "כָּאמֶל", "he_plain": "כאמל", "translit": "Kamel", "gloss_fr": "Kamel", "gloss_en": "Kamel", "support_range_fr": [23, 28], "support_range_en": [29, 34], "is_hard": false}, {"he_nikud": "אָמִין", "he_plain": "אמין", "translit": "Amin", "gloss_fr": "Amin", "gloss_en": "Amin", "support_range_fr": [29, 33], "support_range_en": [35, 39], "is_hard": false}, {"he_nikud": "תַּאבֶּת", "he_plain": "תאבת", "translit": "Thabet", "gloss_fr": "Thaabet", "gloss_en": "Thaabet", "support_range_fr": [34, 41], "support_range_en": [40, 47], "is_hard": false}]'::jsonb, true);