# Audit page par page — état d'avancement du site Ulpan Story

Date : 26 août 2026. Site non publié (préproduction uniquement).

## Vue d'ensemble

| Domaine | État |
| --- | --- |
| Identité visuelle, typographie hébraïque, bilingue FR/EN | En place |
| Double page du livre (format A5 fidèle, 4 étapes) | En place |
| Page méthode pilotée par la base | En place (français) |
| Catalogue (collections, fiche livre) | En place, un seul tome |
| Parcours QR → email → code d'accès | En place, jamais testé par un vrai lecteur |
| Espace lecteur (glossaire, quiz) | En place ; audio et conversation absents |
| Boutique / achat | Non commencé |
| Pages légales | Coquilles vides |
| Version anglaise publique | Non rédigée |

## Page par page

**Accueil `/`** — Fait. Promesse, double page de démonstration, accès aux collections. Manque : lien d'achat.

**La méthode `/methode`** — Fait et alimenté par la base : 10 sections, dont la double page réelle du chapitre 1, le bloc de chiffres et « Nos choix d'éditeur » (français seulement). Décision actée : cette page ne se traduit jamais automatiquement, elle se rédige à la main dans chaque langue. Version anglaise : à rédiger (0 section anglaise).

**Les collections `/collections`** — Fait. Une seule collection, « Héros d'Israël ».

**Fiche collection `/collections/:slug`** — Fait : présentation, pour qui, liste des tomes avec couverture.

**Fiche livre `/livres/:slug`** — Fait : couverture, titre, blurb, ce qu'on apprend, chiffres, double page. Manque : bouton d'achat (aucun lien Amazon en base), extrait PDF.

**Double page du livre** (utilisée sur `/methode` et la fiche livre) — Fait, c'est la pièce la plus avancée : format A5 réel, marges réelles, alignement des lignes de base d'une page à l'autre, quatre étapes (traduction, trous, clés, sans nekoudot), glossaire de fin de livre, lecture séquentielle sur téléphone, zoom. Contenu réel : chapitre 1 saisi (19 blocs, 5 clés, 10 entrées de glossaire) ; les autres chapitres restent à saisir.

**Accès par QR `/b/:qr_code`** — Fait techniquement : la page reconnaît le code du livre et recueille l'email.

**Activation `/activation`** — Fait : double opt-in, lien magique et code à 6 chiffres, emails envoyés depuis notify.ulpanstory.com avec la charte maison. À éprouver en conditions réelles (0 inscription enregistrée à ce jour).

**Connexion `/connexion`** — Coquille : affiche « bientôt ». La connexion passe aujourd'hui par `/activation`. À trancher : garder une page dédiée ou rediriger.

**Espace lecteur `/compagnon`** — Fait : liste des livres débloqués, invite à s'identifier sinon.

**Compagnon d'un livre `/compagnon/:book_slug`** — Partiellement fait : glossaire du livre et quiz interactif (10 questions saisies, correction immédiate, progression enregistrée). Audio annoncé mais aucune piste en base ; conversation en hébreu non commencée.

**Contact `/contact`** — Adresse email seulement, pas de texte ni de formulaire.

**Confidentialité `/confidentialite`** — Vide (texte juridique à écrire).

**Mentions légales `/mentions-legales`** — Vide (éditeur, hébergeur, SIRET à écrire).

**Administration `/admin`** — Trois outils en place : double page de démonstration (`/admin/extraits`), pages éditoriales avec versions, traduction assistée et choix de langue par section (`/admin/pages`), chiffres des livres avec avertissement de recalcul (`/admin/chiffres`). Manquent : saisie des pages du livre (blocs et clés) avec le validateur de parité, gestion du glossaire et des quiz, réserve de QR codes.

## Points d'attention à remonter

1. **Aucun compte administrateur n'est encore attribué** : la table des rôles est vide, donc l'administration est inaccessible tant qu'un compte n'est pas nommé éditeur.
2. **Aucun lien d'achat** en base : le site présente les livres mais ne permet pas de les acheter.
3. **Pages légales vides** : bloquant pour une mise en ligne publique (obligation légale + collecte d'emails).
4. **Version anglaise non rédigée** : 9 sections sur 10 attendent leur texte anglais, écrit à la main par choix éditorial.
5. **Contenu du livre** : un seul chapitre saisi sur les quatre étapes ; il faut l'outil de saisie avant d'industrialiser.

## Prochaines étapes proposées, dans l'ordre

1. Nommer un compte éditeur et rédiger les trois pages légales.
2. Éditeur d'administration des pages du livre (blocs, clés, validateur de parité) — condition pour saisir les chapitres suivants.
3. Achat : liens Amazon par tome et extrait PDF.
4. Audio du compagnon, puis conversation en hébreu.
5. Rédaction de la méthode anglaise et bascule du site .com.
