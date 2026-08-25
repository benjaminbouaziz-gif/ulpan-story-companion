import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * La traduction français → anglais. Elle vit uniquement côté serveur : la clé
 * n'apparaît jamais dans le navigateur. Chaque passage est journalisé.
 */

export const MODEL = "google/gemini-2.5-flash";

/** Champs dont l'anglais n'est jamais produit automatiquement. */
export const NEVER_AUTO = [
  "spread_paragraphs.support_en",
  "books.excerpt_translation_en",
] as const;

/** Champs traduisibles mais toujours marqués « à relire ». */
export const REVIEW_REQUIRED = ["glossary_entries.sense_en"] as const;

export function isForbidden(field: string): boolean {
  return (NEVER_AUTO as readonly string[]).includes(field);
}

/** Empreinte du français au moment de la traduction. */
export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

const SYSTEM = `You translate French editorial copy into English for Ulpan Story, a publisher of Hebrew learning books.

Tone: adult, sober, factual. No commercial emphasis, no promise of a shortcut, no exclamation marks. The English must never sound more enthusiastic than the French.

Never translate: "Ulpan Story", collection names, proper nouns, any Hebrew character, and the [[ ]] cloze markers (keep them and their contents byte for byte).

Imposed lexicon: "oulpan" -> ulpan; "nekoudot" -> nikud; "hébreu vocalisé" -> vocalized Hebrew; "soutien" -> support (never "help"); "double page" -> spread.

Keep the structure strictly: same paragraphs, same line breaks, same lists, same bold markers, same tags. Add nothing, summarise nothing, explain nothing.

Do not transpose culturally: an English speaker learning Hebrew also attends an ulpan.

Answer with the translation only, no preamble, no quotes around it.`;

export async function translateText(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY manquante.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: trimmed },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Traduction indisponible (${res.status}).`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Traduction vide.");
  return out;
}

export type FieldJob = { field: string; fr: string };
export type FieldResult = { field: string; en: string };

/** Traduit une liste de champs et journalise le passage dans agent_runs. */
export async function translateFields(
  supabase: SupabaseClient<Database>,
  jobs: FieldJob[],
  log: { kind: string; entity: string; entity_id: string | null; created_by: string | null },
): Promise<{ results: FieldResult[]; error: string | null }> {
  const usable = jobs.filter((j) => !isForbidden(j.field) && j.fr.trim().length > 0);
  const results: FieldResult[] = [];
  let error: string | null = null;
  let inputChars = 0;
  let outputChars = 0;
  for (const job of usable) {
    try {
      const en = await translateText(job.fr);
      inputChars += job.fr.length;
      outputChars += en.length;
      results.push({ field: job.field, en });
    } catch (e) {
      error = e instanceof Error ? e.message : "Échec de la traduction.";
      break;
    }
  }
  await supabase.from("agent_runs").insert({
    kind: log.kind,
    entity: log.entity,
    entity_id: log.entity_id,
    model: MODEL,
    fields: results.length,
    input_chars: inputChars,
    output_chars: outputChars,
    // Tarif indicatif du modèle rapide, en dollars par million de caractères.
    cost_usd: Number((((inputChars + outputChars) / 1_000_000) * 0.3).toFixed(6)),
    ok: !error,
    error,
    created_by: log.created_by,
  });
  return { results, error };
}
