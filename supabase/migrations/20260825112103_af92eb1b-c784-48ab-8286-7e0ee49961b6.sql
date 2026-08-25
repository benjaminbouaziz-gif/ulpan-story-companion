
CREATE TABLE public.book_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_no int NOT NULL,
  chapter_no int,
  support_kind text NOT NULL CHECK (support_kind IN ('translation','cloze','keys','nikud')),
  chapter_title_he text,
  chapter_title_fr text,
  chapter_title_en text,
  running_head_fr text,
  running_head_en text,
  folio int,
  is_published boolean NOT NULL DEFAULT false,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_no)
);

CREATE TABLE public.page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.book_pages(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  block_kind text NOT NULL DEFAULT 'narrative' CHECK (block_kind IN ('narrative','dialogue')),
  he_nikud text,
  he_plain text,
  support_fr text,
  support_en text,
  support_en_source text,
  support_en_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX page_blocks_page_idx ON public.page_blocks (page_id, sort_order);

CREATE TABLE public.page_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.book_pages(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  gloss_no int,
  he_nikud text NOT NULL,
  translit text,
  sense_fr text,
  sense_en text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX page_keys_page_idx ON public.page_keys (page_id, sort_order);

ALTER TABLE public.glossary_entries
  ADD COLUMN IF NOT EXISTS gloss_no int,
  ADD COLUMN IF NOT EXISTS he_nikud text,
  ADD COLUMN IF NOT EXISTS first_page int;

UPDATE public.glossary_entries SET he_nikud = COALESCE(he_nikud, lemma_he);
UPDATE public.glossary_entries g SET gloss_no = s.rn
FROM (SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY sort_order, created_at) AS rn
      FROM public.glossary_entries) s
WHERE s.id = g.id AND g.gloss_no IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS glossary_entries_book_no_key
  ON public.glossary_entries (book_id, gloss_no) WHERE gloss_no IS NOT NULL;

GRANT SELECT ON public.book_pages TO anon;
GRANT SELECT ON public.page_blocks TO anon;
GRANT SELECT ON public.page_keys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_keys TO authenticated;
GRANT ALL ON public.book_pages TO service_role;
GRANT ALL ON public.page_blocks TO service_role;
GRANT ALL ON public.page_keys TO service_role;

ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_pages readable" ON public.book_pages FOR SELECT USING (true);
CREATE POLICY "page_blocks readable" ON public.page_blocks FOR SELECT USING (true);
CREATE POLICY "page_keys readable" ON public.page_keys FOR SELECT USING (true);

CREATE POLICY "book_pages editable by staff" ON public.book_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "page_blocks editable by staff" ON public.page_blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "page_keys editable by staff" ON public.page_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER book_pages_touch BEFORE UPDATE ON public.book_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Le glossaire numéroté dont se servent les trous et les clés.
INSERT INTO public.glossary_entries (book_id, gloss_no, lemma_he, he_nikud, translit, sense_fr, sense_en, chapter_no, first_page, sort_order)
SELECT b.id, v.no, v.he, v.he, v.tr, v.fr, v.en, v.ch, v.pg, 1000 + v.no
FROM public.books b, (VALUES
  (101, 'כִּכָּר', 'kikar', 'place, esplanade', 'square', 1, 12),
  (102, 'מִשְׁטָרָה', 'Michtara', 'police', 'police', 4, 18),
  (103, 'סוֹחֵר', 'sokher', 'marchand', 'merchant', 4, 18),
  (104, 'רְחוֹב', 'rekhov', 'rue', 'street', 4, 18),
  (105, 'קָצִין', 'katsin', 'officier', 'officer', 8, 26),
  (106, 'שָׁכֵן', 'shakhen', 'voisin', 'neighbour', 8, 26),
  (107, 'מִזְוָדָה', 'mizvada', 'valise', 'suitcase', 8, 26),
  (108, 'לַחְשׁוֹשׁ', 'lakhshosh', 'craindre', 'to fear', 10, 32),
  (109, 'מִבְטָא', 'mivta', 'accent', 'accent', 10, 32)
) AS v(no, he, tr, fr, en, ch, pg)
WHERE b.slug = 'eli-cohen-un-homme-a-damas'
ON CONFLICT DO NOTHING;

-- Les quatre pages de démonstration du tome 1, une par étape.
WITH b AS (SELECT id FROM public.books WHERE slug = 'eli-cohen-un-homme-a-damas'),
p1 AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, chapter_title_he, chapter_title_fr, chapter_title_en, running_head_fr, running_head_en, folio, is_published, validated_at)
  SELECT id, 12, 1, 'translation', 'כִּכַּר מֵרָגָ׳ה', 'La place Marjeh', 'Marjeh Square', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 12, true, now() FROM b RETURNING id
),
p2 AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, running_head_fr, running_head_en, folio, is_published, validated_at)
  SELECT id, 18, 4, 'cloze', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 18, true, now() FROM b RETURNING id
),
p3 AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, running_head_fr, running_head_en, folio, is_published, validated_at)
  SELECT id, 26, 8, 'keys', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 26, true, now() FROM b RETURNING id
),
p4 AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, running_head_fr, running_head_en, folio, is_published, validated_at)
  SELECT id, 32, 10, 'nikud', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 32, true, now() FROM b RETURNING id
),
i1 AS (
  INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, support_fr, support_en)
  SELECT p1.id, v.o, v.k, v.he, v.fr, v.en FROM p1, (VALUES
    (0, 'narrative', 'בַּבֹּקֶר, כִּכַּר מֵרָגָ׳ה מִתְמַלֵּאת אֲנָשִׁים.', $$Le matin, la place Marjeh se remplit de monde.$$, $$In the morning, Marjeh Square fills with people.$$),
    (1, 'narrative', 'אֵלִי יוֹשֵׁב בְּבֵית הַקָּפֶה וְקוֹרֵא עִתּוֹן.', $$Eli est assis au café et lit un journal.$$, $$Eli sits in the café and reads a newspaper.$$),
    (2, 'dialogue', '״בֹּקֶר טוֹב, אֲדוֹנִי,״ אוֹמֵר הַמּוֹכֵר.', $$« Bonjour, monsieur », dit le vendeur.$$, $$"Good morning, sir," says the vendor.$$),
    (3, 'dialogue', '״בֹּקֶר טוֹב. קָפֶה, בְּבַקָּשָׁה.״', $$« Bonjour. Un café, s'il vous plaît. »$$, $$"Good morning. A coffee, please."$$)
  ) AS v(o, k, he, fr, en) RETURNING id
),
i2 AS (
  INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, support_fr, support_en)
  SELECT p2.id, v.o, v.k, v.he, v.fr, v.en FROM p2, (VALUES
    (0, 'narrative', 'הַמִּשְׁטָרָה עוֹבֶרֶת בָּרְחוֹב פַּעֲמַיִם בְּיוֹם.', $$La [[Michtara|102]] passe dans la [[rekhov|104]] deux fois par jour.$$, $$The [[Michtara|102]] passes down the [[rekhov|104]] twice a day.$$),
    (1, 'narrative', 'הַסּוֹחֵר מַכִּיר כָּל אָדָם בַּשּׁוּק.', $$Le [[sokher|103]] connaît chaque homme du marché.$$, $$The [[sokher|103]] knows every man in the market.$$),
    (2, 'dialogue', '״אַתָּה חָדָשׁ כָּאן?״ שׁוֹאֵל הַסּוֹחֵר.', $$« Vous êtes nouveau ici ? » demande le [[sokher|103]].$$, $$"Are you new here?" asks the [[sokher|103]].$$)
  ) AS v(o, k, he, fr, en) RETURNING id
),
i3 AS (
  INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud)
  SELECT p3.id, v.o, v.k, v.he FROM p3, (VALUES
    (0, 'narrative', 'הַקָּצִין הִגִּיעַ בָּעֶרֶב, בְּלִי הַתְרָאָה, עִם מִזְוָדָה קְטַנָּה בַּיָּד.'),
    (1, 'narrative', 'הַשָּׁכֵן מִן הַקּוֹמָה הַשְּׁנִיָּה עָמַד בַּחַלּוֹן וְהִסְתַּכֵּל.'),
    (2, 'dialogue', '״אֲנִי מְחַפֵּשׂ אֶת מַר תָּאבֶּת,״ אָמַר הַקָּצִין בְּשֶׁקֶט.'),
    (3, 'dialogue', '״הוּא עָלָה לְמַעְלָה,״ עָנָה הַשָּׁכֵן.')
  ) AS v(o, k, he) RETURNING id
),
i4 AS (
  INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_plain, he_nikud)
  SELECT p4.id, v.o, v.k, v.plain, v.nikud FROM p4, (VALUES
    (0, 'narrative', 'שתיים בלילה. אלי לא חשש מן החיילים ברחוב.', 'שְׁתַּיִם בַּלַּיְלָה. אֵלִי לֹא חָשַׁש מִן הַחַיָּלִים בָּרְחוֹב.'),
    (1, 'narrative', 'המבטא שלו היה של איש דמשק, ולא של איש זר.', 'הַמִּבְטָא שֶׁלּוֹ הָיָה שֶׁל אִישׁ דַּמֶּשֶׂק, וְלֹא שֶׁל אִישׁ זָר.'),
    (2, 'dialogue', '״לאן אתה הולך בשעה כזאת?״ שאל השומר.', '״לְאָן אַתָּה הוֹלֵךְ בְּשָׁעָה כָּזֹאת?״ שָׁאַל הַשּׁוֹמֵר.')
  ) AS v(o, k, plain, nikud) RETURNING id
),
k3 AS (
  INSERT INTO public.page_keys (page_id, sort_order, gloss_no, he_nikud, translit, sense_fr, sense_en)
  SELECT p3.id, v.o, v.no, v.he, v.tr, v.fr, v.en FROM p3, (VALUES
    (0, 105, 'קָצִין', 'katsin', 'officier', 'officer'),
    (1, 106, 'שָׁכֵן', 'shakhen', 'voisin', 'neighbour'),
    (2, 107, 'מִזְוָדָה', 'mizvada', 'valise', 'suitcase'),
    (3, 101, 'כִּכָּר', 'kikar', 'place, esplanade', 'square')
  ) AS v(o, no, he, tr, fr, en) RETURNING id
)
INSERT INTO public.page_keys (page_id, sort_order, gloss_no, he_nikud, translit, sense_fr, sense_en)
SELECT p4.id, v.o, v.no, v.he, v.tr, v.fr, v.en FROM p4, (VALUES
  (0, 108, 'לַחְשׁוֹשׁ', 'lakhshosh', 'craindre', 'to fear'),
  (1, 109, 'מִבְטָא', 'mivta', 'accent', 'accent')
) AS v(o, no, he, tr, fr, en);
