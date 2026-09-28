# Brique 9 — Quiz des livres : dépôt JSON dans l'atelier, onglet Entraînement dans le compagnon

Mise en œuvre du cahier fourni, sans écart. Livraison en trois temps, dans cet ordre, avec vérification entre chaque.

## Temps 1 — Base (une seule migration)
- `quiz_questions.page_no integer NULL` (ajout seul, rien de supprimé).
- Fonction `remplacer_quiz_livre(p_book_id, p_rows jsonb)` : supprime puis insère dans la même transaction, exécutable par le seul rôle de service ; renvoie le nombre de lignes.
- Table `quiz_answers` (réponses du lecteur) : index `(user_id, book_id)` et `(question_id)`, cascade sur la question ; le lecteur lit et ajoute ses propres lignes, ni modification ni suppression.
- `reader_progress` et `saveQuizRound` restent en place.
- Aucune question insérée en base.

## Temps 2 — Atelier : onglet Quiz de la fiche livre
- `src/lib/quiz-json.ts` (module pur) : contrôle du fichier selon A1 — erreurs bloquantes numérotées par question et par champ, avertissements (champ inconnu, livre sans page), position ligne/colonne d'un JSON illisible, résumé par chapitre et par type.
- `src/lib/atelier-quiz.functions.ts` : `analyserQuiz` (n'écrit rien), `importerQuiz` (réanalyse côté serveur, tout ou rien), `exporterQuiz` (même format que le dépôt), `statsQuiz` — chaîne `requireSupabaseAuth` → `assertEditor` → `getAdminClient`.
- `src/components/AtelierLivreQuiz.tsx` : colonne « En ligne » (total, ligne par chapitre avec taux de réussite, question la plus ratée à partir de 5 réponses, téléchargement) ; colonne « Nouveau fichier » (dépôt ou collage, analyse automatique, rapport, boutons « Essayer le quiz » dans un cadre de 390 px et « Mettre en ligne » avec confirmation dans la page). Même principe que l'écran de collage : rien ne s'écrit avant une analyse sans erreur.
- Fiche livre : l'onglet Quiz quitte la liste « à venir ».

## Temps 3 — Compagnon : trois onglets
- Bandeau du livre à la couleur de la collection (variable `--collection` posée sur le conteneur), onglets Lecture · Entraînement · Glossaire gardés dans l'adresse (`?onglet=`), mode concentration pendant une série. Ligne « Votre entraînement jusqu'ici » retirée.
- `getCompanionBook` renvoie en plus `page_no` par question, les chapitres (titre, première/dernière page, depuis les pages publiées) et la dernière réponse du lecteur par question. Nouvelle `enregistrerReponse` : contrôle `book_access`, justesse recalculée côté serveur, appelée à chaque réponse.
- `src/lib/quiz-progress.ts` (pur) : à revoir, réussite par chapitre, chapitre commencé, chapitre proposé.
- Accueil de l'onglet (carte Continuer, bouton À revoir, liste des chapitres avec anneau ou « Bientôt »), `QuizRound` refondu (tuiles, cartouche hébreu, verrouillage au toucher), panneau de correction (lien « Relire la page N »), bilan (score, segments, questions ratées, refaire / chapitre suivant ; `saveQuizRound` toujours appelé).
- `LecteurLivre` : seulement deux props optionnelles, `initialPageNo` et `retour`. Rien d'autre ne change.

## Détails
- Quatre jetons ajoutés dans `styles.css` avec leur version nuit : `--color-paper`, `--color-ivory-2`, `--color-alert`, `--color-alert-soft`. Aucun jeton existant modifié, aucune couleur en dur.
- Tous les textes en FR et EN dans les dictionnaires.
- Accessibilité : `tablist`/`tab`, cibles de 44 px, panneau `aria-live`, 360 px sans défilement horizontal.
- Interdits respectés : pas d'IA, pas d'autre table, pas de modification de la brique 7, des tables `qc_*`, de l'onglet Livre, de l'audio, de l'accès par QR code.

## Deux points à signaler dès maintenant
- Le livre Eli Cohen n'a aujourd'hui qu'une page (la 1, non publiée). Pour le compagnon, les chapitres se calculent depuis les pages publiées : tant qu'elle ne l'est pas, l'onglet Entraînement n'aura aucun chapitre à proposer. Côté atelier, le contrôle des chapitres lit toutes les pages du livre, publiées ou non.
- Je n'ai aucun fichier de quiz réel : les essais se feront avec un fichier de test que je retire ensuite. Aucune question ne restera en base.

## Rapport en fin de brique
Fichiers créés et modifiés, contenu de la migration, chaîne de sécurité de l'import, résultat de chacun des onze tests de réception.
