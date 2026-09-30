import type { VBlock } from "@/lib/vitrine.data";
import { ZoomImage } from "./ZoomImage";

export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p.trim()}</p>
      ))}
    </div>
  );
}

/** Affiche des blocs de contenu selon leur type. `firstTitleH1` : le premier titre devient h1. */
export function Blocks({ blocks, firstTitleH1 = false, h1ClassName }: { blocks: VBlock[]; firstTitleH1?: boolean; h1ClassName?: string }) {
  const firstTitle = firstTitleH1 ? blocks.find((b) => b.kind === "titre" && b.title)?.id : undefined;
  if (!blocks.length) return null;
  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <div key={b.id} className={b.hidden ? "outline-line outline-1 outline-offset-4 outline-dashed" : ""}>
          <Block b={b} h1={b.id === firstTitle} h1ClassName={h1ClassName} />
        </div>
      ))}
    </div>
  );
}

function Block({ b, h1, h1ClassName }: { b: VBlock; h1: boolean; h1ClassName?: string }) {
  switch (b.kind) {
    case "titre":
      if (!b.title) return null;
      return h1 ? <h1 className={h1ClassName ?? "text-[34px] sm:text-[40px]"}>{b.title}</h1> : <h2 className="text-[26px]">{b.title}</h2>;
    case "texte":
      return b.body ? <Paragraphs text={b.body} /> : null;
    case "etapes":
      return (
        <ol className="space-y-4">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-4">
              <span className="label text-secondary-text min-w-6 pt-1">{it["numero"] || i + 1}</span>
              <div>
                {it["titre"] && <p className="font-medium">{it["titre"]}</p>}
                {it["texte"] && <Paragraphs text={it["texte"]} className="text-secondary-text" />}
              </div>
            </li>
          ))}
        </ol>
      );
    case "faq":
      return (
        <div className="border-line divide-line divide-y border-y">
          {b.items.map((it, i) => (
            <details key={i} className="py-3">
              <summary className="cursor-pointer font-bold">{it["question"]}</summary>
              {it["reponse"] && <Paragraphs text={it["reponse"]} className="mt-2" />}
            </details>
          ))}
        </div>
      );
    case "citation":
      return b.body ? (
        <figure className="border-foreground border-l-2 pl-4">
          <blockquote className="text-[20px] italic">
            <Paragraphs text={b.body} />
          </blockquote>
          {b.title && <figcaption className="label text-secondary-text mt-2">{b.title}</figcaption>}
        </figure>
      ) : null;
    case "chiffres":
      return (
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {b.items.map((it, i) => (
            <div key={i}>
              <dt className="text-[32px] leading-none">{it["valeur"]}</dt>
              <dd className="text-secondary-text mt-1">{it["libelle"]}</dd>
            </div>
          ))}
        </dl>
      );
    case "image":
      return b.imageUrl ? (
        <figure>
          <ZoomImage src={b.imageUrl} alt={b.title ?? b.body ?? "Ulpan Story"} className="border-line border" />
          {(b.title || b.body) && <figcaption className="text-secondary-text mt-2 text-[15px]">{b.title ?? b.body}</figcaption>}
        </figure>
      ) : null;
    default:
      return null;
  }
}
