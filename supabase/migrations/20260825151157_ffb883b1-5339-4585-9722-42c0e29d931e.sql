ALTER TABLE public.page_sections
  ADD COLUMN IF NOT EXISTS locales text[] NOT NULL DEFAULT ARRAY['fr','en']::text[];

UPDATE public.page_sections SET sort_order = sort_order + 1
WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'methode')
  AND sort_order >= 7;

INSERT INTO public.page_sections (page_id, kind, sort_order, is_visible, is_locked, locales, title_fr, body_fr, data)
SELECT p.id, 'richtext'::section_kind, 7, true, false, ARRAY['fr']::text[],
  'Nos choix d''éditeur',
$$Certains trous donnent la racine, pas le mot de la page.

À l'étape 2, le mot retiré du français est remplacé par le mot hébreu en lettres latines, suivi de son numéro de glossaire. La règle générale est simple : ce que vous lisez dans le trou est ce que vous verrez en face, conjugué et accordé exactement pareil.

Nous nous en écartons parfois, et volontairement : à certains endroits, le trou donne la racine — le shoresh, ces trois lettres autour desquelles l'hébreu tout entier s'organise. Vous ne pouvez alors plus recopier : il faut chercher, comparer les lettres, retrouver sur la page d'en face le mot qui en est issu.

Pourquoi vous compliquer la tâche ? Parce que c'est le geste central du lecteur d'hébreu. Une même racine donne le verbe, le nom, le lieu, le métier, l'objet — celui qui n'apprend que des mots isolés apprend une langue deux fois plus grande qu'elle n'est, tandis que celui qui reconnaît la racine devine des mots qu'il n'a jamais rencontrés. Ce petit ralentissement est exactement ce qui installe le réflexe, et il vous servira longtemps après ce livre.

Le glossaire, lui, ne vous laisse jamais en plan : il donne toujours la forme de citation — l'infinitif pour les verbes, le singulier pour les noms. Le numéro reste le chemin sûr.

Ce procédé n'existe qu'à l'étape 2, celle des chapitres 3 à 7 — c'est la seule où la page de droite comporte des trous. Aux étapes 1, 3 et 4, la question ne se pose pas : il n'y a rien à retrouver.

Le français et l'hébreu ne sont pas d'accord sur le genre. C'est normal.

Le soleil est masculin en français et féminin en hébreu. Le chemin est masculin chez nous et féminin là-bas. Quand un trou remplace un mot français par un mot hébreu, deux grammaires se rencontrent dans la même phrase, et il faut choisir laquelle commande.

Nous avons tranché ainsi : la phrase de la page de droite reste une phrase française. L'article, l'adjectif et le participe s'accordent avec le mot français que le trou remplace, jamais avec le genre du mot hébreu. Vous lirez donc « une Dèrèkh importante » si le mot remplacé était « une route », même si l'hébreu, lui, ne se comporte pas ainsi sur la page d'en face.

Pourquoi ce choix ? Parce que la page de droite est un soutien, pas une leçon de grammaire hébraïque. Si elle se mettait à suivre les accords de l'hébreu, elle deviendrait du français fautif, et vous corrigeriez mentalement au lieu de lire. Le genre hébreu, vous l'apprendrez là où il se voit vraiment : sur la page de gauche, dans les accords du texte lui-même.

(À compléter : préciser le traitement retenu pour les verbes, dont la forme hébraïque porte le genre et le nombre du sujet.)

Ce que nous ne corrigeons pas.

(À compléter si tu veux une troisième entrée — par exemple les formules orales figées des dialogues, ou les mots introduits avant leur place dans la progression.)$$,
  '{"admin_note_fr":"Cette section est propre à l''édition française. La question du genre grammatical ne se pose pas en anglais, où les noms n''ont pas de genre : la version anglaise aura ses propres difficultés, et donc ses propres explications."}'::jsonb
FROM public.pages p WHERE p.slug = 'methode'
AND NOT EXISTS (
  SELECT 1 FROM public.page_sections s WHERE s.page_id = p.id AND s.title_fr = 'Nos choix d''éditeur'
);