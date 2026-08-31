ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

DROP INDEX IF EXISTS public.prompts_actif_global;
DROP INDEX IF EXISTS public.prompts_actif_collection;

CREATE UNIQUE INDEX prompts_actif_global ON public.prompts USING btree (step_code, lang)
  WHERE (is_active AND collection_id IS NULL AND frozen_at IS NULL);

CREATE UNIQUE INDEX prompts_actif_collection ON public.prompts USING btree (step_code, collection_id, lang)
  WHERE (is_active AND collection_id IS NOT NULL AND frozen_at IS NULL);