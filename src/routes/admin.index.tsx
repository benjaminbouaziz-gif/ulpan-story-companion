import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { adminDashboard } from "@/lib/admin-dashboard.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — Ulpan Story" },
      { name: "description", content: "Outils internes d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function Block({ title, children, to, toLabel }: { title: string; children: ReactNode; to?: string; toLabel?: string }) {
  return (
    <section className="border-line mt-8 border-t pt-5">
      <h2 className="label">{title}</h2>
      <div className="mt-3">{children}</div>
      {to ? (
        <Link to={to} className="label touch mt-3 inline-flex border-b border-current">
          {toLabel}
        </Link>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="body-text">
      {label} : {value}
    </p>
  );
}

function Counts({ map, none }: { map: Record<string, number>; none: string }) {
  const keys = Object.keys(map).sort();
  if (keys.length === 0) return <span>{none}</span>;
  return <span>{keys.map((k) => `${k} ${map[k]}`).join(" · ")}</span>;
}

function AdminHome() {
  const { t } = useI18n();
  const load = useServerFn(adminDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => load() });
  const none = t("admin.none");

  return (
    <PageShell>
      <div className="flex items-baseline gap-4">
        <h1 className="text-[30px]">{t("admin.title")}</h1>
        <Link to="/admin/compte" className="label touch ml-auto inline-flex border-b border-current">
          {t("admin.account")}
        </Link>
      </div>

      {isLoading || !data ? (
        <p className="body-text text-secondary-text mt-6">{t("admin.loading")}</p>
      ) : (
        <div className="max-w-2xl">
          <Block title={t("admin.dash.catalog")}>
            <Row
              label={t("admin.dash.activeCollections")}
              value={data.collections.active === 0 ? none : `${data.collections.active} / ${data.collections.total}`}
            />
            <Row
              label={t("admin.dash.booksByStatus")}
              value={<Counts map={data.booksByStatus} none={none} />}
            />
            <div className="mt-3">
              {data.books.length === 0 ? (
                <p className="body-text">{none}</p>
              ) : (
                data.books.map((b) => (
                  <p key={b.id} className="body-text">
                    {b.title} — {b.qr_code} — {b.status} — {t("admin.dash.amazon")}{" "}
                    {b.hasAmazon ? t("admin.dash.yes") : t("admin.dash.no")}
                  </p>
                ))
              )}
            </div>
          </Block>

          <Block title={t("admin.dash.bookContent")} to="/admin/extraits" toLabel={t("admin.excerpt")}>
            {data.books.length === 0 ? (
              <p className="body-text">{none}</p>
            ) : (
              data.books.map((b) => (
                <p key={b.id} className="body-text">
                  {b.title} — {t("admin.dash.pagesByStage")} :{" "}
                  <Counts map={b.pagesByStage} none={none} /> — {b.pagesPublished}{" "}
                  {t("admin.dash.published")}
                </p>
              ))
            )}
          </Block>

          <Block title={t("admin.dash.treasures")}>
            {data.books.length === 0 ? (
              <p className="body-text">{none}</p>
            ) : (
              data.books.map((b) => (
                <p key={b.id} className="body-text">
                  {b.title} — {t("admin.dash.glossary")} {b.glossary || none} — {t("admin.dash.quiz")}{" "}
                  {b.quiz || none} — {t("admin.dash.audio")} {b.audio || none}
                </p>
              ))
            )}
          </Block>

          <Block title={t("admin.dash.editorialPages")} to="/admin/pages" toLabel={t("admin.pages")}>
            {data.pages.length === 0 ? (
              <p className="body-text">{none}</p>
            ) : (
              data.pages.map((p) => (
                <p key={p.slug} className="body-text">
                  /{p.slug} — {t("admin.dash.sections")} {p.sections || none} — {p.missingEnglish}{" "}
                  {t("admin.dash.missingEnglish")}
                </p>
              ))
            )}
          </Block>

          <Block title={t("admin.dash.readers")}>
            <Row
              label={t("admin.dash.signups")}
              value={
                data.readers.signups === 0
                  ? none
                  : `${data.readers.signups} — ${data.readers.signupsConfirmed} ${t("admin.dash.confirmed")}`
              }
            />
            <Row label={t("admin.dash.profiles")} value={data.readers.profiles || none} />
            <Row label={t("admin.dash.bookAccess")} value={data.readers.bookAccess || none} />
            <Row
              label={t("admin.dash.events")}
              value={<Counts map={data.readers.eventsByKind} none={none} />}
            />
          </Block>

          <Block title={t("admin.dash.roles")}>
            {data.roles.length === 0 ? (
              <p className="body-text">{none}</p>
            ) : (
              data.roles.map((r) => (
                <p key={`${r.email}-${r.role}`} className="body-text">
                  {r.email} — {r.role}
                </p>
              ))
            )}
          </Block>

          <Block title={t("admin.figures")} to="/admin/chiffres" toLabel={t("admin.figures")}>
            <p className="body-text text-secondary-text">{data.generatedAt}</p>
          </Block>
        </div>
      )}
    </PageShell>
  );
}
