import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import {
  atelierPageAudioUrl,
  removeAtelierPageAudio,
  uploadAtelierPageAudio,
} from "@/lib/atelier-livre.functions";

/**
 * L'audio de la page. Le fichier vit dans un bucket privé : aucune URL
 * permanente n'existe. Le lecteur de contrôle demande une URL signée à
 * l'instant où on veut écouter ; elle expire au bout de 60 secondes.
 */
const MAX = 50 * 1024 * 1024;

export function PageAudio({
  pageId,
  audioPath,
  onChanged,
}: {
  pageId: string;
  audioPath: string | null;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const upload = useServerFn(uploadAtelierPageAudio);
  const remove = useServerFn(removeAtelierPageAudio);
  const sign = useServerFn(atelierPageAudioUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DictKey | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function envoyer() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".m4a") && !name.endsWith(".mp3")) {
      return setError("atelier.livre.audio.err.format");
    }
    if (file.size > MAX) return setError("atelier.livre.audio.err.tooBig");
    if (audioPath && !window.confirm(t("atelier.livre.audio.replaceConfirm"))) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.set("pageId", pageId);
      body.set("file", file);
      await upload({ data: body });
      if (fileRef.current) fileRef.current.value = "";
      setUrl(null);
      onChanged();
    } catch (e) {
      setError(cleErreurAtelier(e));
    } finally {
      setBusy(false);
    }
  }

  async function retirer() {
    if (!window.confirm(t("atelier.livre.audio.removeConfirm"))) return;
    setBusy(true);
    try {
      await remove({ data: { pageId } });
      setUrl(null);
      onChanged();
    } catch (e) {
      setError(cleErreurAtelier(e));
    } finally {
      setBusy(false);
    }
  }

  async function ecouter() {
    setError(null);
    const res = await sign({ data: { pageId } });
    setUrl(res.url);
  }

  return (
    <section className="border-line mt-8 border-t pt-4">
      <h2 className="font-latin text-[15px]">{t("atelier.livre.audio.title")}</h2>
      <p className="mt-1 text-[13px]">{audioPath ?? t("atelier.livre.audio.none")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        <input ref={fileRef} type="file" accept=".m4a,.mp3,audio/mp4,audio/mpeg" />
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          onClick={() => void envoyer()}
          disabled={busy}
        >
          {busy ? t("atelier.livre.audio.uploading") : t("atelier.livre.audio.upload")}
        </button>
        <span className="opacity-70">{t("atelier.livre.audio.choose")}</span>
      </div>

      {audioPath ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            onClick={() => void ecouter()}
          >
            {t("atelier.livre.audio.listen")}
          </button>
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            onClick={() => void retirer()}
            disabled={busy}
          >
            {t("atelier.livre.audio.remove")}
          </button>
        </div>
      ) : null}

      {url ? (
        <audio
          className="mt-3 w-full max-w-[420px]"
          controls
          src={url}
          onError={() => setError("atelier.livre.audio.expired")}
        />
      ) : null}

      {error ? <p className="mt-2 text-[13px]">{t(error)}</p> : null}
    </section>
  );
}
