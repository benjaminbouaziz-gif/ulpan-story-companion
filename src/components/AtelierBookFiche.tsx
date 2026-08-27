import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import type { DictKey } from "@/i18n/dictionaries";
import { reviewStep } from "@/lib/atelier-artifacts.functions";
import {
  atelierBookFiche,
  atelierCollections,
  createAtelierBook,
  updateAtelierBookFiche,
} from "@/lib/atelier-fiche.functions";

/**
 * La fiche du livre : ce que le robot du plan lira. Le seul champ dont il ne
 * peut pas se passer est le résumé de l'éditeur : la recherche documentaire
 * est le métier du robot, aucun champ ne la remplace à l'écran.
 *
 * La colonne source_material_fr reste en base, intacte, hors de l'écran : elle
 * resservira le jour où une matière que la recherche ne donne pas existera.
 *
 * Aucun sélecteur de langue (axe en sommeil), aucune icône, aucune carte :
 * filets fins, zones de texte courtes qui grandissent d'elles-mêmes, statuts
 * en toutes lettres.
 */

const cell = "border-line border-b px-2 py-1 text-left align-top";
const area = "border-line mt-1 w-full resize-none border px-2 py-1 text-[13px]";
const field = "border-line mt-1 w-full border px-2 py-1 text-[13px]";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

/** ---------------------------------------------------------------- création */

