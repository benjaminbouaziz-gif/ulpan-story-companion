# Brique 3 — Alléger la démonstration sur le site

## Résultat attendu

Le site remplace les doubles pages imprimées miniaturisées par une lecture verticale : chaque paragraphe hébreu est immédiatement suivi de son soutien, dans une colonne lisible. L’atelier conserve le fac-similé papier et montre à côté le rendu exact du site.

## Mise en œuvre

1. **Créer l’extrait de lecture public**
   - Ajouter `ExtraitLecture`, alimenté par les mêmes paragraphes que `Spread`.
   - Afficher l’hébreu puis son soutien français ou anglais, avec le cas vocalisé en hébreu à droite et les trous rendus par `parseCloze`.
   - Respecter la taille de texte choisie sur le site, limiter l’affichage initial à quatre paragraphes, puis proposer « Lire la suite de la page » / « Replier » dans les deux langues.
   - N’ajouter ni cadre, ni fond, ni hauteur fixe, ni éléments du fac-similé papier.

2. **Remplacer les fac-similés visibles par les visiteurs**
   - Utiliser `ExtraitLecture` dans les pages collection, QR et dans `SpreadSection`.
   - Retirer de `SpreadSection` le second mode de lecture et son bouton, sans supprimer `SpreadReader.tsx`.
   - Pour la fiche livre et les sections éditoriales disposant de vraies `book_pages`, remplacer aussi `BookSpread` par une lecture verticale équivalente, avec quatre blocs au départ. Conserver le choix entre les pages et le glossaire, mais retirer les contrôles propres au papier.

3. **Conserver les deux contrôles dans l’atelier**
   - Garder `Spread` inchangé sous le titre « Aperçu papier ».
   - Ajouter à côté « Aperçu site » avec `ExtraitLecture`.
   - Brancher les deux aperçus sur le même brouillon afin que chaque modification soit visible simultanément.

4. **Corriger l’accueil uniquement dans les données existantes**
   - Masquer la ligne suivant la devise.
   - Remplacer exactement le chapeau français par le texte demandé et raccourcir l’anglais existant par coupe correspondante.
   - Masquer la section « Derrière le QR code » sans la supprimer.
   - Conserver les informations de suivi de la version anglaise cohérentes avec le nouveau texte français.

5. **Vérifier la recette**
   - Contrôler en français et en anglais les pages collection, livre et QR, les quatre paragraphes, le dépliage/repliage, la taille du texte et l’hébreu vocalisé.
   - Contrôler les deux aperçus synchronisés dans l’atelier et les trois changements visibles sur l’accueil.
   - Vérifier le code et confirmer qu’aucune migration n’a été créée, que `Spread.tsx` reste inchangé et que les fonctions Livre/audio ne sont pas touchées.

## Détails techniques

- `Spread` n’est actuellement utilisé directement que dans les trois emplacements annoncés : collection, QR et atelier. `SpreadSection` couvre la fiche livre en secours et les sections `book_spread`.
- Écart découvert et validé : les livres possédant des `book_pages` passent par `BookPagesSection` et `BookSpread`, hors de la liste initiale. Ils seront eux aussi allégés selon votre réponse, sans changer leur modèle de données.
- Aucun ajout de colonne, aucune migration et aucune duplication de données.

## Rapport final

Le rapport listera les fichiers créés et modifiés, chaque ancien usage public de `Spread`/`BookSpread`, l’usage papier conservé dans l’atelier, les changements de l’accueil et la confirmation qu’aucune migration n’a été créée.
