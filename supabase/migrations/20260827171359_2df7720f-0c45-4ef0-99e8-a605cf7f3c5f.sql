ALTER TABLE public.book_decisions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_version integer;

CREATE INDEX IF NOT EXISTS book_decisions_vivantes_idx
  ON public.book_decisions (book_id, book_step_id)
  WHERE archived_at IS NULL;