import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { fmt } from "@/lib/fmt";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import {
  controleEdition,
  glossaireAtelierUrl,
  setEditionEtat,
  uploadGlossaire,
  EDITION_ETATS,
  type AtelierLivreInfo,
  type EditionEtat,
} from "@/lib/atelier-livre.functions";

/**
 * Le volet d'une édition dans l'onglet Informations : son glossaire (un PDF)
 * et son état. Passer à « publiée » montre d'abord ce qui manque ; le serveur
 * refait la même vérification avant d'écrire.
 */

const btn = "border-line border px-2 py-0.5 text-[13px] disabled:opacity-40";

export const etatKey = (e: EditionEtat): DictKey => `atelier.edition.state.${e}` as DictKey;

export function EditionPanel({
  info,
  edition,
  onChanged,
}: {
  info: AtelierLivreInfo;
  edition: "fr" | "en";
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const control = useServerFn(controleEdition);
  const setEtat = useServerFn(setEditionEtat);
  const upload = useServerFn(uploadGlossaire);
  const url = useServerFn(glossaireAtelierUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DictKey | null>(null);
  const [voulu, setVoulu] = useState<EditionEtat | null>(null);

  const actuel = edition === "en" ? info.editionEn : info.editionFr;
  const glossaire = edition === "en" ? info.glossaireEn : info.glossaireFr;

  const controle = useQuery({
    queryKey: ["atelier", "edition-controle", info.id, edition, info],
    queryFn: () => control({ data: { bookId: info.id, lang: edition } }),
    enabled: voulu === "publiee" || actuel === "publiee",
  });

  async function appliquer(etat: EditionEtat) {
    setError(null);
    setBusy(true);
    try {
      await setEtat({ data: { bookId: info.id, lang: edition, etat } });
      setVoulu(null);
      onChanged();
    } catch (e) {
      setError(cleErreurAtelier(e));
    } finally {
      setBusy(false);
    }
  }

  async function deposer(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (!f.name.toLowerCase().endsWith(".pdf")) return setError("atelier.edition.glossary.err.format");
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

  const c = controle.data;

  return (
    <div className="border-line mt-6 max-w-[860px] border p-3 text-[13px]">
      <h2 className="font-latin text-[15px]">
        {t(edition === "en" ? "atelier.edition.panelEn" : "atelier.edition.panelFr")}
      </h2>

      <h3 className="mt-3 font-medium">{t("atelier.edition.glossary.title")}</h3>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => void deposer(e.target.files?.[0])}
      />
      {glossaire ? (
        <p className="mt-1">
          {glossaire.name}
          {glossaire.updatedAt
            ? ` · ${new Date(glossaire.updatedAt).toLocaleString("fr-FR")}`
            : ""}{" "}
          <button type="button" className={`${btn} ml-2`} disabled={busy} onClick={() => fileRef.current?.click()}>
            {t("atelier.edition.glossary.replace")}
          </button>{" "}
          <button type="button" className={btn} onClick={() => void telecharger()}>
            {t("atelier.edition.glossary.download")}
          </button>
        </p>
      ) : (
        <p className="mt-1">
          {t("atelier.edition.glossary.none")}{" "}
          <button type="button" className={`${btn} ml-2`} disabled={busy} onClick={() => fileRef.current?.click()}>
            {t("atelier.edition.glossary.upload")}
          </button>
        </p>
      )}

      <h3 className="mt-4 font-medium">{t("atelier.edition.stateTitle")}</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {EDITION_ETATS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={busy || e === actuel}
            className={`${btn} ${e === actuel ? "font-medium" : ""}`}
            onClick={() => (e === "publiee" ? setVoulu("publiee") : void appliquer(e))}
          >
            {t(etatKey(e))}
            {e === actuel ? ` — ${t("atelier.edition.current")}` : ""}
          </button>
        ))}
      </div>

      {voulu === "publiee" ? (
        <div className="border-line mt-3 border p-2">
          <p className="font-medium">{t("atelier.edition.checklist")}</p>
          {controle.isLoading || !c ? (
            <p className="mt-1">{t("atelier.loading")}</p>
          ) : (
            <>
              {c.bloquants.length === 0 ? (
                <p className="mt-1">{t("atelier.edition.checkOk")}</p>
              ) : (
                <ul className="text-alert mt-1 list-disc pl-5">
                  {c.bloquants.map((b) => (
                    <li key={b.code}>
                      {fmt(t(`atelier.edition.check.${b.code}.${edition}` as DictKey), { n: b.n ?? 0 })}
                    </li>
                  ))}
                </ul>
              )}
              {c.avertissements.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 opacity-80">
                  {c.avertissements.map((a) => (
                    <li key={a.code}>{t(`atelier.edition.warn.${a.code}` as DictKey)}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={btn}
                  disabled={busy || c.bloquants.length > 0}
                  onClick={() => void appliquer("publiee")}
                >
                  {t("atelier.edition.publish")}
                </button>
                <button type="button" className={btn} onClick={() => setVoulu(null)}>
                  {t("atelier.prompts.cancel")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="text-alert mt-2">{t(error)}</p> : null}
    </div>
  );
}
