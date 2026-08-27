import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/integrations/supabase/client";

/** Réglages : pour l'instant, seulement « Mon compte » — l'adresse en clair et
 *  le changement de mot de passe, déplacés ici depuis l'ancienne administration. */
export const Route = createFileRoute("/atelier/reglages")({
  head: () => ({
    meta: [{ title: "Réglages — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsRoom,
});

function SettingsRoom() {
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
      await supabase.auth.signOut();
      navigate({ to: "/atelier/connexion", replace: true });
    }
  }

  return (
    <Room titleKey="atelier.room.settings" descKey="atelier.room.settings.desc">
      <h2 className="font-latin text-[16px]">{t("atelier.settings.account")}</h2>
      <p className="mt-1 text-[13px]">{email ?? "…"}</p>

      <form onSubmit={submit} className="border-line mt-5 max-w-[360px] border-t pt-5">
        <label className="block text-[13px]">
          {t("admin.currentPassword")}
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="border-line bg-background mt-1 block w-full rounded-[2px] border px-3 py-2 text-[14px]"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          {t("admin.newPassword")}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="border-line bg-background mt-1 block w-full rounded-[2px] border px-3 py-2 text-[14px]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="bg-foreground text-background mt-5 w-full rounded-[2px] py-2 text-[14px] disabled:opacity-40"
        >
          {busy ? "…" : t("admin.changePassword")}
        </button>
        {state === "error" ? <p className="mt-3 text-[13px]">{t("admin.passwordError")}</p> : null}
        {state === "short" ? <p className="mt-3 text-[13px]">{t("admin.passwordTooShort")}</p> : null}
      </form>
    </Room>
  );
}
