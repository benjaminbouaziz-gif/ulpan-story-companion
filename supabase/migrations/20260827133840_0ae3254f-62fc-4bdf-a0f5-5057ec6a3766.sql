alter table public.book_steps add column if not exists awaiting_since timestamptz;

create or replace function public.book_steps_maj_awaiting_since()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_en_attente boolean := new.status in ('attend_validation','en_revision');
begin
  if tg_op = 'INSERT' then
    new.awaiting_since := case when v_en_attente then now() else null end;
    return new;
  end if;

  if old.status is distinct from new.status then
    if v_en_attente then
      -- entrée en attente : on horodate, sauf si l'étape était déjà dans l'un
      -- des deux statuts d'attente (attend_validation -> en_revision garde sa date ?
      -- non : c'est une nouvelle attente, adressée à quelqu'un d'autre).
      new.awaiting_since := now();
    else
      new.awaiting_since := null;
    end if;
  else
    -- aucun changement de statut : rien ne touche cette date, jamais.
    new.awaiting_since := old.awaiting_since;
  end if;
  return new;
end $$;

drop trigger if exists book_steps_awaiting_since on public.book_steps;
create trigger book_steps_awaiting_since
before insert or update on public.book_steps
for each row execute function public.book_steps_maj_awaiting_since();

update public.book_steps
set awaiting_since = case
  when status in ('attend_validation','en_revision') then updated_at
  else null
end
where awaiting_since is null and status in ('attend_validation','en_revision');
