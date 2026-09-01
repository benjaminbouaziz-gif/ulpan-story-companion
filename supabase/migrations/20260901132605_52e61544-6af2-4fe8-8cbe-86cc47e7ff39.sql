with p as (select id from public.prompts where code = 'plan-redaction-corrective'),
source as (
  select v.content from public.prompt_versions v, p
  where v.prompt_id = p.id order by v.version desc limit 1
),
nouvelle as (
  insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
  select p.id,
         coalesce((select max(v.version) from public.prompt_versions v where v.prompt_id = p.id), 0) + 1,
         (select content from source),
         'Modèle corrigé : passerelle Lovable (google/gemini-3.7-flash).',
         'google/gemini-3.7-flash', false
  from p
  returning id, prompt_id, version
)
insert into public.prompt_activations (prompt_id, prompt_version_id, version, reason)
select prompt_id, id, version, 'Modèle du réécriteur corrigé' from nouvelle;

update public.prompts p
set active_version_id = (
  select v.id from public.prompt_versions v where v.prompt_id = p.id order by v.version desc limit 1
)
where p.code = 'plan-redaction-corrective';