-- 1) Journal de maintenance
CREATE TABLE public.maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL CHECK (operation IN ('UPDATE','DELETE')),
  table_name text NOT NULL,
  row_id uuid,
  old_value jsonb NOT NULL,
  author uuid
);

GRANT ALL ON public.maintenance_log TO service_role;

ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;
-- Aucune politique : aucun accès anon/authenticated.

-- Le journal est lui-même intouchable, y compris en maintenance.
CREATE OR REPLACE FUNCTION public.maintenance_log_is_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  raise exception 'maintenance_log est un journal : ni modification ni suppression (%).', tg_op;
end $$;

CREATE TRIGGER maintenance_log_immutable
BEFORE UPDATE OR DELETE ON public.maintenance_log
FOR EACH ROW EXECUTE FUNCTION public.maintenance_log_is_immutable();

-- 2) L'échappatoire écrit avant de laisser passer
CREATE OR REPLACE FUNCTION public.artifacts_are_append_only()
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
  raise exception 'artifacts est en écriture unique (%). Déposer une nouvelle version.', tg_op;
end $$;

-- 3) L'axe langue reste en sommeil : chaîne française seulement.
-- NOTE — La chaîne anglaise est INCOMPLÈTE en l'état : neuf étapes sont
-- dédoublées en fr/en, mais AUCUNE étape ne produit le texte de soutien
-- anglais. Les pages de soutien ne se traduisent jamais automatiquement :
-- ce sont des constructions pédagogiques distinctes. L'étape manquante sera
-- ajoutée quand une édition anglaise sera décidée.
CREATE OR REPLACE FUNCTION public.instancier_chaine(p_book_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_collection uuid;
  v_inserted integer;
begin
  select collection_id into v_collection from public.books where id = p_book_id;

  with modeles as (
    select st.*
    from public.step_templates st
    where st.is_active
      and (st.collection_id is null or st.collection_id = v_collection)
  ), deplie as (
    select m.code, m.label_fr, m.label_en, m.rank, m.species,
           coalesce(l, 'shared') as lang
    from modeles m
    left join lateral unnest(nullif(m.langs, '{shared}'::text[])) as l on true
  )
  insert into public.book_steps (book_id, step_code, label_fr, label_en, rank, species, lang)
  select p_book_id, code, label_fr, label_en, rank, species, lang
  from deplie
  where lang in ('shared', 'fr')
  on conflict (book_id, step_code, lang) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end $$;