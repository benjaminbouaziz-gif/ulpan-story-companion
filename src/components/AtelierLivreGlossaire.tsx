import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { fmt } from "@/lib/fmt";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import {
  glossaireAtelierUrl,
  uploadGlossaire,
  type AtelierLivreInfo,
} from "@/lib/atelier-livre.functions";

/**
 * L'onglet « Glossaire » : le fichier PDF de l'édition choisie, et lui seul.
 * Rien de la table glossary_entries n'est affiché ici.
 */

const btn = "border-line border px-2 py-0.5 text-[13px] disabled:opacity-40";

function taille(n: number | null): string {
  if (n == null) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export function LivreGlossaire({
  info,
  edition,
  onChanged,
}: {
  info: AtelierLivreInfo;
  edition: "fr" | "en";
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const upload = useServerFn(uploadGlossaire);
  const url = useServerFn(glossaireAtelierUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DictKey | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  const glossaire = edition === "en" ? info.glossaireEn : info.glossaireFr;
  const etat = edition === "en" ? info.editionEn : info.editionFr;

  useEffect(() => {
    let vivant = true;
    setApercu(null);
    if (!glossaire) return;
    void url({ data: { bookId: info.id, lang: edition, inline: true } }).then((r) => {
      if (vivant) setApercu(r.url);
    });
    return () => {
      vivant = false;
    };
  }, [glossaire?.path, glossaire?.updatedAt, info.id, edition]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deposer(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (!f.name.toLowerCase().endsWith(".pdf") || (f.type && f.type !== "application/pdf"))
      return setError("atelier.edition.glossary.err.format");
    if (glossaire && !window.confirm(t("atelier.edition.glossary.replaceConfirm"))) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("bookId", info.id);
      body.set("lang", edition);
      body.set("file", f);
      await upload({ data: body });
      onChanged();
    } catch (e) {
      setError(cleErreurAtelier(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function telecharger() {
    const r = await url({ data: { bookId: info.id, lang: edition } });
    if (r.url) window.location.href = r.url;
  }

  return (
    <div className="mt-6 max-w-[1000px] text-[13px]">
      <h2 className="font-latin text-[15px]">
        {t(edition === "en" ? "atelier.glossaire.titleEn" : "atelier.glossaire.titleFr")}
      </h2>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => void deposer(e.target.files?.[0])}
      />

      {etat === "publiee" ? (
        <p className="mt-2">
          {fmt(t("atelier.glossaire.published"), {
            site: edition === "en" ? "ulpanstory.com" : "oulpanstory.fr",
          })}
        </p>
      ) : null}

      {glossaire ? (
        <>
          <p className="mt-3">
            {glossaire.name}
            {glossaire.size != null ? ` · ${taille(glossaire.size)}` : ""}
            {glossaire.updatedAt
              ? ` · ${new Date(glossaire.updatedAt).toLocaleString(edition === "en" ? "en-GB" : "fr-FR")}`
              : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={btn} onClick={() => void telecharger()}>
              {t("atelier.glossaire.download")}
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? t("atelier.glossaire.uploading") : t("atelier.glossaire.replace")}
            </button>
          </div>
          <h3 className="mt-4 font-medium">{t("atelier.glossaire.preview")}</h3>
          {apercu ? (
            <iframe
              title={glossaire.name}
              src={apercu}
              className="border-line mt-2 w-full border"
              style={{ height: 900 }}
            />
          ) : (
            <p className="mt-2">{t("atelier.loading")}</p>
          )}
        </>
      ) : (
        <>
          <p className="mt-3">{t("atelier.glossaire.none")}</p>
          <div
            className={`border-line mt-2 border border-dashed p-6 text-center ${survol ? "font-medium" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setSurvol(true);
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSurvol(false);
              void deposer(e.dataTransfer.files?.[0]);
            }}
          >
            <p>{busy ? t("atelier.glossaire.uploading") : t("atelier.glossaire.drop")}</p>
            <button
              type="button"
              className={`${btn} mt-2`}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {t("atelier.glossaire.choose")}
            </button>
          </div>
        </>
      )}

      {error ? <p className="text-alert mt-2">{t(error)}</p> : null}
    </div>
  );
}
