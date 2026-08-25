-- Versioning + protection des sections
CREATE OR REPLACE FUNCTION public.archive_page_section()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.content_versions (entity, entity_id, snapshot, created_by)
  VALUES ('page_section', OLD.id, to_jsonb(OLD), auth.uid());
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.archive_page_section() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS archive_page_section_before_update ON public.page_sections;
CREATE TRIGGER archive_page_section_before_update
BEFORE UPDATE ON public.page_sections
FOR EACH ROW EXECUTE FUNCTION public.archive_page_section();

CREATE OR REPLACE FUNCTION public.protect_locked_page_section()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF OLD.is_locked THEN
    RAISE EXCEPTION 'Cette section fait partie du gabarit et ne peut pas être supprimée.';
  END IF;
  RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION public.protect_locked_page_section() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_locked_page_section_before_delete ON public.page_sections;
CREATE TRIGGER protect_locked_page_section_before_delete
BEFORE DELETE ON public.page_sections
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_page_section();

-- Le livre de référence
UPDATE public.books SET words_unique = 59 WHERE slug = 'eli-cohen';

-- La page méthode
INSERT INTO public.pages (slug, status, is_system)
VALUES ('methode', 'published', true)
ON CONFLICT (slug) DO UPDATE SET status = 'published', is_system = true;

DELETE FROM public.page_sections
WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'methode');

