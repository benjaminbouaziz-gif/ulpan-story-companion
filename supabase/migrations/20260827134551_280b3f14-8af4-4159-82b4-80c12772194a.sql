-- 1) Version active portée par le prompt
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS active_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE RESTRICT;

-- 2) Note de changement obligatoire dès la version 2
ALTER TABLE public.prompt_versions
  ADD CONSTRAINT prompt_versions_note_obligatoire
  CHECK (version = 1 OR (change_note IS NOT NULL AND btrim(change_note) <> ''));

-- 3) Écriture unique, avec journal de maintenance (même mécanisme qu'artifacts)
CREATE OR REPLACE FUNCTION public.append_only_avec_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_old jsonb := to_jsonb(old);
begin
  if current_setting('app.maintenance', true) = 'on' then
    insert into public.maintenance_log (operation, table_name, row_id, old_value, author)
    values (tg_op, tg_table_name, (v_old->>'id')::uuid, v_old, auth.uid());
    return coalesce(new, old);
  end if;
  raise exception '% est en écriture unique (%). Déposer une nouvelle version.', tg_table_name, tg_op;
end $$;

REVOKE ALL ON FUNCTION public.append_only_avec_journal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prompt_versions_no_update ON public.prompt_versions;
DROP TRIGGER IF EXISTS prompt_versions_no_delete ON public.prompt_versions;
CREATE TRIGGER prompt_versions_no_update BEFORE UPDATE ON public.prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.append_only_avec_journal();
CREATE TRIGGER prompt_versions_no_delete BEFORE DELETE ON public.prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.append_only_avec_journal();

-- 4) Registre tracé des changements de version active
CREATE TABLE IF NOT EXISTS public.prompt_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  prompt_version_id uuid NOT NULL REFERENCES public.prompt_versions(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.prompt_activations TO service_role;
ALTER TABLE public.prompt_activations ENABLE ROW LEVEL SECURITY;
-- Aucune politique client : l'atelier y accède par fonction serveur (service_role).

DROP TRIGGER IF EXISTS prompt_activations_immutable_u ON public.prompt_activations;
DROP TRIGGER IF EXISTS prompt_activations_immutable_d ON public.prompt_activations;
CREATE TRIGGER prompt_activations_immutable_u BEFORE UPDATE ON public.prompt_activations
  FOR EACH ROW EXECUTE FUNCTION public.append_only_avec_journal();
CREATE TRIGGER prompt_activations_immutable_d BEFORE DELETE ON public.prompt_activations
  FOR EACH ROW EXECUTE FUNCTION public.append_only_avec_journal();

CREATE INDEX IF NOT EXISTS prompt_activations_prompt_idx ON public.prompt_activations (prompt_id, created_at DESC);
