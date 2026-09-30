import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";

const MAX = 5;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type ZoomItem = { src: string; alt: string; label: string };

/**
 * Image cliquable qui s'ouvre en plein écran sur le fond du site.
 * Zoom : deux doigts, double-toucher / double-clic, molette. Déplacement de
 * l'image zoomée. Fermeture : croix, Échap, ou glissé vers le bas au doigt.
 * `gallery` : plusieurs images (étapes de la Méthode) parcourues sans fermer.
 */
export function ZoomImage({ src, alt, className = "", imgClassName = "", gallery }: { src: string; alt: string; className?: string; imgClassName?: string; gallery?: { items: ZoomItem[]; index: number; onIndex?: (i: number) => void } }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`block w-full cursor-zoom-in ${className}`} onClick={() => setOpen(true)} aria-label={`${t("vitrine.zoomOpen")} : ${alt}`}>
        <img src={src} alt={alt} loading="lazy" className={`block h-auto w-full ${imgClassName}`} />
      </button>
      {open && <Viewer items={gallery?.items ?? [{ src, alt, label: alt }]} start={gallery?.index ?? 0} multi={!!gallery && gallery.items.length > 1} onIndex={gallery?.onIndex} onClose={() => setOpen(false)} />}
    </>
  );
}

function Viewer({ items, start, multi, onIndex, onClose }: { items: ZoomItem[]; start: number; multi: boolean; onIndex?: (i: number) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(Math.min(start, items.length - 1));
  const item = items[idx]!;
  const { src, alt } = item;
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [portrait, setPortrait] = useState(false);
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
  const goRef = useRef<(d: number) => void>(() => {});

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= items.length) return;
    setIdx(i); setNat(null); setScale(1); setPos({ x: 0, y: 0 }); onIndex?.(i);
  }, [items.length, onIndex]);
  goRef.current = (d: number) => goTo(idx + d);

  // Taille de la zone disponible : l'image y est ajustée, agrandie si besoin.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setArea({ w: Math.max(0, w), h: Math.max(0, h) });
      setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const fit = nat && area ? Math.min(area.w / nat.w, area.h / nat.h) : 0;
  const showRotate = portrait && !!nat && nat.w > nat.h;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (multi && e.key === "ArrowRight") goRef.current(1);
      else if (multi && e.key === "ArrowLeft") goRef.current(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose, multi]);

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

  const arrowCls = "text-foreground bg-background/80 border-line absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border text-[24px] leading-none disabled:opacity-30";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="bg-background text-foreground fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ touchAction: "none", opacity: drop ? Math.max(0.3, 1 - drop / 400) : 1 }}
      onWheel={onWheel}
    >
      <div className="flex min-h-14 shrink-0 items-center gap-3 px-4 sm:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-5">
          {multi && items.map((it, i) => (
            <button key={i} type="button" onClick={() => goTo(i)} aria-current={i === idx}
              className={`label touch border-b-2 py-2 ${i === idx ? "border-current" : "text-secondary-text border-transparent"}`}>
              {it.label}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={t("vitrine.zoomClose")} className="text-foreground flex h-11 w-11 shrink-0 items-center justify-center text-[28px] leading-none">
          ×
        </button>
      </div>
      <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
        {multi && <button type="button" className={`${arrowCls} left-1 sm:left-2`} disabled={idx === 0} onClick={() => goTo(idx - 1)} aria-label={t("vitrine.zoomPrev")}>‹</button>}
        {multi && <button type="button" className={`${arrowCls} right-1 sm:right-2`} disabled={idx === items.length - 1} onClick={() => goTo(idx + 1)} aria-label={t("vitrine.zoomNext")}>›</button>}
        <img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => { if (lastType.current !== "touch") toggleZoom({ x: e.clientX, y: e.clientY }); }}
          className="border-line max-w-none border shadow-[0_2px_14px_rgba(0,0,0,0.12)] select-none"
          style={{
            width: fit ? nat!.w * fit : undefined,
            height: fit ? nat!.h * fit : undefined,
            visibility: fit ? "visible" : "hidden",
            transform: `translate(${pos.x}px, ${pos.y + drop}px) scale(${scale})`,
            cursor: scale > 1 ? "grab" : "zoom-in",
            transition: pointers.current.size ? "none" : "transform 120ms",
          }}
        />
      </div>
      {showRotate && <p className="text-secondary-text shrink-0 px-4 pb-4 text-center text-[13px]">{t("vitrine.zoomRotate")}</p>}
    </div>
  );
}
