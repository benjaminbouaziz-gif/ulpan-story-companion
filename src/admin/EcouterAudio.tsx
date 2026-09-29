import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { pageAudioUrl } from "@/lib/admin-livres.functions";
import { messageErreur } from "./textes";

/** Lecture de contrôle : lien signé 60 s demandé au moment d'écouter. */
export function EcouterAudio({ pageId }: { pageId: string }) {
  const sign = useServerFn(pageAudioUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (url) return <audio src={url} controls autoPlay className="h-8 max-w-[220px]" />;
  return (
    <button
      type="button"
      className="border-line border px-2 text-[12px]"
      aria-label="Écouter"
      onClick={async () => {
        try {
          setUrl((await sign({ data: { pageId } })).url);
        } catch (e) {
          setErr(messageErreur(e));
        }
      }}
    >
      ▶{err ? ` ${err}` : ""}
    </button>
  );
}
