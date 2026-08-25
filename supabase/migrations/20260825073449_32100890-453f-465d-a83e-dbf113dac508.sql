-- Enums
CREATE TYPE public.book_status AS ENUM ('idea','writing','vocalizing','proofreading','layout','bat_ok','printing','published','retired');
CREATE TYPE public.page_status AS ENUM ('draft','published');
CREATE TYPE public.section_kind AS ENUM ('heading','richtext','quote','steps','compare','hebrew_sample','faq','cta');
CREATE TYPE public.quiz_kind AS ENUM ('qcm','trou','ordre','ecoute');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- collections
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#15171A',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tagline_fr TEXT, tagline_en TEXT,
  description_fr TEXT, description_en TEXT,
  for_whom_fr TEXT, for_whom_en TEXT,
  hero_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collections TO anon, authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- books
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  tome_no INTEGER,
  title_fr TEXT NOT NULL,
  title_en TEXT,
  title_he TEXT,
  subtitle_fr TEXT, subtitle_en TEXT,
  blurb_fr TEXT, blurb_en TEXT,
  level_note_fr TEXT, level_note_en TEXT,
  excerpt_he TEXT,
  excerpt_translation_fr TEXT, excerpt_translation_en TEXT,
  what_you_learn_fr JSONB NOT NULL DEFAULT '[]'::jsonb,
  what_you_learn_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  chapters_count INTEGER,
  words_unique INTEGER,
  page_count INTEGER,
  spine_mm NUMERIC,
  price_eur NUMERIC,
  cover_url TEXT,
  sample_pdf_url TEXT,
  isbn TEXT,
  amazon_asin TEXT,
  amazon_url_fr TEXT, amazon_url_com TEXT, amazon_url_other TEXT,
  status public.book_status NOT NULL DEFAULT 'idea',
  qr_reserved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  expected_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO anon, authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_public_read_published" ON public.books FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- pages
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  status public.page_status NOT NULL DEFAULT 'draft',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pages TO anon, authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages_public_read_published" ON public.pages FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- page_sections
CREATE TABLE public.page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  kind public.section_kind NOT NULL,
  title_fr TEXT, title_en TEXT,
  body_fr TEXT, body_en TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.page_sections TO anon, authenticated;
GRANT ALL ON public.page_sections TO service_role;
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_sections_public_read_published" ON public.page_sections FOR SELECT TO anon, authenticated
USING (is_visible = true AND EXISTS (SELECT 1 FROM public.pages p WHERE p.id = page_id AND p.status = 'published'));
CREATE TRIGGER page_sections_updated_at BEFORE UPDATE ON public.page_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- content_versions (server only)
CREATE TABLE public.content_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.content_versions TO service_role;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

-- glossary_entries (auth only)
CREATE TABLE public.glossary_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  chapter_no INTEGER,
  lemma_he TEXT NOT NULL,
  form_he TEXT,
  translit TEXT,
  sense_fr TEXT, sense_en TEXT,
  note_fr TEXT, note_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.glossary_entries TO authenticated;
GRANT ALL ON public.glossary_entries TO service_role;
ALTER TABLE public.glossary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glossary_auth_read" ON public.glossary_entries FOR SELECT TO authenticated USING (true);

-- quiz_questions (auth only)
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_no INTEGER,
  kind public.quiz_kind NOT NULL,
  prompt_fr TEXT, prompt_en TEXT, prompt_he TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  explain_fr TEXT, explain_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_auth_read" ON public.quiz_questions FOR SELECT TO authenticated USING (true);

-- audio_tracks (auth only)
CREATE TABLE public.audio_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_no INTEGER,
  label_fr TEXT, label_en TEXT,
  storage_path TEXT NOT NULL,
  duration_s INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audio_tracks TO authenticated;
GRANT ALL ON public.audio_tracks TO service_role;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audio_auth_read" ON public.audio_tracks FOR SELECT TO authenticated USING (true);

