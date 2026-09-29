import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { btnPrimaryCls, inputCls } from "@/admin/ui";

/** Réglages : changer son propre mot de passe (dans le navigateur, pour l'utilisateur connecté). */
export const Route = createFileRoute("/admin/reglages")({
  component: Reglages,
});

function Reglages() {
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
    if (next.length < 8) return setState("short");
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
      navigate({ to: "/admin/connexion", replace: true });
    }
  }

  return (
    <div>
      <h1 className="text-[26px]">Réglages</h1>
      <h2 className="label mt-6">Mon compte</h2>
      <p className="mt-1 text-[14px]">{email ?? "…"}</p>
      <form onSubmit={submit} className="border-line mt-5 max-w-[360px] border-t pt-5">
        <label className="block text-[13px]">
          Mot de passe actuel
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="mt-4 block text-[13px]">
          Nouveau mot de passe
          <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <button type="submit" disabled={busy} className={`${btnPrimaryCls} mt-5 w-full py-2`}>
          {busy ? "…" : "Changer le mot de passe"}
        </button>
        {state === "error" ? <p className="mt-3 text-[13px]">Le mot de passe n'a pas pu être changé. Vérifiez le mot de passe actuel.</p> : null}
        {state === "short" ? <p className="mt-3 text-[13px]">Le nouveau mot de passe doit faire au moins 8 caractères.</p> : null}
      </form>
    </div>
  );
}
