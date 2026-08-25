-- PARTIE 1 : les chiffres restent éditables
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS spread_pages integer,
  ADD COLUMN IF NOT EXISTS kdp_page_count integer,
  ADD COLUMN IF NOT EXISTS figures_verified_at timestamptz;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS story_nature_fr text,
  ADD COLUMN IF NOT EXISTS story_nature_en text;

-- PARTIE 2 : provenance et empreinte de chaque anglais automatisable
ALTER TABLE public.page_sections
  ADD COLUMN IF NOT EXISTS title_en_source text,
  ADD COLUMN IF NOT EXISTS title_en_hash text,
  ADD COLUMN IF NOT EXISTS body_en_source text,
  ADD COLUMN IF NOT EXISTS body_en_hash text,
  ADD COLUMN IF NOT EXISTS data_en_source text,
  ADD COLUMN IF NOT EXISTS data_en_hash text;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS tagline_en_source text,
  ADD COLUMN IF NOT EXISTS tagline_en_hash text,
  ADD COLUMN IF NOT EXISTS description_en_source text,
  ADD COLUMN IF NOT EXISTS description_en_hash text,
  ADD COLUMN IF NOT EXISTS for_whom_en_source text,
  ADD COLUMN IF NOT EXISTS for_whom_en_hash text,
  ADD COLUMN IF NOT EXISTS story_nature_en_source text,
  ADD COLUMN IF NOT EXISTS story_nature_en_hash text;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS blurb_en_source text,
  ADD COLUMN IF NOT EXISTS blurb_en_hash text,
  ADD COLUMN IF NOT EXISTS level_note_en_source text,
  ADD COLUMN IF NOT EXISTS level_note_en_hash text,
  ADD COLUMN IF NOT EXISTS what_you_learn_en_source text,
  ADD COLUMN IF NOT EXISTS what_you_learn_en_hash text;

ALTER TABLE public.glossary_entries
  ADD COLUMN IF NOT EXISTS sense_en_source text,
  ADD COLUMN IF NOT EXISTS sense_en_hash text;

-- journal des traductions
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  entity text,
  entity_id uuid,
  model text,
  fields integer NOT NULL DEFAULT 0,
  input_chars integer NOT NULL DEFAULT 0,
  output_chars integer NOT NULL DEFAULT 0,
  cost_usd numeric,
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read agent runs" ON public.agent_runs;
CREATE POLICY "Admins read agent runs" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- PHASE 3 : le parcours QR et l'accès
CREATE TABLE IF NOT EXISTS public.email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  qr_code text,
  lang text NOT NULL DEFAULT 'fr',
  consent_token text NOT NULL,
  consent_asked_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_signups_token_key ON public.email_signups(consent_token);
CREATE INDEX IF NOT EXISTS email_signups_email_idx ON public.email_signups(lower(email));
GRANT ALL ON public.email_signups TO service_role;
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_codes_email_idx ON public.access_codes(lower(email));
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- valeurs du tome 1
UPDATE public.books
   SET spread_pages = 28,
       chapters_count = 10,
       words_unique = 59,
       figures_verified_at = now()
 WHERE qr_code = 'ELI1';