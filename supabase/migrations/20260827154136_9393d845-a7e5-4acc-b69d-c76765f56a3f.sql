ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS truncated boolean NOT NULL DEFAULT false;