-- ============ Bibliothèque de prompts ============
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  step_code text NOT NULL,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  change_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version)
);
GRANT ALL ON public.prompt_versions TO service_role;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- ============ Le modèle de chaîne ============
CREATE TABLE public.step_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  rank integer NOT NULL,
  species text NOT NULL CHECK (species IN ('llm','deterministe','humaine')),
  collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX step_templates_code_scope ON public.step_templates (code, COALESCE(collection_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT ALL ON public.step_templates TO service_role;
ALTER TABLE public.step_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER step_templates_updated_at BEFORE UPDATE ON public.step_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ La chaîne instanciée, livre par livre ============
CREATE TABLE public.book_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  step_code text NOT NULL,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  rank integer NOT NULL,
  species text NOT NULL CHECK (species IN ('llm','deterministe','humaine')),
  status text NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire','en_cours','attend_validation','valide','en_revision','echoue','valide_hors_crm')),
  awaiting text CHECK (awaiting IN ('ben','natif','relecteur','robot')),
  opened_at timestamptz,
  closed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, step_code)
);
GRANT ALL ON public.book_steps TO service_role;
ALTER TABLE public.book_steps ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER book_steps_updated_at BEFORE UPDATE ON public.book_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Les artefacts : rien ne s'écrase, rien ne se supprime ============
CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_step_id uuid NOT NULL REFERENCES public.book_steps(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('plan','recit_txt','master_he','ktiv_male','delta_lexical','glossaire','quiz','pdf_interieur','pdf_couverture','paquet_kdp','audio','autre')),
  version integer NOT NULL CHECK (version >= 1),
  storage_path text NOT NULL,
  checksum text,
  size_bytes bigint,
  origin text NOT NULL CHECK (origin IN ('robot','ben')),
  robot_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  prompt_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_step_id, type, version)
);
GRANT ALL ON public.artifacts TO service_role;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Verrou dur : un artefact est en écriture unique. Ni modification, ni suppression.
CREATE OR REPLACE FUNCTION public.artifacts_are_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Un artefact ne peut être ni modifié ni supprimé : déposez une nouvelle version.';
END;
$$;
CREATE TRIGGER artifacts_no_update BEFORE UPDATE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.artifacts_are_append_only();
CREATE TRIGGER artifacts_no_delete BEFORE DELETE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.artifacts_are_append_only();

-- ============ Les verdicts ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_step_id uuid NOT NULL REFERENCES public.book_steps(id) ON DELETE CASCADE,
  artifact_id uuid REFERENCES public.artifacts(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('valide','revision_demandee')),
  comment text,
  author uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============ books : ce que la fabrication exige, rien de plus ============
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS work_summary_fr text,
  ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_step_code text;

-- ============ agent_runs : on reprend la table existante ============
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS book_step_id uuid REFERENCES public.book_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS robot_name text,
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('en_cours','termine','echoue','annule')),
  ADD COLUMN IF NOT EXISTS batch_current integer,
  ADD COLUMN IF NOT EXISTS batch_total integer,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS error_summary text;
CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_idempotency_key ON public.agent_runs (idempotency_key) WHERE idempotency_key IS NOT NULL;