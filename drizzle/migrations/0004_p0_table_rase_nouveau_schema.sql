-- P0 — Table rase contrôlée et nouveau schéma
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('user_roles','admin_login_attempts','content_versions')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.append_only_avec_journal() CASCADE;
DROP FUNCTION IF EXISTS public.archive_page_section() CASCADE;
DROP FUNCTION IF EXISTS public.artifacts_are_append_only() CASCADE;
DROP FUNCTION IF EXISTS public.book_steps_maj_awaiting_since() CASCADE;
DROP FUNCTION IF EXISTS public.books_maj_etape_courante() CASCADE;
DROP FUNCTION IF EXISTS public.instancier_chaine(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.maintenance_log_is_immutable() CASCADE;
DROP FUNCTION IF EXISTS public.protect_locked_page_section() CASCADE;
DROP FUNCTION IF EXISTS public.remplacer_quiz_livre(uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.supprimer_prompt(uuid) CASCADE;

DROP TYPE IF EXISTS public.book_status CASCADE;
DROP TYPE IF EXISTS public.edition_etat CASCADE;
DROP TYPE IF EXISTS public.quiz_kind CASCADE;
DROP TYPE IF EXISTS public.section_kind CASCADE;
DROP TYPE IF EXISTS public.page_status CASCADE;

-- ===== Tables =====
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  color_hex text NOT NULL DEFAULT '#16407A',
  sort_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.collection_texts (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  name text, tagline text, description text, for_whom text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, lang)
);
CREATE TABLE public.collection_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  sort_order int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('texte','image')),
  title text, body text, image_path text,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  collection_id uuid REFERENCES public.collections(id) ON DELETE RESTRICT,
  tome_no int, title_he text, chapters_count int, vocab_count int,
  slug_locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.book_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  status text NOT NULL DEFAULT 'preparation' CHECK (status IN ('preparation','publiee')),
  title text, subtitle text, blurb text, level_note text,
  learn_items text[] NOT NULL DEFAULT '{}',
  amazon_url text, cover_path text, excerpt_path text, glossary_path text,
  print_page_count int, qr_downloaded_at timestamptz, published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, lang)
);
CREATE TABLE public.book_chapters (
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_no int NOT NULL, title_he text,
  PRIMARY KEY (book_id, chapter_no)
);
CREATE TABLE public.edition_chapter_titles (
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  chapter_no int NOT NULL, title text,
  PRIMARY KEY (edition_id, chapter_no)
);
CREATE TABLE public.book_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_no int NOT NULL, chapter_no int NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_no)
);
CREATE TABLE public.page_paragraphs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.book_pages(id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  kind text NOT NULL DEFAULT 'narration' CHECK (kind IN ('narration','dialogue')),
  he_nikud text, he_plain text
);
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  chapter_no int NOT NULL, page_no int,
  kind text NOT NULL CHECK (kind IN ('qcm','trou')),
  question text NOT NULL, hebrew text,
  options jsonb NOT NULL, answer_index int NOT NULL, explanation text,
  sort_order int NOT NULL
);
CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  chosen_index int NOT NULL, is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.site_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL CHECK (page_key IN ('accueil_ouverture','accueil_methode','accueil_livres','accueil_collections','accueil_lecteur','methode','contact','mentions','confidentialite','pied')),
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  sort_order int NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('titre','texte','etapes','faq','citation','chiffres','image')),
  title text, body text,
  items jsonb NOT NULL DEFAULT '[]',
  image_path text,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.method_steps (
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  step_no int NOT NULL CHECK (step_no BETWEEN 1 AND 4),
  tab_label text NOT NULL, image_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, step_no)
);
CREATE TABLE public.readers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  news_status text NOT NULL CHECK (news_status IN ('inscrit','oppose')),
  news_changed_at timestamptz,
  origin_edition_id uuid REFERENCES public.book_editions(id) ON DELETE SET NULL,
  consent_text_version text, consent_at timestamptz,
  unsubscribe_token text UNIQUE NOT NULL
);
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  news_optout boolean NOT NULL DEFAULT false,
  consent_text_version text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE TABLE public.launch_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  news_optout boolean NOT NULL DEFAULT false,
  consent_text_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (email, edition_id)
);
CREATE TABLE public.edition_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, edition_id)
);
CREATE TABLE public.reader_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.book_editions(id) ON DELETE CASCADE,
  quiz_answered int NOT NULL DEFAULT 0,
  quiz_correct int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, edition_id)
);
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('qr_scan','access_requested','access_confirmed','amazon_click')),
  edition_id uuid REFERENCES public.book_editions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ===== Grants : lecture seule pour anon/authenticated, tout pour service_role =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collections','collection_texts','collection_blocks','books','book_editions','book_chapters','edition_chapter_titles','book_pages','page_paragraphs','quiz_questions','quiz_answers','site_blocks','method_steps','readers','access_requests','launch_waitlist','edition_access','reader_progress','events','rate_limits']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "editeurs lecture" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''editor''))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['collections','collection_texts','collection_blocks','books','book_editions','site_blocks','method_steps','book_pages','reader_progress']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
  END LOOP;
