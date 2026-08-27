# Ulpan Story Companion

# PROMPT LOVABLE COMPLET · SITE COMPAGNON ULPAN STORY
### Version consolidée — mobile d'abord

> **Mode d'emploi.** Ce document remplace tous les prompts précédents.
> Ne colle pas tout d'un coup : Lovable construit mieux en passes successives, et une
> erreur repérée à la phase 2 t'évite de la retrouver partout à la phase 6.
> Procédure : colle le **BLOC 0** puis la **PHASE 1**. Vérifie. Puis, pour chaque phase
> suivante, recolle le **BLOC 0** (Lovable perd la charte au bout de quelques itérations)
> suivi de la phase.

---

# BLOC 0 · CONTEXTE PERMANENT
*(à recoller en tête de CHAQUE phase)*

## La maison

Tu construis le site compagnon d'**Ulpan Story**, maison d'édition indépendante qui publie
des livres pour apprendre l'hébreu en lisant de vraies histoires. Chaque livre imprimé
porte un QR code ; ce site est ce qu'il y a derrière ce QR code, plus la vitrine de la
maison.

**Le positionnement, à tenir dans chaque écran :** Ulpan Story ne remplace pas l'oulpan,
**c'est le soutien de l'oulpan**. L'élève y va deux soirs par semaine, il apprend des
règles, il fait des exercices — et entre deux cours, il n'a rien à lire à son niveau. C'est
ce trou-là qu'on comble : du vrai contenu, en hébreu vocalisé, qu'on lit pour l'histoire et
non pour l'exercice.

**La méthode :** page de gauche en hébreu vocalisé, page de droite un soutien en français
qui se retire au fil du livre, jusqu'à lire sans nekoudot à la fin.

**La phrase de la maison :** « Vous n'allez pas étudier l'hébreu. Vous allez le lire. »

**Le ton :** on s'adresse à un adulte qui travaille déjà sérieusement. Pas de promesse de
raccourci, pas de « parlez hébreu en 30 jours », pas de méthode miracle. On dit ce que le
livre fait, et ce qu'il ne fait pas.

## LE MOBILE N'EST PAS UNE ADAPTATION, C'EST LE PRODUIT

**Situation réelle d'usage :** un adulte, le soir, dans son fauteuil, son livre papier
ouvert sur les genoux, qui scanne un QR code avec son téléphone d'une seule main, souvent
sur un réseau médiocre, parfois en lumière faible. Il ne posera jamais son livre pour aller
chercher un ordinateur.

Tu conçois donc **à 390 × 844 px d'abord**. Le format ordinateur est une version élargie
du format téléphone, jamais l'inverse : ne dessine pas une page large que tu réduiras.

Règles qui en découlent, applicables partout :

