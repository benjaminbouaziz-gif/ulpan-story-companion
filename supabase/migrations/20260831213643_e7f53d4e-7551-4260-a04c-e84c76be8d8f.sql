insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
values (
  '2fbac556-f806-4940-8df4-9dfa350fc7f0',
  2,
  'Tu es un rédacteur correcteur. On te donne un plan de chapitres et un rapport de contrôle. Corrige le plan en tenant compte des remarques du rapport. Rends le plan corrigé en entier, au même format que le plan d''origine. Aucun commentaire hors du plan.',
  'Remplissage minimal pour tests modes B et C',
  'claude-sonnet-5',
  false
)
returning id;

update public.prompts
set active_version_id = (select id from public.prompt_versions where prompt_id = '2fbac556-f806-4940-8df4-9dfa350fc7f0' and version = 2),
    updated_at = now()
where id = '2fbac556-f806-4940-8df4-9dfa350fc7f0';