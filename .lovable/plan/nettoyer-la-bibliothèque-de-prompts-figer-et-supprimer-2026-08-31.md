# Nettoyer la bibliothèque de prompts : Figer et Supprimer

## Ce que j'ai vérifié

Les cinq prompts visés :

| Prompt | Versions | Artefacts produits | Autres liens |
|---|---|---|---|
| Contrôleur — méthode | 2 | 0 | aucun |
| Contrôleur — Plan de chapitres | 7 | 0 | aucun |
| Contrôleur — Récit | 1 | 0 | aucun |
| Règles — Plan de chapitres | 2 | 0 | **1 rapport de contrôle** y fait référence |
| Règles — Récit | 2 | 0 | aucun |

Aucun de ces prompts n'est utilisé par le code de l'atelier : le robot de plan et le robot de rédaction ne lisent que les prompts des étapes `plan` et `redaction`. Aucun livre ne pointe dessus. Quatre sont donc entièrement détachables.

Un seul accroc : « Règles — Plan de chapitres » est cité par un rapport de contrôle enregistré en base. Le supprimer effacerait une trace d'historique.

## Ce que je propose

Deux boutons dans le dossier d'un prompt, plutôt qu'un ménage manuel à chaque fois :

**Figer** — le prompt sort de la bibliothèque active : il n'apparaît plus dans la liste, ne peut plus recevoir de version, et libère l'étape pour un futur prompt. Rien n'est effacé : l'historique reste consultable via un filtre « voir les prompts figés ». Réversible.

**Supprimer** — effacement réel, proposé **uniquement** quand le prompt n'a produit aucun artefact et n'est cité par aucun rapport. Sinon le bouton est absent et l'écran explique en une phrase pourquoi (« ce prompt a produit 10 livrables : il peut être figé, pas supprimé »). Confirmation par saisie du nom du prompt.

Appliqué au ménage demandé : les quatre « Contrôleur — … » et « Règles — Récit » sont supprimés ; « Règles — Plan de chapitres » est figé (trace d'un rapport conservée). Si tu préfères, je peux aussi supprimer le rapport de contrôle orphelin et supprimer ce cinquième prompt pour de bon — dis-le moi.

## Détails techniques

- Migration : `prompts.frozen_at timestamptz null` ; index unique du prompt actif par étape restreint aux prompts non figés, pour qu'un prompt figé ne bloque plus la création d'un remplaçant.
- `atelier-prompts.functions.ts` : `freezePrompt`, `unfreezePrompt`, `deletePrompt` (rôle éditeur vérifié comme le reste). `atelierPrompts` renvoie un champ `frozen` et un compteur d'usage (artefacts + rapports) ; la liste filtre les figés par défaut.
- `deletePrompt` recompte les usages côté serveur avant d'agir et refuse s'il y en a. Les tables `prompt_versions` et `prompt_activations` sont en écriture unique par déclencheur : la suppression passe par l'échappatoire de maintenance prévue, qui journalise chaque ligne effacée dans `maintenance_log`.
- `atelier.prompts.tsx` : boutons Figer / Réactiver / Supprimer dans le dossier, case « voir les prompts figés » au-dessus de la liste, libellés en français comme le reste de l'atelier.
