import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { adminMe } from "@/lib/admin-spread.functions";
import {
  adminBookFigures,
  adminSaveBookFigures,
  adminTranslateBook,
} from "@/lib/admin-books.functions";

export const Route = createFileRoute("/admin/chiffres")({
  head: () => ({
    meta: [
      { title: "Chiffres des livres — Administration" },
      { name: "description", content: "Saisie des chiffres annoncés pour chaque tome." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FiguresEditor,
});

type Field = "spread_pages" | "kdp_page_count" | "chapters_count" | "words_unique";
const FIELDS: { key: Field; label: string }[] = [
  { key: "spread_pages", label: "Doubles pages annoncées" },
  { key: "kdp_page_count", label: "Pages KDP (impression)" },
  { key: "chapters_count", label: "Chapitres" },
  { key: "words_unique", label: "Mots de vocabulaire" },
];

type Draft = Record<Field, string>;

function toDraft(b: Record<string, unknown>): Draft {
  const get = (k: Field) => {
    const v = b[k];
    return v === null || v === undefined ? "" : String(v);
  };
  return {
    spread_pages: get("spread_pages"),
    kdp_page_count: get("kdp_page_count"),
    chapters_count: get("chapters_count"),
    words_unique: get("words_unique"),
  };
}

function num(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function FiguresEditor() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useServerFn(adminMe);
  const load = useServerFn(adminBookFigures);
  const save = useServerFn(adminSaveBookFigures);
  const translate = useServerFn(adminTranslateBook);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ["admin", "me"], queryFn: () => me(), retry: false });
  const figuresQuery = useQuery({
    queryKey: ["admin", "figures"],
    queryFn: () => load(),
    enabled: Boolean(meQuery.data?.isEditor),
    retry: false,
  });

  const books = figuresQuery.data?.books ?? [];
  const counted = figuresQuery.data?.counted ?? {};

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const b of books) next[b.id] = toDraft(b as unknown as Record<string, unknown>);
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figuresQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (v: { id: string; draft: Draft; confirm: boolean }) =>
      save({
        data: {
          id: v.id,
          spread_pages: num(v.draft.spread_pages),
          kdp_page_count: num(v.draft.kdp_page_count),
          chapters_count: num(v.draft.chapters_count),
          words_unique: num(v.draft.words_unique),
          confirm: v.confirm,
        },
      }),
    onSuccess: (r) => {
      setMessage(r.ok ? "Chiffres enregistrés." : (r.error ?? "Échec."));
      void qc.invalidateQueries({ queryKey: ["admin", "figures"] });
    },
  });

  const translateMutation = useMutation({
    mutationFn: async (id: string) => translate({ data: { id, force: false } }),
    onSuccess: (r) =>
      setMessage(r.ok ? `Anglais produit (${r.translated} champs).` : (r.error ?? "Échec.")),
  });

  if (meQuery.isLoading)
    return (
      <PageShell>
        <p className="body-text">…</p>
      </PageShell>
    );
  if (!meQuery.data?.isEditor)
    return (
      <PageShell>
        <p className="body-text">{t("admin.forbidden")}</p>
      </PageShell>
    );

  return (
    <PageShell>
      <h1 className="text-[30px]">Chiffres des livres</h1>
      <p className="label text-secondary-text mt-4">
        Ces valeurs sont celles annoncées. Le comptage en base est une indication ; il ne bloque
        ni l'enregistrement ni la publication.
      </p>
      {message ? <p className="label mt-4">{message}</p> : null}

      {books.map((b) => {
        const d = drafts[b.id];
        if (!d) return null;
        const c = counted[b.id];
        return (
          <section key={b.id} className="border-line mt-8 border-t pt-5">
            <p className="label text-secondary-text">
              {b.tome_no ? `Tome ${b.tome_no} · ` : ""}
              {b.title_fr}
            </p>
            <p className="label text-secondary-text mt-1">
              Dernière confirmation :{" "}
              {b.figures_verified_at
                ? new Date(b.figures_verified_at).toLocaleString()
                : "jamais"}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {FIELDS.map((f) => {
                const computed =
                  f.key === "kdp_page_count"
                    ? null
                    : ((c?.[f.key as keyof typeof c] as number | null) ?? null);
                const saisi = num(d[f.key]);
                const diverges =
                  computed !== null && saisi !== null && computed !== saisi ? computed : null;
                return (
                  <div key={f.key}>
                    <label className="label block">
                      {f.label}
                      <input
                        inputMode="numeric"
                        value={d[f.key]}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [b.id]: { ...prev[b.id]!, [f.key]: e.target.value },
                          }))
                        }
                        className="border-line bg-background mt-1 block w-full border px-2 py-2 tabular-nums"
                      />
                    </label>
                    {computed !== null ? (
                      <p className="label text-secondary-text mt-1 flex items-center gap-3">
                        <span>calculé : {computed}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => ({
                              ...prev,
                              [b.id]: { ...prev[b.id]!, [f.key]: String(computed) },
                            }))
                          }
                          className="border-b border-current"
                        >
                          reprendre cette valeur
                        </button>
                      </p>
                    ) : null}
                    {diverges !== null ? (
                      <p className="label mt-1">Écart avec le comptage ({diverges}).</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => saveMutation.mutate({ id: b.id, draft: d, confirm: false })}
                className="label touch bg-foreground text-background px-4"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate({ id: b.id, draft: d, confirm: true })}
                className="label touch border-line border px-4"
              >
                Enregistrer et confirmer
              </button>
              <button
                type="button"
                onClick={() => translateMutation.mutate(b.id)}
                className="label touch border-line border px-4"
              >
                Traduire tout le livre
              </button>
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
