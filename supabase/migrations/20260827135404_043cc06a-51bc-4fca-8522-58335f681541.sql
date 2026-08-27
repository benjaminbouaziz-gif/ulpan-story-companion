ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS source_material_fr text,
  ADD COLUMN IF NOT EXISTS book_constraints_fr text,
  ADD COLUMN IF NOT EXISTS intent_note_fr text;

COMMENT ON COLUMN public.books.source_material_fr IS 'Matière documentaire facultative fournie par l''éditeur ; prime sur la recherche du robot quand elle est remplie.';
COMMENT ON COLUMN public.books.book_constraints_fr IS 'Consignes propres au livre (personnes vivantes, marques, vocabulaire).';
COMMENT ON COLUMN public.books.intent_note_fr IS 'Note d''intention : ton, angle, ce qu''on ne veut pas.';