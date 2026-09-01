# Connexion à l'atelier : « Identifiant incorrect »

## Ce que disent les vérifications

- Votre compte existe, est confirmé, a bien un mot de passe, et porte le rôle `admin`. Rien n'est bloqué ni banni.
- La dernière connexion réussie enregistrée date du 31 août à 14 h 31.
- Le registre des tentatives ratées (`admin_login_attempts`) est **entièrement vide** : zéro ligne, jamais.

C'est le point important. Le code n'affiche « identifiant incorrect » qu'après avoir écrit une ligne de tentative ratée. Le registre vide veut dire que, très probablement, la fonction de connexion **plante avant** d'arriver au test du mot de passe : l'écran affiche alors le même message générique, alors que vos identifiants ne sont pas en cause. Cause exacte non encore confirmée — c'est la première étape ci-dessous.

## Étape 1 — Faire parler l'erreur (avant toute correction)

- Appeler la fonction de connexion telle quelle avec une adresse bidon et lire la réponse réelle du serveur + les journaux serveur.
- Cela tranche entre trois hypothèses : (a) la fonction lève une exception (clé serveur, client Supabase, écriture du registre), (b) le mot de passe est réellement refusé, (c) le compteur d'échecs bloque.

## Étape 2 — Corriger la cause trouvée

Selon le résultat :
- Si la fonction plante : réparer le point fautif (création du client de connexion, ou écriture du registre dont l'erreur est aujourd'hui ignorée).
- Si le mot de passe est réellement refusé : le réinitialiser pour votre compte.

## Étape 3 — Que l'écran cesse de mentir

Aujourd'hui, trois situations très différentes affichent le même texte :
- adresse ou mot de passe faux ;
- panne interne de la fonction de connexion ;
- exception réseau côté navigateur.

Distinguer proprement :
- identifiants faux → « Adresse ou mot de passe incorrect » (volontairement identique dans les deux cas, pour ne pas révéler l'existence d'un compte) ;
- panne interne → « La connexion n'a pas pu aboutir (erreur technique) » ;
- trop de tentatives → message dédié, déjà existant.

Et ne plus ignorer l'erreur d'écriture du registre des tentatives : si elle échoue, elle doit être visible dans les journaux serveur.

## Détails techniques

- `src/lib/admin-auth.functions.ts` : l'insertion dans `admin_login_attempts` n'est pas vérifiée (`error` ignoré) ; ajouter le contrôle et la journalisation. Séparer le retour `refused` d'un nouveau retour `erreur_interne` au lieu de laisser l'exception remonter en message générique.
- `src/routes/atelier_.connexion.tsx` : afficher les trois messages distincts selon `result.reason`, et un message technique dans le `catch`.
- Aucun changement de schéma prévu, sauf si l'étape 1 révèle un problème de droits sur `admin_login_attempts`.
