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
