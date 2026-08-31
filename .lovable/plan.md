# Brique 9 bis — les règles jugées deviennent un prompt

## Ce qui ne bouge pas

Les critères mécaniques restent dans la grille, calculés par le code de calibrage, aucune valeur touchée. Le calcul des notes, les trois sorties (validé, plafond, stagnation), la règle « un critère non rendu échoue », la frontière éditeur → contexte → client d'administration : rien de tout cela ne change. Le seuil, le plafond de tours et la stratégie restent des réglages d'étape.

## Chantier 1 — le modèle se choisit dans une liste

- Nouveau module partagé `src/lib/modeles.ts` : `ModeleAtelier`, `MODELES_ATELIER` (Gemini 2.5 Flash par la passerelle, sans recherche en ligne ; Claude Sonnet 4.6 par la clé Anthropic, avec recherche en ligne) et `modeleConnu(id)`. Aucune clé dedans.
- Dans Atelier › Prompts, aux deux endroits de saisie (nouveau prompt, nouvelle version) : le champ libre devient une liste déroulante, avec une entrée vide « — aucun — » qui vaut « aucun modèle ».
- La case « recherche en ligne » est grisée et remise à faux dès que le modèle choisi ne la propose pas.
- Un modèle déjà enregistré mais absent de la liste s'affiche en fin de liste, suffixé « (hors liste) » : aucun réglage existant n'est effacé en silence.
- Texte d'aide remplacé, en français et en anglais : « Deux modèles sont ouverts dans l'atelier. La recherche en ligne n'est possible qu'avec Claude. »
- Contrôle serveur dans `atelier-prompts.functions.ts` (enregistrement d'un prompt et d'une version) : un modèle non nul hors liste est refusé avec « Modèle hors liste de l'atelier : « X ». » Le refus ne s'applique que si le modèle soumis diffère de celui déjà enregistré sur le prompt : republier une version en conservant le modèle en place reste possible, même hors liste.
- Identifiants exacts, jamais abrégés ni normalisés : `google/gemini-2.5-flash` (passerelle Lovable, clé `LOVABLE_API_KEY`, pas de recherche en ligne) et `claude-sonnet-4-6` (Anthropic, clé `ANTHROPIC_API_KEY`, recherche en ligne possible).

## Chantier 2 — migration

- Trois prompts nouveaux, chacun avec sa propre étape pour ne pas entrer en collision avec l'unicité (étape, langue) des prompts actifs : `controle` (« Contrôleur — méthode », étape `controle`), `regles_plan` (« Règles — Plan de chapitres », étape `regles_plan`), `regles_recit` (« Règles — Récit », étape `regles_recit`). Langue `fr`, aucune collection. Version 1 active, contenu provisoire d'une ligne « à remplir » en attendant les textes ; le prompt `controle` reçoit dès la migration le modèle `claude-sonnet-4-6`, pour être appelable sans réglage.
- Aucun prompt existant n'est désactivé, déplacé ni modifié — `controle_plan` et `controle_recit` restent tels quels.
- Les critères de la grille dont l'espèce est « jugé » passent inactifs. Ils ne sont pas supprimés. Les mécaniques restent actifs et intacts.
- Deux colonnes sur les rapports : `regles_prompt_version_id`, `regles_version` — contre quelle version des règles le rapport a été rendu.


## Chantier 3 — lire les règles écrites

Le code ne connaît aucune règle, seulement la forme d'une déclaration :

```text
[code · famille · bloquant] Libellé court
Le texte de la règle, sur autant de lignes que nécessaire.
```

Le code est en minuscules, chiffres et tirets bas ; la famille est exactement conformite, structure, pedagogie ou langue ; le troisième champ est « bloquant » ou « simple » ; les espaces autour des points médians sont tolérés. Tout ce qui précède la première déclaration est un préambule : transmis au contrôleur, mais ne produit aucun verdict.

`lireReglesEcrites(texte)` renvoie préambule, critères jugés et problèmes. Elle refuse — et le contrôle échoue au lieu de valider — quand : aucune déclaration, deux fois le même code, un code déjà porté par un critère mécanique actif de la grille, une famille inconnue, une déclaration sans texte sous elle. Le message nomme la ligne fautive.

## Chantier 4 — le contrôleur lit deux prompts

- `lirePromptControleur` ne prend plus de code d'étape : elle lit toujours le prompt `controle`.
- `lirePromptRegles(editor, stepCode)` lit `regles_plan` pour l'étape plan et `regles_recit` pour la rédaction, et remonte contenu, identifiant de version et numéro de version. Mêmes refus nommés qu'aujourd'hui : pas de version active, pas de modèle, modèle inconnu, clé absente.
- Dans un tour de contrôle : les mécaniques viennent de la grille (espèce mécanique uniquement), les jugés viennent des règles écrites, la liste envoyée au modèle est bâtie à partir des critères jugés puis suivie du préambule et du texte intégral des règles.
- L'enregistrement du rapport écrit la version des règles. Sur un verdict jugé, l'identifiant de critère est nul ; code, libellé, famille et caractère bloquant restent écrits en clair — le rapport reste lisible après réécriture des règles.

## Chantier 5 — l'écran Qualité

- « Les grilles de critères » ne liste plus que les mesures, sous le titre « Les mesures — calculées par le code, non modifiables ici ».
- Section nouvelle « Les règles jugées » : par étape contrôlée, le nom du prompt de règles, sa version active, le nombre de règles lues, la liste des codes, et un lien vers la fiche du prompt.
- Si la lecture des règles échoue, la section affiche le message d'erreur en clair à la place de la liste.
- Le formulaire d'ajout et de modification d'un critère jugé disparaît.

## Détails techniques

- Migration SQL : `insert` des trois prompts + version 1 + `active_version_id` ; `update prompts set is_active = false` sur les deux anciens contrôleurs ; `update qc_criteria set is_active = false where species = 'juge'` ; `alter table qc_reports add column regles_prompt_version_id uuid references prompt_versions(id), add column regles_version integer`. Aucun GRANT nouveau.
- `src/lib/qc-core.server.ts` : `lireReglesEcrites`, `lirePromptRegles`, `lirePromptControleur` sans argument de code ; `Critere.id` devient `string | null`.
- `src/lib/qc-run.server.ts` : `unTour` filtre la grille sur les mécaniques, appelle les règles écrites, `enregistrerRapport` écrit les deux colonnes.
- `src/lib/qc.functions.ts` : une fonction serveur qui, pour la salle Qualité, remonte par étape le prompt de règles, sa version, les codes lus ou l'erreur de lecture.
- `src/routes/atelier.qualite.tsx`, `src/components/AtelierQcPolicies.tsx`, `src/routes/atelier.prompts.tsx`, `src/lib/atelier-prompts.functions.ts`, `src/i18n/dictionaries.ts` : modifications décrites ci-dessus, rien d'autre.
