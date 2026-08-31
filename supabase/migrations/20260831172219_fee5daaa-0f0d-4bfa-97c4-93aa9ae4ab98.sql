CREATE OR REPLACE FUNCTION public.supprimer_prompt(p_prompt_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_arts integer;
  v_qc integer;
  v_books integer;
  v_versions integer;
begin
  select count(*) into v_arts
  from public.artifacts a
  join public.prompt_versions v on v.id = a.prompt_version_id
  where v.prompt_id = p_prompt_id;

  select count(*) into v_qc
  from public.qc_reports r
  join public.prompt_versions v on v.id = r.regles_prompt_version_id
  where v.prompt_id = p_prompt_id;

  select count(*) into v_books from public.books b where b.prompt_id = p_prompt_id;

  if v_arts > 0 or v_qc > 0 or v_books > 0 then
    raise exception 'Ce prompt est relié à % livrable(s), % rapport(s) et % livre(s) : il peut être figé, pas supprimé.', v_arts, v_qc, v_books;
  end if;

  perform set_config('app.maintenance', 'on', true);

  update public.prompts set active_version_id = null where id = p_prompt_id;
  delete from public.prompt_activations where prompt_id = p_prompt_id;
  delete from public.prompt_versions where prompt_id = p_prompt_id;
  get diagnostics v_versions = row_count;
  delete from public.prompts where id = p_prompt_id;

  perform set_config('app.maintenance', 'off', true);
  return v_versions;
end $$;

REVOKE ALL ON FUNCTION public.supprimer_prompt(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_prompt(uuid) TO service_role;