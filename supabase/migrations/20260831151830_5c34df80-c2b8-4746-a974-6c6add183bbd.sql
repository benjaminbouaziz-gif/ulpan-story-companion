ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_mode_connu;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_mode_connu CHECK (
  mode IS NULL OR mode = ANY (ARRAY[
    'initial'::text,
    'avec_precedent'::text,
    'sans_precedent'::text,
    'enchainement'::text,
    'chapitre'::text,
    'chapitre_revision'::text,
    'assemblage'::text,
    'controle'::text,
    'correction'::text
  ])
);