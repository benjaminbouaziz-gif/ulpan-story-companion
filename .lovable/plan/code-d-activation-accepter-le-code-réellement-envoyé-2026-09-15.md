# Code d'activation : accepter le code réellement envoyé

## Diagnostic

L'e-mail d'accès contient un code à **8 chiffres**, mais l'écran d'activation n'en accepte que **6** (champ limité à 6 caractères). Le lecteur qui choisit le code de secours ne peut donc jamais le saisir en entier. La longueur du code envoyé est un réglage du service d'e-mails, qui n'est pas modifiable depuis les outils dont je dispose.

## Proposition

On garde le code tel qu'il arrive (8 chiffres) et on fait accepter au site **les codes de 6 à 8 chiffres** : la vérification elle-même accepte déjà n'importe quelle longueur, seul le champ bloque. Les textes ne mentionneront plus « six chiffres » mais « le code du courrier », pour ne plus dépendre d'une longueur précise.

## Changements

1. **Écran d'activation** (`src/routes/activation.tsx`) : le champ passe de 6 à 8 caractères maximum ; la saisie reste numérique. Les titres/descriptions de la page ne parlent plus de « six chiffres ».
2. **Libellés FR/EN** (`src/i18n/dictionaries.ts`) : « code à six chiffres » devient « code du courrier » (FR) et « the code from the email » (EN) — messages après envoi, lien « J'ai un code », nom du champ.
3. **Modèle d'e-mail** (`src/lib/email-templates/magic-link.tsx`) : la phrase « code à six chiffres » devient « ce code ».

## Vérification

- Contrôle visuel : l'écran accepte 8 chiffres et le bouton se réveille.
- Je ne peux pas recevoir un vrai courrier ici : le test complet consistera à demander un accès et saisir le code reçu à 8 chiffres.

Rien ne change dans le parcours QR, le double opt-in, ni l'e-mail envoyé.
