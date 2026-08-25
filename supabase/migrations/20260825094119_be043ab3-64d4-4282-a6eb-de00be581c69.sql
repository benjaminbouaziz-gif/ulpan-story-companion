ALTER TYPE public.section_kind ADD VALUE IF NOT EXISTS 'book_spread';
ALTER TYPE public.section_kind ADD VALUE IF NOT EXISTS 'facts';
ALTER TABLE public.page_sections ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;