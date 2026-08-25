
-- Questions d'entraînement du tome 1, tirées du vocabulaire du chapitre 1.
INSERT INTO public.quiz_questions (book_id, chapter_no, kind, prompt_fr, prompt_he, options, answer, explain_fr, sort_order)
SELECT b.id, 1, k.kind, k.prompt_fr, k.prompt_he, k.options::jsonb, k.answer::jsonb, k.explain_fr, k.sort_order
FROM public.books b,
(VALUES
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'נוֹלַד', '["est né","a appris","est monté","seul"]', '{"index":0}', 'נוֹלַד : est né.', 1),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'לָמַד', '["a écrit","a appris","a demandé","a couru"]', '{"index":1}', 'לָמַד : a appris.', 2),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'בָּרְחוֹב', '["à la maison","dans la rue","à l''école","au marché"]', '{"index":1}', 'בָּרְחוֹב : dans la rue.', 3),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'עָלָה', '["est descendu","est monté, a fait son alya","est resté","a oublié"]', '{"index":1}', 'עָלָה : est monté ; en Israël, a fait son alya.', 4),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'רְשִׁימָה', '["liste","question","calme","entraînement"]', '{"index":0}', 'רְשִׁימָה : liste.', 5),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'שְׁאֵלָה', '["réponse","question","lettre","rue"]', '{"index":1}', 'שְׁאֵלָה : question.', 6),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'שֶׁקֶט', '["bruit","calme, silence","vitesse","peur"]', '{"index":1}', 'שֶׁקֶט : calme, silence.', 7),
  ('qcm'::public.quiz_kind, 'Que veut dire ce mot ?', 'אִימוּן', '["entraînement","souvenir","voyage","travail"]', '{"index":0}', 'אִימוּן : entraînement.', 8),
  ('trou'::public.quiz_kind, 'Complétez : « il a appris seul »', 'הוּא לָמַד ＿', '["לְבַד","שֶׁקֶט","רְשִׁימָה","שְׁאֵלָה"]', '{"index":0}', 'לְבַד : seul.', 9),
  ('trou'::public.quiz_kind, 'Complétez : « on l''appelait Eli »', '＿ אֶלִי', '["קָרְאוּ לוֹ","נוֹלַד","עָלָה","לָמַד"]', '{"index":0}', 'קָרְאוּ לוֹ : on l''appelait.', 10)
) AS k(kind, prompt_fr, prompt_he, options, answer, explain_fr, sort_order)
WHERE b.slug = 'eli-cohen'
AND NOT EXISTS (SELECT 1 FROM public.quiz_questions q WHERE q.book_id = b.id);

-- La progression du lecteur : une ligne par livre, gardée côté lecteur.
CREATE TABLE IF NOT EXISTS public.reader_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quiz_answered integer NOT NULL DEFAULT 0,
  quiz_correct integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reader_progress TO authenticated;
GRANT ALL ON public.reader_progress TO service_role;

ALTER TABLE public.reader_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reader_progress_own" ON public.reader_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
