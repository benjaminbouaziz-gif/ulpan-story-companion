import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import { pathFor, type PageId, type RouteParams } from "@/i18n/routes";

/** Lien interne : le chemin vient toujours de la table des adresses. */
export function SiteLink({
  page,
  params,
  className,
  activeClassName,
  children,
}: {
  page: PageId;
  params?: RouteParams;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const { lang } = useI18n();
  const href = pathFor(page, lang, params);
  const { pathname } = useLocation();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  return (
    // Le chemin est calculé par pathFor à partir de la table des adresses.
    <Link to={href as "/"} className={[className, active ? activeClassName : ""].join(" ")}>
      {children}
    </Link>
  );
}
