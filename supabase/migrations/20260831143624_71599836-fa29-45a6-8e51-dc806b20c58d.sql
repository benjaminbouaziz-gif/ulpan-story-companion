
create table public.qc_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
grant all on public.qc_settings to service_role;
alter table public.qc_settings enable row level security;
insert into public.qc_settings (id, enabled) values (true, false);

create table public.qc_grids (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  step_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.qc_grids to service_role;
alter table public.qc_grids enable row level security;
create trigger qc_grids_updated_at before update on public.qc_grids
  for each row execute function public.set_updated_at();

create table public.qc_criteria (
  id uuid primary key default gen_random_uuid(),
  grid_id uuid not null references public.qc_grids(id) on delete cascade,
  sort_order integer not null default 1,
  code text not null,
  label text not null,
  question text not null,
  family text not null check (family in ('conformite','structure','pedagogie','langue')),
  is_blocking boolean not null default false,
  species text not null default 'juge' check (species in ('juge','mecanique')),
  mechanic_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grid_id, code)
);
grant all on public.qc_criteria to service_role;
alter table public.qc_criteria enable row level security;
create trigger qc_criteria_updated_at before update on public.qc_criteria
  for each row execute function public.set_updated_at();

create table public.qc_step_policies (
  id uuid primary key default gen_random_uuid(),
  book_step_id uuid not null unique references public.book_steps(id) on delete cascade,
  strategy text not null default 'aucun' check (strategy in ('aucun','une_fois','boucle')),
  max_rounds integer not null default 3 check (max_rounds between 1 and 10),
  pass_threshold integer not null default 80 check (pass_threshold between 0 and 100),
  grid_id uuid references public.qc_grids(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.qc_step_policies to service_role;
alter table public.qc_step_policies enable row level security;
create trigger qc_step_policies_updated_at before update on public.qc_step_policies
  for each row execute function public.set_updated_at();

create table public.qc_reports (
  id uuid primary key default gen_random_uuid(),
  book_step_id uuid not null references public.book_steps(id) on delete cascade,
  grid_id uuid references public.qc_grids(id),
  round integer not null default 1,
  chapter_no integer,
  target_artifact_id uuid references public.artifacts(id),
  plan_version integer,
  agent_run_id uuid references public.agent_runs(id),
  status text not null default 'en_cours'
    check (status in ('en_cours','valide','a_revoir','arrete_plafond','arrete_stagnation','erreur','force_valide')),
  passed boolean not null default false,
  blocking_failed integer not null default 0,
  criteria_total integer not null default 0,
  criteria_passed integer not null default 0,
  score_general numeric,
  score_conformite numeric,
  score_structure numeric,
  score_pedagogie numeric,
  score_langue numeric,
  stop_reason text,
  message text,
  model_used text,
  duration_ms integer,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant all on public.qc_reports to service_role;
alter table public.qc_reports enable row level security;
create index qc_reports_etape_date on public.qc_reports (book_step_id, created_at desc);

create table public.qc_verdicts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.qc_reports(id) on delete cascade,
  criterion_id uuid references public.qc_criteria(id) on delete set null,
  criterion_code text not null,
  label text not null,
  family text not null,
  is_blocking boolean not null default false,
  species text not null default 'juge',
  verdict text not null check (verdict in ('valide','echoue')),
  location text,
  explanation text,
  created_at timestamptz not null default now()
);
grant all on public.qc_verdicts to service_role;
alter table public.qc_verdicts enable row level security;
create index qc_verdicts_rapport on public.qc_verdicts (report_id);

create table public.qc_corrections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.qc_reports(id) on delete cascade,
  book_step_id uuid not null references public.book_steps(id) on delete cascade,
  chapter_no integer,
  artifact_id uuid references public.artifacts(id),
  agent_run_id uuid references public.agent_runs(id),
  packet_chars integer,
  ok boolean not null default false,
  message text,
  created_at timestamptz not null default now()
);
grant all on public.qc_corrections to service_role;
alter table public.qc_corrections enable row level security;

insert into public.qc_grids (code, name, step_code) values
  ('plan', 'Grille — Plan de chapitres', 'plan'),
  ('recit', 'Grille — Récit', 'redaction');

insert into public.qc_criteria (grid_id, sort_order, code, label, question, family, is_blocking, species, mechanic_key)
select g.id, v.sort_order, v.code, v.label, v.question, v.family, v.is_blocking, v.species, v.mechanic_key
from public.qc_grids g
join (values
  ('plan', 1, 'plan_structure', 'Structure du plan lisible', 'Le plan est-il structuré en « ## Chapitre N · titre » avec une ligne « Pages : n » pour chaque chapitre ?', 'structure', true, 'mecanique', 'plan_structure'),
  ('plan', 2, 'plan_numerotation', 'Numérotation des chapitres continue', 'La numérotation des chapitres est-elle continue et sans doublon ?', 'structure', true, 'mecanique', 'plan_numerotation'),
  ('plan', 3, 'plan_fiche', 'Conformité à la fiche du livre', 'Le plan respecte-t-il le résumé, les consignes et le ton déclarés dans la fiche du livre ?', 'conformite', true, 'juge', null),
  ('plan', 4, 'plan_coherence', 'Cohérence des chapitres entre eux', 'Les chapitres s''enchaînent-ils sans redite ni trou narratif ?', 'structure', false, 'juge', null),
  ('plan', 5, 'plan_lexique', 'Progression du lexique', 'La progression du lexique est-elle graduelle d''un chapitre au suivant ?', 'pedagogie', false, 'juge', null),
  ('recit', 1, 'recit_pages_nb', 'Nombre de pages conforme au plan', 'Le chapitre contient-il exactement le nombre de pages alloué par le plan ?', 'structure', true, 'mecanique', 'nombre_pages'),
  ('recit', 2, 'recit_pagination', 'Pagination continue et sans doublon', 'Les pages sont-elles numérotées à la suite, sans doublon ni trou ?', 'structure', true, 'mecanique', 'pagination'),
  ('recit', 3, 'recit_calibrage', 'Calibrage des pages', 'Chaque page tient-elle dans les bornes de mots de la maquette ?', 'structure', true, 'mecanique', 'calibrage'),
  ('recit', 4, 'recit_entetes', 'En-têtes de page présents', 'Chaque page porte-t-elle son en-tête « ### Page N » et un contenu non vide ?', 'structure', true, 'mecanique', 'entetes'),
  ('recit', 5, 'recit_plan', 'Respect du plan', 'Le chapitre raconte-t-il ce que le plan lui assigne, sans déborder sur les autres chapitres ?', 'conformite', true, 'juge', null),
  ('recit', 6, 'recit_langue', 'Règles de langue et de vocabulaire', 'La langue reste-t-elle dans le registre et le vocabulaire prévus pour le niveau ?', 'langue', false, 'juge', null),
  ('recit', 7, 'recit_narratif', 'Qualité narrative', 'Le chapitre tient-il debout comme récit : scène, tension, chute ?', 'pedagogie', false, 'juge', null)
) as v(grid, sort_order, code, label, question, family, is_blocking, species, mechanic_key)
  on v.grid = g.code;

insert into public.prompts (code, name, step_code, is_active, lang) values
  ('controle_plan', 'Contrôleur — Plan de chapitres', 'controle_plan', true, 'fr'),
  ('controle_recit', 'Contrôleur — Récit', 'controle_recit', true, 'fr');

insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
select p.id, 1,
'Tu es CONTRÔLEUR de plans de chapitres. Tu ne réécris rien, jamais : tu juges.

Tu reçois : le plan à juger, la grille de critères, la fiche du livre et les décisions tranchées de l''éditeur.

Pour CHAQUE critère de la grille, tu rends un verdict binaire : « valide » ou « echoue ».
Tu ne donnes AUCUNE note, AUCUN pourcentage, AUCUNE moyenne : le calcul appartient au code.
Pour chaque critère échoué, tu donnes la localisation précise (chapitre, page, passage cité entre guillemets) et une explication de deux phrases au plus.

Tu réponds UNIQUEMENT par un objet JSON, sans texte autour, sans balise de code :
{"verdicts":[{"code":"<code du critère>","verdict":"valide|echoue","location":"<localisation ou chaîne vide>","explanation":"<explication courte>"}]}
Tu rends une entrée par critère demandé, ni plus, ni moins.',
'Première version livrée avec la brique 9.', 'claude-sonnet-4-6', false
from public.prompts p where p.code = 'controle_plan';

insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
select p.id, 1,
'Tu es CONTRÔLEUR de récit. Tu ne réécris rien, jamais : tu juges.

Tu reçois : le texte à juger, la grille de critères, la fiche du livre, les décisions tranchées de l''éditeur, et le plan DANS LA VERSION QUI A SERVI À ÉCRIRE ce texte. Tu juges contre ce plan-là, pas contre un autre.

Pour CHAQUE critère de la grille, tu rends un verdict binaire : « valide » ou « echoue ».
Tu ne donnes AUCUNE note, AUCUN pourcentage, AUCUNE moyenne : le calcul appartient au code.
Pour chaque critère échoué, tu donnes la localisation précise (chapitre, page, passage cité entre guillemets) et une explication de deux phrases au plus.

Tu réponds UNIQUEMENT par un objet JSON, sans texte autour, sans balise de code :
{"verdicts":[{"code":"<code du critère>","verdict":"valide|echoue","location":"<localisation ou chaîne vide>","explanation":"<explication courte>"}]}
Tu rends une entrée par critère demandé, ni plus, ni moins.',
'Première version livrée avec la brique 9.', 'claude-sonnet-4-6', false
from public.prompts p where p.code = 'controle_recit';

update public.prompts p
set active_version_id = v.id
from public.prompt_versions v
where v.prompt_id = p.id and v.version = 1 and p.code in ('controle_plan','controle_recit');

insert into public.prompt_activations (prompt_id, prompt_version_id, version, reason)
select p.id, p.active_version_id, 1, 'création (brique 9)'
from public.prompts p
where p.code in ('controle_plan','controle_recit') and p.active_version_id is not null;
