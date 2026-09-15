# Activation : une adresse validée l'est définitivement

## Ce qui existe déjà

À l'activation, le site écrit déjà la validation de façon permanente : `email_signups.confirmed_at` est daté et le profil du lecteur reçoit `consent_at` + `consent_source: "qr_double_optin"`. Rien n'est jamais effacé : une adresse validée reste validée.

Et sur l'appareil où le code a été saisi, la session est conservée par le navigateur : le lecteur qui revient sur le même appareil n'a déjà plus de code à saisir.

## Ce qui manque aujourd'hui

1. Si la même adresse redemande un accès (autre appareil, autre QR code, navigateur vidé), le site enregistre une nouvelle demande et renvoie un code comme si de rien n'était — sans dire que l'adresse est déjà confirmée.
2. Sur un nouvel appareil, un e-mail reste indispensable pour ouvrir la session : c'est le seul moyen sûr de prouver que c'est bien le propriétaire de l'adresse. Ce point n'est pas contournable sans affaiblir la sécurité.

## Proposition

1. **`requestAccess` (src/lib/access.functions.ts)** : avant d'enregistrer, vérifier si l'adresse est déjà confirmée (profil existant avec `consent_at`, ou `email_signups` déjà confirmé).
   - **Adresse déjà confirmée** : ne rien ré-enregistrer (ni nouvelle ligne `email_signups`, ni événement `access_requested`), envoyer quand même l'e-mail de connexion (nécessaire pour ouvrir la session sur cet appareil), et répondre avec un statut distinct `already_confirmed`.
   - **Adresse nouvelle** : comportement actuel inchangé.
2. **`AccessForm.tsx` + dictionnaires FR/EN** : quand le statut est `already_confirmed`, afficher un message dédié du type « Cette adresse est déjà confirmée. Le courrier que vous recevrez sert uniquement à vous reconnecter sur cet appareil. » (libellé ajouté au dictionnaire, FR et EN).
3. **Aucun changement** sur `confirmAccess`, la page d'activation, le parcours QR, ni l'authentification.

## Vérification

- Première demande avec une adresse neuve : ligne enregistrée, e-mail reçu, activation normale.
- Deuxième demande avec la même adresse : aucune nouvelle ligne en base, message « déjà confirmée » affiché, connexion possible via le courrier.
- Une adresse déjà activée sur un appareil rouvre le compagnon sans code sur ce même appareil (déjà le cas, à re-vérifier).
