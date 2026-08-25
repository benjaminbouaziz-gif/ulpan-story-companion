import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  BlockKind,
  BookPage,
  GlossaryWord,
  PageBlock,
  PageKey,
  PageSupportKind,
} from "./book-page";
import type { GlossaryItem, SpreadParagraph, SupportKind } from "./spread";


/** Client de lecture publique : les politiques RLS anon s'appliquent. */
export function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type SpreadRow = Database["public"]["Tables"]["spread_paragraphs"]["Row"];
type GlossaryRow = Database["public"]["Tables"]["glossary_entries"]["Row"];

export function toSpreadParagraph(row: SpreadRow): SpreadParagraph {
  return {
    id: row.id,
    sort_order: row.sort_order,
    stage_no: row.stage_no,
    he: row.he,
    he_has_nikud: row.he_has_nikud,
    support_kind: row.support_kind as SupportKind,
    support_fr: row.support_fr,
    support_en: row.support_en,
    support_he: row.support_he,
  };
}

export function toGlossaryItem(row: GlossaryRow): GlossaryItem {
  return {
    id: row.id,
    sort_order: row.sort_order,
    lemma_he: row.lemma_he,
    sense_fr: row.sense_fr,
    sense_en: row.sense_en,
  };
}

type PageRow = Database["public"]["Tables"]["book_pages"]["Row"];
type BlockRow = Database["public"]["Tables"]["page_blocks"]["Row"];
type KeyRow = Database["public"]["Tables"]["page_keys"]["Row"];

export function toPageBlock(row: BlockRow): PageBlock {
  return {
    id: row.id,
    sort_order: row.sort_order,
    block_kind: row.block_kind as BlockKind,
    he_nikud: row.he_nikud,
    he_plain: row.he_plain,
    support_fr: row.support_fr,
    support_en: row.support_en,
  };
}

export function toPageKey(row: KeyRow): PageKey {
  return {
    id: row.id,
    sort_order: row.sort_order,
    gloss_no: row.gloss_no,
    he_nikud: row.he_nikud,
    translit: row.translit,
    sense_fr: row.sense_fr,
    sense_en: row.sense_en,
  };
}

/** Une page et ses blocs : la page seule ne veut rien dire. */
export function toBookPage(row: PageRow, blocks: BlockRow[], keys: KeyRow[]): BookPage {
  return {
    id: row.id,
    page_no: row.page_no,
    chapter_no: row.chapter_no,
    support_kind: row.support_kind as PageSupportKind,
    chapter_title_he: row.chapter_title_he,
    chapter_title_fr: row.chapter_title_fr,
    chapter_title_en: row.chapter_title_en,
    running_head_fr: row.running_head_fr,
    running_head_en: row.running_head_en,
    folio: row.folio,
    is_published: row.is_published,
    validated_at: row.validated_at,
    blocks: blocks
      .filter((b) => b.page_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toPageBlock),
    keys: keys
      .filter((k) => k.page_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toPageKey),
  };
}

export function toGlossaryWord(row: GlossaryRow): GlossaryWord {
  return {
    id: row.id,
    gloss_no: row.gloss_no,
    he_nikud: row.he_nikud ?? row.lemma_he,
    translit: row.translit,
    sense_fr: row.sense_fr,
    sense_en: row.sense_en,
    first_page: row.first_page,
  };
}

/**
 * Les pages publiées d'un livre, dans l'ordre du livre. Une seule requête par
 * table : les blocs et les clés sont répartis ensuite.
 */
export async function loadBookPages(
  supabase: ReturnType<typeof publicClient>,
  bookId: string,
): Promise<BookPage[]> {
  const { data: pageRows } = await supabase
    .from("book_pages")
    .select("*")
    .eq("book_id", bookId)
    .eq("is_published", true)
    .order("page_no", { ascending: true });
  const pages = (pageRows ?? []) as PageRow[];
  if (pages.length === 0) return [];
  const ids = pages.map((p) => p.id);
  const [{ data: blocks }, { data: keys }] = await Promise.all([
    supabase.from("page_blocks").select("*").in("page_id", ids),
    supabase.from("page_keys").select("*").in("page_id", ids),
  ]);
  return pages.map((p) => toBookPage(p, (blocks ?? []) as BlockRow[], (keys ?? []) as KeyRow[]));
}

/** Le glossaire du livre, numéroté : c'est lui que les trous appellent. */
export async function loadGlossaryWords(
  supabase: ReturnType<typeof publicClient>,
  bookId: string,
): Promise<GlossaryWord[]> {
  const { data } = await supabase
    .from("glossary_entries")
    .select("*")
    .eq("book_id", bookId)
    .order("gloss_no", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  return ((data ?? []) as GlossaryRow[]).map(toGlossaryWord);
}
