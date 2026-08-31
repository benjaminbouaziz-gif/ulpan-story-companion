# Contrôle du plan « Yoni » : ce qui s'est réellement passé

## 1. L'appel au modèle a bien eu lieu

Le rapport en base le prouve : `model_used = claude-sonnet-4-6`, et les trois critères jugés portent des explications rédigées, spécifiques au livre (« la bascule temporelle du ch. 1 vers le ch. 2 est expliquée », « paliers É1 à É6 », « la prise d'otages (ch. 6) »). Aucun code ne peut fabriquer ça : le contrôleur a lu le plan et rendu des verdicts.

Le rapport a bien 5 critères sur 5 validés, statut `valide` (le message affiché « arrêté au tour 1 » vient du libellé d'écran, pas d'un arrêt sur plafond).

## 2. Pourquoi aucune ligne dans la salle Robots

`qc_reports.agent_run_id` est **nul** : la ligne d'`agent_runs` n'a jamais été créée. Cause exacte, vérifiée en base :

- le contrôle insère sa ligne avec `mode: "controle"` ;
- la table porte la contrainte `agent_runs_mode_connu` qui n'autorise que `initial`, `avec_precedent`, `sans_precedent`, `enchainement`, `chapitre`, `chapitre_revision`, `assemblage` ;
- l'insertion est donc refusée par la base, et le code **ignore l'erreur** (`const { data: run } = await admin...insert(...)` sans contrôle d'erreur). `runId` reste nul, le contrôle continue comme si rien n'était, et plus rien n'est journalisé : ni durée, ni coût, ni jetons, ni modèle côté salle Robots.

La salle Robots n'a aucun filtre : elle lit les 100 dernières lignes d'`agent_runs`. Il n'y a rien à afficher parce que rien n'a été écrit.

## 3. Le chemin exact, fonction par fonction

```text
AtelierQcReport.tsx (bouton « Contrôler »)
  -> runQcControl                     src/lib/qc.functions.ts:538
     assertEditor, puis controlerEtape(..., { forcer: true })
  -> controlerEtape                   src/lib/qc-run.server.ts:506
     controleActif() -> interrupteur global
     lirePolitique() -> stratégie / plafond / seuil
     lireGrille()    -> critères actifs de l'étape
     boucle des tours -> unTour()
  -> unTour                           src/lib/qc-run.server.ts:238
     lirePromptControleur(editor, 'controle_plan')   <- CHARGEMENT DU PROMPT
        src/lib/qc-core.server.ts:367 : prompts.code = 'controle_plan',
        puis prompt_versions de active_version_id (contenu, modèle, web_search),
        avec vérification fournisseur + clé d'API.
     lecture du dernier artefact 'plan' (storage) -> markdown
     verdictsMecaniques()  -> 2 critères, aucun modèle (recit-calibrage.ts)
     insert agent_runs 'en_cours'  <- ÉCHOUE ICI, silencieusement
     appelerControleur()             src/lib/qc-core.server.ts:460
        matière = fiche du livre + décisions + livrable, système = contenu du prompt
     -> appelerModele()              src/lib/robot-provider.server.ts   <- DÉPART DE LA REQUÊTE
     lireVerdictsRendus() -> verdicts jugés
     calculerNotes() + enregistrerRapport() -> qc_reports / qc_verdicts
```

## 4. Un critère jugé non évaluable : ce que fait le code aujourd'hui

Il **échoue**, et c'est déjà le comportement voulu. Dans `lireVerdictsRendus` (`qc-core.server.ts:415`) : JSON illisible, critère absent de la réponse, ou verdict vide, tous donnent `echoue`, avec l'explication « Aucun verdict rendu par le contrôleur pour ce critère : il est compté comme échoué. » Une réponse vide lève une erreur, et un dépassement de délai (4 min) lève aussi. Aucun critère jugé n'est validé par défaut.

**Sauf un trou, celui-ci :** si l'appel au modèle échoue avant d'être lancé pour une autre raison, l'échec remonte — mais l'échec de journalisation, lui, est avalé. Le contrôle a donc pu se dérouler « invisible ». C'est le seul point où le code ment par omission.

## Ce que je corrigerais (à ton accord)

1. **Rendre le contrôle visible** : autoriser `mode = 'controle'` dans la contrainte `agent_runs_mode_connu` (migration purement additive).
2. **Ne plus jamais avaler l'échec de journalisation** : si l'insertion dans `agent_runs` échoue, le contrôle s'arrête avec l'erreur brute de la base. Un contrôle non journalisé n'a pas le droit d'aboutir.
3. **Rattacher les rapports orphelins ? Non** : le rapport Yoni reste sans ligne de lancement (l'information de durée/coût est perdue). Je ne fabrique rien.
4. **Salle Robots** : afficher `controle` dans la colonne Mode (« contrôle qualité »), et le tour en cours (`batch_current / batch_total`).

Rien d'autre n'est touché : ni les grilles, ni les notes, ni les stratégies, ni le chemin d'appel.
