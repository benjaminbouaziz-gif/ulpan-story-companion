import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import {
  activatePromptVersion,
  atelierPromptSteps,
  atelierPrompts,
  createPrompt,
  promptDossier,
  publishPromptVersion,
} from "@/lib/atelier-prompts.functions";

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
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchList = useServerFn(atelierPrompts);
  const fetchSteps = useServerFn(atelierPromptSteps);
  const list = useQuery({ queryKey: ["atelier", "prompts"], queryFn: () => fetchList() });
  const steps = useQuery({ queryKey: ["atelier", "promptSteps"], queryFn: () => fetchSteps() });

  const create = useServerFn(createPrompt);
  const [creating, setCreating] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newWebSearch, setNewWebSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le bouton reste toujours cliquable : au clic, il nomme ce qui manque.
  const [missing, setMissing] = useState<{ step?: boolean; name?: boolean; content?: boolean }>({});

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          stepCode: newStep,
          name: newName,
          content: newContent,
          collectionId: null,
          model: newModel.trim() === "" ? null : newModel.trim(),
          webSearch: newWebSearch,
        },
      }),
    onSuccess: async (res) => {
      setCreating(false);
      setNewStep("");
      setNewName("");
      setNewContent("");
      setNewModel("");
      setNewWebSearch(false);
      setError(null);
      setMissing({});
      await qc.invalidateQueries({ queryKey: ["atelier", "prompts"] });
      setOpenId(res.promptId);
    },
    onError: (e: Error) => setError(e.message || "L’enregistrement du prompt a échoué."),
  });

  return (
    <section className="max-w-[1000px]">
      <h1 className="font-latin text-[24px]">{t("atelier.room.prompts")}</h1>
      <p className="mt-2 text-[14px]">{t("atelier.room.prompts.desc")}</p>

      <div className="border-line mt-6 border-t pt-4">
        {list.isLoading ? (
          <p className="text-[14px]">{t("atelier.loading")}</p>
        ) : (list.data ?? []).length === 0 ? (
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
              {(list.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className={cell}>{p.name}</td>
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
              <label className="mt-3 block text-[13px]">
                {t("atelier.prompts.field.step")}
                <select value={newStep} onChange={(e) => setNewStep(e.target.value)} className={`${field} mt-1`}>
                  <option value="">{t("atelier.prompts.chooseStep")}</option>
                  {(steps.data ?? []).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.rank}. {s.labelFr}
                    </option>
                  ))}
                </select>
              </label>
              {missing.step ? <p className="mt-1 text-[13px]">{t("atelier.prompts.missing.step")}</p> : null}
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
                      step: !newStep,
                      name: !newName.trim(),
                      content: !newContent.trim(),
                    };
                    setMissing(m);
                    setError(null);
                    if (m.step || m.name || m.content) return;
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

        {openId ? <PromptDossier promptId={openId} /> : null}
      </div>
    </section>
  );
}

function PromptDossier({ promptId }: { promptId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchDossier = useServerFn(promptDossier);
  const dossier = useQuery({
    queryKey: ["atelier", "prompt", promptId],
    queryFn: () => fetchDossier({ data: { promptId } }),
  });

  const publish = useServerFn(publishPromptVersion);
  const activate = useServerFn(activatePromptVersion);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [model, setModel] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ content?: boolean; note?: boolean }>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["atelier", "prompt", promptId] });
    await qc.invalidateQueries({ queryKey: ["atelier", "prompts"] });
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

  if (dossier.isLoading) return <p className="mt-8 text-[14px]">{t("atelier.loading")}</p>;
  const data = dossier.data;
  if (!data?.prompt) return <p className="mt-8 text-[14px]">{t("atelier.prompts.notFound")}</p>;

  const active = data.versions.find((v) => v.isActive) ?? null;
  const others = data.versions.filter((v) => !v.isActive);

  return (
    <div className="border-line mt-10 border-t pt-6">
      <h2 className="font-latin text-[18px]">{data.prompt.name}</h2>
      <p className="mt-1 text-[13px] opacity-80">{data.prompt.stepLabelFr}</p>

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
