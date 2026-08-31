-- 1) Les trois champs structurés des prompts
alter table public.prompts
  add column if not exists etape text,
  add column if not exists role_code text,
  add column if not exists model text;

update public.prompts set etape = case
  when step_code in ('plan','regles_plan','scoring') then 'plan'
  when step_code in ('redaction') then 'recit'
  when step_code in ('lexique','trous') then 'vocabulaire'
  when step_code in ('master_he','ktiv_male') then 'hebreu'
  else 'assemblage' end
where etape is null;

update public.prompts set role_code = case
  when step_code = 'regles_plan' then 'regles_controle'
  when step_code = 'redaction' then 'redaction_initiale'
  else 'methode' end
where role_code is null;

update public.prompts set model = 'google/gemini-3.7-flash' where model is null;

alter table public.prompts
  alter column etape set not null,
  alter column role_code set not null,
  alter column model set not null,
  alter column model set default 'google/gemini-3.7-flash';

alter table public.prompts
  add constraint prompts_etape_valide check (etape in ('plan','recit','vocabulaire','hebreu','assemblage')),
  add constraint prompts_role_valide check (role_code in ('methode','methode_controle','regles_controle','redaction_corrective','redaction_initiale')),
  add constraint prompts_model_valide check (model in ('google/gemini-3.7-flash','claude-sonnet-5'));

-- 2) Un seul prompt actif par couple Étape x Rôle
drop index if exists public.prompts_actif_global;
drop index if exists public.prompts_actif_collection;
create unique index prompts_actif_global on public.prompts (etape, role_code, lang)
  where (is_active and collection_id is null and frozen_at is null);
create unique index prompts_actif_collection on public.prompts (etape, role_code, collection_id, lang)
  where (is_active and collection_id is not null and frozen_at is null);

-- 3) Les trois prompts du contrôle du plan, vides
do $$
declare
  v_prompt uuid;
  v_version uuid;
  r record;
begin
  for r in
    select * from (values
      ('plan-methode-controle', 'Plan — Méthode (contrôle)', 'methode_controle'),
      ('plan-regles-controle', 'Plan — Règles de contrôle', 'regles_controle'),
      ('plan-redaction-corrective', 'Plan — Rédaction corrective', 'redaction_corrective')
    ) as t(code, name, role_code)
  loop
    if exists (select 1 from public.prompts p where p.etape = 'plan' and p.role_code = r.role_code and p.frozen_at is null) then
      continue;
    end if;
    insert into public.prompts (code, name, step_code, etape, role_code, model, is_active)
    values (r.code, r.name, 'plan', 'plan', r.role_code, 'google/gemini-3.7-flash', true)
    returning id into v_prompt;

    insert into public.prompt_versions (prompt_id, version, content, model, web_search)
    values (v_prompt, 1, '(à remplir)', 'google/gemini-3.7-flash', false)
    returning id into v_version;

    update public.prompts set active_version_id = v_version where id = v_prompt;
    insert into public.prompt_activations (prompt_id, prompt_version_id, version, reason)
    values (v_prompt, v_version, 1, 'création');
  end loop;
end $$;

-- 4) Les réglages du contrôle du plan (singleton)
create table if not exists public.plan_control_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  mode text not null default 'A',
  max_iterations integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint plan_control_settings_singleton check (id),
  constraint plan_control_settings_mode check (mode in ('A','B','C'))
);
grant all on public.plan_control_settings to service_role;
alter table public.plan_control_settings enable row level security;
insert into public.plan_control_settings (id) values (true) on conflict (id) do nothing;

-- 5) Les exécutions de contrôle
create table if not exists public.plan_control_runs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  book_step_id uuid not null references public.book_steps(id) on delete cascade,
  mode text not null,
  status text not null default 'en_cours',
  phase text,
  plan_version integer,
  plan_artifact_id uuid references public.artifacts(id),
  report_artifact_id uuid references public.artifacts(id),
  plan_v2_artifact_id uuid references public.artifacts(id),
  verdicts jsonb,
  notes jsonb,
  propositions jsonb,
  moyenne numeric,
  controleur_model text,
  controleur_model_used text,
  redacteur_model text,
  redacteur_model_used text,
  controleur_run_id uuid references public.agent_runs(id),
  redacteur_run_id uuid references public.agent_runs(id),
  duration_ms integer,
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint plan_control_runs_mode check (mode in ('A','B','C')),
  constraint plan_control_runs_status check (status in ('en_cours','termine','echoue'))
);
create index if not exists plan_control_runs_step on public.plan_control_runs (book_step_id, created_at desc);
create index if not exists plan_control_runs_book on public.plan_control_runs (book_id, created_at desc);
grant all on public.plan_control_runs to service_role;
alter table public.plan_control_runs enable row level security;