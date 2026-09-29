<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Phase P0 : écritures visiteurs/lecteurs uniquement via src/lib/public-writes.server.ts ; éditeurs via getAdminClient. Pourquoi : le client de service n'est atteignable que par ces deux portes.
- reprise/ garde les briques de l'ancien site, hors compilation ; ne jamais l'importer. Pourquoi : référence pour les phases suivantes.
- P1 : la langue vient du domaine seul (src/i18n/lang.functions.ts ; ?lang= + cookie preview_lang hors production) et tous les liens passent par pathFor de src/i18n/routes.ts. Pourquoi : un domaine = une langue, adresses cohérentes et redirections 301 automatiques.
- P2 : l'admin vit sous /admin (enveloppe ssr:false qui vérifie le rôle via adminWhoAmI) ; ses textes sont en français seul dans src/admin/textes.ts, hors des dictionnaires publics. Pourquoi : outil interne mono-langue, les dictionnaires FR/EN restent réservés au site public.
- P2 : le registre admin_login_attempts s'écrit via public-writes.server.ts (countLoginFailures/recordLoginFailure). Pourquoi : garder deux seules portes vers le client de service.
- P3 : les onglets Français/English de la fiche livre sont un seul composant (src/admin/OngletEdition.tsx) ; toute donnée d'édition passe par src/lib/admin-editions.functions.ts, filtrée sur edition_id. Pourquoi : aucun repli d'une langue sur l'autre.
- P3 : QuizRound et quiz-progress vivent dans src/ avec le type neutre src/lib/quiz-types.ts ; leurs libellés sont dans les dictionnaires publics (quiz.*). Pourquoi : réutilisés par le compagnon en phase 7.
- P4 : un seul éditeur de blocs (src/admin/BlockEditor.tsx) pour site_blocks et collection_blocks ; types permis par écran dans src/lib/site-blocks.ts, revérifiés côté serveur (src/lib/admin-site.functions.ts) ; chaque enregistrement ajoute un instantané dans content_versions. Pourquoi : jamais de JSON saisi, historique uniforme.
- P5 : les pages publiques et les aperçus admin partagent les mêmes lectures (src/lib/vitrine.data.ts, mode "public" sous RLS ou "apercu" via client éditeur) et les mêmes composants (src/vitrine/Pages.tsx). Pourquoi : l'aperçu montre exactement la page publique, non-publié compris.
- P7 : le dépôt JSON de la fiche livre suit docs/contrat-fiche-livre.md ; analyse pure dans src/lib/fiche-json.ts, contrôles base et écriture dans src/lib/admin-fiche.functions.ts (réanalyse avant écriture). Pourquoi : même principe que les quiz, rien écrit en cas d erreur.
- P6 : parcours lecteur = src/lib/lecteur.functions.ts (langue recalculée côté serveur par src/i18n/lang.server.ts) → public-writes.server.ts ; pages dans src/lecteur/ ; effacement partagé src/lib/effacement.server.ts (client fourni par l'appelant). Pourquoi : deux seules portes vers le client de service, aucune langue transmise par le navigateur.
