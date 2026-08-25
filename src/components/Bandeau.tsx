import type { ReactNode } from "react";
import { Lamed } from "./Bandeau.lamed";

/**
 * Le bandeau : bande pleine de la couleur de la collection, en bas de bloc,
 * avec le lamed en réserve dedans. Le bandeau s'ouvre pour laisser passer une
 * information, il ne se fait jamais percer : ce qui doit le traverser
 * l'interrompt en ivoire (voir `interruption`).
 */
export function Bandeau({
  color,
  children,
  interruption,
}: {
  color: string;
  children?: ReactNode;
  interruption?: ReactNode;
}) {
  return (
    <div className="w-full" style={{ backgroundColor: color }}>
      <div className="flex items-stretch">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-ivory text-[22px]">
            <Lamed />
          </span>
          {children ? (
            <span className="label text-ivory">{children}</span>
          ) : null}
        </div>
        {interruption ? (
          <>
            {/* Interruption : le bandeau s'arrête, l'ivoire prend la place. */}
            <div className="ml-auto flex items-center bg-ivory px-4 py-3">
              <span className="label text-ink">{interruption}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
