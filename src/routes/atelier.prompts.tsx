import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import {
  activatePromptVersion,
  atelierPromptSteps,
  atelierPrompts,
  createPrompt,
  deletePrompt,
  freezePrompt,
  promptDossier,
  publishPromptVersion,
  setPromptModel,
} from "@/lib/atelier-prompts.functions";
import {
  ETAPES,
  MODELES,
  MODELE_GEMINI,
  ROLES,
  libelleEtape,
  libelleRole,
} from "@/lib/atelier-models";


/**
 * LA BIBLIOTHÈQUE DE PROMPTS.
 *
 * Un prompt ne se modifie jamais : il se re-publie. L'écran n'offre donc aucun
 * champ « modifier » sur une version existante — seulement « nouvelle version »
 * avec sa note de changement, obligatoire dès la version 2.
 *
 * Le contenu s'affiche à chasse fixe, sans coloration ni formatage : c'est du
 * texte, on le lit et on le copie. Aucun prompt n'est rédigé ici par la
 * machine : les contenus sont collés par l'éditeur.
 *
 * L'axe langue reste en sommeil : aucun sélecteur de langue.
 */
export const Route = createFileRoute("/atelier/prompts")({
  head: () => ({
    meta: [{ title: "Prompts — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: PromptsRoom,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";
const field = "border-line w-full rounded-[2px] border px-2 py-1 text-[13px]";
const mono = "font-mono w-full whitespace-pre-wrap break-words text-[13px] leading-[1.5]";
const button = "border-line rounded-[2px] border px-3 py-1 text-[13px]";

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("fr-FR") : "—";
}

function PromptsRoom() {
  const { t } = useI18n();
  const refreshAtelier = useAtelierRefresh();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showFrozen, setShowFrozen] = useState(false);


  const fetchList = useServerFn(atelierPrompts);
  const fetchSteps = useServerFn(atelierPromptSteps);
  const list = useQuery({ queryKey: ["atelier", "prompts"], queryFn: () => fetchList() });
  const steps = useQuery({ queryKey: ["atelier", "promptSteps"], queryFn: () => fetchSteps() });

  const create = useServerFn(createPrompt);
  const changeModel = useServerFn(setPromptModel);
  const [creating, setCreating] = useState(false);
  const [newEtape, setNewEtape] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newModel, setNewModel] = useState<string>(MODELE_GEMINI);
  const [newWebSearch, setNewWebSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le bouton reste toujours cliquable : au clic, il nomme ce qui manque.
  const [missing, setMissing] = useState<{ etape?: boolean; role?: boolean; name?: boolean; content?: boolean }>({});

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          etape: newEtape as "plan",
          roleCode: newRole as "methode",
          name: newName,
          content: newContent,
          collectionId: null,
          model: newModel as typeof MODELE_GEMINI,
          webSearch: newWebSearch,
        },
      }),
    onSuccess: async (res) => {
      setCreating(false);
      setNewEtape("");
      setNewRole("");
      setNewName("");
      setNewContent("");
      setNewModel(MODELE_GEMINI);
      setNewWebSearch(false);
      setError(null);
      setMissing({});
      refreshAtelier();
      setOpenId(res.promptId);
    },
    onError: (e: Error) => setError(e.message || "L’enregistrement du prompt a échoué."),
  });

  /** Le modèle se change depuis la fiche, sans publier une version. */
  const modelMut = useMutation({
    mutationFn: (v: { promptId: string; model: string }) =>
      changeModel({ data: { promptId: v.promptId, model: v.model as typeof MODELE_GEMINI } }),
    onSuccess: () => refreshAtelier(),
    onError: (e: Error) => setError(e.message),
  });

  // Les prompts figés ne s'affichent que si on les demande.
  const visibles = (list.data ?? []).filter((p) => showFrozen || !p.frozenAt);


  return (
    <section className="max-w-[1000px]">
      <h1 className="font-latin text-[24px]">{t("atelier.room.prompts")}</h1>
      <p className="mt-2 text-[14px]">{t("atelier.room.prompts.desc")}</p>

      <div className="border-line mt-6 border-t pt-4">
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={showFrozen} onChange={(e) => setShowFrozen(e.target.checked)} />
          {t("atelier.prompts.showFrozen")}
        </label>
        {list.isLoading ? (
          <p className="text-[14px]">{t("atelier.loading")}</p>
        ) : visibles.length === 0 ? (
          <p className="text-[14px]">{t("atelier.prompts.emptyList")}</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cell}>{t("atelier.prompts.col.name")}</th>
                <th className={cell}>{t("atelier.prompts.col.model")}</th>
                <th className={cell}>{t("atelier.prompts.col.webSearch")}</th>
                <th className={cell}>{t("atelier.prompts.col.active")}</th>
                <th className={cell}>{t("atelier.prompts.col.lastModified")}</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td className={cell}>
                    {p.name}
                    {p.frozenAt ? <span className="ml-2 opacity-70">({t("atelier.prompts.frozenTag")})</span> : null}
                  </td>
                  <td className={cell}>{p.activeModel ?? t("atelier.none")}</td>
                  <td className={cell}>
                    {p.activeWebSearch
                      ? t("atelier.prompts.webSearchOn")
                      : t("atelier.prompts.webSearchOff")}
                  </td>
                  <td className={cell}>{p.activeVersion ?? t("atelier.none")}</td>
                  <td className={cell}>{fmt(p.lastVersionAt)}</td>
                  <td className={cell}>
                    <button
                      type="button"
                      className="border-b border-current"
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    >
                      {openId === p.id ? t("atelier.prompts.close") : t("atelier.prompts.open")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}


        <div className="mt-6">
          {creating ? (
            <div className="border-line border-t pt-4">
              <h2 className="font-latin text-[16px]">{t("atelier.prompts.new")}</h2>
              {/* Un prompt se nomme désormais par son étape et son rôle, pas par un code technique. */}
              <label className="mt-3 block text-[13px]">
                Étape
                <select value={newEtape} onChange={(e) => setNewEtape(e.target.value)} className={`${field} mt-1`}>
                  <option value="">{t("atelier.prompts.chooseStep")}</option>
                  {ETAPES.map((e) => (
                    <option key={e.code} value={e.code}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              {missing.etape ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.step")}</p> : null}
              <label className="mt-3 block text-[13px]">
                Rôle
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={`${field} mt-1`}>
                  <option value="">Choisir un rôle</option>
                  {ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {missing.role ? <p className="mt-1 text-[13px]">Le rôle du prompt manque.</p> : null}
              <label className="mt-3 block text-[13px]">
                {t("atelier.prompts.field.name")}
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className={`${field} mt-1`} />
              </label>
              {missing.name ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.name")}</p> : null}
              <label className="mt-3 block text-[13px]">
                {t("atelier.prompts.field.content")}
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={14}
                  className={`${field} ${mono} mt-1`}
                />
              </label>
              {missing.content ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.content")}</p> : null}
              <label className="mt-3 block text-[13px]">
                {t("atelier.prompts.field.model")}
                <input value={newModel} onChange={(e) => setNewModel(e.target.value)} className={`${field} mt-1`} />
              </label>
              <p className="mt-1 text-[12px]">{t("atelier.prompts.modelHint")}</p>
              <label className="mt-3 flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={newWebSearch}
                  onChange={(e) => setNewWebSearch(e.target.checked)}
                />
                {t("atelier.prompts.field.webSearch")}
              </label>
              {error ? <p className="mt-2 text-[13px]">{error}</p> : null}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    const m = {
                      etape: !newEtape,
                      role: !newRole,
                      name: !newName.trim(),
                      content: !newContent.trim(),
                    };
                    setMissing(m);
                    setError(null);
                    if (m.etape || m.role || m.name || m.content) return;
                     if (createMut.isPending) return;
                    createMut.mutate();
                  }}
                >
                  {t("atelier.prompts.save")}
                </button>
                <button type="button" className={button} onClick={() => setCreating(false)}>
                  {t("atelier.prompts.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={button} onClick={() => setCreating(true)}>
              {t("atelier.prompts.new")}
            </button>
          )}
        </div>

        {openId ? <PromptDossier promptId={openId} onDeleted={() => setOpenId(null)} /> : null}
      </div>
    </section>
  );
}

function PromptDossier({ promptId, onDeleted }: { promptId: string; onDeleted: () => void }) {
  const { t } = useI18n();
  const refreshAtelier = useAtelierRefresh();
  const fetchDossier = useServerFn(promptDossier);
  const dossier = useQuery({
    queryKey: ["atelier", "prompt", promptId],
    queryFn: () => fetchDossier({ data: { promptId } }),
  });

  const publish = useServerFn(publishPromptVersion);
  const activate = useServerFn(activatePromptVersion);
  const freeze = useServerFn(freezePrompt);
  const remove = useServerFn(deletePrompt);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [model, setModel] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ content?: boolean; note?: boolean }>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    refreshAtelier();
  };

  const publishMut = useMutation({
    mutationFn: () =>
      publish({
        data: {
          promptId,
          content,
          changeNote: note,
          model: model.trim() === "" ? null : model.trim(),
          webSearch,
        },
      }),
    onSuccess: async () => {
      setEditing(false);
      setNote("");
      setError(null);
      setMissing({});
      await refresh();
    },
    onError: (e: Error) => setError(e.message || "La publication de la version a échoué."),
  });

  const activateMut = useMutation({
    mutationFn: (versionId: string) => activate({ data: { promptId, versionId } }),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const freezeMut = useMutation({
    mutationFn: (frozen: boolean) => freeze({ data: { promptId, frozen } }),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => remove({ data: { promptId } }),
    onSuccess: async () => {
      onDeleted();
      await refresh();
    },
    onError: (e: Error) => setError(e.message),
  });


  if (dossier.isLoading) return <p className="mt-8 text-[14px]">{t("atelier.loading")}</p>;
  const data = dossier.data;
  if (!data?.prompt) return <p className="mt-8 text-[14px]">{t("atelier.prompts.notFound")}</p>;

  const active = data.versions.find((v) => v.isActive) ?? null;
  const others = data.versions.filter((v) => !v.isActive);

  return (
    <div className="border-line mt-10 border-t pt-6">
      <h2 className="font-latin text-[18px]">{data.prompt.name}</h2>
      <p className="mt-1 text-[13px] opacity-80">{data.prompt.stepLabelFr}</p>
      {data.prompt.frozenAt ? (
        <p className="mt-2 text-[13px]">
          {t("atelier.prompts.frozenSince").replace("{date}", fmt(data.prompt.frozenAt))}
        </p>
      ) : null}

      {/* Ranger la bibliothèque : figer (réversible, rien n'est effacé) ou
          supprimer (seulement si le prompt n'est relié à rien). */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={button}
          onClick={() => {
            setError(null);
            if (freezeMut.isPending) return;
            if (data.prompt!.frozenAt) {
              freezeMut.mutate(false);
              return;
            }
            const ok = window.confirm(t("atelier.prompts.confirmFreeze").replace("{name}", data.prompt!.name));
            if (ok) freezeMut.mutate(true);
          }}
        >
          {data.prompt.frozenAt ? t("atelier.prompts.unfreeze") : t("atelier.prompts.freeze")}
        </button>
        {data.prompt.usageCount === 0 ? (
          <button
            type="button"
            className={button}
            onClick={() => {
              setError(null);
              if (deleteMut.isPending) return;
              const saisi = window.prompt(
                t("atelier.prompts.confirmDelete")
                  .replace("{name}", data.prompt!.name)
                  .replace("{versions}", String(data.versions.length)),
              );
              if (saisi === null) return;
              if (saisi.trim() !== data.prompt!.name.trim()) {
                setError(t("atelier.prompts.deleteMismatch"));
                return;
              }
              deleteMut.mutate();
            }}
          >
            {t("atelier.prompts.delete")}
          </button>
        ) : (
          <span className="text-[13px] opacity-80">
            {t("atelier.prompts.deleteBlocked").replace("{count}", String(data.prompt.usageCount))}
          </span>
        )}
      </div>
      {error ? <p className="mt-2 text-[13px]">{error}</p> : null}


      <h3 className="mt-6 text-[14px] font-medium">
        {t("atelier.prompts.activeVersion")}{" "}
        {active ? `${t("atelier.prompts.version")} ${active.version} — ${fmt(active.createdAt)}` : t("atelier.none")}
      </h3>
      {active ? (
        <p className="mt-1 text-[13px]">
          {t("atelier.prompts.model")} : {active.model ?? t("atelier.none")} —{" "}
          {active.webSearch ? t("atelier.prompts.webSearchOn") : t("atelier.prompts.webSearchOff")}
        </p>
      ) : null}
      {active ? <pre className={`${mono} mt-2`}>{active.content}</pre> : null}
      {active?.changeNote ? (
        <p className="mt-2 text-[13px]">
          {t("atelier.prompts.changeNote")} : {active.changeNote}
        </p>
      ) : null}

      <div className="mt-6">
        {editing ? (
          <div>
            <label className="block text-[13px]">
              {t("atelier.prompts.field.content")}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className={`${field} ${mono} mt-1`}
              />
            </label>
            {missing.content ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.content")}</p> : null}
            <label className="mt-3 block text-[13px]">
              {t("atelier.prompts.field.changeNote")}
              <input value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1`} />
            </label>
            {missing.note ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.note")}</p> : null}
            <label className="mt-3 block text-[13px]">
              {t("atelier.prompts.field.model")}
              <input value={model} onChange={(e) => setModel(e.target.value)} className={`${field} mt-1`} />
            </label>
            <p className="mt-1 text-[12px]">{t("atelier.prompts.modelHint")}</p>
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
              {t("atelier.prompts.field.webSearch")}
            </label>
            <p className="mt-1 text-[12px]">{t("atelier.prompts.noteRequired")}</p>
            {error ? <p className="mt-2 text-[13px]">{error}</p> : null}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className={button}
                onClick={() => {
                  const m = { content: !content.trim(), note: !note.trim() };
                  setMissing(m);
                  setError(null);
                  if (m.content || m.note) return;
                   if (publishMut.isPending) return;
                  publishMut.mutate();
                }}
              >
                {t("atelier.prompts.publish")}
              </button>
              <button type="button" className={button} onClick={() => setEditing(false)}>
                {t("atelier.prompts.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={button}
            onClick={() => {
              setContent(active?.content ?? "");
              setModel(active?.model ?? "");
              setWebSearch(active?.webSearch ?? false);
              setNote("");
              setEditing(true);
            }}
          >
            {t("atelier.prompts.newVersion")}
          </button>
        )}
      </div>

      <h3 className="mt-8 text-[14px] font-medium">{t("atelier.prompts.previous")}</h3>
      {others.length === 0 ? (
        <p className="mt-2 text-[13px]">{t("atelier.prompts.noPrevious")}</p>
      ) : (
        <ul className="mt-2 text-[13px]">
          {others.map((v) => (
            <li key={v.id} className="border-line border-b py-2">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="border-b border-current"
                  onClick={() => setOpenHistory((s) => ({ ...s, [v.id]: !s[v.id] }))}
                >
                  {t("atelier.prompts.version")} {v.version} — {fmt(v.createdAt)}
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    const ok = window.confirm(
                      t("atelier.prompts.confirmActivate")
                        .replace("{version}", String(v.version))
                        .replace("{name}", data.prompt!.name),
                    );
                    if (ok) activateMut.mutate(v.id);
                  }}
                >
                  {t("atelier.prompts.activate")}
                </button>
              </div>
              {v.changeNote ? (
                <p className="mt-1">
                  {t("atelier.prompts.changeNote")} : {v.changeNote}
                </p>
              ) : null}
              {openHistory[v.id] ? <pre className={`${mono} mt-2`}>{v.content}</pre> : null}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-[14px] font-medium">{t("atelier.prompts.produced")}</h3>
      {data.produced.length === 0 ? (
        <p className="mt-2 text-[13px]">{t("atelier.prompts.producedEmpty")}</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.prompts.version")}</th>
              <th className={cell}>{t("atelier.queue.col.book")}</th>
              <th className={cell}>{t("atelier.prompts.col.artifact")}</th>
              <th className={cell}>{t("atelier.prompts.col.date")}</th>
            </tr>
          </thead>
          <tbody>
            {data.produced.map((p, i) => (
              <tr key={`${p.versionId}-${i}`}>
                <td className={cell}>{data.versions.find((v) => v.id === p.versionId)?.version ?? "—"}</td>
                <td className={cell}>{p.bookTitle}</td>
                <td className={cell}>
                  {p.type} v{p.version}
                </td>
                <td className={cell}>{fmt(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Le registre des activations reste alimenté en base (trace pour le journal),
          mais il n'encombre plus cet écran. */}
    </div>
  );
}
