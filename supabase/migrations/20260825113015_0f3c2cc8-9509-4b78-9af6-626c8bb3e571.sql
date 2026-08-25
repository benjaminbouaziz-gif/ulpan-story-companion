-- Prononciation au glossaire : c'est elle qui referme la boucle avec les trous.
UPDATE public.glossary_entries SET translit = v.translit, first_page = v.first_page
FROM (VALUES
  (1, 'nolad', 12), (2, 'lamad', 12), (3, 'barehov', 24), (4, 'ala', 24),
  (5, 'rechima', 36), (6, 'chéela', 36), (7, 'chéket', 36), (8, 'imoun', 48),
  (9, 'levad', 48), (10, 'karou lo', 48)
) AS v(gloss_no, translit, first_page)
WHERE public.glossary_entries.gloss_no = v.gloss_no;

DELETE FROM public.book_pages
WHERE book_id = 'bd8eef88-d9b5-4f29-9c74-85bd0c4996ae';

-- Étape 1 : hébreu vocalisé | traduction
WITH p AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, chapter_title_he, chapter_title_fr, chapter_title_en, running_head_fr, running_head_en, folio, is_published, validated_at)
  VALUES ('bd8eef88-d9b5-4f29-9c74-85bd0c4996ae', 12, 1, 'translation', 'פֶּרֶק אֶחָד', 'Un enfant du Caire', 'A child of Cairo', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 12, true, now())
  RETURNING id
)
INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en)
SELECT p.id, v.sort_order, v.block_kind, v.he_nikud, NULL, v.support_fr, v.support_en FROM p, (VALUES
  (1, 'narrative', 'אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם, בְּבַיִת שֶׁדִּבְּרוּ בּוֹ עִבְרִית וְעַרְבִית.', 'Eli Cohen est né en Égypte, dans une maison où l''on parlait hébreu et arabe.', 'Eli Cohen was born in Egypt, in a house where Hebrew and Arabic were spoken.'),
  (2, 'narrative', 'הוּא לָמַד עִבְרִית בַּבַּיִת וְעַרְבִית בָּרְחוֹב, וְאִישׁ לֹא רָאָה בּוֹ דָּבָר מְיֻחָד.', 'Il a appris l''hébreu à la maison et l''arabe dans la rue, et personne ne voyait en lui rien de particulier.', 'He learned Hebrew at home and Arabic in the street, and no one saw anything unusual in him.'),
  (3, 'dialogue', '— אֵלִי, אָמְרָה אִמּוֹ, אַל תְּדַבֵּר עַרְבִית בַּבַּיִת.', '— Eli, dit sa mère, ne parle pas arabe à la maison.', '— Eli, his mother said, do not speak Arabic in the house.'),
  (4, 'narrative', 'הוּא שָׁתַק, וְהִמְשִׁיךְ לִקְרוֹא אֶת הָעִתּוֹן שֶׁל אָבִיו.', 'Il s''est tu, et a continué de lire le journal de son père.', 'He said nothing, and went on reading his father''s newspaper.')
) AS v(sort_order, block_kind, he_nikud, support_fr, support_en);

-- Étape 2 : hébreu vocalisé | traduction à trous
WITH p AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, chapter_title_he, chapter_title_fr, chapter_title_en, running_head_fr, running_head_en, folio, is_published, validated_at)
  VALUES ('bd8eef88-d9b5-4f29-9c74-85bd0c4996ae', 24, 4, 'cloze', 'פֶּרֶק אַרְבַּע', 'La liste', 'The list', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 24, true, now())
  RETURNING id
)
INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en)
SELECT p.id, v.sort_order, v.block_kind, v.he_nikud, NULL, v.support_fr, v.support_en FROM p, (VALUES
  (1, 'narrative', 'בְּיוֹם אֶחָד הוּא עָלָה לְיִשְׂרָאֵל, וּשְׁמוֹ הָיָה עוֹד שֵׁם אֶחָד בָּרְשִׁימָה.', 'Un jour il [[ala|4]] en Israël, et son nom n''était qu''un nom de plus sur la [[rechima|5]].', 'One day he [[ala|4]] to Israel, and his name was one more name on the [[rechima|5]].'),
  (2, 'narrative', 'הוּא חִכָּה בַּמִּשְׂרָד שָׁעָה, וְאָז נִכְנַס אִישׁ עִם שְׁאֵלָה אַחַת.', 'Il a attendu une heure dans le bureau, puis un homme est entré avec une seule [[chéela|6]].', 'He waited an hour in the office, then a man came in with a single [[chéela|6]].'),
  (3, 'dialogue', '— אַתָּה מְדַבֵּר עַרְבִית בָּרְחוֹב כְּמוֹ בַּבַּיִת?', '— Vous parlez arabe [[barehov|3]] comme à la maison ?', '— Do you speak Arabic [[barehov|3]] as you do at home?'),
  (4, 'narrative', 'אֵלִי עָנָה בְּעַרְבִית, וְהָאִישׁ לֹא כָּתַב דָּבָר.', 'Eli a répondu en arabe, et l''homme n''a rien écrit.', 'Eli answered in Arabic, and the man wrote nothing down.')
) AS v(sort_order, block_kind, he_nikud, support_fr, support_en);

