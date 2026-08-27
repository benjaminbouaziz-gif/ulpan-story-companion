import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import { ARTIFACT_TYPES, artifactFileName } from "@/lib/artifact-path";
import {
  artifactSignedUrl,
  reviewStep,
  stepDossier,
  uploadArtifact,
} from "@/lib/atelier-artifacts.functions";

/**
 * Le dossier d'une étape : ce qui a été déposé, et la porte de validation.
 * Cockpit : texte dense, statuts écrits en mots, aucune couleur seule porteuse
 * de sens. Les liens de fichier sont signés à la demande (15 min) et ne sont
 * jamais conservés.
 */
export function StepDossier({ bookStepId, status }: { bookStepId: string; status: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchDossier = useServerFn(stepDossier);
  const sign = useServerFn(artifactSignedUrl);
  const upload = useServerFn(uploadArtifact);
  const review = useServerFn(reviewStep);

  const [type, setType] = useState<string>("autre");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const dossier = useQuery({
    queryKey: ["atelier", "dossier", bookStepId],
    queryFn: () => fetchDossier({ data: { bookStepId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["atelier", "dossier", bookStepId] });
    void qc.invalidateQueries({ queryKey: ["atelier", "chain"] });
    void qc.invalidateQueries({ queryKey: ["atelier", "books"] });
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
          ...(dossier.data?.artifacts[0] ? { artifactId: dossier.data.artifacts[0].id } : {}),
        },
      }),
    onSuccess: () => {
      setComment("");
      setMessage(t("atelier.step.reviewDone"));
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const artifacts = dossier.data?.artifacts ?? [];
  const reviews = dossier.data?.reviews ?? [];
  const terminal = status === "valide" || status === "valide_hors_crm";

  return (
    <div className="border-line mt-2 border-t pt-2 text-[12px]">
      <h4 className="font-latin text-[13px]">{t("atelier.step.artifacts")}</h4>
      {dossier.isLoading ? (
        <p>…</p>
      ) : artifacts.length === 0 ? (
        <p>{t("atelier.step.noArtifacts")}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {artifacts.map((a) => (
            <li key={a.id}>
              {a.type} · {t("atelier.step.version")} {a.version} · {artifactFileName(a.storagePath)}
              {a.sizeBytes ? ` · ${Math.max(1, Math.round(a.sizeBytes / 1024))} ko` : ""} ·{" "}
              <button
                type="button"
                className="border-b border-current"
                onClick={async () => {
                  try {
                    const { url } = await sign({ data: { artifactId: a.id } });
                    window.open(url, "_blank", "noopener,noreferrer");
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                {t("atelier.step.openFile")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="font-latin mt-3 text-[13px]">{t("atelier.step.deposit")}</h4>
      <p className="opacity-70">{t("atelier.step.uploadOrder")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
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
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          disabled={!file || deposit.isPending}
          onClick={() => deposit.mutate()}
        >
          {deposit.isPending ? t("atelier.step.sending") : t("atelier.step.send")}
        </button>
      </div>

      <h4 className="font-latin mt-3 text-[13px]">{t("atelier.step.reviews")}</h4>
      {reviews.length === 0 ? (
        <p>{t("atelier.step.noReviews")}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {reviews.map((r) => (
            <li key={r.id}>
              {r.decision === "valide" ? t("atelier.step.approve") : t("atelier.step.reject")} ·{" "}
              {new Date(r.createdAt).toLocaleString()}
              {r.comment ? <span className="block opacity-70">{r.comment}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {terminal ? (
        <p className="mt-3">{t("atelier.step.terminal")}</p>
      ) : (
        <div className="mt-3">
          <h4 className="font-latin text-[13px]">{t("atelier.step.decide")}</h4>
          <textarea
            className="border-line mt-1 w-full border bg-transparent px-1 py-0.5"
            rows={2}
            placeholder={t("atelier.step.reason")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={decide.isPending}
              onClick={() => {
                if (window.confirm(t("atelier.step.approve"))) decide.mutate("valide");
              }}
            >
              {t("atelier.step.approve")}
            </button>
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={decide.isPending}
              onClick={() => decide.mutate("revision_demandee")}
            >
              {t("atelier.step.reject")}
            </button>
          </div>
        </div>
      )}

      {message ? <p className="mt-2">{message}</p> : null}
    </div>
  );
}
