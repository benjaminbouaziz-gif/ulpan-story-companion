import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hashText, translateFields } from "./translate.server";

type Row = Record<string, unknown>;
type Client = SupabaseClient<Database>;

/** Les clés de data qui portent une paire _fr / _en traduisible. */
const DATA_PAIRS = ["label", "body", "q", "a", "title"] as const;

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * L'état de chaque champ anglais : vide, auto, corrigé à la main, ou à
 * retraduire parce que le français a bougé depuis la dernière traduction.
 */
export async function sectionFieldStatus(row: Row): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const field of ["title", "body"]) {
    const fr = s(row[`${field}_fr`]);
    const en = s(row[`${field}_en`]);
    const source = s(row[`${field}_en_source`]);
    const hash = s(row[`${field}_en_hash`]);
    if (!fr.trim()) out[field] = "none";
    else if (!en.trim()) out[field] = "empty";
    else if (hash && hash !== (await hashText(fr)))
      out[field] = source === "human" ? "stale_human" : "stale";
    else out[field] = source === "human" ? "human" : "auto";
  }
  return out;
}

/**
 * À l'enregistrement : tout anglais vide ou marqué auto dont le français a
 * changé est retraduit. Un anglais « human » n'est jamais écrasé.
 */
export async function autoEnglishPatch(
  supabase: Client,
  userId: string,
  current: Row,
  next: { title_fr: string | null; title_en: string | null; body_fr: string | null; body_en: string | null; data: unknown },
): Promise<{ patch: Record<string, unknown>; error: string | null }> {
  const target = next as unknown as Record<string, unknown>;
  const jobs: { field: string; fr: string }[] = [];
  for (const field of ["title", "body"] as const) {
    const fr = s(target[`${field}_fr`]);
    const en = s(target[`${field}_en`]);
    const source = s(current[`${field}_en_source`]);
    if (!fr.trim()) continue;
    if (source === "human") continue;
    const hash = s(current[`${field}_en_hash`]);
    if (en.trim() && hash === (await hashText(fr))) continue;
    jobs.push({ field, fr });
  }
  if (jobs.length === 0) return { patch: {}, error: null };
  const run = await translateFields(supabase, jobs, {
    kind: "translate_field",
    entity: "page_section",
    entity_id: (current["id"] as string) ?? null,
    created_by: userId,
  });
  const patch: Record<string, unknown> = {};
  for (const r of run.results) {
    patch[`${r.field}_en`] = r.en;
    patch[`${r.field}_en_source`] = "auto";
    patch[`${r.field}_en_hash`] = await hashText(s(target[`${r.field}_fr`]));
  }
  return { patch, error: run.error };
}

/**
 * Traduit les libellés à l'intérieur de data : chiffres du bloc facts,
 * questions de FAQ, étapes. L'hébreu et les soutiens n'y passent jamais.
 */
export async function translateDataObject(
  supabase: Client,
  userId: string,
  sectionId: string,
  data: unknown,
  force: boolean,
): Promise<{ data: unknown; changed: boolean; count: number; error: string | null }> {
  if (!data || typeof data !== "object")
    return { data, changed: false, count: 0, error: null };
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const jobs: { field: string; fr: string }[] = [];
  const targets: { holder: Record<string, unknown>; key: string }[] = [];

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    for (const pair of DATA_PAIRS) {
      const fr = s(obj[`${pair}_fr`]);
      const en = s(obj[`${pair}_en`]);
      if (!fr.trim()) continue;
      if (en.trim() && !force) continue;
      targets.push({ holder: obj, key: `${pair}_en` });
      jobs.push({ field: `${targets.length - 1}`, fr });
    }
    Object.values(obj).forEach(visit);
  };
  visit(clone);

  if (jobs.length === 0) return { data: clone, changed: false, count: 0, error: null };
  const run = await translateFields(supabase, jobs, {
    kind: "translate_data",
    entity: "page_section",
    entity_id: sectionId,
    created_by: userId,
  });
  for (const r of run.results) {
    const target = targets[Number(r.field)];
    if (target) target.holder[target.key] = r.en;
  }
  return {
    data: clone,
    changed: run.results.length > 0,
    count: run.results.length,
    error: run.error,
  };
}