-- Étape 3 : hébreu vocalisé | clés seules
WITH p AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, chapter_title_he, chapter_title_fr, chapter_title_en, running_head_fr, running_head_en, folio, is_published, validated_at)
  VALUES ('bd8eef88-d9b5-4f29-9c74-85bd0c4996ae', 36, 8, 'keys', 'פֶּרֶק שְׁמוֹנֶה', 'Le silence du bureau', 'The silence of the office', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 36, true, now())
  RETURNING id
), b AS (
  INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en)
  SELECT p.id, v.sort_order, v.block_kind, v.he_nikud, NULL, NULL, NULL FROM p, (VALUES
    (1, 'narbeh', 'x')
  ) AS v(sort_order, block_kind, he_nikud) WHERE false
  RETURNING page_id
)
INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en)
SELECT p.id, v.sort_order, v.block_kind, v.he_nikud, NULL, NULL, NULL FROM p, (VALUES
  (1, 'narrative', 'בַּמִּשְׂרָד הָיָה שֶׁקֶט, וְאֵלִי חִכָּה בְּלִי לִשְׁאוֹל שְׁאֵלָה.'),
  (2, 'dialogue', '— תִּהְיֶה לְבַד, אָמַר הָאִישׁ. אֵין מִי שֶׁיַּעֲזוֹר לְךָ.'),
  (3, 'narrative', 'אַחֲרֵי חֳדָשִׁים שֶׁל אִימּוּנִים קָרְאוּ לוֹ בְּשֵׁם אַחֵר.')
) AS v(sort_order, block_kind, he_nikud);

INSERT INTO public.page_keys (page_id, sort_order, gloss_no, he_nikud, translit, sense_fr, sense_en)
SELECT bp.id, v.sort_order, v.gloss_no, v.he_nikud, v.translit, v.sense_fr, v.sense_en
FROM public.book_pages bp, (VALUES
  (1, 7, 'שֶׁקֶט', 'chéket', 'calme, silence', 'quiet, silence'),
  (2, 6, 'שְׁאֵלָה', 'chéela', 'question', 'question'),
  (3, 9, 'לְבַד', 'levad', 'seul', 'alone'),
  (4, 8, 'אִימּוּן', 'imoun', 'entraînement', 'training'),
  (5, 10, 'קָרְאוּ לוֹ', 'karou lo', 'on l''appelait', 'they called him')
) AS v(sort_order, gloss_no, he_nikud, translit, sense_fr, sense_en)
WHERE bp.book_id = 'bd8eef88-d9b5-4f29-9c74-85bd0c4996ae' AND bp.page_no = 36;

-- Étape 4 : hébreu sans nekoudot (ktiv malé) | soutien vocalisé
WITH p AS (
  INSERT INTO public.book_pages (book_id, page_no, chapter_no, support_kind, chapter_title_he, chapter_title_fr, chapter_title_en, running_head_fr, running_head_en, folio, is_published, validated_at)
  VALUES ('bd8eef88-d9b5-4f29-9c74-85bd0c4996ae', 48, 12, 'nikud', 'פֶּרֶק שְׁתֵּים עֶשְׂרֵה', 'Damas', 'Damascus', 'Eli Cohen, un homme à Damas', 'Eli Cohen, a man in Damascus', 48, true, now())
  RETURNING id
)
INSERT INTO public.page_blocks (page_id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en)
SELECT p.id, v.sort_order, v.block_kind, v.he_nikud, v.he_plain, NULL, NULL FROM p, (VALUES
  (1, 'narrative', 'אַחֲרֵי חֳדָשִׁים שֶׁל אִימּוּנִים הוּא נָסַע לְדַמֶּשֶׂק, לְבַד, עִם שֵׁם חָדָשׁ.', 'אחרי חודשים של אימונים הוא נסע לדמשק, לבד, עם שם חדש.'),
  (2, 'narrative', 'בְּדַמֶּשֶׂק קָרְאוּ לוֹ כָּאמֶל אָמִין תָאבֶּת, וְאִיש לֹא שָׁאַל שְׁאֵלָה.', 'בדמשק קראו לו כאמל אמין תאבת, ואיש לא שאל שאלה.'),
  (3, 'dialogue', '— אַתָּה גָּר פֹּה לְבַד? שָׁאֲלָה הַשְּׁכֵנָה.', '— אתה גר פה לבד? שאלה השכנה.'),
  (4, 'narrative', 'הוּא חִיֵּךְ, אָמַר כֵּן בְּעַרְבִית, וְסָגַר אֶת הַדֶּלֶת.', 'הוא חייך, אמר כן בערבית, וסגר את הדלת.')
) AS v(sort_order, block_kind, he_nikud, he_plain);