END $$;

-- ===== Aides de visibilité (security definer : évite la récursion RLS) =====
CREATE OR REPLACE FUNCTION public.collection_visible(_collection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.collections WHERE id = _collection_id AND is_visible)
$$;
CREATE OR REPLACE FUNCTION public.edition_visible(_edition_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_editions e
    JOIN public.books b ON b.id = e.book_id
    JOIN public.collections c ON c.id = b.collection_id
    WHERE e.id = _edition_id AND e.status = 'publiee' AND c.is_visible)
$$;
CREATE OR REPLACE FUNCTION public.book_visible(_book_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_editions e
    JOIN public.books b ON b.id = e.book_id
    JOIN public.collections c ON c.id = b.collection_id
    WHERE b.id = _book_id AND e.status = 'publiee' AND c.is_visible)
$$;
CREATE OR REPLACE FUNCTION public.lecteur_a_acces_livre(_book_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.edition_access a
    JOIN public.book_editions e ON e.id = a.edition_id
    JOIN public.books b ON b.id = e.book_id
    JOIN public.collections c ON c.id = b.collection_id
    WHERE a.user_id = auth.uid() AND b.id = _book_id AND e.status = 'publiee' AND c.is_visible)
$$;
CREATE OR REPLACE FUNCTION public.lecteur_a_acces_edition(_edition_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.edition_access a
    JOIN public.book_editions e ON e.id = a.edition_id
    WHERE a.user_id = auth.uid() AND e.id = _edition_id AND e.status = 'publiee')
$$;

-- ===== Lecture publique =====
CREATE POLICY "public lecture" ON public.collections FOR SELECT TO anon, authenticated USING (is_visible);
CREATE POLICY "public lecture" ON public.collection_texts FOR SELECT TO anon, authenticated USING (public.collection_visible(collection_id));
CREATE POLICY "public lecture" ON public.collection_blocks FOR SELECT TO anon, authenticated USING (is_visible AND public.collection_visible(collection_id));
CREATE POLICY "public lecture" ON public.books FOR SELECT TO anon, authenticated USING (public.book_visible(id));
CREATE POLICY "public lecture" ON public.book_chapters FOR SELECT TO anon, authenticated USING (public.book_visible(book_id));
CREATE POLICY "public lecture" ON public.book_editions FOR SELECT TO anon, authenticated USING (public.edition_visible(id));
CREATE POLICY "public lecture" ON public.edition_chapter_titles FOR SELECT TO anon, authenticated USING (public.edition_visible(edition_id));
CREATE POLICY "public lecture" ON public.site_blocks FOR SELECT TO anon, authenticated USING (is_visible);
CREATE POLICY "public lecture" ON public.method_steps FOR SELECT TO anon, authenticated USING (true);

