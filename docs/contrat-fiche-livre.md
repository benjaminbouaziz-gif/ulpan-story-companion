# Contrat — fiche livre JSON

Un fichier par livre, déposé dans l'admin (Livres → « Déposer une fiche livre (JSON) »).
Nom conseillé : `fiche-<slug>.json`. Encodage UTF-8.

## Structure

```text
{
  "collection": { ... }   facultatif
  "livre":      { ... }   obligatoire
  "editions":   { "fr": { ... }, "en": { ... } }   obligatoire, au moins une langue
}
```

Tout champ non prévu ci-dessous est une **erreur** (pas ignoré). Les textes sont
nettoyés des espaces au début et à la fin ; un texte vide vaut « absent ».

## Bloc `collection` (facultatif)

| Champ | Type | Obligatoire | Limites |
|---|---|---|---|
| slug | texte | oui | 80 car., minuscules/chiffres/tirets (`^[a-z0-9]+(-[a-z0-9]+)*$`), non réservé, doit être égal à `livre.collection`, pas déjà le slug d'un livre |
| couleur | texte | non | une des 12 couleurs du nuancier : #1f3a5f, #2e5e4e, #6b2d2d, #7a5c2e, #4a3b5c, #2f4f4f, #8c4a2f, #3d5a80, #5c6b3a, #6d4c41, #34495e, #7b3f61 |
| ordre | entier | non | 0 à 100 000 |
| fr / en | objet | non | textes de la collection dans la langue |
| fr/en.nom | texte | oui si la langue est présente | 300 car. |
| fr/en.accroche | texte | non | 500 car. |
| fr/en.description | texte | non | 10 000 car. |
| fr/en.pour_qui | texte | non | 5 000 car. |

- Collection absente de la base : créée **masquée**.
- Collection existante : couleur/ordre fournis et textes des langues fournies sont remplacés ; sa visibilité ne change jamais ; une version est enregistrée dans l'historique.
- Bloc absent : la collection existante n'est pas modifiée ; si elle n'existe pas, le fichier est **refusé**.

## Bloc `livre` (obligatoire)

| Champ | Type | Obligatoire | Limites |
|---|---|---|---|
| slug | texte | oui | même format que ci-dessus ; identique au champ `livre` des fichiers de quiz ; pas déjà le slug d'une collection |
| ancien_slug | texte | non | pour renommer un livre existant ; refusé si ce slug est verrouillé (QR code déjà téléchargé) |
| collection | texte | oui | slug de la collection |
| tome | entier | non | 0 à 100 000 |
| titre_hebreu | texte | non | 500 car. |
| nombre_chapitres | entier | non | 0 à 100 000 |
| nombre_mots_vocabulaire | entier | non | 0 à 100 000 |
| titres_chapitre_hebreu | liste de `{ "chapitre", "titre" }` | non | 1 000 au plus ; chapitre entier 1–10 000 sans doublon ; titre obligatoire, 500 car. |

## Bloc `editions` (obligatoire) — `fr` et/ou `en`

| Champ | Type | Obligatoire | Limites |
|---|---|---|---|
| titre | texte | oui | 300 car. |
| sous_titre | texte | non | 300 car. |
| resume | texte | non | 5 000 car. |
| note_niveau | texte | non | 500 car. |
| ce_que_vous_apprendrez | liste de textes | non | 50 au plus, 500 car. chacun |
| pages_imprimees | entier | non | 1 à 10 000 |
| lien_amazon | texte | non | 1 000 car., commence par `https://`, sans espace |
| titres_chapitre | liste de `{ "chapitre", "titre" }` | non | comme `titres_chapitre_hebreu` |

Une langue absente du fichier n'est pas touchée. Une édition nouvelle est créée **en préparation** (donc invisible).

Rappel : pour **publier**, l'admin exige en plus la collection, le titre, le résumé, la note de niveau, les pages imprimées, le lien Amazon, les titres de chapitre pour chaque chapitre ayant des pages, la couverture et le glossaire PDF.

## Ce que le fichier ne contient pas

Images (couverture, extrait), glossaire PDF, pages hébraïques (import dédié), audio, quiz, blocs de présentation enrichie.

## Effets d'un dépôt

- Une erreur, quelle qu'elle soit : **rien n'est écrit**. Le rapport liste une ligne par erreur : champ, langue, problème.
- Livre nouveau : créé, éditions en préparation.
- Livre existant : une version (livre, éditions, titres de chapitre) est enregistrée dans l'historique, puis ses textes sont remplacés par ceux du fichier (les titres de chapitre de la langue déposée sont remplacés en entier). Rien d'autre n'est touché : statut de publication, visibilité, images, glossaire, pages, audio, quiz, clics Amazon, verrou du slug.

## Exemple complet et valide (livre fictif)

```json
{
  "collection": {
    "slug": "romans-courts",
    "couleur": "#2e5e4e",
    "ordre": 1,
    "fr": {
      "nom": "Romans courts",
      "accroche": "Des histoires complètes à lire en quelques soirées.",
      "description": "Chaque tome raconte une histoire entière, écrite pour les lecteurs qui débutent en hébreu.",
      "pour_qui": "Lecteurs ayant terminé un premier oulpan."
    },
    "en": {
      "nom": "Short Novels",
      "accroche": "Complete stories to read in a few evenings.",
      "description": "Each volume tells a whole story, written for readers starting out in Hebrew.",
      "pour_qui": "Readers who have completed a first ulpan."
    }
  },
  "livre": {
    "slug": "le-marchand-de-jaffa",
    "collection": "romans-courts",
    "tome": 1,
    "titre_hebreu": "הַסּוֹחֵר מִיָּפוֹ",
    "nombre_chapitres": 2,
    "nombre_mots_vocabulaire": 420,
    "titres_chapitre_hebreu": [
      { "chapitre": 1, "titre": "הַשּׁוּק" },
      { "chapitre": 2, "titre": "הַנָּמָל" }
    ]
  },
  "editions": {
    "fr": {
      "titre": "Le marchand de Jaffa",
      "sous_titre": "Un roman en hébreu facile",
      "resume": "Au marché de Jaffa, un vieux marchand confie un secret à un jeune garçon.",
      "note_niveau": "Niveau débutant avancé",
      "ce_que_vous_apprendrez": ["Le vocabulaire du marché", "Les nombres et les prix"],
      "pages_imprimees": 96,
      "lien_amazon": "https://www.amazon.fr/dp/EXEMPLE0001",
      "titres_chapitre": [
        { "chapitre": 1, "titre": "Le marché" },
        { "chapitre": 2, "titre": "Le port" }
      ]
    },
    "en": {
      "titre": "The Merchant of Jaffa",
      "sous_titre": "A novel in easy Hebrew",
      "resume": "At the Jaffa market, an old merchant shares a secret with a young boy.",
      "note_niveau": "Upper beginner",
      "ce_que_vous_apprendrez": ["Market vocabulary", "Numbers and prices"],
      "pages_imprimees": 96,
      "lien_amazon": "https://www.amazon.com/dp/EXAMPLE0001",
      "titres_chapitre": [
        { "chapitre": 1, "titre": "The Market" },
        { "chapitre": 2, "titre": "The Harbour" }
      ]
    }
  }
}
```

## Champs obligatoires, en bref

- `livre.slug`, `livre.collection`
- au moins une édition, et pour chacune : `titre`
- si le bloc `collection` est présent : `collection.slug` ; pour chaque langue présente : `nom`
- chaque titre de chapitre : `chapitre` et `titre`

Tout le reste est facultatif.