export function NewBookForm({ onCreated }: { onCreated: (bookId: string) => void }) {
  const { t } = useI18n();
  const refreshAtelier = useAtelierRefresh();
  const fetchCollections = useServerFn(atelierCollections);
  const create = useServerFn(createAtelierBook);

  const collections = useQuery({
    queryKey: ["atelier", "collections"],
    queryFn: () => fetchCollections(),
  });

  const [titleFr, setTitleFr] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tomeNo, setTomeNo] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [workSummaryFr, setWorkSummaryFr] = useState("");
  const [bookConstraintsFr, setBookConstraintsFr] = useState("");
  const [intentNoteFr, setIntentNoteFr] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Le bouton n'est jamais muet : ce qui manque se dit sous le champ.
  const [touched, setTouched] = useState(false);

  const missTitle = titleFr.trim().length === 0;
  const missCollection = collectionId === "";
  const missQr = qrCode.trim().length < 3;
  const ready = !missTitle && !missCollection && !missQr;

  const save = useMutation({
    mutationFn: () =>
      create({
        data: {
          titleFr: titleFr.trim(),
          collectionId,
          tomeNo: tomeNo.trim() === "" ? null : Number(tomeNo),
          qrCode: qrCode.trim(),
          workSummaryFr: workSummaryFr.trim(),
          bookConstraintsFr: bookConstraintsFr.trim(),
          intentNoteFr: intentNoteFr.trim(),
        },
      }),
    onSuccess: (res) => {
      setError(null);
      refreshAtelier();
      onCreated(res.id);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="border-line mt-4 border p-4 text-[13px]">
      <h2 className="font-latin text-[16px]">{t("atelier.books.newBook")}</h2>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          {t("atelier.fiche.field.title")}
          <input className={field} value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
          {touched && missTitle ? <span className="mt-1 block">{t("atelier.fiche.needTitle")}</span> : null}
        </label>

        <label className="block">
          {t("atelier.fiche.field.collection")}
          <select
            className={field}
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">{t("atelier.fiche.chooseCollection")}</option>
            {(collections.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
          {touched && missCollection ? (
            <span className="mt-1 block">{t("atelier.fiche.needCollection")}</span>
          ) : null}
        </label>

        <label className="block">
          {t("atelier.fiche.field.tome")}
          <input
            className={field}
            inputMode="numeric"
            value={tomeNo}
            onChange={(e) => setTomeNo(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>

        <label className="block">
          {t("atelier.fiche.field.qr")}
          <input
            className={field}
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          />
          <span className="mt-1 block opacity-70">
            {t("atelier.fiche.qrUrl")} /b/{qrCode || "…"} — {t("atelier.fiche.qrRule")}
          </span>
          {touched && missQr ? <span className="mt-1 block">{t("atelier.fiche.needQr")}</span> : null}
        </label>
      </div>

      <FicheTextArea
        label={t("atelier.fiche.field.summary")}
        value={workSummaryFr}
        onChange={setWorkSummaryFr}
      />
      <FicheTextArea
        label={t("atelier.fiche.field.constraints")}
        value={bookConstraintsFr}
        onChange={setBookConstraintsFr}
      />
      <FicheTextArea
        label={t("atelier.fiche.field.intent")}
        value={intentNoteFr}
        onChange={setIntentNoteFr}
      />

      <p className="mt-3 opacity-70">{t("atelier.fiche.creationRule")}</p>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          disabled={save.isPending}
          onClick={() => {
            setTouched(true);
            setError(null);
            if (!ready) return;
            save.mutate();
          }}
        >
          {save.isPending ? t("atelier.fiche.saving") : t("atelier.fiche.create")}
        </button>
      </div>

      {error ? <p className="mt-3">{error}</p> : null}
    </div>
  );
}

/** Trois lignes au départ, grandit avec le texte, plafonne à quinze lignes. */
function FicheTextArea({
  label,
  value,
  onChange,
  hint,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  hint?: string;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const line = 20;
    el.style.height = "auto";
    const wanted = Math.max(3 * line, Math.min(el.scrollHeight, 15 * line));
    el.style.height = `${wanted}px`;
    el.style.overflowY = el.scrollHeight > 15 * line ? "auto" : "hidden";
  }, [value]);

  return (
    <label className="mt-3 block">
      {label}
      <textarea
        ref={ref}
        className={area}
        rows={3}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {hint ? <span className="mt-1 block opacity-70">{hint}</span> : null}
    </label>
  );
}


/** ------------------------------------------------------------ lecture/édition */

export function BookFiche({ bookId }: { bookId: string }) {
  const { t } = useI18n();
  const refreshAtelier = useAtelierRefresh();
  const fetchFiche = useServerFn(atelierBookFiche);
  const update = useServerFn(updateAtelierBookFiche);
  const review = useServerFn(reviewStep);

  const fiche = useQuery({
    queryKey: ["atelier", "fiche", bookId],
    queryFn: () => fetchFiche({ data: { bookId } }),
  });

  const [editing, setEditing] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [workSummaryFr, setWorkSummaryFr] = useState("");
  const [bookConstraintsFr, setBookConstraintsFr] = useState("");
  const [intentNoteFr, setIntentNoteFr] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const data = fiche.data ?? null;

  useEffect(() => {
    if (!data) return;
    setQrCode(data.qrCode);
    setWorkSummaryFr(data.workSummaryFr);
    setBookConstraintsFr(data.bookConstraintsFr);
    setIntentNoteFr(data.intentNoteFr);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          bookId,
          ...(data && !data.qrLocked ? { qrCode } : {}),
          ...(data && !data.planValidated
            ? {
                workSummaryFr,
                bookConstraintsFr,
                intentNoteFr,
              }
            : {}),
        },
      }),
    onSuccess: (res) => {
      setMessage(res.changed.length === 0 ? t("atelier.fiche.noChange") : t("atelier.fiche.saved"));
      setEditing(false);
      refreshAtelier();
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)),
  });

  /**
   * La fiche se clôt ici, jamais dans le dossier générique : une ligne dans
   * reviews, l'étape passe validée, la suivante devient la courante.
   */
  const validateStep = useMutation({
    mutationFn: () => {
      if (!data?.ficheStepId) throw new Error(t("atelier.fiche.notFound"));
      if (data.workSummaryFr.trim().length === 0) throw new Error(t("atelier.fiche.missingSummary"));
      return review({ data: { bookStepId: data.ficheStepId, decision: "valide" as const } });
    },
    onSuccess: () => {
      setMessage(t("atelier.fiche.validateDone"));
      refreshAtelier();
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)),
  });

  if (fiche.isLoading) return <p className="mt-4 text-[13px]">{t("atelier.loading")}</p>;
  if (!data) return <p className="mt-4 text-[13px]">{t("atelier.fiche.notFound")}</p>;

  const missing = data.workSummaryFr.trim().length === 0;

  return (
    <div className="mt-8 text-[13px]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-latin text-[16px]">{t("atelier.fiche.title")}</h2>
        {editing ? null : (
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            onClick={() => {
              setMessage(null);
              setEditing(true);
            }}
          >
            {t("atelier.fiche.edit")}
          </button>
        )}
      </div>

      <table className="mt-3 w-full border-collapse">
        <tbody>
          <tr>
            <td className={cell}>{t("atelier.fiche.field.title")}</td>
            <td className={cell}>{data.titleFr}</td>
          </tr>
          <tr>
            <td className={cell}>{t("atelier.fiche.field.collection")}</td>
            <td className={cell}>{data.collectionName ?? t("atelier.none")}</td>
          </tr>
          <tr>
            <td className={cell}>{t("atelier.fiche.field.tome")}</td>
            <td className={cell}>{data.tomeNo ?? t("atelier.none")}</td>
          </tr>
          <tr>
            <td className={cell}>{t("atelier.books.col.status")}</td>
            <td className={cell}>{data.status}</td>
          </tr>
          <tr>
            <td className={cell}>{t("atelier.fiche.field.slug")}</td>
            <td className={cell}>{data.slug}</td>
          </tr>
          <tr>
            <td className={cell}>{t("atelier.fiche.field.qr")}</td>
            <td className={cell}>
              {editing && !data.qrLocked ? (
                <>
                  <input
                    className={field}
                    value={qrCode}
                    onChange={(e) =>
                      setQrCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                    }
                  />
                  <span className="mt-1 block opacity-70">
                    {t("atelier.fiche.qrUrl")} /b/{qrCode || "…"}
                  </span>
                </>
              ) : (
                <>
                  {data.qrCode}
                  <span className="ml-2 opacity-70">
                    {t("atelier.fiche.qrUrl")} /b/{data.qrCode}
                  </span>
                  {data.qrLocked ? (
                    <span className="mt-1 block opacity-70">{t("atelier.fiche.qrFrozen")}</span>
                  ) : null}
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {data.planValidated ? <p className="mt-4">{t("atelier.fiche.frozen")}</p> : null}

      {editing && !data.planValidated ? (
        <>
          <FicheTextArea
            label={t("atelier.fiche.field.summary")}
            value={workSummaryFr}
            onChange={setWorkSummaryFr}
          />
          <FicheTextArea
            label={t("atelier.fiche.field.constraints")}
            value={bookConstraintsFr}
            onChange={setBookConstraintsFr}
          />
          <FicheTextArea
            label={t("atelier.fiche.field.intent")}
            value={intentNoteFr}
            onChange={setIntentNoteFr}
          />
        </>
      ) : (
        <>
          <FicheTextArea
            label={t("atelier.fiche.field.summary")}
            value={data.workSummaryFr || t("atelier.fiche.empty")}
            readOnly
          />
          <FicheTextArea
            label={t("atelier.fiche.field.constraints")}
            value={data.bookConstraintsFr || t("atelier.fiche.empty")}
            readOnly
          />
          <FicheTextArea
            label={t("atelier.fiche.field.intent")}
            value={data.intentNoteFr || t("atelier.fiche.empty")}
            readOnly
          />
        </>
      )}

      {editing ? (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("atelier.fiche.saving") : t("atelier.fiche.save")}
          </button>
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            onClick={() => {
              setEditing(false);
              setMessage(null);
            }}
          >
            {t("atelier.prompts.cancel")}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-3">{message}</p> : null}

      {/* Ce qui manque pour lancer le plan : le résumé, et lui seul. */}
      <div className="border-line mt-6 border p-3">
        <h3 className="font-latin text-[15px]">{t("atelier.fiche.missing")}</h3>
        <p className="mt-1">
          {missing ? t("atelier.fiche.missingSummary") : t("atelier.fiche.materialComplete")}
        </p>
        <p className="mt-1 opacity-70">{t("atelier.fiche.noLaunchYet")}</p>
      </div>

      <h3 className="font-latin mt-6 text-[15px]">{t("atelier.fiche.journal")}</h3>
      {data.journal.length === 0 ? (
        <p className="mt-1">{t("atelier.fiche.noJournal")}</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {data.journal.map((row) => (
              <tr key={row.id}>
                <td className={cell}>{formatDate(row.at)}</td>
                <td className={cell}>
                  {row.fields.map((f) => t(`atelier.fiche.f.${f}` as DictKey)).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* La porte de l'étape « Fiche du livre » : au bas de la fiche, ici. */}
      {data.ficheStepId ? (
        <div className="mt-6">
          {data.ficheStepStatus === "valide" || data.ficheStepStatus === "valide_hors_crm" ? (
            <p>{t("atelier.fiche.validated")}</p>
          ) : (
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={validateStep.isPending}
              onClick={() => {
                setMessage(null);
                validateStep.mutate();
              }}
            >
              {validateStep.isPending
                ? t("atelier.fiche.validating")
                : t("atelier.fiche.validateStep")}
            </button>
          )}
        </div>
      ) : null}

    </div>
  );
}
