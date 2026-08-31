# Panneau « Contrôle du plan » invisible dans l'étape Plan

## Diagnostic (confirmé)

Le panneau de contrôle ne s'affiche plus parce que la fonction d'état `planControlState` échoue en silence.

- Dans `src/lib/plan-controle.functions.ts` (ligne 283), le mapping des exécutions fait :
  `((r.verdicts ?? []) as VerdictLigne[]).filter((v) => v.source === "modele")`
- Les exécutions d'avant la refonte du contrat (avant le 31/08) stockent `verdicts` sous l'**ancien schéma** (un objet avec 4 familles booléennes), pas un tableau.
- Un objet n'a pas `.filter` → la fonction renvoie l'erreur `(r.verdicts ?? []).filter is not a function` (erreur capturée en direct dans la réponse réseau du navigateur).
- React Query met la requête en erreur → `state.data` est `undefined` → le composant fait `return null` → **tout le panneau disparaît**, sans message.

Tout le reste est sain : réglages (`enabled: true`, mode A), étape `plan` existante, contraintes d'artefacts, colonnes de `plan_control_runs`.

## Correction (un seul fichier)

`src/lib/plan-controle.functions.ts`, dans le mapping des runs de `planControlState` :

- `verdicts` : n'accepter que les tableaux — `Array.isArray(r.verdicts) ? r.verdicts : null`. Les anciennes exécutions (objet) donnent `verdicts: null`, et l'écran affiche déjà « Aucun rapport lisible pour cette exécution. » pour ce cas.
- `attendus` : calculé sur ce tableau sécurisé (`?? null` quand pas de tableau).
- `propositions` : même garde `Array.isArray` (défensif, même cause possible).

Aucun changement de schéma, aucune migration, aucun autre chantier.

## Preuve à rendre

- Le panneau « Contrôle du plan » réapparaît dans le dossier de l'étape Plan (vérifié par navigateur : présence du titre, du badge de mode et du bouton « Lancer le contrôle »).
- Les anciennes exécutions au format obsolète n'interrompent plus l'écran ; les nouvelles (tableau de verdicts) s'affichent normalement.