-- ===== Lecteur connecté =====
CREATE POLICY "lecteur pages" ON public.book_pages FOR SELECT TO authenticated USING (is_published AND public.lecteur_a_acces_livre(book_id));
CREATE POLICY "lecteur paragraphes" ON public.page_paragraphs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.book_pages p WHERE p.id = page_id AND p.is_published AND public.lecteur_a_acces_livre(p.book_id)));
CREATE POLICY "lecteur quiz" ON public.quiz_questions FOR SELECT TO authenticated USING (public.lecteur_a_acces_edition(edition_id));
CREATE POLICY "lecteur soi" ON public.quiz_answers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lecteur soi" ON public.reader_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lecteur soi" ON public.edition_access FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lecteur soi" ON public.readers FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ===== Remplacement du quiz d'une édition =====
CREATE OR REPLACE FUNCTION public.remplacer_quiz_edition(p_edition_id uuid, p_rows jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.quiz_questions WHERE edition_id = p_edition_id;
  INSERT INTO public.quiz_questions (edition_id, chapter_no, page_no, kind, question, hebrew, options, answer_index, explanation, sort_order)
  SELECT p_edition_id, (r->>'chapter_no')::int, NULLIF(r->>'page_no','')::int, r->>'kind', r->>'question', r->>'hebrew',
         r->'options', (r->>'answer_index')::int, r->>'explanation', COALESCE((r->>'sort_order')::int, ord::int)
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.remplacer_quiz_edition(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remplacer_quiz_edition(uuid, jsonb) TO service_role;

-- ===== Données initiales =====
INSERT INTO public.method_steps (lang, step_no, tab_label) VALUES
  ('fr',1,'1 · Traduction'),('fr',2,'2 · Texte à trous'),('fr',3,'3 · Vocabulaire'),('fr',4,'4 · Sans nekoudot'),
  ('en',1,'1 · Translation'),('en',2,'2 · Gapped text'),('en',3,'3 · Vocabulary'),('en',4,'4 · Without nikud');
INSERT INTO public.site_blocks (page_key, lang, kind)
SELECT k, l, 'titre' FROM unnest(ARRAY['accueil_ouverture','accueil_methode','accueil_livres','accueil_collections','accueil_lecteur','contact','mentions','confidentialite']) k, unnest(ARRAY['fr','en']) l;
INSERT INTO public.site_blocks (page_key, lang, kind) VALUES ('pied','fr','texte'),('pied','en','texte');

-- ===== Stockage =====
DROP POLICY IF EXISTS "audios livres lecture editeurs" ON storage.objects;
DROP POLICY IF EXISTS "audios livres ecriture editeurs" ON storage.objects;
DROP POLICY IF EXISTS "audios livres maj editeurs" ON storage.objects;
DROP POLICY IF EXISTS "audios livres suppression editeurs" ON storage.objects;
DROP POLICY IF EXISTS "glossaires lecture editeurs" ON storage.objects;
DROP POLICY IF EXISTS "glossaires ecriture editeurs" ON storage.objects;
DROP POLICY IF EXISTS "glossaires maj editeurs" ON storage.objects;
DROP POLICY IF EXISTS "glossaires suppression editeurs" ON storage.objects;

CREATE POLICY "espaces editeurs lecture" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('audios','site','glossaires') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "espaces editeurs ecriture" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('audios','site','glossaires') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "espaces editeurs maj" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('audios','site','glossaires') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "espaces editeurs suppression" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('audios','site','glossaires') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "site lecture publique" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site');

-- ===== Tâche quotidienne =====
CREATE OR REPLACE FUNCTION public.menage_quotidien()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  DELETE FROM public.access_requests WHERE confirmed_at IS NULL AND requested_at < now() - interval '7 days';
  DELETE FROM auth.users u
   WHERE u.created_at < now() - interval '7 days'
     AND NOT EXISTS (SELECT 1 FROM public.readers r WHERE r.user_id = u.id)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('admin','editor'));
  DELETE FROM auth.users u
   WHERE EXISTS (SELECT 1 FROM public.readers r WHERE r.user_id = u.id AND r.last_seen_at < now() - interval '3 years')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('admin','editor'));
  DELETE FROM public.launch_waitlist WHERE notified_at IS NOT NULL AND notified_at < now() - interval '30 days';
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '24 hours';
  DELETE FROM public.admin_login_attempts WHERE created_at < now() - interval '30 days';
END $$;
REVOKE ALL ON FUNCTION public.menage_quotidien() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('menage_quotidien', '15 3 * * *', 'SELECT public.menage_quotidien()');
