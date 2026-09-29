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
