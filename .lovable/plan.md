# Conserver la réponse brute du contrôleur

## Le constat

Le contrôleur ne rend plus de verdicts parce que le prompt actif `controle_plan` (version 4) n'est pas un prompt de contrôleur : c'est le texte de consigne d'installation de la grille, sans la consigne de format JSON qu'avait la version 1. Ce point est diagnostiqué et n'est pas l'objet de ce plan.

Ce plan ne traite qu'un manque d'outillage : la réponse brute du modèle est jetée après lecture, donc chaque panne de format se diagnostique à l'aveugle.

## Ce qui est ajouté

1. **La réponse brute est conservée sur le rapport.** Deux colonnes ajoutées à `qc_reports` :
   - `raw_response` — le texte exact rendu par le contrôleur, sans retouche ;
   - `raw_parse_ok` — vrai si un objet JSON a pu être lu, faux sinon.
   Rien n'est modifié ni retiré : ce sont deux colonnes nouvelles, nulles pour les rapports existants.

2. **Les codes du dialogue sont conservés aussi.** Deux colonnes de plus :
   - `codes_envoyes` — la liste des codes de critères jugés soumis au modèle ;
   - `codes_rendus` — la liste des codes trouvés dans sa réponse.
   Cela répond en une ligne à « quels codes partent, quels codes reviennent », y compris quand le modèle renvoie des codes inventés.

3. **Le rapport dépliable montre le brut.** Dans le dossier d'étape, sous le tableau des verdicts, un bloc replié « Réponse brute du contrôleur » : l'indication JSON lisible ou non, les codes attendus, les codes reçus, puis le texte brut dans un cadre à défilement. Replié par défaut : la lecture normale ne change pas.

4. **Un rapport d'erreur reste un rapport.** Quand le fournisseur refuse l'appel, le texte de l'erreur est déjà dans `message` ; la réponse brute reste vide et le bloc le dit clairement au lieu d'être absent.

## Détails techniques

- Migration : `alter table qc_reports add column raw_response text, add column raw_parse_ok boolean, add column codes_envoyes text[], add column codes_rendus text[]` (aucun GRANT nouveau : la table n'est lue que par le service).
- `src/lib/qc-core.server.ts` : `lireVerdictsRendus` retourne, en plus des verdicts, `{ parseOk, codesRendus }` ; `appelerControleur` remonte `rawText`, `codesEnvoyes`, `codesRendus`, `parseOk` dans `AppelControleur`.
- `src/lib/qc-run.server.ts` : `enregistrerRapport` écrit ces quatre champs ; toute erreur d'écriture remonte, comme le reste de la brique 9.
- `src/lib/qc.functions.ts` : `QcReportRow` expose `rawResponse`, `rawParseOk`, `codesEnvoyes`, `codesRendus`.
- `src/components/AtelierQcReport.tsx` : le bloc replié, avec `whitespace-pre-wrap` et hauteur bornée.
- Aucun changement de la logique de jugement : un critère non rendu échoue toujours.
