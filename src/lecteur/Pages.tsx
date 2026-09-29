import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import { otherLangHref, pathFor } from "@/i18n/routes";
import { supabase } from "@/integrations/supabase/client";
import { SiteLink } from "@/components/SiteLink";
import {
  attenteConnecte, confirmerAcces, demanderAcces, desinscrire, entrerConnecte, lienConnexion,
  monEspace, regleNouveautes, rejoindreAttente, supprimerMonCompte,
} from "@/lib/lecteur.functions";
import type { QrEntry, Resultat } from "@/lib/public-writes.server";

const input = "border-line bg-background body-text mt-1 block w-full border px-3 py-3";
const primary = "label touch bg-foreground text-background mt-6 w-full px-4 py-3 disabled:opacity-40";
const lienCls = "label touch mt-4 inline-flex border-b border-current";

function useMessage() {
  const { t } = useI18n();
  return (r: Resultat | "error") =>
    r === "ok" ? t("lecteur.checkInbox") : r === "rate" ? t("lecteur.rate") : r === "invalid" ? t("lecteur.invalidEmail") : t("lecteur.error");
}

/* ------------------------------------------------------------------ */
/* Formulaire d'accès (ou de liste d'attente)                          */
/* ------------------------------------------------------------------ */

function AccessForm({ slug, attente }: { slug: string; attente: boolean }) {
  const { t } = useI18n();
  const acces = useServerFn(demanderAcces);
  const wait = useServerFn(rejoindreAttente);
  const msgOf = useMessage();
  const [email, setEmail] = useState("");
  const [optout, setOptout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { result } = await (attente ? wait : acces)({ data: { slug, email, newsOptout: optout } });
      if (result === "ok") setDone(attente ? t("lecteur.noted") : t("lecteur.checkInbox"));
      else setErr(msgOf(result));
    } catch {
      setErr(t("lecteur.error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="border-line mt-8 border-t pt-6" data-lecteur-done>
        <p className="body-text">{done}</p>
        {!attente && <SiteLink page="activation" className={lienCls}>{t("lecteur.haveCode")}</SiteLink>}
      </div>
    );
  }
  return (
    <form className="border-line mt-8 border-t pt-6" onSubmit={submit}>
      <label className="label block">
        {t("lecteur.email")}
        <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      <label className="body-text mt-4 flex items-start gap-3">
        <input type="checkbox" checked={optout} onChange={(e) => setOptout(e.target.checked)} className="mt-1" />
        <span>{t("lecteur.optout")}</span>
      </label>
      <p className="body-text text-secondary-text mt-6">{t("lecteur.consent")}</p>
      <SiteLink page="confidentialite" className="body-text underline">{t("lecteur.privacy")}</SiteLink>
      <button type="submit" disabled={busy || !email.trim()} className={primary}>{busy ? "…" : t("lecteur.submit")}</button>
      {err && <p className="label mt-3" role="alert">{err}</p>}
      {!attente && <div><SiteLink page="activation" className={lienCls}>{t("lecteur.haveCode")}</SiteLink></div>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Entrée QR                                                            */
/* ------------------------------------------------------------------ */

export function QrPage({ slug, d }: { slug: string; d: Extract<QrEntry, { kind: "ok" }> }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const entrer = useServerFn(entrerConnecte);
  const attendre = useServerFn(attenteConnecte);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [noted, setNoted] = useState(false);
  const prep = d.status !== "publiee";

  useEffect(() => {
    let off = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (off) return;
      if (!data.session) return setConnecte(false);
      setConnecte(true);
      if (!prep) {
        const r = await entrer({ data: { slug } });
        if (!off && r.status === "publiee") void navigate({ to: pathFor("compagnon", lang, { slug }) as "/" });
      }
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      {d.coverUrl && <img src={d.coverUrl} alt="" className="border-line mx-auto w-48 border" />}
      {d.title && <h1 className="mt-6 text-center text-[28px]">{d.title}</h1>}
      {d.titleHe && <p className="mt-2 text-center text-[22px]" dir="rtl" lang="he">{d.titleHe}</p>}
      <p className="body-text mt-6">{t("lecteur.qrIntro")}</p>
      {prep && <p className="body-text mt-4" data-prep>{t("lecteur.prepMsg")}</p>}
      {connecte === false && <AccessForm slug={slug} attente={prep} />}
      {connecte === true && prep && (
        noted ? <p className="body-text mt-8">{t("lecteur.noted")}</p> : (
          <button type="button" className={primary} onClick={async () => { const r = await attendre({ data: { slug } }); if (r.result === "ok") setNoted(true); }}>
            {t("lecteur.notifyMe")}
          </button>
        )
      )}
      {connecte === true && !prep && <p className="body-text mt-8">{t("lecteur.opening")}</p>}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Activation                                                           */
/* ------------------------------------------------------------------ */

const lienErreur = () =>
  typeof window !== "undefined" && /error(_code)?=/.test(window.location.hash + window.location.search);
const erreurInitiale = lienErreur();

export function ActivationPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const confirm = useServerFn(confirmerAcces);
  const renvoyer = useServerFn(lienConnexion);
  const msgOf = useMessage();
  const [state, setState] = useState<"idle" | "opening">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [expire, setExpire] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editionId = () => {
    const e = new URLSearchParams(window.location.search).get("e");
    return e && /^[0-9a-f-]{36}$/i.test(e) ? e : null;
  };

  async function finish() {
    setState("opening");
    try {
      const r = await confirm({ data: { editionId: editionId() } });
      if (r.granted && r.slug && r.lang === lang) void navigate({ to: pathFor("compagnon", lang, { slug: r.slug }) as "/" });
      else void navigate({ to: pathFor("espace_lecteur", lang) as "/" });
    } catch {
      setState("idle");
      setExpire(true);
    }
  }

  useEffect(() => {
    if (erreurInitiale || lienErreur()) setExpire(true);
    let off = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (off || !data.session) return;
      const { data: u } = await supabase.auth.getUser();
      if (!off && u.user) void finish();
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) {
      setErr(t("lecteur.badCode"));
      setExpire(true);
      return;
    }
    await finish();
  }

  async function nouveauLien() {
    setBusy(true);
    try {
      const r = await renvoyer({ data: { email, editionId: editionId() } });
      setInfo(msgOf(r.result));
    } catch {
      setInfo(t("lecteur.error"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "opening") return <main className="mx-auto w-full max-w-xl px-4 py-12"><p className="body-text">{t("lecteur.opening")}</p></main>;
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-[28px]">{t("lecteur.codeTitle")}</h1>
      {expire && !err && <p className="body-text mt-4" role="alert">{t("lecteur.expired")}</p>}
      <p className="body-text text-secondary-text mt-4">{t("lecteur.codeIntro")}</p>
      <form className="mt-6" onSubmit={verifier}>
        <label className="label block">
          {t("lecteur.email")}
          <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <label className="label mt-4 block">
          {t("lecteur.code")}
          <input required inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} pattern="[0-9]{6,8}" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="border-line bg-background mt-1 block w-full border px-3 py-3 text-[24px] tracking-[0.2em] tabular-nums" />
        </label>
        <button type="submit" disabled={busy || code.length < 6} className={primary}>{busy ? "…" : t("lecteur.verify")}</button>
        {err && <p className="label mt-3" role="alert">{err}</p>}
      </form>
      {expire && (
        <div className="mt-6">
          <button type="button" className="label touch border-line border px-4 py-3" disabled={busy || !email.trim()} onClick={() => void nouveauLien()}>
            {t("lecteur.newLink")}
          </button>
          {info && <p className="body-text mt-3">{info}</p>}
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Espace lecteur                                                       */
/* ------------------------------------------------------------------ */

type Espace = Awaited<ReturnType<typeof monEspace>>;

export function EspacePage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const lire = useServerFn(monEspace);
  const lien = useServerFn(lienConnexion);
  const regler = useServerFn(regleNouveautes);
  const supprimer = useServerFn(supprimerMonCompte);
  const msgOf = useMessage();
  const [session, setSession] = useState<boolean | null>(null);
  const [d, setD] = useState<Espace | null>(null);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [ouvrirSuppr, setOuvrirSuppr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function charger() {
    try {
      setD(await lire());
    } catch {
      setSession(false);
    }
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(Boolean(data.session));
      if (data.session) void charger();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deconnecter(message: string | null = null) {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setD(null);
    setSession(false);
    setInfo(message);
  }

  if (session === null) return <main className="mx-auto w-full max-w-xl px-4 py-12"><p>…</p></main>;

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <h1 className="text-[28px]">{t("page.espace_lecteur")}</h1>
        {info && <p className="body-text mt-4" role="status">{info}</p>}
        <form className="mt-6" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try { setInfo(msgOf((await lien({ data: { email, editionId: null } })).result)); } catch { setInfo(t("lecteur.error")); } finally { setBusy(false); }
        }}>
          <label className="label block">
            {t("lecteur.email")}
            <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <button type="submit" disabled={busy || !email.trim()} className={primary}>{busy ? "…" : t("lecteur.sendLink")}</button>
        </form>
        <SiteLink page="activation" className={lienCls}>{t("lecteur.iHaveCode")}</SiteLink>
      </main>
    );
  }

  if (!d) return <main className="mx-auto w-full max-w-xl px-4 py-12"><p>…</p></main>;
  const ici = d.livres.filter((l) => l.lang === lang);
  const ailleurs = d.livres.some((l) => l.lang !== lang);
  const host = typeof window !== "undefined" ? window.location.host : "";

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-[28px]">{t("lecteur.myBooks")}</h1>
      {ici.length === 0 ? <p className="body-text text-secondary-text mt-4">{t("lecteur.noBooks")}</p> : (
        <ul className="mt-6 grid gap-4">
          {ici.map((l) => (
            <li key={l.slug}>
              <SiteLink page="compagnon" params={{ slug: l.slug }} className="flex items-center gap-4">
                {l.coverUrl ? <img src={l.coverUrl} alt="" className="border-line h-20 w-14 border object-cover" /> : <span className="border-line inline-block h-20 w-14 border border-dashed" />}
                <span className="body-text underline">{l.title ?? l.slug}</span>
              </SiteLink>
            </li>
          ))}
        </ul>
      )}
      {ailleurs && <p className="body-text mt-4"><a className="underline" href={otherLangHref("espace_lecteur", lang, {}, host)}>{t("lecteur.otherDomain")}</a></p>}

      {d.isReader && (
        <label className="body-text mt-10 flex items-center gap-3">
          <input type="checkbox" checked={d.news} onChange={async (e) => { const on = e.target.checked; setD({ ...d, news: on }); await regler({ data: { on } }); }} />
          <span>{t("lecteur.news")}</span>
        </label>
      )}

      <div className="border-line mt-10 border-t pt-6">
        {!ouvrirSuppr ? (
          <button type="button" className="label underline" onClick={() => setOuvrirSuppr(true)}>{t("lecteur.delete")}</button>
        ) : d.isStaff ? (
          <p className="body-text" role="alert">{t("lecteur.deleteStaff")}</p>
        ) : (
          <div>
            <p className="body-text">{t("lecteur.deleteConfirm")}</p>
            <input aria-label={t("lecteur.deleteWord")} className={input} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            <button type="button" className={primary} disabled={busy || confirmation.trim() !== t("lecteur.deleteWord")} onClick={async () => {
              setBusy(true);
              try {
                const r = await supprimer({ data: { confirmation: t("lecteur.deleteWord") as "SUPPRIMER" | "DELETE" } });
                if (r.result === "staff") setInfo(t("lecteur.deleteStaff"));
                else await deconnecter(t("lecteur.deleted"));
              } catch { setInfo(t("lecteur.error")); } finally { setBusy(false); }
            }}>{t("lecteur.delete")}</button>
          </div>
        )}
        {info && <p className="body-text mt-3">{info}</p>}
        <div className="mt-6"><button type="button" className="label underline" onClick={() => void deconnecter()}>{t("lecteur.signOut")}</button></div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Désinscription                                                       */
/* ------------------------------------------------------------------ */

export function DesinscriptionPage() {
  const { t } = useI18n();
  const run = useServerFn(desinscrire);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t") ?? "";
    if (!token) return setOk(false);
    run({ data: { token } }).then((r) => setOk(r.ok)).catch(() => setOk(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-[28px]">{t("page.desinscription")}</h1>
      {ok !== null && <p className="body-text mt-4" data-unsub={ok ? "ok" : "bad"}>{ok ? t("lecteur.unsubDone") : t("lecteur.unsubBad")}</p>}
    </main>
  );
}