- **Une seule colonne**, toujours. Aucune mise en deux colonnes en dessous de 1024 px.
  En particulier, la double page hébreu / soutien **s'empile verticalement** sur téléphone
  (hébreu d'abord, soutien dessous) — ne la comprime jamais en deux colonnes étroites.
- **Zone du pouce.** Les actions principales sont en bas d'écran, pas en haut. Barre
  d'action fixe en bas là où c'est utile, respectant les zones sûres de l'appareil
  (`env(safe-area-inset-bottom)`).
- **Cibles tactiles de 44 px minimum**, 8 px d'espacement entre deux cibles.
- **Aucune interaction dépendant du survol.** Pas de tooltip au hover, pas de menu déroulant
  qui s'ouvre au passage de la souris.
- **Pas de fenêtre modale sur téléphone** : des feuilles qui montent du bas (bottom sheets),
  refermables par glissement et par un bouton visible.
- **Corps de texte à 17 px minimum. Texte hébreu vocalisé à 22 px minimum** — en dessous,
  les nekoudot deviennent illisibles, et une partie de tes lecteurs a plus de 45 ans.
- **Un réglage de taille de texte** (trois crans : normal, grand, très grand) accessible
  depuis toute page de lecture, mémorisé dans les préférences. Ce n'est pas un confort,
  c'est une condition d'usage pour du texte vocalisé.
- **Un mode de lecture sombre** en complément de l'ivoire, pour la lecture du soir. Le
  fond sombre est un encre chaud, pas un noir pur ; le texte reste ivoire.
- `100dvh`, jamais `100vh` (barre d'adresse mobile).
- **Budget de performance :** premier rendu utile sous 2,5 s en 4G dégradée, moins de
  200 Ko de JavaScript au chargement initial, images en AVIF/WebP avec dimensions
  déclarées. Pas de police chargée en bloquant le rendu.
- **Formulaires :** `type="email"`, `inputmode`, `autocomplete` corrects, un seul champ à
  l'écran pour l'inscription. Le clavier ne doit jamais masquer le bouton d'envoi.
- L'application doit être **installable** (PWA, icône lamed). **Pas de notifications push** :
  c'est contraire à l'esprit de la maison.

**Exception :** l'administration est conçue pour ordinateur, mais doit rester consultable
sur tablette. Ne perds pas de temps à la rendre utilisable au téléphone.

## Charte visuelle — à respecter au pixel

```
Fond            ivoire       #F3F1EA
Encre           quasi-noir   #15171A
Filet / bordure              #D7D5CE
Texte secondaire             #6C6C66
Fond sombre (mode nuit)      #1A1A17     texte #EDEBE4

Couleurs de collection (une seule par écran, jamais mélangées) :
  Héros d'Israël   #16407A
  Start-Up Nation  #0F6E52
  Star du Sport    #B0770A
  Les Mots Créés   #6B2D5C
  Nouvelles        #8E1F2B

Typographies (Google Fonts) :
  Latin   David Libre         titres et corps
  Hébreu  Frank Ruhl Libre    tout texte hébreu, sans exception
  Utilitaire  system-ui       labels et boutons, en petites capitales espacées
```

**Le logo** est la lettre ל (lamed) composée en Frank Ruhl Libre : en encre sur ivoire, ou
en ivoire sur la couleur de collection. Jamais dans un cercle, jamais déformée.

**Le bandeau**, signature reprise des couvertures : une bande pleine de la couleur de la
collection, en bas de bloc, avec le lamed en réserve dedans. Règle absolue : **le bandeau
s'ouvre pour laisser passer une information, il ne se fait jamais percer** — si quelque
chose doit le traverser, il s'interrompt en ivoire.

**Tous les tokens ci-dessus vont dans la configuration Tailwind** (`ivory`, `ink`, `rule`,
`muted`, `coll-heroes`…). Aucune valeur de couleur ou de police codée en dur dans un
composant : les cinq couleurs de collection ne sont pas définitives et devront pouvoir
changer en un seul fichier.

## Règle technique non négociable sur l'hébreu

Tout texte hébreu : `dir="rtl"`, `lang="he"`, Frank Ruhl Libre, **sans `letter-spacing`,
sans `text-transform`, sans `font-stretch`** — ces propriétés désalignent les nekoudot et
c'est immédiatement visible. Ne coupe jamais un mot vocalisé par une balise en son milieu.
Vérifie qu'une phrase française contenant un mot hébreu conserve le bon ordre d'affichage.
Teste sur iOS Safari **et** Android Chrome : c'est là que ça casse.

## Anti-brief — ce que je ne veux voir nulle part

- Pas de dégradés, pas d'ombres colorées, pas de `blur`, pas de verre dépoli.
- Coins à 0 ou 2 px de rayon maximum. C'est de l'imprimé, pas du SaaS.
- Pas d'emoji, ni dans l'interface ni dans les textes.
- Pas de bleu ni de violet génériques type palette Tailwind par défaut.
- Pas d'illustration 3D, pas d'icônes rondes multicolores, pas de photo de stock.
- **Aucune gamification** : pas de badge, pas de niveau, pas de série de jours consécutifs,
  pas de classement, pas de comparaison entre lecteurs. Le compagnon d'un livre ne doit
  pas ressembler à Duolingo.
- Pas de bandeau cookies — parce qu'on n'utilisera aucun cookie tiers.
- Pas de fausses données visibles : si une table est vide, l'écran le dit proprement.

## Stack

React + TypeScript + Tailwind + **Supabase** (base, auth, storage, edge functions). Pas
d'autre dépendance sans nécessité démontrée.

---

# PHASE 1 · SOCLE, DONNÉES, BILINGUE

*(Recoller le BLOC 0 au-dessus.)*

## Deux portes, une base

- **oulpanstory.fr** → interface en français
- **ulpanstory.com** → interface en anglais

Une seule base de code, une seule base de données. La langue vient du domaine, avec un
sélecteur discret en pied de page qui la force et la mémorise. **Toutes les chaînes
d'interface passent par des fichiers de traduction `fr` / `en` dès la première ligne de
code** — aucun texte codé en dur dans un composant. Les contenus éditoriaux ont leurs
propres colonnes par langue.

## Schéma Supabase

```sql
collections      id, slug, name_fr, name_en, color_hex, sort_order, is_active,
                 tagline_fr, tagline_en, description_fr, description_en,
                 for_whom_fr, for_whom_en, hero_image_url

books            id, collection_id, slug, qr_code (court, unique, ex 'ELI1'), tome_no,
                 title_fr, title_en, title_he, subtitle_fr, subtitle_en,
                 blurb_fr, blurb_en, level_note_fr, level_note_en,
                 excerpt_he, excerpt_translation_fr, excerpt_translation_en,
                 what_you_learn_fr (jsonb), what_you_learn_en (jsonb),
                 chapters_count, words_unique, page_count, spine_mm, price_eur,
                 cover_url, sample_pdf_url, isbn, amazon_asin,
                 amazon_url_fr, amazon_url_com, amazon_url_other,
                 status, qr_reserved_at, published_at, retired_at, expected_at

pages            id, slug ('accueil'|'methode'|'a-propos'|'contact'…), is_system,
                 status, updated_by, updated_at

page_sections    id, page_id, sort_order, is_visible,
                 kind ('heading'|'richtext'|'quote'|'steps'|'compare'|'hebrew_sample'|
                       'faq'|'cta'),
                 title_fr, title_en, body_fr, body_en, data (jsonb)

content_versions id, entity, entity_id, snapshot (jsonb), created_by, created_at

glossary_entries book_id, sort_order, chapter_no, lemma_he, form_he, translit,
                 sense_fr, sense_en, note_fr, note_en

quiz_questions   book_id, chapter_no, kind ('qcm'|'trou'|'ordre'|'ecoute'),
                 prompt_fr, prompt_en, prompt_he, options (jsonb), answer (jsonb),
                 explain_fr, explain_en, sort_order

audio_tracks     book_id, chapter_no, label_fr, label_en, storage_path, duration_s

profiles         user_id, email, lang, display_name, text_size, theme,
                 consent_at, consent_source, created_at

book_access      user_id, book_id, first_opened_at, last_seen_at

events           id, user_id (nullable), book_id (nullable), qr_code, kind,
                 meta (jsonb), created_at
```

**`status` d'un livre est une machine à états**, pas un booléen :

```
idea → writing → vocalizing → proofreading → layout → bat_ok → printing → published → retired
```

Le site public n'affiche que `published`. Toute transition est journalisée (phase 6).

## RLS, dès maintenant

- `collections`, `books`, `pages`, `page_sections` → lecture publique, uniquement publié.
- `glossary_entries`, `quiz_questions`, `audio_tracks` → **lecture authentifiée seulement**.
- `profiles`, `book_access` → chacun ne voit que ses propres lignes.
- `events`, `content_versions` → écriture serveur uniquement, aucune lecture client.

## Seed

**Une seule vraie donnée** : la collection Héros d'Israël (#16407A) et le livre `ELI1`,
*Eli Cohen, un homme à Damas*, tome 1, avec un extrait hébreu vocalisé réel et sa
traduction. Le reste des tables reste vide — les écrans doivent gérer le vide proprement.

## Routes

```
/                         accueil éditorial
/methode                  la méthode
/collections              les collections
/collections/:slug        une collection
/livres/:slug             une fiche livre (publique)
/b/:qr_code               ENTRÉE QR (phase 3)
/compagnon                espace lecteur (protégé)
/compagnon/:book_slug     le compagnon d'un livre (protégé)
/connexion  /activation
/mentions-legales  /confidentialite  /contact
/admin/*                  administration
```

## Livrable de la phase 1

Le schéma, les RLS, le seed, les tokens Tailwind, l'i18n, le routage, le squelette
d'accueil, le réglage de taille de texte et le mode sombre. **Ni auth, ni compagnon, ni
IA, ni admin.** Arrête-toi là et dis-moi ce que tu as fait.

---

# PHASE 2 · PAGES PUBLIQUES ET CONTENU ÉDITABLE

*(Recoller le BLOC 0.)*

**Principe :** aucun texte éditorial codé en dur. Tout vient de `pages` / `page_sections`,
`collections` et `books`. Seuls les libellés d'interface vivent dans les fichiers de
traduction.

## La page méthode `/methode`

Éditable section par section, préremplie au seed avec ces sept sections :

1. **Le constat.** « Vous allez à l'oulpan. Vous apprenez des règles, vous faites des
   exercices — et entre deux cours, vous n'avez rien à lire. »
2. **Ce qu'on fait.** De vraies histoires, en hébreu vocalisé, au niveau où vous êtes.
3. **La double page** (`compare`), avec un vrai extrait du tome 1 : hébreu vocalisé et
   soutien en regard. **Sur téléphone, empilé verticalement, hébreu d'abord.**
4. **Le soutien qui se retire** (`steps`) : du soutien complet à l'hébreu sans nekoudot.
5. **Ce que le livre ne fait pas.** Il ne remplace pas votre oulpan, il ne vous enseigne
   pas la grammaire, il ne vous fera pas parler seul. **Ne supprime jamais cette section
   du gabarit** : c'est la preuve qu'on ne vend pas de miracle.
6. **Le compagnon.** Ce qu'il y a derrière le QR code.
7. **FAQ.** Quel niveau faut-il, faut-il savoir lire, combien de temps par jour, et si je
   ne comprends pas un mot.

Le composant `hebrew_sample` — extrait vocalisé, traduction en regard, bouton d'écoute si
une piste existe — est réutilisable sur les pages collection et livre.

## Les pages collection `/collections/:slug`

Bandeau à la couleur, lamed en réserve, description longue éditable (pourquoi cette
collection existe, à qui elle s'adresse), un extrait représentatif de son ton, puis la liste
des tomes : numéro, titre français et titre hébreu, et l'état — disponible, à paraître avec
sa date et un champ d'alerte email, ou en préparation.

## Les pages livre `/livres/:slug`

Couverture, collection, numéro de tome, 4e de couverture, **un vrai extrait** (première
page vocalisée avec son soutien, et l'audio du passage si disponible — c'est ce qui vend
le livre, pas l'argumentaire), « à qui ce tome convient », ce qu'on y apprend (mots uniques,
chapitres, thèmes), ce que contient le compagnon, et le bouton d'achat.

### Le bouton d'achat

Le paiement se fait **sur Amazon** : le bouton est un lien sortant vers la fiche produit.

1. **Un lien par marché**, choisi selon le domaine : `amazon_url_fr` sur oulpanstory.fr,
   `amazon_url_com` sur ulpanstory.com, `amazon_url_other` en réserve.
2. Liens **stockés en base**, jamais codés en dur ; `amazon_asin` est un champ séparé,
   c'est lui qui servira au rapprochement des ventes.
3. Un `event` `buy_click` à chaque clic, avec livre, marché et source. C'est ta seule
   mesure de conversion, le tunnel de paiement t'échappant ensuite.
4. Sur téléphone, le bouton d'achat est **fixe en bas d'écran** dès qu'on a dépassé
   l'extrait, dans la zone du pouce.

*Vigilance : si tu utilises des liens d'affiliation Amazon Partenaires vers tes propres
livres, la mention d'affiliation est obligatoire et les conditions du programme sont
strictes. Amazon Pay — encaisser sur ton site — est un autre produit, sans objet ici.*

---

# PHASE 3 · LE PARCOURS QR ET L'ACCÈS

*(Recoller le BLOC 0.)*

C'est le cœur du produit, et il se joue **entièrement au téléphone**.

## Le trajet exact

1. `/b/ELI1` → on écrit un `event` `qr_open` (anonyme, sans compte).
2. S'affiche **la page commune du compagnon**, avec l'encadré du livre déjà ouvert et mis
   en avant — un seul gabarit, un contenu contextualisé, pas une page par livre.
3. Le lecteur voit **ce qu'il y a dedans** (glossaire, quiz, audio, compagnon IA) mais les
   contenus sont fermés. Le verrou est honnête : « Ces contenus sont offerts avec le livre.
   Laissez votre email, vous recevrez un lien d'activation. »
4. Il saisit son email. **Un seul champ à l'écran**, clavier email, bouton dans la zone du
   pouce.
5. **Le clic sur le lien d'activation vaut double opt-in** : ouverture du service ET
   consentement RGPD. On enregistre `consent_at` et `consent_source = 'qr:ELI1'`.
6. Il atterrit sur `/compagnon/eli-cohen`, connecté, contenus ouverts.
7. **Reconnexions : magic link uniquement.** Aucun mot de passe nulle part, pas d'OAuth.

## Le piège mobile qu'il faut traiter

Un QR scanné depuis l'appareil photo, Instagram ou WhatsApp ouvre souvent un **navigateur
intégré à l'application**. Le lien d'activation reçu par mail s'ouvrira, lui, dans le
navigateur par défaut : ce n'est pas le même contexte, et la session est perdue. Le lecteur
tourne en rond et abandonne.

**Traitement obligatoire :** en plus du lien, le mail contient un **code à 6 chiffres**, et
l'écran d'attente propose de le saisir. Le lecteur reste ainsi dans l'onglet où il est.
C'est le chemin de secours principal, pas une option — teste-le explicitement depuis le
navigateur intégré d'Instagram.

## Autres détails

- Un email déjà connu qui scanne un autre QR ne se réinscrit pas : magic link direct, et le
  nouveau livre s'ajoute à son `book_access`.
- Un lecteur déjà connecté qui scanne va directement au bon livre.
- Lien expiré → écran d'échec clair avec bouton « renvoyer ».
- Emails transactionnels sobres, en texte, en-tête au lamed, signés
  `contact@oulpanstory.com`, dans la langue du domaine d'origine.

---

# PHASE 4 · LES CONTENUS DU LIVRE

*(Recoller le BLOC 0.)*

Sur `/compagnon/:book_slug`, quatre contenus présentés comme **quatre sections d'une même
page**, pas comme les onglets d'une application. Sur téléphone, une navigation d'ancrage
discrète en bas d'écran permet de sauter de l'une à l'autre.

## Le glossaire

Toutes les entrées, dans l'ordre du livre, groupées par chapitre. Chaque entrée : la forme
de citation vocalisée, la forme exacte telle qu'elle apparaît dans le livre si elle diffère,
la translittération, le sens. Filtre par chapitre, recherche instantanée en hébreu **et**
en translittération. Sur téléphone, la recherche est en haut, collante, avec un bouton
d'effacement large.

**Bouton « version imprimable »** : feuille A4 propre, deux colonnes, noir et blanc, via
`@media print`. Pas de génération de PDF côté serveur.

## Les quiz

Un quiz par chapitre. Quatre types : QCM, texte à trou, remise en ordre, écoute. Correction
immédiate avec une explication courte. À la fin, le score et rien d'autre — **pas de badge,
pas de niveau, pas de comparaison**. Le score est enregistré, jamais affiché comme une
performance.

Au téléphone : une question par écran, réponses en gros boutons pleine largeur dans la
zone du pouce, progression discrète en haut, aucune animation de célébration.

## La lecture audio

Le texte hébreu lu, découpé par chapitre. Lecteur minimal : lecture/pause, vitesse
(0,75 / 1 / 1,25), reprise là où on s'était arrêté.

Spécificités mobiles obligatoires : **mini-lecteur collant en bas d'écran** qui survit à la
navigation entre sections ; intégration de l'**API Media Session** pour que le titre
s'affiche sur l'écran verrouillé et que les boutons du casque fonctionnent ; la lecture ne
s'interrompt pas quand l'écran s'éteint.

Fichiers dans Supabase Storage, **bucket privé**, servis par URL signée à durée courte —
ils ne doivent pas être aspirables.

*L'audio est produit hors du site (voir note en annexe C). Le site ne fait que servir des
fichiers déposés.*

---

# PHASE 5 · LE COMPAGNON IA

*(Recoller le BLOC 0.)*

Un fil de conversation dans la page du livre. Le lecteur parle **du livre qu'il vient de
lire**, pour pratiquer. Ce n'est ni un chatbot généraliste ni un professeur.

## Trois modes, sélecteur en tête du fil

1. **Hébreu vocalisé** — réponses en hébreu avec nekoudot.
2. **Hébreu phonétique** — même hébreu translittéré, pour qui ne lit pas encore vite.
3. **Français / anglais** — pour parler du récit, de la grammaire, d'un point du texte.

## Contraintes du prompt système, côté serveur

- Contexte injecté : **le texte du livre et son glossaire**, rien d'autre.
- En mode hébreu, **pas de vocabulaire hors du livre** ; si c'est inévitable, gloser le mot
  entre parenthèses.
- Phrases courtes, temps simples : le lecteur sort du niveau du tome 1.
- Relancer toujours par une question.
- Ne pas corriger chaque faute : reformuler correctement et poursuivre.
- Refuser poliment de sortir du livre, ne jamais servir de traducteur généraliste.

## Garde-fous

Appels **exclusivement depuis une edge function** — aucune clé d'API dans le client. Quota
par utilisateur et par jour, annoncé honnêtement quand il est atteint. Historique conservé
par livre. Un `event` `ai_msg` par échange, **sans le contenu du message**.

Au téléphone : champ de saisie collant en bas, au-dessus du clavier, jamais masqué ; la
conversation défile au-dessus.

---

# PHASE 6 · L'ADMIN, SOCLE DU CRM

*(Recoller le BLOC 0.)*

## Le principe qui commande tout

Ce site n'est pas une vitrine avec un back-office : c'est **le noyau de données de la maison
d'édition**. Un CRM interne — l'« usine » — s'y branchera à court terme, et des agents
automatisés y créeront des livres, importeront des glossaires, déclencheront des
publications et liront les statistiques.

> **Tout ce qu'un humain peut faire dans l'admin doit exister comme un appel d'API.
> L'interface d'admin est un client de cette API, jamais un accès direct à la base.**

Pas un seul `supabase.from('books').update(...)` dans un composant d'admin. Chaque action
passe par une edge function qui valide, journalise et exécute. Le jour où un agent fera la
même chose, il appellera la même fonction.

## Tables supplémentaires

```sql
book_assets      id, book_id, kind ('interior_pdf'|'cover_pdf'|'he_export'|'support_export'|
                                    'glossary_csv'|'quiz_csv'|'audio_zip'|'cover_img'),
                 version, storage_path, checksum, uploaded_by, created_at

agent_runs       id, agent_name, book_id, action, status, input (jsonb),
                 output_summary (jsonb), cost_cents, duration_ms,
                 idempotency_key (unique), created_at

audit_log        id, actor_type ('human'|'agent'), actor_id, entity, entity_id,
                 action, before (jsonb), after (jsonb), created_at

api_keys         id, label, key_hash, scopes (text[]), last_used_at, revoked_at

outbox           id, topic ('book.published'|'qr.opened'|'reader.activated'|
                            'quiz.completed'),
                 payload (jsonb), delivered_at, attempts, last_error

social_accounts  id, platform, handle, external_id, access_token_encrypted,
                 token_expires_at, connected_at, status
social_metrics   id, account_id, captured_at, metric, value, meta (jsonb)
social_posts     id, account_id, external_id, published_at, permalink,
                 caption_excerpt, book_id (nullable), reach, likes, comments, saves
```

Toutes ces tables sont **inaccessibles au client** : service role uniquement.

## L'API machine

Une edge function d'entrée `/api/v1/*`, authentifiée par clé (en-tête `X-Api-Key`, comparée
au hash, portée vérifiée à chaque appel).

```
POST  /api/v1/books                    créer un livre (état 'idea')
PATCH /api/v1/books/:id                mettre à jour
POST  /api/v1/books/:id/transition     changer d'état  { to, comment }
POST  /api/v1/books/:id/glossary       import glossaire (CSV/JSON, remplace la version)
POST  /api/v1/books/:id/quiz           import quiz
POST  /api/v1/books/:id/assets         déposer un asset (URL signée en retour)
POST  /api/v1/books/:id/publish        le geste de publication
GET   /api/v1/books/:id/readiness      la checklist de publication, en JSON
POST  /api/v1/pages/:slug/sections     écrire du contenu éditorial
GET   /api/v1/stats/books              QR, activations, quiz, audio, IA — par livre et par jour
GET   /api/v1/events?since=            flux d'événements pour le CRM
```

**Trois exigences non négociables :**

1. **Idempotence.** Tout POST accepte un en-tête `Idempotency-Key` ; le même appel rejoué
   ne crée pas de doublon, il rend le résultat précédent. Un agent qui plante et relance
   est la règle, pas l'exception.
2. **Validation stricte.** Un import refuse le lot entier si une ligne est invalide, et
   rend le numéro de ligne et la raison. Jamais d'import partiel silencieux.
3. **Journalisation.** Tout appel écrit dans `agent_runs`, et dans `audit_log` s'il modifie
   une donnée.

## Le geste de publication

Quand un livre est validé et part sur Amazon, **il doit paraître sur le site le même jour**.
Un seul geste — bouton d'admin ou `POST /publish` — qui, en une transaction :

1. Vérifie la **checklist** et refuse si un élément manque : couverture, titres FR/EN/HE,
   accroche FR/EN, glossaire non vide, quiz, audio de tous les chapitres (ou marquage
   explicite « audio à venir »), `qr_code` réservé, `page_count`, `spine_mm`, `price_eur`,
   au moins une URL Amazon.
2. Passe l'état à `published`, horodate.
3. Rend la fiche publique, l'ajoute au catalogue de sa collection.
4. Active la page compagnon derrière le QR.
5. Met à jour la page de collection ; le tome précédent annonce le suivant.
6. Empile un message `book.published` dans `outbox`.

La checklist est visible **en permanence** pour chaque livre en fabrication, pas seulement
au moment de publier.

### Le point que je dois signaler honnêtement

**KDP n'expose pas d'API publique de publication.** Le CRM pourra préparer tout le paquet —
PDF intérieur, PDF de couverture, métadonnées, description, mots-clés, prix — mais le dépôt
sur Amazon restera un geste manuel. C'est structurel. Prévois donc un écran **« paquet
KDP »** qui rassemble tout, prêt à copier-coller et à téléverser. Vérifie l'état des
conditions Amazon au moment de bâtir dessus.

## Le QR vit avant le livre

Le QR est imprimé à l'étape maquette : un exemplaire peut être scanné avant que la page
existe.

- Le code est **réservé** à l'étape `layout` (`qr_reserved_at`), pas à la publication.
- `/b/:qr_code` répond **toujours** proprement : livre non publié → page d'attente sobre
  avec collecte d'email et envoi automatique à la publication ; livre retiré → renvoi vers
  la collection ; code inconnu → page d'erreur éditoriale, jamais un 404 brut.
- Un `event` `qr_open` est écrit dans tous les cas : les scans avant publication sont une
  information commerciale précieuse.

## L'éditeur de contenu

- Onglet **Contenu** : pages et sections, **édition français / anglais côte à côte** sur le
  même écran, avec un indicateur quand la version anglaise est vide ou plus ancienne.
  Rich text volontairement pauvre : gras, italique, lien, liste, citation, intertitre — pas
  de couleur, pas de taille, pas d'alignement, la charte décide. Bouton **Prévisualiser**
  qui affiche la page réelle, en vue téléphone par défaut. Historique et restauration via
  `content_versions`.
- Un champ dédié « texte hébreu » qui bascule en `dir="rtl"`, Frank Ruhl Libre, avec aperçu
  du rendu des nekoudot à côté du champ.
- Onglet **Catalogue** : collections et livres, tous les champs éditoriaux, extraits, liens
  Amazon, ASIN.
- Onglet **Mesure** (voir annexe A).
- Onglet **Réseaux** : pour l'instant, un écran qui affiche proprement « aucun compte
  connecté ».

## Instagram et Meta — préparer, pas construire

**Ce n'est pas un bouton « connecter ».** Il faut un compte Instagram professionnel rattaché
à une Page Facebook, une application Meta déclarée, un passage par la revue de
l'application pour obtenir les autorisations de statistiques, et une gestion de jetons qui
expirent. Plusieurs jours de démarches, et les API Meta changent souvent : vérifie leur état
au moment de t'y mettre.

Tu ne construis **que la place** : les trois tables ci-dessus et l'écran vide. Le
rattachement manuel d'une publication à un livre (`social_posts.book_id`) est ce qui
permettra plus tard de mettre côte à côte une publication et les scans de QR du jour.

## Ce que tu ne construis PAS

L'orchestration des agents, la génération d'audio, la veille de sujets, la réponse aux avis
Amazon, toute logique de fabrication d'un livre. Le site expose les données et les portes ;
le CRM viendra frapper à ces portes.

---

# ANNEXE A · LA MESURE

```
qr_open              { qr_code, book_id, is_published, referrer }
signup / activate    { book_id, source }
glossary_open        { book_id, chapter_no }
glossary_search      { book_id, query_len }        -- jamais la requête elle-même
glossary_print       { book_id }
quiz_start           { book_id, chapter_no, kind }
quiz_answer          { book_id, chapter_no, question_id, correct, ms }
quiz_complete        { book_id, chapter_no, score, duration_s, retry_no }
audio_play           { book_id, chapter_no, speed }
audio_progress       { book_id, chapter_no, pct }  -- à 25/50/75/100 %, pas en continu
ai_msg               { book_id, mode }             -- jamais le contenu
buy_click            { book_id, market, source }
```

**Les trois chiffres à mettre en avant** dans le tableau de bord, parce que ce sont les
seuls qui t'apprennent quelque chose sur les livres eux-mêmes :

- **La question la plus ratée** de chaque chapitre — elle signale un mot mal introduit dans
  le texte, pas un mauvais lecteur.
- **Le chapitre où l'on décroche** : le dernier chapitre atteint par la majorité.
- **Le mot le plus cherché** au glossaire : il aurait dû être glosé dans la page.

Ces trois indicateurs remontent au CRM et deviendront des consignes de rédaction pour les
tomes suivants. Écris-le en une ligne dans l'interface, pour que l'écran ait un sens.

Aucun `event` ne contient de texte saisi par l'utilisateur ni d'identifiant tiers. **Pas de
Google Analytics, pas de pixel, pas de cookie tiers** — donc pas de bandeau cookies.

---

# ANNEXE B · RGPD

- Le double opt-in est la base légale : `consent_at`, `consent_source` et l'horodatage sont
  conservés et exportables — c'est la preuve en cas de contrôle.
- Lien de désinscription dans chaque email.
- Page de suppression de compte qui **supprime réellement** (`profiles`, `book_access`,
  historique IA), pas un drapeau `deleted = true`.
- Mentions légales, politique de confidentialité et contact rédigées et reliées en pied de
  page. Contact : `contact@oulpanstory.com`.
- Export CSV de la liste d'emails avec date et source de consentement.

---

# ANNEXE C · RECETTE FINALE

Avant de déclarer que c'est fini, prouve chacun de ces points :

**Mobile**
1. Sur un iPhone en 4G dégradée : `/b/ELI1` → contenu ouvert en moins de 3 gestes et
   2 minutes.
2. Le parcours complet d'activation **depuis le navigateur intégré d'Instagram**, code à
   6 chiffres compris.
3. Toute la navigation faisable d'une seule main, pouce droit, sur un écran de 390 px.
4. L'audio continue écran verrouillé, avec les commandes du casque.
5. Le clavier ne masque jamais le bouton d'envoi, sur iOS comme sur Android.
6. Premier rendu utile sous 2,5 s en 4G dégradée.

**Hébreu**
7. Rendu des nekoudot sur iOS Safari **et** Android Chrome, aux trois tailles de texte.
8. Une phrase française contenant un mot hébreu s'affiche dans le bon ordre.

**Données et sécurité**
9. Déconnecté, aucune requête ne rend une entrée de glossaire.
10. Les fichiers audio sont inaccessibles sans session.
11. Créer un livre, importer son glossaire, déposer une couverture et le publier
    **entièrement par appels d'API** — montre-moi les requêtes.
12. Le même POST rejoué avec la même `Idempotency-Key` ne crée qu'un seul livre.
13. Publier un livre sans glossaire : refus, avec la liste de ce qui manque.
14. Scanner un QR réservé mais non publié : page d'attente, email collecté, `event` écrit.
15. Clé d'API révoquée : tout appel refusé immédiatement.
16. `audit_log` contient une ligne pour chacune de ces actions, avec le bon `actor_type`.

**Éditorial**
17. Modifier un paragraphe de la page méthode, prévisualiser, publier, puis restaurer la
    version précédente.
18. Une page dont la version anglaise est vide est signalée et n'est pas publiée en anglais.
19. Une table vide n'affiche jamais une erreur ni un squelette infini.
20. Contraste AA des cinq couleurs de collection sur ivoire **et** sur le fond sombre.

---

# ANNEXE D · CE QUI RESTE VOLONTAIREMENT OUVERT

Ces points ne sont pas dans le prompt parce qu'ils ne sont pas tranchés — et un prompt qui
invente des réponses fabrique de la dette :

1. **Le jeu définitif des cinq couleurs.** Celles du BLOC 0 sont des repères de travail.
   D'où l'obligation absolue de passer par des tokens : les changer devra coûter un fichier.
2. **La vente en direct.** Aucun paiement sur le site ; tout passe par Amazon. Vendre un
   PDF ou un abonnement serait une phase séparée.
3. **La production de l'audio.** Elle se fait hors du site, fichier par fichier, avant
   dépôt. Le site ne génère jamais d'audio.
4. **Le branchement du CRM.** La table `events` et l'`outbox` sont dessinées pour lui, mais
   aucune livraison sortante n'est câblée : à faire quand le CRM existera.
5. **Les statistiques Meta.** La place est prête, la connexion ne l'est pas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/498c8300-ccf3-4d40-ba90-80a5f9653b00).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
