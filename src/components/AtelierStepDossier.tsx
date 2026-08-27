import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { ARTIFACT_TYPES, artifactFileName } from "@/lib/artifact-path";
import { PlanRobotPanel } from "./AtelierPlanRobot";
import {
  artifactSignedUrl,
  reviewStep,
  stepDossier,
  uploadArtifact,
  type ArtifactRow,
} from "@/lib/atelier-artifacts.functions";

/**
 * LE DOSSIER D'ÉTAPE — ordre de lecture FIXE :
 *  a. la ligne de situation ;
 *  b. le livrable courant, tout de suite, téléchargeable ;
 *  c. les versions précédentes, repliées (jamais supprimables) ;
 *  d. les deux actions, toujours au même endroit ;
 *  e. le dépôt d'une nouvelle version ;
 *  f. le journal de l'étape, entier, jamais tronqué.
 *
 * Aucun afficheur de fichier : on télécharge, on ne lit pas dans l'atelier.
 * Les liens sont signés à la demande (15 min) et ne sont jamais conservés.
 * Aucune langue n'apparaît : l'axe langue reste en sommeil.
 */

const cell = "border-line border-b px-2 py-1 text-left align-top";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

function sizeKo(bytes: number | null): string {
  return bytes ? `${Math.max(1, Math.round(bytes / 1024))} ko` : "—";
}

