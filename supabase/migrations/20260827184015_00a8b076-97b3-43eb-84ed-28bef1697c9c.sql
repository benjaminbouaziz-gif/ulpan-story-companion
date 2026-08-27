ALTER TABLE public.artifacts DROP CONSTRAINT artifacts_type_check;
ALTER TABLE public.artifacts ADD CONSTRAINT artifacts_type_check CHECK (type = ANY (ARRAY['plan','chapitre','recit_txt','master_he','ktiv_male','delta_lexical','glossaire','quiz','pdf_interieur','pdf_couverture','paquet_kdp','audio','autre']));
ALTER TABLE public.artifacts ADD COLUMN IF NOT EXISTS chapter_no integer;
ALTER TABLE public.artifacts ADD CONSTRAINT artifacts_chapter_no_coherent CHECK ((chapter_no IS NULL AND type <> 'chapitre') OR (type = 'chapitre' AND chapter_no >= 1));
ALTER TABLE public.artifacts DROP CONSTRAINT IF EXISTS artifacts_book_step_id_type_version_key;
CREATE UNIQUE INDEX IF NOT EXISTS artifacts_step_type_chapitre_version_key ON public.artifacts (book_step_id, type, COALESCE(chapter_no, 0), version);

ALTER TABLE public.agent_runs DROP CONSTRAINT agent_runs_mode_connu;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_mode_connu CHECK (mode IS NULL OR mode = ANY (ARRAY['initial','avec_precedent','sans_precedent','enchainement','chapitre','chapitre_revision','assemblage']));

CREATE TABLE public.chapter_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_step_id uuid NOT NULL REFERENCES public.book_steps(id) ON DELETE CASCADE,
  chapter_no integer NOT NULL CHECK (chapter_no >= 1),
  artifact_id uuid REFERENCES public.artifacts(id) ON DELETE SET NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ok boolean NOT NULL,
  expected_pages integer NOT NULL,
  first_page integer NOT NULL,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX chapter_measures_step_chapter_idx ON public.chapter_measures (book_step_id, chapter_no, created_at DESC);
GRANT SELECT ON public.chapter_measures TO authenticated;
GRANT ALL ON public.chapter_measures TO service_role;
ALTER TABLE public.chapter_measures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chapter measures" ON public.chapter_measures FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));