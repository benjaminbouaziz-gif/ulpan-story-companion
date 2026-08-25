import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { AccessForm } from "@/components/AccessForm";
import { PageShell } from "@/components/SiteChrome";
import { Spread } from "@/components/Spread";
import { pickLang, useI18n } from "@/i18n/context";
import { getQrEntry } from "@/lib/access.functions";

const qrQuery = (qr: string) =>
  queryOptions({
    queryKey: ["qr", qr],
    queryFn: () => getQrEntry({ data: { qr_code: qr } }),
  });

/** L'entrée par le QR code du livre imprimé. */
export const Route = createFileRoute("/b/$qr_code")({
  head: () => ({
    meta: [
      { title: "Votre livre — Ulpan Story" },
      {
        name: "description",
        content: "Le compagnon du livre que vous tenez : glossaire, quiz, audio et conversation.",
      },
      { property: "og:title", content: "Votre livre — Ulpan Story" },
      { property: "og:description", content: "Ce qu'il y a derrière le QR code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(qrQuery(params.qr_code)),
  component: QrEntry,
  errorComponent: () => (
    <PageShell>
      <p className="body-text">—</p>
    </PageShell>
  ),
});

function QrEntry() {
  const { qr_code } = Route.useParams();
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(qrQuery(qr_code));
  const book = data.book;
  const published = book?.status === "published";

  return (
    <PageShell>
      <p className="label text-secondary-text">{data.qr_code}</p>

      {book ? (
        <section className="border-line mt-2 border-b pb-6">
          <p className="label text-secondary-text">{t("access.yourBook")}</p>
          <h1 className="mt-2 text-[28px]">
            {pickLang(lang, book.title_fr, book.title_en) ?? ""}
          </h1>
          {pickLang(lang, book.subtitle_fr, book.subtitle_en) ? (
            <p className="body-text text-secondary-text mt-2">
              {pickLang(lang, book.subtitle_fr, book.subtitle_en)}
            </p>
          ) : null}
          {data.collection ? (
            <p
              className="label mt-3"
              style={{ color: data.collection.color_hex }}
            >
              {pickLang(lang, data.collection.name_fr, data.collection.name_en) ?? ""}
              {book.tome_no ? ` · ${t("books.volume")} ${book.tome_no}` : ""}
            </p>
          ) : null}
          {pickLang(lang, book.blurb_fr, book.blurb_en) ? (
            <p className="body-text mt-4">{pickLang(lang, book.blurb_fr, book.blurb_en)}</p>
          ) : null}
        </section>
      ) : (
        <h1 className="mt-1 text-[28px]">{t("home.qr.title")}</h1>
      )}

      {published && data.paragraphs.length > 0 ? (
        <div className="mt-8">
          <Spread
            paragraphs={data.paragraphs}
            color={data.collection?.color_hex ?? null}
            runningHead={
              pickLang(lang, book.spread_running_head_fr, book.spread_running_head_en) ??
              pickLang(lang, book.title_fr, book.title_en) ??
              ""
            }
            chapter={pickLang(lang, book.spread_chapter_fr, book.spread_chapter_en) ?? ""}
            folio={book.spread_folio_left ?? 42}
          />
        </div>
      ) : null}

      {!published ? <p className="body-text mt-8">{t("access.qrPending")}</p> : null}

      <AccessForm qrCode={data.qr_code} />
    </PageShell>
  );
}
