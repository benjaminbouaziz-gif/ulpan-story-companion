# Correctif : « The resource already exists » après une relance de contrôle

## Diagnostic

**(a) Quel téléversement échoue**

Le dépôt du **rapport de contrôle** (le fichier JSON produit par le contrôleur), dans le bucket privé `artifacts`, au chemin :

```text
books/2ba66ada-…/plan/shared/rapport_controle/v1/rapport-controle-v1.json
```

**(b) Comment ce chemin est construit**

Il est composé de `livre / étape / langue / type / v{version} / nom de fichier`. Le seul élément variable est le **numéro de version**, et ce numéro est calculé en relisant la plus grande version de rapport **déjà enregistrée en base**. Rien dans le chemin n'identifie l'exécution.

**(c) La tentative précédente a-t-elle laissé un fichier ?**

Oui. Le stockage contient un fichier à ce chemin exact (déposé hier soir), alors que **la base ne contient aucune ligne de rapport de contrôle** pour cette étape. La cause de ce décalage est identifiée : la table des livrables n'accepte, par une règle de validation, qu'une liste fermée de types de fichiers — et `rapport_controle` **n'y figure pas**. L'enregistrement en base est donc refusé, mais ce refus n'est jamais vérifié dans le code : le fichier reste orphelin dans le stockage, le compteur de version reste bloqué à 1, et la relance suivante réécrit le même chemin → refus 409.

## Correction

1. **Autoriser le type `rapport_controle`** dans la règle de validation des livrables (migration), pour que le rapport s'enregistre enfin en base — et que le compteur de version avance.
2. **Ne plus ignorer un refus d'enregistrement** : après le dépôt du rapport, vérifier l'erreur et faire échouer l'exécution avec le message réel (comme c'est déjà fait pour le plan corrigé). Plus de fichier orphelin silencieux.
3. **Chemin unique par exécution** : ajouter un segment portant l'identifiant de l'exécution, pour le rapport de contrôle comme pour le plan corrigé :

```text
books/{livre}/{étape}/{langue}/{type}/v{version}/{id d'exécution}/{fichier}
```

Deux exécutions successives ne peuvent plus se marcher dessus, même si l'une échoue en cours de route ; le versionnage du dossier d'étape reste inchangé.

4. Aucun fichier existant n'est supprimé, et l'écriture reste en mode « ne jamais écraser ».

## Détails techniques

- Migration : `ALTER TABLE public.artifacts DROP CONSTRAINT artifacts_type_check` puis recréation de la même liste **plus** `'rapport_controle'` (les autres valeurs à l'identique).
- `src/lib/artifact-path.ts` : `artifactPath` reçoit un paramètre optionnel `runId`, inséré entre `v{version}` et le nom de fichier. Les appels existants sans `runId` gardent exactement le chemin actuel.
- `src/lib/plan-controle.server.ts` : passer `runId: runControleur` (rapport) et `runId: runRedacteur` (plan corrigé) ; ajouter le contrôle d'erreur sur l'insertion du rapport avec `texteErreurBase`.
- Aucun changement sur `uploadArtifactBytes` (`upsert: false` conservé).

## Preuve à rendre

Deux contrôles mode A successifs sur le même plan, tous deux terminés, avec les deux chemins distincts lus en base. Réserve : la clé Google directe renvoie actuellement des 503 « forte demande » ; la preuve sera faite avec le modèle habituel du prompt de contrôle si le 503 persiste.
