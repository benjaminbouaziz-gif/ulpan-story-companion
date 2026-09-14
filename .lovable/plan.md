# Brique 1 — L'onglet Livre : créer les pages, déposer les audios

L'atelier devient l'espace de saisie manuelle. Cette brique livre trois écrans : la liste des livres, la fiche d'un livre (Informations + Pages), et l'éditeur d'une page avec son audio.

## Ce qui est construit

### 1. Liste des livres — `/atelier/livres`
Une ligne par livre : titre, tome, collection, code QR, statut, nombre de pages créées, nombre de pages avec audio. Les deux compteurs sont comptés en base à l'affichage. Un lien « ouvrir » par ligne. Aucun graphique, aucune vignette. La chaîne de fabrication, les décisions et la fiche robot disparaissent de cet écran.

### 2. Fiche du livre — `/atelier/livres/$slug`
En-tête : titre, tome, collection, code QR. Puis des onglets : **Informations** et **Pages** actifs ; **Glossaire**, **Quiz**, **Conversation** affichés grisés avec « brique suivante », sans lien ni appel.

**Informations** — formulaire sur les colonnes existantes de `books` uniquement :
- Identité : title_fr, title_en, title_he, subtitle_fr, subtitle_en, slug, tome_no, collection_id, qr_code
- Site : blurb_fr, blurb_en, level_note_fr, level_note_en, what_you_learn_fr / what_you_learn_en (listes de lignes, ajouter/supprimer)
- Achat : amazon_url_fr, amazon_url_com, amazon_url_other, amazon_asin — toute URL qui ne commence pas par `https://` est refusée, côté écran et côté serveur
- Fabrication : cover_url, sample_pdf_url, page_count, chapters_count
- État : status, published_at

Aucun appel de traduction, aucun indicateur « à traduire ».

**Pages** — tableau trié par page_no : numéro, chapitre, type de soutien, audio (oui/non), publié (oui/non), lien « ouvrir ». Bouton « Nouvelle page » au-dessus. Livre sans page : « aucune page ».

### 3. Éditeur de page — `/atelier/livres/$slug/pages/$pageId`
Champs de la page : page_no (obligatoire, unique par livre — refus explicite en cas de doublon), chapter_no, support_kind (liste fermée : translation, cloze, vocabulary, nikud, libellés traduits), chapter_title_he / _fr / _en, running_head_fr / _en, folio, is_published.

Blocs (`page_blocks`), ordonnés : ajouter, supprimer, monter, descendre. Par bloc : `he_nikud` (grande zone multiligne, rtl/lang=he/police hébraïque), `he_plain` (rempli automatiquement depuis he_nikud via `stripNikud` de `src/lib/spread.ts`, et figé dès que je l'édite à la main), `support_fr`, `support_en`. `block_kind` reste `paragraph`, non modifiable.

Un seul bouton « Enregistrer » écrit la page et ses blocs. Aucune sauvegarde automatique. Avertissement si je quitte l'écran avec des modifications non enregistrées.

### 4. L'audio de la page
Bloc distinct sous les paragraphes : téléversement d'un fichier `.m4a` ou `.mp3`, 50 Mo maximum. Rangement imposé `{slug}/page-{NN}.{ext}` — le nom d'origine est jeté. Le chemin est écrit dans `book_pages.audio_path`. Remplacement d'un audio existant après confirmation. Bouton « retirer l'audio » (efface le fichier puis remet `audio_path` à null). Lecteur de contrôle minimal (lecture, pause, position) alimenté par une URL signée de 60 secondes générée à la demande côté serveur ; aucune URL permanente n'apparaît nulle part.

### 5. Navigation
`/atelier/prompts`, `/atelier/robots` et `/atelier/etape/$id` quittent la barre latérale et redirigent vers `/atelier/livres`. Le code de ces salles reste en place, intact.

## Détails techniques

**Migration (une seule, exacte) :**
```sql
ALTER TABLE public.book_pages ADD COLUMN audio_path text;
```
Bucket Storage `audios-livres` créé **privé** (limite 50 Mo) via l'outil dédié, puis politiques sur `storage.objects` :
```sql
CREATE POLICY "audios livres lecture editeurs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "audios livres ecriture editeurs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "audios livres maj editeurs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "audios livres suppression editeurs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audios-livres'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));
```
Rien d'autre. `audio_tracks` n'est pas touchée. Aucun INSERT de contenu.

**Sécurité.** Nouveau module `src/lib/atelier-livre.functions.ts` : chaque fonction serveur porte `.middleware([requireSupabaseAuth])`, appelle `assertEditor(context.supabase, context.userId)` (rôle lu dans `user_roles`, jamais annoncé par le client) puis `getAdminClient(editor)`. Un compte sans rôle reçoit `Forbidden` et aucune donnée. Le téléversement, la suppression et la signature d'URL passent par ces mêmes fonctions. Politiques RLS d'écriture sur `book_pages` et `page_blocks` restreintes à admin/editor si elles ne le sont pas déjà (vérification faite avant, dans la même migration si nécessaire).

**URL signée.** `createSignedUrl(chemin, 60)` sur le bucket privé, appelée dans le handler serveur au moment où le lecteur en a besoin ; validité réelle 60 secondes, jamais stockée ni rendue dans le HTML.

**Fichiers touchés :** `src/routes/atelier.livres.tsx` (refonte liste), nouvelles routes `atelier.livres.$slug.tsx` et `atelier.livres_.$slug.pages.$pageId.tsx`, redirections dans `atelier.prompts.tsx` / `atelier.robots.tsx` / `atelier.etape.$id.tsx`, menu dans `src/routes/atelier.tsx`, nouveaux composants `AtelierBookInfo.tsx`, `AtelierPagesList.tsx`, `AtelierPageEditor.tsx`, `AtelierPageAudio.tsx`, nouveau `src/lib/atelier-livre.functions.ts`, clés FR/EN dans `src/i18n/dictionaries.ts`. Rien hors `/atelier` n'est modifié, sauf le dictionnaire (partagé) et la migration.

**Non fait :** aucun import de masse, aucune génération, aucun texte en dur, aucune table supprimée, site public et parcours lecteur intacts, `/atelier/*` reste en noindex.
