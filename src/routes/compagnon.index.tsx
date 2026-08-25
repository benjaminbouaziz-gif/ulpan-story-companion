import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { listMyBooks } from "@/lib/companion.functions";

export const Route = createFileRoute("/compagnon/")({
  head: () => ({
    meta: [
      { title: "Espace lecteur — Ulpan Story" },
      {
        name: "description",
        content:
          "Le compagnon des livres Ulpan Story : glossaire, quiz, lecture audio et conversation en hébreu.",
      },
      { property: "og:title", content: "Espace lecteur — Ulpan Story" },
      { property: "og:description", content: "Ce qu'il y a derrière le QR code de votre livre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanionHome,
});

function CompanionHome() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const fetchBooks = useServerFn(listMyBooks);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useQuery({
    queryKey: ["companion", "books"],
    queryFn: () => fetchBooks(),
    enabled: signedIn === true,
  });

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.companion")}</h1>

      {signedIn === false ? (
        <>
          <p className="body-text mt-4">{t("companion.signedOut")}</p>
          <Link
            to="/activation"
            className="label touch mt-6 inline-flex border-b border-current"
          >
            {t("companion.signIn")}
          </Link>
        </>
      ) : null}

      {signedIn === true ? (
        <>
          <p className="label text-secondary-text mt-6">{t("companion.myBooks")}</p>
          {query.isPending ? <p className="body-text mt-4">{t("companion.loading")}</p> : null}
          {query.data && query.data.books.length === 0 ? (
            <p className="body-text mt-4">{t("companion.noBooks")}</p>
          ) : null}
          <ul className="border-line mt-4 border-t">
            {(query.data?.books ?? []).map((book) => (
              <li key={book.id} className="border-line border-b py-4">
                <Link
                  to="/compagnon/$book_slug"
                  params={{ book_slug: book.slug }}
                  className="touch flex items-baseline justify-between gap-4"
                >
                  <span className="body-text">{book.title_fr}</span>
                  <span className="label text-secondary-text">{t("companion.open")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageShell>
  );
}
