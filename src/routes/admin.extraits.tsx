import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { Excerpt } from "@/components/Excerpt";
import { useI18n } from "@/i18n/context";
import {
  adminCreateParagraph,
  adminDeleteParagraph,
  adminListParagraphs,
  adminMe,
  adminSaveParagraph,
} from "@/lib/admin-excerpt.functions";
import { hasNikudSigns, stripNikud, type ExcerptParagraph } from "@/lib/excerpt";

export const Route = createFileRoute("/admin/extraits")({
  head: () => ({
    meta: [
      { title: "Extrait démonstratif — Administration" },
      { name: "description", content: "Édition paragraphe par paragraphe de l'extrait." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExcerptEditor,
});

function ExcerptEditor() {
  const { t } = useI18n();
  const me = useServerFn(adminMe);
  const list = useServerFn(adminListParagraphs);
  const save = useServerFn(adminSaveParagraph);
  const create = useServerFn(adminCreateParagraph);
  const remove = useServerFn(adminDeleteParagraph);

  const [bookSlug, setBookSlug] = useState("eli-cohen");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExcerptParagraph | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ["admin", "me"], queryFn: () => me(), retry: false });
  const listQuery = useQuery({
    queryKey: ["admin", "paragraphs", bookSlug],
    queryFn: () => list({ data: { bookSlug } }),
    enabled: Boolean(meQuery.data?.isEditor),
    retry: false,
  });

  const paragraphs = listQuery.data?.paragraphs ?? [];
  const current = useMemo(
    () => paragraphs.find((p) => p.id === selected) ?? null,
    [paragraphs, selected],
  );

  useEffect(() => {
    setDraft(current ? { ...current } : null);
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: async (p: ExcerptParagraph) =>
      save({
        data: {
          id: p.id,
          sort_order: p.sort_order,
          stage_no: p.stage_no,
          stage_label_fr: p.stage_label_fr,
          stage_label_en: p.stage_label_en,
          he: p.he,
          has_nikud: p.has_nikud,
          support_fr: p.support_fr,
          support_en: p.support_en,
        },
      }),
    onSuccess: (res) => {
      setMessage(res.ok ? "Enregistré." : (res.error ?? "Erreur."));
      listQuery.refetch();
    },
    onError: () => setMessage("Erreur d'enregistrement."),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const bookId = listQuery.data?.book?.id;
      if (!bookId) throw new Error("no book");
      const next = (paragraphs[paragraphs.length - 1]?.sort_order ?? 0) + 1;
      return create({
        data: {
          book_id: bookId,
          sort_order: next,
          stage_no: paragraphs[paragraphs.length - 1]?.stage_no ?? 1,
          stage_label_fr: "Nouvelle étape",
          stage_label_en: "New stage",
          he: "טֶקְסְט",
          has_nikud: true,
          support_fr: null,
          support_en: null,
        },
      });
    },
    onSuccess: () => listQuery.refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      setSelected(null);
      listQuery.refetch();
    },
  });

  if (meQuery.isLoading) {
    return (
      <PageShell>
        <p className="body-text">…</p>
      </PageShell>
    );
  }

  if (!meQuery.data?.isEditor) {
    return (
      <PageShell>
        <h1 className="text-[26px]">{t("admin.excerpt")}</h1>
        <p className="body-text text-secondary-text mt-4">{t("admin.forbidden")}</p>
      </PageShell>
    );
  }

  function patch(p: Partial<ExcerptParagraph>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  }

  return (
    <PageShell>
      <h1 className="text-[26px]">{t("admin.excerpt")}</h1>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="label text-secondary-text flex flex-col gap-1">
          Livre
          <input
            value={bookSlug}
            onChange={(e) => setBookSlug(e.target.value)}
            className="border-line body-text touch border px-2"
          />
        </label>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          className="label touch border-line border px-3"
        >
          Ajouter un paragraphe
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <h2 className="label text-secondary-text">Paragraphes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {paragraphs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`border-line w-full border p-3 text-right ${
                    p.id === selected ? "border-foreground" : ""
                  }`}
                >
                  <span className="label text-secondary-text float-left" dir="ltr">
                    {p.sort_order} · étape {p.stage_no}
                  </span>
                  <span dir="rtl" lang="he" className="hebrew">
                    {p.he}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {draft ? (
            <section className="border-line mt-8 border-t pt-6">
              <label className="label text-secondary-text flex flex-col gap-1">
                Hébreu
                <textarea
                  dir="rtl"
                  lang="he"
                  rows={3}
                  value={draft.he}
                  onChange={(e) => patch({ he: e.target.value })}
                  className="border-line hebrew border p-2"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="label touch flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.has_nikud}
                    onChange={(e) => patch({ has_nikud: e.target.checked })}
                  />
                  Vocalisé
                </label>
                <button
                  type="button"
                  onClick={() => patch({ he: stripNikud(draft.he), has_nikud: false })}
                  className="label touch border-line border px-3"
                >
                  Retirer les nekoudot
                </button>
                {hasNikudSigns(draft.he) && !draft.has_nikud ? (
                  <span className="label text-secondary-text">Reste des nekoudot</span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <label className="label text-secondary-text flex flex-col gap-1">
                  Ordre
                  <input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => patch({ sort_order: Number(e.target.value) })}
                    className="border-line body-text touch w-20 border px-2"
                  />
                </label>
                <label className="label text-secondary-text flex flex-col gap-1">
                  Étape
                  <input
                    type="number"
                    value={draft.stage_no}
                    onChange={(e) => patch({ stage_no: Number(e.target.value) })}
                    className="border-line body-text touch w-20 border px-2"
                  />
                </label>
                <label className="label text-secondary-text flex flex-col gap-1">
                  Nom d'étape FR
                  <input
                    value={draft.stage_label_fr ?? ""}
                    onChange={(e) => patch({ stage_label_fr: e.target.value || null })}
                    className="border-line body-text touch border px-2"
                  />
                </label>
                <label className="label text-secondary-text flex flex-col gap-1">
                  Nom d'étape EN
                  <input
                    value={draft.stage_label_en ?? ""}
                    onChange={(e) => patch({ stage_label_en: e.target.value || null })}
                    className="border-line body-text touch border px-2"
                  />
                </label>
              </div>

              <label className="label text-secondary-text mt-4 flex flex-col gap-1">
                Soutien FR
                <textarea
                  rows={2}
                  value={draft.support_fr ?? ""}
                  onChange={(e) => patch({ support_fr: e.target.value || null })}
                  className="border-line body-text border p-2"
                />
              </label>
              <label className="label text-secondary-text mt-3 flex flex-col gap-1">
                Soutien EN
                <textarea
                  rows={2}
                  value={draft.support_en ?? ""}
                  onChange={(e) => patch({ support_en: e.target.value || null })}
                  className="border-line body-text border p-2"
                />
              </label>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate(draft)}
                  className="label touch border-line bg-foreground text-background border px-4"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(draft.id)}
                  className="label touch border-line border px-3"
                >
                  Supprimer
                </button>
                {message ? <p className="label text-secondary-text">{message}</p> : null}
              </div>
            </section>
          ) : (
            <p className="body-text text-secondary-text mt-6">
              Choisissez un paragraphe à modifier.
            </p>
          )}
        </div>

        <aside className="lg:w-[380px]">
          <h2 className="label text-secondary-text">Aperçu téléphone</h2>
          <div className="border-line mx-auto mt-3 w-[360px] max-w-full border p-4">
            <Excerpt
              paragraphs={paragraphs.map((p) => (draft && p.id === draft.id ? draft : p))}
            />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
