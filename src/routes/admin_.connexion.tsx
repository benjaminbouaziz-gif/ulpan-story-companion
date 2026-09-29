import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminSignIn } from "@/lib/admin-auth.functions";
import { btnPrimaryCls, inputCls } from "@/admin/ui";

/** La porte de l'admin : deux champs, un bouton. Aucune inscription. */
export const Route = createFileRoute("/admin_/connexion")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connexion — Admin Ulpan Story" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSignIn,
});

function AdminSignIn() {
  const navigate = useNavigate();
  const signIn = useServerFn(adminSignIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn({ data: { email: email.trim(), password } });
      if (!result.ok) {
        setError(
          result.reason === "throttled"
            ? "Trop de tentatives. Réessayez dans un quart d'heure."
            : result.reason === "interne"
              ? "La connexion est en panne de notre côté. Réessayez plus tard."
              : "Adresse ou mot de passe incorrect.",
        );
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) return setError("La connexion est en panne de notre côté. Réessayez plus tard.");
      navigate({ to: "/admin/livres", replace: true });
    } catch {
      setError("La connexion est en panne de notre côté. Réessayez plus tard.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80dvh] items-center justify-center p-8">
      <form onSubmit={submit} className="border-line w-full max-w-[360px] border p-6">
        <h1 className="text-[20px]">Connexion à l'admin</h1>
        <label className="mt-5 block text-[13px]">
          Adresse e-mail
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="mt-4 block text-[13px]">
          Mot de passe
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <button type="submit" disabled={busy} className={`${btnPrimaryCls} mt-6 w-full py-2`}>
          {busy ? "…" : "Se connecter"}
        </button>
        {error ? <p className="mt-3 text-[13px]">{error}</p> : null}
      </form>
    </div>
  );
}
