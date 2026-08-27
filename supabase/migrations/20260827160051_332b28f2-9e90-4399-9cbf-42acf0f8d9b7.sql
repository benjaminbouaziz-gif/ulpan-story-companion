CREATE TABLE public.book_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  book_step_id uuid REFERENCES public.book_steps(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  question text NOT NULL,
  contexte text,
  decision text,
  status text NOT NULL DEFAULT 'ouverte' CHECK (status IN ('ouverte','tranchee','ecartee')),
  stale boolean NOT NULL DEFAULT false,
  question_key text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

GRANT ALL ON public.book_decisions TO service_role;

ALTER TABLE public.book_decisions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX book_decisions_step_key ON public.book_decisions (book_id, coalesce(book_step_id, '00000000-0000-0000-0000-000000000000'::uuid), question_key);
CREATE INDEX book_decisions_book ON public.book_decisions (book_id, sort_order);

CREATE TRIGGER book_decisions_updated_at
  BEFORE UPDATE ON public.book_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();