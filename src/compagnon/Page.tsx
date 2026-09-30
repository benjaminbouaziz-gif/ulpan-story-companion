import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { supabase } from "@/integrations/supabase/client";
import { SiteLink } from "@/components/SiteLink";
import { LecteurLivre } from "@/components/LecteurLivre";
import { CompanionTraining } from "@/components/CompanionTraining";
import { ReadingSettings } from "@/components/ReadingSettings";
import { PreferencesProvider } from "@/lib/preferences";
import { ouvrirCompagnon, repondreQuestion, urlAudioPage, urlGlossaire } from "@/lib/compagnon.functions";

type Onglet = "lecture" | "entrainement" | "glossaire";
/** L'onglet actif vit dans l'adresse : ?onglet= en français, ?tab= en anglais. */
const PARAM = { fr: "onglet", en: "tab" } as const;
const NOMS: Record<"fr" | "en", Record<Onglet, string>> = {
  fr: { lecture: "lecture", entrainement: "entrainement", glossaire: "glossaire" },
  en: { lecture: "reading", entrainement: "practice", glossaire: "glossary" },
};
const ONGLETS: { id: Onglet; key: DictKey }[] = [
  { id: "lecture", key: "companion.tab.lecture" },
  { id: "entrainement", key: "companion.tab.entrainement" },
  { id: "glossaire", key: "companion.tab.glossaire" },
];

export function CompagnonPage() {
  return (
    <PreferencesProvider>
      <Compagnon />
    </PreferencesProvider>
  );
}

function Verrou() {
  const { t } = useI18n();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12" data-locked>
      <p className="body-text">{t("companion.locked")}</p>
      <SiteLink page="espace_lecteur" className="label touch mt-6 inline-flex border-b border-current">{t("nav.companion")}</SiteLink>
    </main>
  );
}

function Compagnon() {
  const { t, lang } = useI18n();
  const { slug } = useParams({ strict: false }) as { slug: string };
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const brut = String(search[PARAM[lang]] ?? "");
  const onglet: Onglet = (Object.entries(NOMS[lang]).find(([, v]) => v === brut)?.[0] as Onglet) ?? "lecture";

  const ouvrir = useServerFn(ouvrirCompagnon);
  const audio = useServerFn(urlAudioPage);
  const glossaire = useServerFn(urlGlossaire);
  const repondre = useServerFn(repondreQuestion);

  const [session, setSession] = useState<boolean | null>(null);
  const [focus, setFocus] = useState(false);
  const [goto, setGoto] = useState<{ pageNo: number; n: number } | undefined>(undefined);
  const [retour, setRetour] = useState<"question" | "result" | null>(null);
  const [glossBusy, setGlossBusy] = useState(false);
  const [glossErr, setGlossErr] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
  }, []);

  const q = useQuery({
    queryKey: ["compagnon", slug, lang],
    queryFn: () => ouvrir({ data: { slug } }),
    enabled: session === true,
    staleTime: Infinity,
    retry: false,
  });

  const requestAudioUrl = useCallback(async (pageId: string) => (await audio({ data: { slug, pageId } })).url, [audio, slug]);
  const go = (o: Onglet) => void navigate({ to: ".", search: { [PARAM[lang]]: NOMS[lang][o] } as never, replace: true });

  if (session === false) return <Verrou />;
  if (session === null || q.isPending) return <main className="mx-auto w-full max-w-xl px-4 py-12"><p className="body-text">…</p></main>;
  if (q.isError || !q.data || !q.data.allowed) return <Verrou />;

  const d = q.data;
  const telecharger = async () => {
    setGlossBusy(true); setGlossErr(false);
    try {
      const { url } = await glossaire({ data: { slug } });
      if (url) window.location.href = url; else setGlossErr(true);
    } catch { setGlossErr(true); } finally { setGlossBusy(false); }
  };
  const concentre = focus && onglet === "entrainement";
  const style = d.color ? ({ "--collection": d.color } as React.CSSProperties) : undefined;

  return (
    <main className="frame py-4" style={style}>
      {!concentre ? (
        <div className="flex items-center gap-3">
          {d.coverUrl ? <img src={d.coverUrl} alt="" className="border-line h-14 w-10 border object-cover" /> : null}
          <h1 className="flex-1 text-[22px] leading-tight">{d.title ?? d.titleHe ?? slug}</h1>
          <ReadingSettings />
        </div>
      ) : null}

      <div className="border-line mt-4 flex items-end gap-3 border-b">
      <div role="tablist" className="flex flex-1 gap-5">
        {ONGLETS.map((o) => {
          const active = onglet === o.id;
          return (
            <button key={o.id} role="tab" type="button" aria-selected={active} onClick={() => go(o.id)} className={`label touch border-b-2 pb-2 ${o.id === "glossaire" ? "hidden md:inline-flex" : ""}`}
              style={{ borderColor: active ? "currentColor" : "transparent", opacity: active ? 1 : 0.6 }}>
              {t(o.key)}
            </button>
          );
        })}
      </div>
        {/* Téléphone : le glossaire se télécharge directement, sans onglet. */}
        <button type="button" data-glossary-mobile disabled={!d.hasGlossary || glossBusy} onClick={() => void telecharger()}
          className="label bg-foreground text-background mb-1.5 min-h-11 shrink-0 px-3 disabled:opacity-40 md:hidden">
          {d.hasGlossary ? `↓ ${t("companion.tab.glossaire")}` : t("companion.glossarySoon").replace(/\.$/, "")}
        </button>
      </div>
      {glossErr && onglet !== "glossaire" ? <p className="label mt-2 md:hidden" role="alert">{t("lecteur.error")}</p> : null}

      {onglet === "lecture" ? (
        <div role="tabpanel" className="mt-4">
          {d.pages.length > 0 ? (
            <LecteurLivre editionId={d.editionId} editionTitle={d.title ?? d.titleHe ?? ""} coverUrl={d.coverUrl} pages={d.pages} chapters={d.chapters}
              requestAudioUrl={requestAudioUrl} goto={goto}
              retour={retour ? { label: retour === "question" ? t("quiz.backQuestion") : t("quiz.backResult"), onClick: () => { setRetour(null); go("entrainement"); } } : undefined} />
          ) : (
            <p className="body-text text-secondary-text">{t("companion.pagesSoon")}</p>
          )}
        </div>
      ) : null}

      {/* L'entraînement reste monté pour retrouver la même question au retour. */}
      <div role="tabpanel" hidden={onglet !== "entrainement"}>
        <CompanionTraining
          questions={d.questions}
          chapters={d.chapters}
          initialAnswers={d.lastAnswers}
          onAnswer={async (qq, chosen) => {
            try { await repondre({ data: { slug, questionId: qq.id, chosen } }); return true; } catch { return false; }
          }}
          onReread={(pageNo, from) => { setGoto({ pageNo, n: Date.now() }); setRetour(from); go("lecture"); }}
          onFocusMode={setFocus}
        />
      </div>

      {onglet === "glossaire" ? (
        <div role="tabpanel" className="mt-6">
          {d.hasGlossary ? (
            <>
              <button type="button" disabled={glossBusy} className="label touch bg-foreground text-background px-4 py-3 disabled:opacity-40" data-glossary
                onClick={() => void telecharger()}>
                {t("companion.glossaryDownload")}
              </button>
              {glossErr ? <p className="label mt-3" role="alert">{t("lecteur.error")}</p> : null}
            </>
          ) : (
            <p className="body-text text-secondary-text">{t("companion.glossarySoon")}</p>
          )}
        </div>
      ) : null}
    </main>
  );
}
