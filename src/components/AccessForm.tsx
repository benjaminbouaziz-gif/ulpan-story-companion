import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n/context";
import { requestAccess } from "@/lib/access.functions";

const QR_KEY = "ulpanstory.qr";

/**
 * La collecte d'email. Une seule action dans la zone du pouce : l'adresse, la
 * case de consentement, le bouton. Le code à six chiffres est le chemin de
 * secours pour le navigateur intégré d'Instagram.
 */
export function AccessForm({ qrCode }: { qrCode: string | null }) {
  const { t, lang } = useI18n();
  const send = useServerFn(requestAccess);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (qrCode) window.localStorage.setItem(QR_KEY, qrCode);
      return send({
        data: {
          email,
          qr_code: qrCode,
          lang,
          consent: true,
          redirect_to: `${window.location.origin}/activation`,
        },
      });
    },
  });

  if (mutation.data?.ok) {
    return (
      <div className="border-line mt-8 border-t pt-6">
        <p className="body-text">{t("access.sent")}</p>
        <Link to="/activation" className="label touch mt-4 inline-flex border-b border-current">
          {t("access.codeLink")}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="border-line mt-8 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (consent && email.trim()) mutation.mutate();
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

      <label className="label mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>{t("access.consent")}</span>
      </label>

      <button
        type="submit"
        disabled={!consent || !email.trim() || mutation.isPending}
        className="label touch bg-foreground text-background mt-6 w-full disabled:opacity-40"
      >
        {mutation.isPending ? "…" : t("access.submit")}
      </button>

      {mutation.data && !mutation.data.ok ? (
        <p className="label mt-3">{t("access.error")}</p>
      ) : null}

      <Link to="/activation" className="label touch mt-4 inline-flex border-b border-current">
        {t("access.codeLink")}
      </Link>
    </form>
  );
}

export { QR_KEY };
