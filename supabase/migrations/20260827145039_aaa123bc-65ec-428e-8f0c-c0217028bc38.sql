-- La règle d'attente datait d'avant les robots : un lancement en cours attend
-- le robot, un lancement échoué attend Ben. On dit la même chose au bon niveau.
alter table public.book_steps drop constraint if exists book_steps_awaiting_coherent;

alter table public.book_steps add constraint book_steps_awaiting_coherent check (
  (status in ('attend_validation','en_revision','en_cours','echoue') and awaiting is not null)
  or (status in ('a_faire','valide','valide_hors_crm') and awaiting is null)
);