import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { adminSignIn } from "@/lib/admin-auth.functions";

/**
 * La connexion de l'éditeur : deux champs, un bouton. Le message d'erreur est
 * le même que l'adresse soit inconnue ou le mot de passe faux. Aucun lien
 * d'inscription : les comptes sont créés à la main.
 */
export const Route = createFileRoute("/admin_/connexion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Administration Ulpan Story" },
      { name: "description", content: "Connexion réservée à l'édition." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSignIn,
});

function AdminSignIn() {
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
        setError(t("admin.tooManyAttempts"));
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        await failed({ data: { email } });
        setError(t("admin.signInError"));
        return;
      }
      navigate({ to: "/admin", replace: true });
    } catch {
      setError(t("admin.signInError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("admin.signIn")}</h1>
      <form onSubmit={submit} className="border-line mt-6 max-w-md border-t pt-6">
        <label className="label block">
          {t("admin.email")}
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-line bg-background body-text mt-1 block w-full border px-3 py-2"
          />
        </label>
        <label className="label mt-4 block">
          {t("admin.password")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-line bg-background body-text mt-1 block w-full border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="label touch bg-foreground text-background mt-6 w-full disabled:opacity-40"
        >
          {busy ? "…" : t("admin.submit")}
        </button>
        {error ? <p className="label mt-3">{error}</p> : null}
      </form>
    </PageShell>
  );
}
