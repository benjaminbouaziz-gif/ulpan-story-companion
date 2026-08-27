import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";

/** Mon compte : l'adresse en clair, et le changement de mot de passe. */
export const Route = createFileRoute("/admin/compte")({
  head: () => ({
    meta: [
      { title: "Mon compte — Administration Ulpan Story" },
      { name: "description", content: "Compte d'administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAccount,
});

function AdminAccount() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "error" | "short">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setState("short");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      ...(current ? ({ current_password: current } as { current_password: string }) : {}),
    });
    setBusy(false);
    setState(error ? "error" : "ok");
    if (!error) {
      setCurrent("");
      setNext("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/connexion", replace: true });
  }

  return (
    <PageShell>
      <Link to="/admin" className="label touch inline-flex border-b border-current">
        {t("admin.title")}
      </Link>
      <h1 className="mt-4 text-[30px]">{t("admin.account")}</h1>
      <p className="body-text text-secondary-text mt-2">{email ?? "…"}</p>

      <form onSubmit={submit} className="border-line mt-6 max-w-md border-t pt-6">
        <label className="label block">
          {t("admin.currentPassword")}
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="border-line bg-background body-text mt-1 block w-full border px-3 py-2"
          />
        </label>
        <label className="label mt-4 block">
          {t("admin.newPassword")}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="border-line bg-background body-text mt-1 block w-full border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="label touch bg-foreground text-background mt-6 w-full disabled:opacity-40"
        >
          {busy ? "…" : t("admin.changePassword")}
        </button>
        {state === "ok" ? <p className="label mt-3">{t("admin.passwordChanged")}</p> : null}
        {state === "error" ? <p className="label mt-3">{t("admin.passwordError")}</p> : null}
        {state === "short" ? <p className="label mt-3">{t("admin.passwordTooShort")}</p> : null}
      </form>

      <button
        type="button"
        onClick={signOut}
        className="label touch border-line mt-8 border px-3"
      >
        {t("admin.signOut")}
      </button>
    </PageShell>
  );
}
