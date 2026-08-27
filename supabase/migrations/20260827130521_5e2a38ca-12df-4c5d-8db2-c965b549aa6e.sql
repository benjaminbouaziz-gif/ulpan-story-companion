-- A1 : axe langue
alter table public.step_templates
  add column if not exists langs text[] not null default '{shared}';

alter table public.step_templates
  add constraint step_templates_langs_valid check (
    langs = '{shared}'::text[]
    or (langs <@ '{fr,en}'::text[] and array_length(langs, 1) between 1 and 2)
  );

update public.step_templates set langs = '{fr}'::text[]
  where code in ('redaction','scoring','go_recit');

update public.step_templates set langs = '{fr,en}'::text[]
  where code in ('trous','montage','controles','bat','couverture','paquet_kdp','publication_kdp','tresors','publication_site');

alter table public.book_steps
  add column if not exists lang text not null default 'shared';

alter table public.book_steps
  add constraint book_steps_lang_valid check (lang in ('shared','fr','en'));

-- l'édition existante (Eli Cohen) est l'édition française
update public.book_steps bs set lang = 'fr'
  from public.step_templates st
  where st.code = bs.step_code and st.langs <> '{shared}'::text[];

alter table public.book_steps drop constraint if exists book_steps_book_id_step_code_key;
alter table public.book_steps
  add constraint book_steps_unique unique (book_id, step_code, lang);

-- A2 : unicité, sans piège NULL
create unique index if not exists step_templates_code_global
  on public.step_templates (code) where collection_id is null;
create unique index if not exists step_templates_code_collection
  on public.step_templates (code, collection_id) where collection_id is not null;

alter table public.prompts add column if not exists lang text not null default 'shared';
alter table public.prompts add constraint prompts_lang_valid check (lang in ('shared','fr','en'));

create unique index if not exists prompts_actif_global
  on public.prompts (step_code, lang) where is_active and collection_id is null;
create unique index if not exists prompts_actif_collection
  on public.prompts (step_code, collection_id, lang) where is_active and collection_id is not null;

-- A3 : invariants d'état
alter table public.book_steps drop constraint if exists book_steps_awaiting_check;
alter table public.book_steps add constraint book_steps_awaiting_check
  check (awaiting is null or awaiting in ('ben','relecteur_he','relecteur_en','robot'));

alter table public.book_steps add constraint book_steps_awaiting_coherent check (
  (status in ('attend_validation','en_revision') and awaiting is not null)
  or (status not in ('attend_validation','en_revision') and awaiting is null)
);

update public.book_steps
  set note = 'Livrable réalisé hors CRM, avant l''atelier : fichiers de travail conservés hors du bucket (poste de Ben).'
  where status = 'valide_hors_crm' and (note is null or btrim(note) = '');

alter table public.book_steps add constraint book_steps_hors_crm_note check (
  status <> 'valide_hors_crm'
  or (note is not null and length(btrim(note)) > 0)
);

-- A4 : verrou d'immuabilité avec échappatoire tracée
create or replace function public.artifacts_are_append_only() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.maintenance', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'artifacts est en écriture unique (%). Déposer une nouvelle version.', tg_op;
end $$;

-- A5 : current_step_code dérivé
create or replace function public.books_maj_etape_courante() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_book uuid;
  v_code text;
begin
  v_book := coalesce(new.book_id, old.book_id);
  select bs.step_code into v_code
  from public.book_steps bs
  where bs.book_id = v_book
    and bs.status not in ('valide','valide_hors_crm')
  order by bs.rank, bs.step_code
  limit 1;
  update public.books set current_step_code = v_code where id = v_book;
  return null;
end $$;

drop trigger if exists book_steps_maj_etape on public.book_steps;
create trigger book_steps_maj_etape
after insert or update of status or delete on public.book_steps
for each row execute function public.books_maj_etape_courante();

-- instanciation pilotée par les modèles : une ligne par langue produite
create or replace function public.instancier_chaine(p_book_id uuid) returns integer
language plpgsql
security definer
set search_path = public
as $$
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
  select p_book_id, code, label_fr, label_en, rank, species, lang from deplie
  on conflict (book_id, step_code, lang) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end $$;

revoke all on function public.instancier_chaine(uuid) from public, anon, authenticated;
grant execute on function public.instancier_chaine(uuid) to service_role;

-- réaligne current_step_code sur la règle dérivée
update public.books b set current_step_code = (
  select bs.step_code from public.book_steps bs
  where bs.book_id = b.id and bs.status not in ('valide','valide_hors_crm')
  order by bs.rank, bs.step_code limit 1
);