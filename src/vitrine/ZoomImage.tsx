import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";

const MAX = 5;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Image cliquable qui s'ouvre en plein écran sur fond sombre.
 * Zoom : deux doigts, double-toucher / double-clic, molette. Déplacement de
 * l'image zoomée. Fermeture : croix, Échap, ou glissé vers le bas au doigt.
 */
export function ZoomImage({ src, alt, className = "", imgClassName = "" }: { src: string; alt: string; className?: string; imgClassName?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`block w-full cursor-zoom-in ${className}`} onClick={() => setOpen(true)} aria-label={`${t("vitrine.zoomOpen")} : ${alt}`}>
        <img src={src} alt={alt} loading="lazy" className={`block h-auto w-full ${imgClassName}`} />
      </button>
      {open && <Viewer src={src} alt={alt} onClose={() => setOpen(false)} closeLabel={t("vitrine.zoomClose")} />}
    </>
  );
}

function Viewer({ src, alt, onClose, closeLabel }: { src: string; alt: string; onClose: () => void; closeLabel: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [drop, setDrop] = useState(0); // glissé vers le bas (non zoomé)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number; mid: { x: number; y: number }; pos: { x: number; y: number } } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // État courant lu par les gestionnaires (évite les valeurs périmées pendant un geste).
  const cur = useRef({ scale: 1, pos: { x: 0, y: 0 } });
  cur.current = { scale, pos };
  const last = useRef<{ x: number; y: number; type: string } | null>(null);
  const lastTap = useRef(0);
  const lastType = useRef("mouse");
  const closeRef = useRef<HTMLButtonElement>(null);

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  /**
   * Zoom ancré : l'image est centrée dans le cadre (origine de transformation au
   * centre C). Un point écran p vaut C + pos + s·(q − C). Pour que le point qui
   * était sous `from` (à l'échelle s0, décalage pos0) se retrouve sous `to` à
   * l'échelle s : pos = (to − C) − (s / s0)·(from − C − pos0).
   */
  const zoomAt = (s: number, from: { x: number; y: number }, to: { x: number; y: number }, s0: number, pos0: { x: number; y: number }) => {
    if (s <= 1) { reset(); return; }
    const r = boxRef.current?.getBoundingClientRect();
    const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    const k = s / s0;
    setScale(s);
    setPos({ x: to.x - cx - k * (from.x - cx - pos0.x), y: to.y - cy - k * (from.y - cy - pos0.y) });
  };
  const toggleZoom = (at: { x: number; y: number }) => {
    const { scale: s0, pos: p0 } = cur.current;
    if (s0 > 1) reset();
    else zoomAt(2.5, at, at, s0, p0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    lastType.current = e.pointerType;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: cur.current.scale, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pos: cur.current.pos };
      last.current = null;
    } else {
      last.current = { x: e.clientX, y: e.clientY, type: e.pointerType };
      if (e.pointerType === "touch") {
        const now = Date.now();
        if (now - lastTap.current < 300) toggleZoom({ x: e.clientX, y: e.clientY });
        lastTap.current = now;
      }
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const s = clamp((pinch.current.scale * d) / pinch.current.dist, 1, MAX);
      // Le point entre les doigts au début du geste suit le milieu actuel des doigts.
      zoomAt(s, pinch.current.mid, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pinch.current.scale, pinch.current.pos);
      return;
    }
    const l = last.current;
    if (!l) return;
    const dx = e.clientX - l.x;
    const dy = e.clientY - l.y;
    last.current = { ...l, x: e.clientX, y: e.clientY };
    if (cur.current.scale > 1) setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
    else if (l.type === "touch") setDrop((v) => Math.max(0, v + dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // Un doigt reste posé après le pincement : il reprend le déplacement depuis sa position.
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      last.current = { x: p!.x, y: p!.y, type: "touch" };
    }
    if (pointers.current.size === 0) {
      last.current = null;
      if (drop > 120) onClose();
      else setDrop(0);
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const { scale: s0, pos: p0 } = cur.current;
    const s = clamp(s0 * Math.exp(-dy * 0.0015), 1, MAX);
    const at = { x: e.clientX, y: e.clientY };
    zoomAt(s, at, at, s0, p0);
  };

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="bg-night fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ touchAction: "none", opacity: drop ? Math.max(0.3, 1 - drop / 400) : 1 }}
      onWheel={onWheel}
    >
      <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} className="text-night-ink absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center text-[28px] leading-none">
        ×
      </button>
      <img
        src={src}
        alt={alt}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { if (lastType.current !== "touch") toggleZoom({ x: e.clientX, y: e.clientY }); }}
        className="max-h-full max-w-full select-none"
        style={{ transform: `translate(${pos.x}px, ${pos.y + drop}px) scale(${scale})`, cursor: scale > 1 ? "grab" : "zoom-in", transition: pointers.current.size ? "none" : "transform 120ms" }}
      />
    </div>
  );
}
