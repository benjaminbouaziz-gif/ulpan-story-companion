-- 1. Les trois nouveaux prompts, chacun sur sa propre étape (l'unicité porte sur (step_code, lang)).
with nouveaux as (
  select * from (values
    ('controle',     'Contrôleur — méthode',       'controle',     'claude-sonnet-4-6'::text),
    ('regles_plan',  'Règles — Plan de chapitres', 'regles_plan',  null::text),
    ('regles_recit', 'Règles — Récit',             'regles_recit', null::text)
  ) as t(code, name, step_code, model)
),
crees as (
  insert into public.prompts (code, name, step_code, lang, collection_id, is_active)
  select n.code, n.name, n.step_code, 'fr', null, true
  from nouveaux n
  where not exists (select 1 from public.prompts p where p.code = n.code)
  returning id, code
),
versions as (
  insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
  select c.id, 1, 'à remplir', 'Création', n.model, false
  from crees c join nouveaux n on n.code = c.code
  returning id, prompt_id
)
update public.prompts p
set active_version_id = v.id
from versions v
where p.id = v.prompt_id;

-- 2. Les critères jugés sortent des grilles : désactivés, jamais supprimés.
update public.qc_criteria set is_active = false, updated_at = now()
where species = 'juge' and is_active = true;

-- 3. Le rapport dit contre quelle version des règles il a été rendu.
alter table public.qc_reports
  add column if not exists regles_prompt_version_id uuid references public.prompt_versions(id),
  add column if not exists regles_version integer;