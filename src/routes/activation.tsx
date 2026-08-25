import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { QR_KEY } from "@/components/AccessForm";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { confirmAccess } from "@/lib/access.functions";

export const Route = createFileRoute("/activation")({
  head: () => ({
    meta: [
      { title: "Activation — Ulpan Story" },
      {
        name: "description",
        content:
          "Ouvrez les contenus offerts avec votre livre : lien reçu par email ou code à six chiffres.",
      },
      { property: "og:title", content: "Activation — Ulpan Story" },
      { property: "og:description", content: "Lien par email ou code à six chiffres." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivationPage,
});

function ActivationPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const confirm = useServerFn(confirmAccess);
  const [state, setState] = useState<"idle" | "opening" | "done">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setState("opening");
    const qr = window.localStorage.getItem(QR_KEY);
    try {
      const r = await confirm({ data: { qr_code: qr } });
      setState("done");
      if (r.bookSlug) {
        void navigate({ to: "/compagnon/$book_slug", params: { book_slug: r.bookSlug } });
      } else {
        void navigate({ to: "/compagnon" });
      }
    } catch {
      // Session absente ou expirée : on revient au code à six chiffres.
      setState("idle");
      setError(t("access.codeError"));
    }
  };

  // Retour du lien magique : la session est déjà posée par le client.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      // On s'assure que le jeton est encore valide avant d'appeler le serveur.
      const { data: user } = await supabase.auth.getUser();
      if (!cancelled && user.user) void finish();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const codeMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      if (err) throw err;
      await finish();
    },
    onError: () => setError(t("access.codeError")),
  });

  if (state !== "idle") {
    return (
      <PageShell>
        <p className="body-text">{state === "opening" ? t("access.opening") : t("access.opened")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-[28px]">{t("access.codeTitle")}</h1>
      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim() && code.trim().length >= 6) codeMutation.mutate();
        }}
      >
        <label className="label block">
          {t("access.email")}
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-line bg-background body-text mt-1 block w-full border px-3 py-3"
          />
        </label>
        <label className="label mt-4 block">
          {t("access.code")}
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="border-line bg-background mt-1 block w-full border px-3 py-3 text-[24px] tracking-[0.2em] tabular-nums"
          />
        </label>
        <button
          type="submit"
          disabled={codeMutation.isPending}
          className="label touch bg-foreground text-background mt-6 w-full disabled:opacity-40"
        >
          {codeMutation.isPending ? "…" : t("access.verify")}
        </button>
        {error ? <p className="label mt-3">{error}</p> : null}
      </form>
    </PageShell>
  );
}
