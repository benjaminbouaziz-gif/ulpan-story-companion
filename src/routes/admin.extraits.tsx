import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { Spread } from "@/components/Spread";
import { useI18n } from "@/i18n/context";
import {
  adminCreateSpreadParagraph,
  adminDeleteSpreadParagraph,
  adminListSpread,
  adminMe,
  adminSaveSpreadParagraph,
} from "@/lib/admin-spread.functions";
import { hasNikudSigns, stripNikud, type SpreadParagraph, type SupportKind } from "@/lib/spread";

const KINDS: { value: SupportKind; label: string }[] = [
  { value: "translation", label: "Traduction totale" },
  { value: "cloze", label: "Traduction à trous" },
  { value: "vocabulary", label: "Vocabulaire seul" },
  { value: "nikud", label: "Hébreu vocalisé" },
];

export const Route = createFileRoute("/admin/extraits")({
  head: () => ({
    meta: [
      { title: "Double page de démonstration — Administration" },
      { name: "description", content: "Édition paragraphe par paragraphe de la double page." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SpreadEditor;
});

function SpreadEditor() {
  const { t } = useI18n();
  const me = useServerFn(adminMe);
  const list = useServerFn(adminListSpread);
  const save = useServerFn(adminSaveSpreadParagraph);
  const create = useServerFn(adminCreateSpreadParagraph);
  const remove = useServerFn(adminDeleteSpreadParagraph);

  const [bookSlug, setBookSlug] = useState("eli-cohen");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpreadParagraph | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);

  const meQuery = useQuery({ queryKey: ["admin", "me"], queryFn: () => me(), retry: false });
  const listQuery = useQuery({
    queryKey: ["admin", "spread", bookSlug],
    queryFn: () => list({ data: { bookSlug } }),
    enabled: Boolean(meQuery.data?.isEditor),
    retry: false,
  });

  const paragraphs: SpreadParagraph[] = listQuery.data?.paragraphs ?? [];
  const book = listQuery.data?.book ?? null;
  const current = useMemo(
    () => paragraphs.find((p) => p.id === selected) ?? null,
    [paragraphs, selected],
  );

  useEffect(() => {
    setDraft(current ? { ...current } : null);
  }, [current]);

  const preview: SpreadParagraph[] = draft
    ? paragraphs.map((p) => (p.id === draft.id ? draft : p))
    : paragraphs;

  const saveMutation = useMutation({
    mutationFn: async (p: SpreadParagraph) =>
      save({
        data: {
          id: p.id,
          sort_order: p.sort_order,
          stage_no: p.stage_no,
          he: p.he,
          he_has_nikud: p.he_has_nikud,
          support_kind: p.support_kind,
          support_fr: p.support_fr,
          support_en: p.support_en,
          support_he: p.support_he,
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
      const bookId = book?.id;
      if (!bookId) throw new Error("no book");
      const last = paragraphs[paragraphs.length - 1];
      return create({
        data: {
          book_id: bookId,
          sort_order: (last?.sort_order ?? 0) + 1,
          stage_no: last?.stage_no ?? 1,
          he: "טֶקְסְט",
          he_has_nikud: true,
          support_kind: "translation",
          support_fr: null,
          support_en: null,
          support_he: null,
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

  function patch(p: Partial<SpreadParagraph>) {
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
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          className="label touch border-line border px-3"
        >
          {showGrid ? "Masquer la trame" : "Afficher la trame"}
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row">
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
                    {p.sort_order} · étape {p.stage_no} ·{" "}
                    {KINDS.find((k) => k.value === p.support_kind)?.label}
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
                Hébreu (page de gauche)
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
                    checked={draft.he_has_nikud}
                    onChange={(e) => patch({ he_has_nikud: e.target.checked })}
                  />
                  Vocalisé
                </label>
                <button
                  type="button"
                  onClick={() => patch({ he: stripNikud(draft.he), he_has_nikud: false })}
                  className="label touch border-line border px-3"
                >
                  Retirer les nekoudot
                </button>
                {hasNikudSigns(draft.he) && !draft.he_has_nikud ? (
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
                  Étape (1–4)
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={draft.stage_no}
                    onChange={(e) => patch({ stage_no: Number(e.target.value) })}
                    className="border-line body-text touch w-20 border px-2"
                  />
                </label>
                <label className="label text-secondary-text flex flex-col gap-1">
                  Type de soutien
                  <select
                    value={draft.support_kind}
                    onChange={(e) => patch({ support_kind: e.target.value as SupportKind })}
                    className="border-line body-text touch border px-2"
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {draft.support_kind === "nikud" ? (
                <label className="label text-secondary-text mt-4 flex flex-col gap-1">
                  Soutien : hébreu vocalisé (page de droite)
                  <textarea
                    dir="rtl"
                    lang="he"
                    rows={3}
                    value={draft.support_he ?? ""}
                    onChange={(e) => patch({ support_he: e.target.value || null })}
                    className="border-line hebrew border p-2"
                  />
                </label>
              ) : (
                <>
                  <label className="label text-secondary-text mt-4 flex flex-col gap-1">
                    Soutien FR
                    {draft.support_kind === "cloze" ? (
                      <span className="label text-secondary-text">
                        Mots à deviner entre [[ ]] — la phonétique s'affiche à leur place.
                      </span>
                    ) : null}
                    <textarea
                      rows={3}
                      value={draft.support_fr ?? ""}
                      onChange={(e) => patch({ support_fr: e.target.value || null })}
                      className="border-line body-text border p-2"
                    />
                  </label>
                  <label className="label text-secondary-text mt-3 flex flex-col gap-1">
                    Soutien EN
                    <textarea
                      rows={3}
                      value={draft.support_en ?? ""}
                      onChange={(e) => patch({ support_en: e.target.value || null })}
                      className="border-line body-text border p-2"
                    />
                  </label>
                </>
              )}

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
                {message ? <span className="label text-secondary-text">{message}</span> : null}
              </div>
            </section>
          ) : (
            <p className="body-text text-secondary-text mt-6">
              Choisissez un paragraphe pour l'éditer.
            </p>
          )}
        </div>

        <div className="flex-1">
          <h2 className="label text-secondary-text">Aperçu de la double page</h2>
          <div className="mt-3">
            <Spread
              paragraphs={preview}
              runningHead={book?.spread_running_head_fr ?? book?.title_fr ?? ""}
              chapter={book?.spread_chapter_fr ?? ""}
              folio={book?.spread_folio_left ?? 42}
              showGrid={showGrid}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
