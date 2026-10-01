import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { I18nProvider } from "@/i18n/context";
import { detectLang } from "@/i18n/lang.functions";
import type { Lang } from "@/i18n/dictionaries";
import { redirectTarget, type PageId } from "@/i18n/routes";
import { getFooterTagline, getStripeColors } from "@/lib/site.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ErrorPage, NotFoundPage } from "@/pages/SystemPages";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    pageId?: PageId;
  }
}

function NotFoundComponent() {
  return <NotFoundPage />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return <ErrorPage reset={reset} />;
}

// Côté navigateur, la langue de la session est gardée entre deux navigations.
let clientLang: Lang | null = null;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const query = new URLSearchParams(location.searchStr).get("lang") ?? undefined;
    let lang: Lang;
    if (typeof window !== "undefined" && clientLang && !query) {
      lang = clientLang;
    } else {
      lang = await detectLang({ data: { query } });
      if (typeof window !== "undefined") clientLang = lang;
    }
    const target = redirectTarget(location.pathname, lang);
    if (target) {
      throw redirect({ href: target + (location.searchStr ?? ""), statusCode: 301 });
    }
    return { lang };
  },
  loader: async ({ context }) => {
    const [tagline, stripe] = await Promise.all([
      getFooterTagline({ data: { lang: context.lang } }),
      getStripeColors({ data: { lang: context.lang } }),
    ]);
    return { lang: context.lang, tagline, stripe };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F3F1EA" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { lang } = Route.useRouteContext();
  return (
    <html lang={lang ?? "fr"}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, lang } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { pathname } = useLocation();
  // L'admin a sa propre enveloppe : pas d'en-tête ni de pied du site public.
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider lang={lang}>
        <div className="bg-background text-foreground flex min-h-screen flex-col">
          {!isAdmin && <SiteHeader stripe={data?.stripe ?? []} />}
          <div className="flex-1">
            {/* Required: nested routes render here. */}
            <Outlet />
          </div>
          {!isAdmin && <SiteFooter tagline={data?.tagline ?? null} stripe={data?.stripe ?? []} />}
        </div>
      </I18nProvider>
    </QueryClientProvider>
  );
}
