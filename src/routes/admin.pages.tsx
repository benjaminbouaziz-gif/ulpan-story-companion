import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { adminMe } from "@/lib/admin-spread.functions";
import {
  adminDeleteSection,
  adminListSections,
  adminRestoreSectionVersion,
  adminSaveSection,
  adminSectionVersions,
  adminTranslatePage,
} from "@/lib/admin-pages.functions";

const BADGES: Record<string, string> = {
  auto: "auto",
  human: "corrigé à la main",
  stale: "à retraduire",
  stale_human: "à retraduire (version humaine)",
  empty: "vide",
  to_write: "à rédiger",
  fr_only: "français seulement",
  none: "",
};

function Badge({ state }: { state: string | undefined }) {
  const label = state ? BADGES[state] : undefined;
  if (!label) return null;
  return <span className="label text-secondary-text ml-2">· {label}</span>;
}


export const Route = createFileRoute("/admin/pages")({
  head: () => ({
    meta: [
      { title: "Pages éditoriales — Administration" },
      { name: "description", content: "Édition des sections des pages du site." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PagesEditor,
});

type Draft = {
  id: string;
  kind: string;
  is_locked: boolean;
  sort_order: number;
  is_visible: boolean;
  locales: string[];
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  data_json: string;
};


function PagesEditor() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useServerFn(adminMe);
  const list = useServerFn(adminListSections);
  const save = useServerFn(adminSaveSection);
  const remove = useServerFn(adminDeleteSection);
  const versions = useServerFn(adminSectionVersions);
  const restore = useServerFn(adminRestoreSectionVersion);
  const translatePage = useServerFn(adminTranslatePage);

  const [slug, setSlug] = useState("methode");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [openVersions, setOpenVersions] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ["admin", "me"], queryFn: () => me(), retry: false });
  const listQuery = useQuery({
    queryKey: ["admin", "page-sections", slug],
    queryFn: () => list({ data: { slug } }),
    enabled: Boolean(meQuery.data?.isEditor),
    retry: false,
  });

  const sections = listQuery.data?.sections ?? [];
  const manual = Boolean(listQuery.data?.manual);
  const statuses = (listQuery.data?.statuses ?? {}) as Record<string, Record<string, string>>;
  // « français seulement » est un choix, pas un manque : on ne le compte pas.
  const missing = Object.values(statuses).reduce(
    (n, fields) =>
      n +
      Object.values(fields).filter(
        (v) => v === "stale" || v === "stale_human" || v === "empty" || v === "to_write",
      ).length,
    0,
  );

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const s of sections) {
      next[s.id] = {
        id: s.id,
        kind: s.kind,
        is_locked: s.is_locked,
        sort_order: s.sort_order,
        is_visible: s.is_visible,
        locales: Array.isArray(s.locales) && s.locales.length > 0 ? s.locales : ["fr", "en"],

        title_fr: s.title_fr ?? "",
        title_en: s.title_en ?? "",
        body_fr: s.body_fr ?? "",
        body_en: s.body_en ?? "",
        data_json: JSON.stringify(s.data ?? {}, null, 2),
      };
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data]);

  const versionsQuery = useQuery({
    queryKey: ["admin", "section-versions", openVersions],
    queryFn: () => versions({ data: { id: openVersions! } }),
    enabled: Boolean(openVersions),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) =>
      save({
        data: {
          id: d.id,
          sort_order: d.sort_order,
          is_visible: d.is_visible,
          locales: (d.locales.filter((l) => l === "fr" || l === "en") as ("fr" | "en")[]).length
            ? (d.locales.filter((l) => l === "fr" || l === "en") as ("fr" | "en")[])
            : (["fr"] as ("fr" | "en")[]),

          title_fr: d.title_fr.trim() ? d.title_fr : null,
          title_en: d.title_en.trim() ? d.title_en : null,
          body_fr: d.body_fr.trim() ? d.body_fr : null,
          body_en: d.body_en.trim() ? d.body_en : null,
          data_json: d.data_json,
        },
      }),
    onSuccess: (r) => {
      setMessage(r.ok ? "Enregistré." : (r.error ?? "Échec."));
      void qc.invalidateQueries({ queryKey: ["admin", "page-sections", slug] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: (r) => {
      setMessage(r.ok ? "Section supprimée." : (r.error ?? "Échec."));
      void qc.invalidateQueries({ queryKey: ["admin", "page-sections", slug] });
    },
  });

  const translateMutation = useMutation({
    mutationFn: async (force: boolean) => translatePage({ data: { slug, force } }),
    onSuccess: (r) => {
      setMessage(r.ok ? `Anglais produit (${r.translated} champs).` : (r.error ?? "Échec."));
      void qc.invalidateQueries({ queryKey: ["admin", "page-sections", slug] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (version_id: string) => restore({ data: { version_id } }),
    onSuccess: (r) => {
      setMessage(r.ok ? "Version restaurée." : (r.error ?? "Échec."));
      void qc.invalidateQueries({ queryKey: ["admin", "page-sections", slug] });
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
        <p className="body-text">{t("admin.forbidden")}</p>
      </PageShell>
    );
  }


  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => (d[id] ? { ...d, [id]: { ...d[id]!, ...patch } } : d));

  return (
    <PageShell>
      <h1 className="text-[30px]">Pages éditoriales</h1>

      <label className="label mt-6 block">
        Page
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.trim())}
          className="border-line bg-background mt-1 block w-full border px-2 py-2"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p className="label text-secondary-text">
          {missing > 0
            ? manual
              ? `${missing} champ(s) anglais à rédiger.`
              : `${missing} champ(s) anglais à produire ou à retraduire.`
            : manual
              ? "Anglais rédigé."
              : "Anglais à jour."}
        </p>
        {manual ? (
          <p className="label text-secondary-text">
            Cette page s'écrit séparément dans chaque langue.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => translateMutation.mutate(false)}
            className="label touch border-line border px-4"
          >
            Traduire toute la page
          </button>
        )}
      </div>


      {message ? <p className="label mt-4">{message}</p> : null}

      <div className="mt-8">
        {sections.map((s) => {
          const d = drafts[s.id];
          if (!d) return null;
          return (
            <section key={s.id} className="border-line mt-8 border-t pt-5 first:mt-0">
              <p className="label text-secondary-text">
                {d.sort_order}. {d.kind}
                {d.is_locked ? " · gabarit" : ""}
              </p>

              <label className="label mt-4 block">
                Titre (fr)
                <textarea
                  value={d.title_fr}
                  onChange={(e) => set(s.id, { title_fr: e.target.value })}
                  rows={2}
                  className="border-line bg-background body-text mt-1 block w-full border px-2 py-2"
                />
              </label>
              <label className="label mt-3 block">
                Titre (en)
                <Badge state={statuses[s.id]?.["title"]} />
                <textarea
                  value={d.title_en}
                  onChange={(e) => set(s.id, { title_en: e.target.value })}
                  rows={2}
                  className="border-line bg-background body-text mt-1 block w-full border px-2 py-2"
                />
              </label>
              <label className="label mt-3 block">
                Corps (fr)
                <textarea
                  value={d.body_fr}
                  onChange={(e) => set(s.id, { body_fr: e.target.value })}
                  rows={6}
                  className="border-line bg-background body-text mt-1 block w-full border px-2 py-2"
                />
              </label>
              <label className="label mt-3 block">
                Corps (en)
                <Badge state={statuses[s.id]?.["body"]} />
                <textarea
                  value={d.body_en}
                  onChange={(e) => set(s.id, { body_en: e.target.value })}
                  rows={6}
                  className="border-line bg-background body-text mt-1 block w-full border px-2 py-2"
                />
              </label>
              <label className="label mt-3 block">
                Données (JSON)
                <textarea
                  value={d.data_json}
                  onChange={(e) => set(s.id, { data_json: e.target.value })}
                  rows={8}
                  className="border-line bg-background mt-1 block w-full border px-2 py-2 font-mono text-[13px]"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.is_visible}
                    onChange={(e) => set(s.id, { is_visible: e.target.checked })}
                  />
                  Visible
                </label>
                <label className="label flex items-center gap-2">
                  Ordre
                  <input
                    type="number"
                    value={d.sort_order}
                    onChange={(e) => set(s.id, { sort_order: Number(e.target.value) })}
                    className="border-line bg-background w-16 border px-2 py-1"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate(d)}
                  className="label touch bg-foreground text-background px-4"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setOpenVersions(openVersions === s.id ? null : s.id)}
                  className="label touch border-line border px-4"
                >
                  Versions
                </button>
                <button
                  type="button"
                  disabled={d.is_locked}
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="label touch border-line border px-4 disabled:opacity-40"
                  title={
                    d.is_locked ? "Cette section fait partie du gabarit de la page." : undefined
                  }
                >
                  Supprimer
                </button>
              </div>

              {openVersions === s.id ? (
                <div className="border-line mt-4 border-t pt-3">
                  {(versionsQuery.data?.versions ?? []).length === 0 ? (
                    <p className="label text-secondary-text">Aucune version archivée.</p>
                  ) : (
                    (versionsQuery.data?.versions ?? []).map((v) => (
                      <div key={v.id} className="flex items-center gap-3 py-1">
                        <span className="label text-secondary-text">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreMutation.mutate(v.id)}
                          className="label touch border-b border-current"
                        >
                          Restaurer
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
