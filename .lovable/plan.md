# Brique 2 — Le contenu du site dans l'atelier

## 1. Le déménagement des trois outils

Trois écrans neufs dans l'atelier, qui reprennent le corps des composants existants sans toucher au métier :

- `/atelier/site/pages` ← corps de `admin.pages.tsx`
- `/atelier/site/extraits` ← corps de `admin.extraits.tsx`
- `/atelier/site/chiffres` ← corps de `admin.chiffres.tsx`

`PageShell` et la mise en page ivoire sont retirés : les écrans vivent dans la coquille de l'atelier (barre latérale, pleine largeur, typographie utilitaire, coins 2 px).

`/atelier/site` devient le sommaire de ces trois écrans (liens internes, plus la mention « ancien outil »).

Les fichiers `src/routes/admin.*.tsx` sont supprimés et remplacés par une seule route attrape-tout `src/routes/admin.$.tsx` qui redirige :
`/admin/pages` → `/atelier/site/pages`, `/admin/extraits` → `/atelier/site/extraits`, `/admin/chiffres` → `/atelier/site/chiffres`, tout le reste → `/atelier/livres`.

Les fonctions serveur (`src/lib/admin-pages.functions.ts`, `admin-spread.functions.ts`, `admin-books.functions.ts`, `admin-auth.functions.ts`, `admin-spread.server.ts`) ne sont pas touchées : elles restent le moteur.

## 2. Les huit pages passent en base

Une migration crée les lignes `pages` (`is_system = true`) et leurs `page_sections`, avec le texte français et anglais repris **mot pour mot** des dictionnaires. `*_en_source = 'reprise'`, `*_en_hash` calculé sur le français repris.

| Page | Sections prévues (kind) |
| --- | --- |
| `accueil` | devise (`heading`), accroche + lede (`richtext`), « La méthode » (`richtext`), « Les collections » (`heading`, verrouillée), « Disponible aujourd'hui » (`heading`, verrouillée), « Derrière le QR code » (`richtext`) |
| `collections` | titre + phrase de vide (`heading`, verrouillée) |
| `compagnon` | phrase d'accueil hors session (`richtext`, verrouillée) |
| `activation` | titre du formulaire de code (`heading`, verrouillée) |
| `contact` | adresse de contact (`richtext`) |
| `mentions-legales` | adresse de contact (`richtext`) |
| `confidentialite` | adresse de contact (`richtext`) |
| `connexion` | aucune section : la page n'affiche aujourd'hui qu'un libellé d'interface |

Les listes alimentées par la base (collections, tomes, formulaires, lecteur) restent en code ; seules leurs phrases d'introduction passent en base, et ces sections sont `is_locked = true`.

Puis chaque route publique concernée lit ses sections avec `pageQuery` + `PageSections`, comme `methode.tsx`, **en conservant** ses éléments dynamiques et ses balises `head` actuelles.

## 3. Ce que je ne touche pas

Parcours `/b/$qr_code`, activation par code, authentification, onglet Livre, aucune table ni colonne supprimée, aucun texte inventé.

## Détail technique

- Migration : `INSERT INTO public.pages` (8 lignes) + `INSERT INTO public.page_sections`, valeurs de `kind` prises dans l'énumération existante, `sort_order` dans l'ordre d'affichage actuel. Les hash anglais sont calculés dans la migration en SQL (`encode(digest(...))`) ou écrits en dur d'après le même algorithme que `hashText`, pour que « à retraduire » fonctionne dès la première modification.
- Aucune valeur ajoutée aux énumérations `section_kind` / `page_status`.
- Nouvelles clés de dictionnaire FR/EN pour le sommaire de la salle Site et les titres des trois écrans ; les libellés d'interface existants restent en place.
- Les routes publiques gagnent un `loader` qui précharge `pageQuery(<slug>)`.

## Points que je signalerai dans le rapport

- `contact`, `mentions-legales` et `confidentialite` n'ont aujourd'hui **aucun texte rédactionnel** : elles affichent une adresse email et le message d'interface « Cette page n'a pas encore de contenu publié. » Je reprends l'email, je ne complète rien.
- `connexion` n'affiche que « Bientôt. » — libellé d'interface, donc rien à reprendre.
- Ces pages seront donc éditables mais vides ; c'est à vous d'y écrire le texte depuis l'atelier.
