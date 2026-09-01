-- 1) LA GRILLE DU PLAN : huit points, dont les mesurables tenus par le code.
update public.qc_criteria c
set label = 'Promesse éditoriale',
    question = 'Le plan tient-il la promesse éditoriale déclarée dans la fiche du livre (résumé de travail, consignes, ton et angle) ?',
    family = 'conformite', is_blocking = true, is_active = true, sort_order = 10
where c.code = 'plan_fiche' and c.grid_id = (select id from public.qc_grids where code = 'plan');

update public.qc_criteria c
set label = 'Arc narratif',
    question = 'Les chapitres forment-ils un arc : une situation de départ, une progression, une fin — sans redite ni trou ?',
    family = 'structure', is_blocking = true, is_active = true, sort_order = 11
where c.code = 'plan_coherence' and c.grid_id = (select id from public.qc_grids where code = 'plan');

update public.qc_criteria c
set label = 'Progression pédagogique',
    question = 'La difficulté et le lexique progressent-ils graduellement d''un chapitre au suivant, sans saut brutal ?',
    family = 'pedagogie', is_blocking = true, is_active = true, sort_order = 12
where c.code = 'plan_lexique' and c.grid_id = (select id from public.qc_grids where code = 'plan');

insert into public.qc_criteria (grid_id, sort_order, code, label, question, family, is_blocking, species, mechanic_key, is_active)
select g.id, v.sort_order, v.code, v.label, v.question, v.family, v.is_blocking, v.species, v.mechanic_key, true
from public.qc_grids g
cross join (values
  (3, 'plan_titres', 'Titres de chapitres présents', 'Chaque chapitre annoncé porte-t-il un titre non vide ?', 'structure', true, 'mecanique', 'plan_titres'),
  (4, 'plan_nombre', 'Nombre de chapitres attendu', 'Le plan annonce-t-il le nombre de chapitres attendu pour ce livre ?', 'structure', true, 'mecanique', 'plan_nombre'),
  (5, 'plan_champs', 'Champs requis du plan', 'Le plan porte-t-il, pour chaque chapitre, sa ligne « Pages : n », et une section « Points à trancher » ?', 'structure', true, 'mecanique', 'plan_champs'),
  (13, 'plan_faisabilite', 'Faisabilité linguistique', 'Ce que chaque chapitre annonce est-il écrivable en hébreu au niveau visé, avec le lexique disponible ?', 'langue', true, 'juge', null),
  (14, 'plan_faits', 'Faits et sources', 'Les faits, dates, lieux et références avancés par le plan sont-ils exacts et sourçables ?', 'conformite', false, 'juge', null),
  (15, 'plan_collection', 'Cohérence de collection', 'Le plan reste-t-il cohérent avec la nature et la promesse de la collection du livre ?', 'conformite', false, 'juge', null),
  (16, 'plan_decisions', 'Décisions à trancher', 'Les points laissés à l''arbitrage de l''éditeur sont-ils réellement des arbitrages, énoncés clairement et sans doublon ?', 'structure', false, 'juge', null)
) as v(sort_order, code, label, question, family, is_blocking, species, mechanic_key)
where g.code = 'plan'
  and not exists (select 1 from public.qc_criteria x where x.grid_id = g.id and x.code = v.code);

-- 2) LE CONTRÔLEUR DU PLAN : contrat de rapport strict.
with p as (select id from public.prompts where code = 'plan-methode-controle'),
nouvelle as (
  insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
  select p.id,
         coalesce((select max(v.version) from public.prompt_versions v where v.prompt_id = p.id), 0) + 1,
$prompt$Tu es CONTRÔLEUR de plans de chapitres. Tu ne réécris JAMAIS un plan : tu juges.

Tu reçois : le plan à contrôler, la liste des codes de critères à juger, les règles de contrôle de la maison, la fiche du livre et les décisions déjà tranchées par l'éditeur. Les décisions tranchées font foi : elles ne se rediscutent pas, et un plan qui les respecte ne peut pas être pris en défaut pour cela.

Tu rends UNE entrée par code demandé, ni plus, ni moins. Aucune note, aucun pourcentage, aucune moyenne : le calcul appartient au code.

verdict : « valide » ou « echoue », rien d'autre.
severity : « bloquant » quand l'écart empêche d'écrire le livre tel quel ; « signalement » quand il mérite d'être vu sans arrêter la chaîne.
location : où exactement (chapitre, section, ligne). Chaîne vide si le critère est valide.
evidence : le passage fautif, cité entre guillemets, tel qu'il figure dans le plan. Chaîne vide si le critère est valide.
required_fix : la correction EXIGÉE, une phrase impérative, sans rédiger le plan à la place. Chaîne vide si le critère est valide.
suggestion : une piste facultative, une phrase au plus. Chaîne vide si tu n'en as pas.

Tu réponds UNIQUEMENT par un objet JSON, sans texte autour, sans balise de code :
{"verdicts":[{"code":"<code>","verdict":"valide|echoue","severity":"bloquant|signalement","location":"","evidence":"","required_fix":"","suggestion":""}]}$prompt$,
         'Contrat de rapport strict : code, verdict, severity, location, evidence, required_fix, suggestion.',
         'google/gemini-3.7-flash', false
  from p
  returning id, prompt_id, version
)
insert into public.prompt_activations (prompt_id, prompt_version_id, version, reason)
select prompt_id, id, version, 'Contrôle du plan : rapport JSON strict' from nouvelle;

update public.prompts p
set active_version_id = (
  select v.id from public.prompt_versions v where v.prompt_id = p.id order by v.version desc limit 1
)
where p.code = 'plan-methode-controle';

-- 3) LE RÉÉCRITEUR DU PLAN : écarts bloquants seulement.
with p as (select id from public.prompts where code = 'plan-redaction-corrective'),
nouvelle as (
  insert into public.prompt_versions (prompt_id, version, content, change_note, model, web_search)
  select p.id,
         coalesce((select max(v.version) from public.prompt_versions v where v.prompt_id = p.id), 0) + 1,
$prompt$Tu es RÉÉCRITEUR de plan de chapitres. Tu ne juges rien, tu ne valides rien, tu ne commentes rien.

Tu reçois : le plan source, le rapport de contrôle, la fiche du livre et les décisions déjà tranchées par l'éditeur.

Tu corriges EXCLUSIVEMENT les écarts marqués bloquants dans le rapport, en suivant leur « correction exigée ». Tout ce que le rapport ne vise pas reste à l'identique : mêmes chapitres, mêmes titres, mêmes répartitions de pages, mêmes formulations. Tu n'ajoutes ni chapitre ni section de ton propre chef. Les décisions tranchées font foi.

Tu rends le plan corrigé EN ENTIER, dans le même format que le plan source : « ## Chapitre N · titre », une ligne « Pages : n » par chapitre, et la section « ## Points à trancher » conservée. Aucun préambule, aucun commentaire, aucune balise de code, aucune liste de vos changements.$prompt$,
         'Réécriture ciblée : seuls les écarts bloquants, le reste conservé.',
         'claude-sonnet-5', false
  from p
  returning id, prompt_id, version
)
insert into public.prompt_activations (prompt_id, prompt_version_id, version, reason)
select prompt_id, id, version, 'Réécriture ciblée unique du plan' from nouvelle;

update public.prompts p
set active_version_id = (
  select v.id from public.prompt_versions v where v.prompt_id = p.id order by v.version desc limit 1
)
where p.code = 'plan-redaction-corrective';