# Deux éditions par livre (FR / EN)

Mise en œuvre du cahier joint, dans l'ordre ci-dessous. Une seule fiche livre, deux états d'édition, aucun repli d'une langue sur l'autre.

## 1. Base (une migration)
- Type `edition_etat` (absente, preparation, publiee) ; `books.edition_fr` (défaut preparation), `books.edition_en` (défaut absente), `glossaire_fr_path`, `glossaire_en_path`.
- Reprise : `edition_fr = publiee` si `status = published`, sinon preparation ; `edition_en = absente`.
- Policies publiques réécrites sur `(edition_fr = 'publiee' OR edition_en = 'publiee')` : `books`, `spread_paragraphs`, `glossary_entries`. `pages` / `page_sections` intactes.
- `quiz_questions.lang` (fr|en, reprise selon prompt_fr/prompt_en) + index `(book_id, lang)`.
- `remplacer_quiz_livre(p_book_id, p_lang, p_rows)` : ne remplace que la langue donnée ; ancienne signature supprimée ; service_role seul.
- Bucket privé `glossaires`, chemin `<book_id>/<fr|en>/<fichier>`.

## 2. Plus aucun repli
- `pickLang` renvoie la valeur de la langue demandée ou `null`.
- Tous les usages (SiteCopy, BookSpread, PageSections, collections, livres, b/$qr_code, accueil, glossarySense, QuizRound, titres de chapitre) : bloc vide = non affiché.

## 3. Site public et QR
- `catalog.functions.ts` : chaque fonction reçoit la langue active et filtre sur l'édition publiée (livres, collections avec au moins un livre publié, fiche livre → introuvable, démonstration).
- Bouton Amazon : `amazon_url_fr` (FR) / `amazon_url_com` (EN), masqué si vide.
- `/b/$qr_code` : « publié » = édition de la langue active publiée.

## 4. Compagnon
- Édition non publiée → message « non disponible ».
- Lecture inchangée ; titres de chapitre de la langue active, sinon « Chapitre N ».
- Entraînement : questions de la langue active seulement, sinon « L'entraînement de ce livre arrive bientôt. ».
- Glossaire : liste retirée de l'écran, remplacée par « Télécharger le glossaire » (URL signée de quelques minutes après contrôle `book_access`) ou « Le glossaire arrive bientôt. ».

## 5. Atelier, fiche livre
- En-tête : pastilles FR / EN + sélecteur `?edition=fr|en`, partagé par les onglets.
- Informations : champs communs + champs de l'édition choisie ; dépôt PDF du glossaire (nom, date, Remplacer, Télécharger) ; choix de l'état ; titre obligatoire pour chaque édition non absente, au moins une édition non absente.
- Liste de contrôle avant « publiée » : bloquants (titre, résumé, lien Amazon, glossaire, soutien sur toutes les pages, titre de chaque chapitre, nom de collection) et avertissements (quiz, sous-titre, « ce que vous apprendrez »). Vérifiée aussi côté serveur.
- Pages : l'éditeur n'affiche que les champs de l'édition choisie ; la liste signale les pages sans soutien.
- Quiz : stats/export/import par langue ; fichier d'une autre langue refusé ; confirmation « Les X questions françaises… Le quiz anglais n'est pas modifié. ».

## 6. Textes
Toutes les nouvelles chaînes FR/EN dans les dictionnaires.

## Points à signaler
- Les tables `excerpt_paragraphs` et `excerpt_segments` citées dans le cahier n'existent pas en base : rien à réécrire pour elles.
- Retirer le repli de `pickLang` fera disparaître sur le site anglais tout texte dont l'anglais est vide aujourd'hui (voulu, mais visible tout de suite).
- Seul Eli Cohen existe : les tests A–10 se feront en changeant ses états puis en les rétablissant.

## Non fait
Aucune table « éditions », aucune traduction, aucune suppression de données, rien sur l'hébreu, l'audio, Brique 7, `qc_*`.