INSERT INTO public.page_sections (page_id, sort_order, kind, is_visible, is_locked, title_fr, body_fr, data)
SELECT p.id, v.sort_order, v.kind::public.section_kind, true, v.is_locked, v.title_fr, v.body_fr, v.data
FROM public.pages p,
(VALUES
 (1, 'richtext', false,
  $t$Vous allez à l'oulpan. Et entre deux cours, vous n'avez rien à lire.$t$,
  $t$Vous apprenez des règles, vous faites des exercices, vous accumulez du vocabulaire. Puis vous rentrez chez vous, et il ne se passe plus rien jusqu'au cours suivant. Les textes de votre manuel sont trop courts. Les livres israéliens sont trop durs — sans voyelles, avec un vocabulaire que vous n'avez pas. Les applications vous font répéter des mots isolés.

Il manque la chose la plus simple : une histoire, à votre niveau, qu'on ait envie de finir.

Ulpan Story ne remplace pas votre oulpan. C'est ce que vous lisez entre deux cours.$t$,
  '{}'::jsonb),
 (2, 'book_spread', false,
  $t$C'est la double page du livre. Pas une illustration, pas une maquette pour le site : le format, les marges, la typographie et la mise en page sont exactement ceux que vous aurez entre les mains. Les quatre paragraphes montrent les quatre étapes que le livre traverse, de la première à la dernière page.$t$,
  $t$Les quatre étapes sont réunies ici pour la démonstration. Dans le livre, chaque double page appartient à une seule étape.$t$,
  '{"book_id":"bd8eef88-d9b5-4f29-9c74-85bd0c4996ae"}'::jsonb),
 (3, 'steps', false,
  $t$À gauche, l'hébreu. À droite, ce qui vous aide. Et ce qui vous aide change quatre fois.$t$,
  NULL,
  $j${"steps":[
   {"n":1,"label_fr":"Étape 1","label_en":"","body_fr":"Vous lisez avec le texte français en face. La page de gauche est en hébreu vocalisé, la page de droite donne la traduction complète. Vous ne cherchez rien, vous ne butez sur rien : vous lisez, et vos yeux font l'aller-retour. C'est le moment où l'hébreu redevient une langue qu'on lit, pas une matière qu'on révise.","body_en":""},
   {"n":2,"label_fr":"Étape 2","label_en":"","body_fr":"La traduction se troue. Le français est toujours là, mais certains mots ont disparu. À leur place, le mot hébreu écrit en lettres latines. Vous savez comment il se prononce, vous savez ce qu'il fait dans la phrase — il ne vous reste qu'à le retrouver en face, dans le texte hébreu. C'est la première fois que vous lisez l'hébreu parce que vous en avez besoin, et non parce qu'on vous le demande.","body_en":""},
   {"n":3,"label_fr":"Étape 3","label_en":"","body_fr":"Il ne reste que le vocabulaire. Plus de récit traduit. La page de droite ne donne plus que les mots et leur sens. Vous lisez l'histoire en hébreu, et vous levez les yeux quand un mot vous manque. À ce stade, la plupart des mots de la page vous sont déjà familiers : vous les avez croisés quatre fois depuis le début du livre.","body_en":""},
   {"n":4,"label_fr":"Étape 4","label_en":"","body_fr":"Les rôles s'inversent. La page de gauche perd ses voyelles. C'est l'hébreu tel qu'il s'écrit en Israël, dans les journaux, sur les panneaux, dans les livres. Et la page de droite, elle, porte le même texte avec les nekoudot. Il n'y a plus un mot de français dans le livre. Vous ne quittez plus l'hébreu : vous changez seulement de béquille. C'est la dernière page, et vous venez de la lire.","body_en":""}
  ]}$j$::jsonb),
 (4, 'facts', false,
  $t$Ce qu'il y a dans un livre$t$,
  $t$Un livre se lit en entier. Il n'y a pas de tome 2 pour finir l'histoire : chaque livre commence à l'étape 1 et se termine à l'étape 4. Vous refaites le parcours complet à chaque titre, avec un vocabulaire nouveau et une histoire nouvelle.$t$,
  $j${"book_id":"bd8eef88-d9b5-4f29-9c74-85bd0c4996ae","facts":[
   {"value":"{{book.spread_pages}}","label_fr":"doubles pages de récit","label_en":""},
   {"value":"{{book.chapters_count}}","label_fr":"chapitres","label_en":""},
   {"value":"160 à 230","label_fr":"mots par page — le texte s'allonge à mesure que le soutien s'allège","label_en":""},
   {"value":"{{book.words_unique}}","label_fr":"mots de vocabulaire nouveaux, pas un de plus","label_en":""},
   {"value":"4","label_fr":"apparitions minimum pour chaque mot nouveau","label_en":""},
   {"value":"40 %","label_fr":"du livre en dialogues, au minimum","label_en":""},
   {"value":"1","label_fr":"histoire vraie, du début à la fin","label_en":""}
  ]}$j$::jsonb),
 (5, 'richtext', false,
  $t$Une soixantaine de mots. Choisis, pas subis.$t$,
  $t$Un livre n'introduit pas tout ce que l'histoire aurait pu contenir : il introduit une liste arrêtée à l'avance, et le récit est écrit pour la servir. Trois règles président à cette liste.

Chaque mot revient au moins quatre fois. Un mot vu une fois est un mot oublié. Un mot rencontré quatre fois dans quatre situations différentes est un mot qui reste. C'est la raison pour laquelle nos histoires sont écrites après la liste de vocabulaire, et non l'inverse.

Un mot nouveau n'apparaît jamais sans avoir été présenté. Quand un mot doit surgir plus tôt que prévu parce que l'histoire l'exige, il est glosé à cet endroit précis — vous ne tombez jamais sur un mot sans filet.

Le mot que vous cherchez est celui que vous voyez. Dans les trous de l'étape 2, le mot donné en phonétique est celui exactement tel qu'il est écrit sur la page d'en face — conjugué, accordé, avec sa préposition. Pas une forme de dictionnaire que vous devriez reconstruire. Le glossaire, lui, vous donne la forme de citation : l'infinitif pour les verbes, le singulier pour les noms.$t$,
  '{}'::jsonb),
 (6, 'richtext', false,
  $t$Des dialogues, et de l'hébreu qu'on parle$t$,
  $t$Plus de 40 % du livre est en dialogues. Ce n'est pas un hasard.

L'hébreu du récit et l'hébreu de la conversation ne sont pas le même hébreu. Un livre qui ne serait que narration vous apprendrait à lire un rapport, pas à commander un café.

Dans les dialogues, nous nous autorisons dès la première page ce que la progression n'aurait pas encore permis ailleurs : l'impératif, les formules orales figées, les tournures qu'on entend cent fois par jour en Israël et qu'aucune leçon de grammaire ne vous donnera au bon moment. Un personnage qui dit « écoute », « viens », « attends » ne conjugue pas : il parle. Vous apprenez ces formes comme vous les entendriez, en bloc, à leur place.

Le reste du récit s'en tient à des temps simples et à des phrases courtes. On ne vous fera pas franchir trois obstacles dans la même ligne : le vocabulaire est nouveau, la grammaire ne l'est pas.$t$,
  '{}'::jsonb),
 (7, 'richtext', true,
  $t$Ce que ce livre ne fait pas$t$,
  $t$Il ne remplace pas votre oulpan. Il n'enseigne pas la grammaire, il ne corrige pas vos exercices, il ne vous fera pas passer un niveau. Il vous donne ce que votre oulpan ne peut pas vous donner : du temps de lecture, en continu, avec plaisir.

Il ne vous fera pas parler tout seul. Lire beaucoup rend l'oral plus facile, ça ne le remplace pas. Il faut parler à des gens.

Il ne vous promet pas de délai. Vous ne lirez pas l'hébreu en trente jours parce que vous aurez lu un livre. Vous lirez, à la dernière page, un texte hébreu sans voyelles et sans traduction — et c'est déjà considérable.$t$,
  '{}'::jsonb),
 (8, 'richtext', false,
  $t$Ce qu'il y a derrière le QR code$t$,
  $t$Le livre continue sur votre téléphone.

À la fin de chaque livre, un QR code. Il ouvre l'espace de ce titre, offert avec le livre :

Le glossaire complet, cherchable, avec sa version imprimable — parce qu'une feuille à côté du livre vaut mieux qu'un téléphone dans la main.

Les quiz, chapitre par chapitre, pour vérifier ce qui est resté.

La lecture audio du texte hébreu, pour entendre ce que vous venez de lire.

Un compagnon avec qui parler de l'histoire, en hébreu ou en hébreu phonétique, qui n'emploie que les mots du livre.

Il n'y a rien à installer, rien à payer, et aucune raison de quitter votre page pendant que vous lisez.$t$,
  '{}'::jsonb),
 (9, 'faq', false,
  NULL, NULL,
  $j${"items":[
   {"q_fr":"Quel niveau faut-il avoir ?","q_en":"","a_fr":"Il faut savoir déchiffrer l'alphabet hébreu et lire avec les nekoudot, même lentement. Si vous êtes à l'oulpan depuis quelques mois, vous êtes au bon endroit. Si vous ne lisez pas encore les lettres, commencez par là — ce livre ne vous l'apprendra pas.","a_en":""},
   {"q_fr":"Faut-il connaître beaucoup de vocabulaire ?","q_en":"","a_fr":"Non. Le livre suppose le vocabulaire de base de l'oulpan et introduit un par un les mots dont il a besoin.","a_en":""},
   {"q_fr":"Combien de temps par jour ?","q_en":"","a_fr":"Une double page prend quelques minutes. Rien ne vous oblige à en faire plus, et rien ne vous compte les jours : il n'y a ni série à tenir ni notification.","a_en":""},
   {"q_fr":"Et si je bute sur un mot ?","q_en":"","a_fr":"Il est en face, ou dans le glossaire du QR code. Vous n'êtes jamais bloqué.","a_en":""},
   {"q_fr":"Est-ce le même livre en français et en anglais ?","q_en":"","a_fr":"La même histoire, le même hébreu, mais les pages de soutien sont écrites séparément dans chaque langue.","a_en":""},
   {"q_fr":"En combien de temps arrive-t-on à l'étape 4 ?","q_en":"","a_fr":"À la fin du livre. C'est-à-dire tout de suite, à l'échelle d'une langue.","a_en":""}
  ]}$j$::jsonb)
) AS v(sort_order, kind, is_locked, title_fr, body_fr, data)
WHERE p.slug = 'methode';