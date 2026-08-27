ALTER TABLE public.prompt_versions
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS web_search boolean NOT NULL DEFAULT false;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS model_used text;

CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_idempotency_key_unique
  ON public.agent_runs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_un_seul_en_cours_par_etape
  ON public.agent_runs (book_step_id)
  WHERE status = 'en_cours';