export function StepDossier({ bookStepId }: { bookStepId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchDossier = useServerFn(stepDossier);
  const sign = useServerFn(artifactSignedUrl);
  const upload = useServerFn(uploadArtifact);
  const review = useServerFn(reviewStep);

  const [type, setType] = useState<string>("autre");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [commentMissing, setCommentMissing] = useState(false);
  const [fileMissing, setFileMissing] = useState(false);

  const dossier = useQuery({
    queryKey: ["atelier", "dossier", bookStepId],
    queryFn: () => fetchDossier({ data: { bookStepId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["atelier", "dossier", bookStepId] });
    void qc.invalidateQueries({ queryKey: ["atelier", "chain"] });
    void qc.invalidateQueries({ queryKey: ["atelier", "books"] });
    void qc.invalidateQueries({ queryKey: ["atelier", "queue"] });
  };

  const download = async (artifactId: string) => {
    try {
      const { url } = await sign({ data: { artifactId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const deposit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("atelier.step.file"));
      const form = new FormData();
      form.set("bookStepId", bookStepId);
      form.set("type", type);
      form.set("file", file);
      return upload({ data: form });
    },
    onSuccess: () => {
      setFile(null);
      setFileMissing(false);
      setMessage(null);
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const decide = useMutation({
    mutationFn: (decision: "valide" | "revision_demandee") =>
      review({
        data: {
          bookStepId,
          decision,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(current ? { artifactId: current.id } : {}),
        },
      }),
    onSuccess: () => {
      setComment("");
      setCommentMissing(false);
      setMessage(t("atelier.step.reviewDone"));
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const situation = dossier.data?.situation ?? null;
  const artifacts: ArtifactRow[] = dossier.data?.artifacts ?? [];
  const reviews = dossier.data?.reviews ?? [];
  const ficheChanges = dossier.data?.ficheChanges ?? [];
  const current = artifacts[0] ?? null;
  const previous = artifacts.slice(1);
  const horsCrm = situation?.status === "valide_hors_crm";
  const closed = situation?.status === "valide";

  /**
   * L'étape « Fiche du livre » n'est pas un livrable qu'on dépose : son écran
   * est le formulaire de la fiche, sur la page du livre. On y renvoie.
   */
  useEffect(() => {
    if (situation?.stepCode !== "fiche") return;
    void navigate({
      to: "/atelier/livres",
      search: { livre: situation.bookId, etape: undefined },
      hash: "fiche-du-livre",
      replace: true,
    });
  }, [situation?.stepCode, situation?.bookId, navigate]);

  if (dossier.isLoading) return <p className="text-[13px]">…</p>;
  if (situation?.stepCode === "fiche") return <p className="text-[13px]">…</p>;
  if (!situation) return <p className="text-[13px]">{t("atelier.step.unknown")}</p>;

  const line = (a: ArtifactRow) => (
    <tr key={a.id}>
      <td className={cell}>{a.type}</td>
      <td className={cell}>
        {t("atelier.step.version")} {a.version}
      </td>
      <td className={cell}>{sizeKo(a.sizeBytes)}</td>
      <td className={cell}>{formatDate(a.createdAt)}</td>
      <td className={cell}>{t(`atelier.origin.${a.origin}` as DictKey)}</td>
      <td className={cell}>
        {artifactFileName(a.storagePath)} ·{" "}
        <button type="button" className="border-b border-current" onClick={() => void download(a.id)}>
          {t("atelier.step.download")}
        </button>
      </td>
    </tr>
  );

  return (
    <div className="text-[13px]">
      {/* a. situation */}
      <p>
        {situation.bookTitle} · {situation.labelFr} · {t("atelier.books.col.rank")} {situation.rank} ·{" "}
        {t(`atelier.status.${situation.status}` as DictKey)} · {t("atelier.books.col.awaiting")}{" "}
        {situation.awaiting ? t(`atelier.awaiting.${situation.awaiting}` as DictKey) : t("atelier.none")}
      </p>

      {/* b. livrable courant */}
      <h2 className="font-latin mt-5 text-[16px]">{t("atelier.step.current")}</h2>
      {!current ? (
        <p className="mt-1">{t("atelier.step.noArtifacts")}</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <tbody>{line(current)}</tbody>
        </table>
      )}

      {/* c. versions précédentes */}
      {previous.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            className="border-b border-current"
            onClick={() => setShowOld((v) => !v)}
          >
            {showOld ? t("atelier.step.hidePrevious") : t("atelier.step.showPrevious")} ({previous.length})
          </button>
          {showOld ? (
            <table className="mt-2 w-full border-collapse">
              <tbody>{previous.map(line)}</tbody>
            </table>
          ) : null}
        </div>
      ) : null}

      {/* c-bis. le robot de l'étape, quand elle en a un */}
      <PlanRobotPanel bookStepId={bookStepId} onDone={invalidate} />

      {/* d. les deux actions */}
      {horsCrm ? (
        <p className="mt-5">
          {t("atelier.step.outsideCrm")}
          {situation.note ? <span className="block opacity-70">{situation.note}</span> : null}
        </p>
      ) : (
        <div className="mt-5">
          <h2 className="font-latin text-[16px]">{t("atelier.step.decide")}</h2>
          {closed ? <p className="mt-1">{t("atelier.step.terminal")}</p> : null}
          <textarea
            className="border-line mt-2 w-full max-w-[560px] border bg-transparent px-1 py-0.5"
            rows={2}
            placeholder={t("atelier.step.reason")}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.trim()) setCommentMissing(false);
            }}
          />
          {commentMissing ? <p className="mt-1">{t("atelier.step.reasonRequired")}</p> : null}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={decide.isPending}
              onClick={() => {
                const question = `${t("atelier.step.confirmValidate")} ${situation.labelFr} — ${situation.bookTitle}. ${t("atelier.step.confirmEffect")}`;
                if (window.confirm(question)) decide.mutate("valide");
              }}
            >
              {t("atelier.step.approve")}
            </button>
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={decide.isPending}
              onClick={() => {
                const missing = comment.trim().length === 0;
                setCommentMissing(missing);
                if (missing || decide.isPending) return;
                decide.mutate("revision_demandee");
              }}
            >
              {t("atelier.step.reject")}
            </button>
          </div>
        </div>
      )}

      {/* e. dépôt */}
      {horsCrm ? null : (
        <div className="mt-6">
          <h2 className="font-latin text-[16px]">{t("atelier.step.deposit")}</h2>
          <p className="mt-1 opacity-70">{t("atelier.step.depositRule")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label>
              {t("atelier.step.type")}{" "}
              <select
                className="border-line border bg-transparent px-1 py-0.5"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ARTIFACT_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <input
                type="file"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) setFileMissing(false);
                }}
              />
              {fileMissing ? <p className="mt-1">{t("atelier.step.file")}</p> : null}
            </div>
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={deposit.isPending}
              onClick={() => {
                const missing = !file;
                setFileMissing(missing);
                if (missing || deposit.isPending) return;
                deposit.mutate();
              }}
            >
              {deposit.isPending ? t("atelier.step.sending") : t("atelier.step.send")}
            </button>
          </div>
        </div>
      )}

      {/* f. journal */}
      <h2 className="font-latin mt-6 text-[16px]">{t("atelier.step.journal")}</h2>
      {reviews.length === 0 && artifacts.length === 0 && ficheChanges.length === 0 ? (
        <p className="mt-1">{t("atelier.step.noJournal")}</p>
      ) : (
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {[
              ...reviews.map((r) => ({
                id: r.id,
                at: r.createdAt,
                what:
                  r.decision === "valide" ? t("atelier.step.approve") : t("atelier.step.reject"),
                comment: r.comment,
              })),
              ...artifacts.map((a) => ({
                id: a.id,
                at: a.createdAt,
                what: `${t("atelier.step.deposit")} · ${a.type} ${t("atelier.step.version")} ${a.version} · ${t(`atelier.origin.${a.origin}` as DictKey)}`,
                comment: null as string | null,
              })),
              ...ficheChanges.map((f) => ({
                id: f.id,
                at: f.at,
                what: `${t("atelier.step.ficheChange")} · ${f.fields
                  .map((k) => t(`atelier.fiche.f.${k}` as DictKey))
                  .join(", ")}`,
                comment: null as string | null,
              })),
            ]
              .sort((a, b) => (a.at < b.at ? 1 : -1))
              .map((e) => (
                <tr key={e.id}>
                  <td className={cell}>{formatDate(e.at)}</td>
                  <td className={cell}>
                    {e.what}
                    {e.comment ? <span className="block opacity-70">{e.comment}</span> : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {message ? <p className="mt-3">{message}</p> : null}
    </div>
  );
}