-- profiles
CREATE TABLE public.profiles (
  user_id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  lang TEXT NOT NULL DEFAULT 'fr',
  display_name TEXT,
  text_size TEXT NOT NULL DEFAULT 'normal',
  theme TEXT NOT NULL DEFAULT 'ivory',
  consent_at TIMESTAMPTZ,
  consent_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- book_access
CREATE TABLE public.book_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_access TO authenticated;
GRANT ALL ON public.book_access TO service_role;
ALTER TABLE public.book_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_access_own" ON public.book_access FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- events (server only)
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  qr_code TEXT,
  kind TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE INDEX books_collection_idx ON public.books(collection_id);
CREATE INDEX page_sections_page_idx ON public.page_sections(page_id, sort_order);
CREATE INDEX glossary_book_idx ON public.glossary_entries(book_id, sort_order);
CREATE INDEX events_created_idx ON public.events(created_at);

-- Seed
INSERT INTO public.collections (slug, name_fr, name_en, color_hex, sort_order, tagline_fr, tagline_en, description_fr, description_en, for_whom_fr, for_whom_en)
VALUES (
  'heros-d-israel', 'Héros d''Israël', 'Heroes of Israel', '#16407A', 1,
  'Des vies réelles, racontées en hébreu vocalisé.',
  'Real lives, told in vocalized Hebrew.',
  'Des destins qui ont marqué l''histoire d''Israël, racontés comme des récits et non comme des leçons. Chaque tome se lit d''un bout à l''autre, page de gauche en hébreu vocalisé, page de droite un soutien en français qui se retire au fil des chapitres.',
  'Lives that shaped the history of Israel, told as stories rather than lessons. Each volume reads from start to finish: Hebrew with nikud on the left page, English support on the right that gradually withdraws.',
  'Pour l''adulte qui suit un oulpan et cherche enfin quelque chose à lire à son niveau entre deux cours.',
  'For the adult attending an ulpan who finally wants something to read at their level between classes.'
);

INSERT INTO public.books (
  collection_id, slug, qr_code, tome_no, title_fr, title_en, title_he, subtitle_fr, subtitle_en,
  blurb_fr, blurb_en, level_note_fr, level_note_en, excerpt_he, excerpt_translation_fr, excerpt_translation_en,
  what_you_learn_fr, what_you_learn_en, chapters_count, words_unique, page_count, spine_mm, price_eur,
  status, qr_reserved_at, published_at
) VALUES (
  (SELECT id FROM public.collections WHERE slug = 'heros-d-israel'),
  'eli-cohen', 'ELI1', 1,
  'Eli Cohen, un homme à Damas', 'Eli Cohen, a Man in Damascus', 'אֵלִי כֹּהֵן, אִישׁ בְּדַמֶּשֶׂק',
  'Tome 1', 'Volume 1',
  'Un homme part vivre sous un autre nom dans une ville qui le tuerait s''il était démasqué. L''histoire est vraie, elle est racontée simplement, et elle se lit en hébreu vocalisé du premier au dernier chapitre.',
  'A man goes to live under another name in a city that would kill him if unmasked. The story is true, told plainly, and read in vocalized Hebrew from the first chapter to the last.',
  'Après quelques mois d''oulpan : vous connaissez l''alphabet et le présent, le soutien fait le reste.',
  'After a few months of ulpan: you know the alphabet and the present tense, the support does the rest.',
  'אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם. הוּא לָמַד עִבְרִית בַּבַּיִת, וְעַרְבִית בָּרְחוֹב. בְּיוֹם אֶחָד הוּא עָלָה לְיִשְׂרָאֵל, וּשְׁמוֹ הָיָה עוֹד שֵׁם אֶחָד בָּרְשִׁימָה.',
  'Eli Cohen est né en Égypte. Il a appris l''hébreu à la maison, et l''arabe dans la rue. Un jour, il est monté en Israël, et son nom n''était qu''un nom de plus sur la liste.',
  'Eli Cohen was born in Egypt. He learned Hebrew at home, and Arabic in the street. One day he came up to Israel, and his name was just one more name on the list.',
  '["Le présent et le passé des verbes courants","Le vocabulaire de la ville et du voyage","Les noms de famille et les lieux","Lire une phrase entière sans traduire mot à mot"]'::jsonb,
  '["Present and past of common verbs","Vocabulary of the city and travel","Family names and places","Reading a full sentence without translating word by word"]'::jsonb,
  12, 640, 168, 10.2, 16.90,
  'published', now(), now()
);
