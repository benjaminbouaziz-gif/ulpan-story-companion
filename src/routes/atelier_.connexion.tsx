import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { adminSignIn } from "@/lib/admin-auth.functions";

/**
 * La porte de l'atelier : deux champs, un bouton. Le message d'erreur est le
 * même que l'adresse soit inconnue ou le mot de passe faux. Aucune inscription :
 * les comptes et les rôles sont créés à la main, en base.
 */
export const Route = createFileRoute("/atelier_/connexion")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Connexion — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: AtelierSignIn,
});

function AtelierSignIn() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const allowed = useServerFn(adminLoginAllowed);
  const failed = useServerFn(adminLoginFailed);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const gate = await allowed({ data: { email } });
      if (!gate.allowed) {
        setError(t("atelier.tooManyAttempts"));
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        await failed({ data: { email } });
        setError(t("atelier.signInError"));
        return;
      }
      navigate({ to: "/atelier", replace: true });
    } catch {
      setError(t("atelier.signInError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="atelier flex min-h-[100dvh] items-center justify-center p-8">
      <form onSubmit={submit} className="border-line w-full max-w-[360px] rounded-[2px] border p-6">
        <h1 className="font-latin text-[20px]">{t("atelier.signIn")}</h1>
        <label className="mt-5 block text-[13px]">
          {t("atelier.email")}
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-line bg-background mt-1 block w-full rounded-[2px] border px-3 py-2 text-[14px]"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          {t("atelier.password")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-line bg-background mt-1 block w-full rounded-[2px] border px-3 py-2 text-[14px]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="bg-foreground text-background mt-6 w-full rounded-[2px] py-2 text-[14px] disabled:opacity-40"
        >
          {busy ? "…" : t("atelier.submit")}
        </button>
        {error ? <p className="mt-3 text-[13px]">{error}</p> : null}
      </form>
    </div>
  );
}
