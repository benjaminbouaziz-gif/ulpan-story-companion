import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyserFicheJson, type Fiche, type ProblemeFiche } from "@/lib/fiche-json";

/**
 * ADMIN — dépôt d'une fiche livre JSON. Analyse sans écriture, puis dépôt qui
 * refait TOUTE l'analyse avant d'écrire. Ne touche jamais : visibilité,
 * statut des éditions, images, glossaire, extrait, pages, audio, quiz, clics.
 */
async function editorAdmin(context: { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string }) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  const editor = await assertEditor(context.supabase, context.userId);
  return getAdminClient(editor);
}
type Admin = Awaited<ReturnType<typeof editorAdmin>>;

type Plan = {
  collection: { id: string | null; action: "creer" | "modifier" | "inchangee" };
  livre: { id: string | null; action: "creer" | "modifier"; renommeDepuis: string | null };
  editions: { lang: "fr" | "en"; id: string | null; action: "creer" | "modifier" }[];
};

async function planifier(admin: Admin, f: Fiche): Promise<{ plan: Plan | null; erreurs: ProblemeFiche[] }> {
  const erreurs: ProblemeFiche[] = [];
  const err = (champ: string, probleme: string) => erreurs.push({ champ, langue: null, probleme });

  const { data: col } = await admin.from("collections").select("id").eq("slug", f.livre.collection).maybeSingle();
  if (!col && !f.collection) err("livre.collection", `la collection « ${f.livre.collection} » n'existe pas ; ajoutez un bloc « collection » pour la créer`);
  if (!col) {
    const { data: b } = await admin.from("books").select("id").eq("slug", f.livre.collection).maybeSingle();
    if (b) err("collection.slug", `« ${f.livre.collection} » est déjà le slug d'un livre`);
  }

  const { data: parSlug } = await admin.from("books").select("id, slug, slug_locked_at").eq("slug", f.livre.slug).maybeSingle();
  let book = parSlug;
  let renomme: string | null = null;
  if (f.livre.ancienSlug) {
    const { data: ancien } = await admin.from("books").select("id, slug, slug_locked_at").eq("slug", f.livre.ancienSlug).maybeSingle();
    if (!ancien) err("livre.ancien_slug", `aucun livre n'a le slug « ${f.livre.ancienSlug} »`);
    else if (ancien.slug_locked_at) err("livre.slug", `le slug « ${ancien.slug} » est verrouillé (QR code déjà téléchargé) : le dépôt ne peut pas le modifier`);
    else if (parSlug) err("livre.slug", `« ${f.livre.slug} » est déjà le slug d'un autre livre`);
    else { book = ancien; renomme = ancien.slug; }
  }
  if (!book || renomme) {
    const { data: c } = await admin.from("collections").select("id").eq("slug", f.livre.slug).maybeSingle();
    if (c) err("livre.slug", `« ${f.livre.slug} » est déjà le slug d'une collection`);
  }

  const { data: eds } = book ? await admin.from("book_editions").select("id, lang").eq("book_id", book.id) : { data: [] };
  const plan: Plan = {
    collection: { id: col?.id ?? null, action: col ? (f.collection ? "modifier" : "inchangee") : "creer" },
    livre: { id: book?.id ?? null, action: book ? "modifier" : "creer", renommeDepuis: renomme },
    editions: (["fr", "en"] as const).filter((l) => f.editions[l]).map((l) => {
      const id = eds?.find((e) => e.lang === l)?.id ?? null;
      return { lang: l, id, action: id ? "modifier" : "creer" };
    }),
  };
  return { plan: erreurs.length ? null : plan, erreurs };
}

async function analyseComplete(admin: Admin, contenu: string) {
  const a = analyserFicheJson(contenu);
  if (!a.fiche) return { fiche: null, plan: null, erreurs: a.erreurs };
  const p = await planifier(admin, a.fiche);
  return { fiche: a.fiche, plan: p.plan, erreurs: p.erreurs };
}

const input = z.object({ contenu: z.string().max(2_000_000) });

export const analyserFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const r = await analyseComplete(admin, data.contenu);
    return { erreurs: r.erreurs, plan: r.plan, slug: r.fiche?.livre.slug ?? null };
  });

async function snapshot(admin: Admin, entity: string, id: string, snap: unknown, userId: string) {
  const { error } = await admin.from("content_versions").insert({ entity, entity_id: id, snapshot: snap as never, created_by: userId });
  if (error) throw new Error("SAVE_FAILED");
}

export const deposerFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { fiche: f, plan, erreurs } = await analyseComplete(admin, data.contenu);
    if (!f || !plan || erreurs.length) throw new Error("FICHE_INVALID");
    const resume: string[] = [];

    /* Collection */
    let collectionId = plan.collection.id;
    if (f.collection) {
      const champs: Record<string, unknown> = {};
      if (f.collection.couleur) champs["color_hex"] = f.collection.couleur;
      if (f.collection.ordre != null) champs["sort_order"] = f.collection.ordre;
      if (!collectionId) {
        if (champs["sort_order"] == null) {
          const { data: last } = await admin.from("collections").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
          champs["sort_order"] = (last?.sort_order ?? 0) + 1;
        }
        const { data: row, error } = await admin.from("collections").insert({ slug: f.collection.slug, is_visible: false, ...champs } as never).select("id").single();
        if (error || !row) throw new Error("SAVE_FAILED");
        collectionId = row.id;
        resume.push(`Collection « ${f.collection.slug} » créée (masquée).`);
      } else {
        const [{ data: c }, { data: t }] = await Promise.all([
          admin.from("collections").select("*").eq("id", collectionId).single(),
          admin.from("collection_texts").select("*").eq("collection_id", collectionId),
        ]);
        await snapshot(admin, "collection_fiche", collectionId, { collection: c, textes: t }, context.userId);
        if (Object.keys(champs).length) await admin.from("collections").update(champs as never).eq("id", collectionId);
        resume.push(`Collection « ${f.collection.slug} » modifiée (visibilité inchangée).`);
      }
      const textes = (["fr", "en"] as const).filter((l) => f.collection!.textes[l]).map((l) => {
        const t = f.collection!.textes[l]!;
        return { collection_id: collectionId!, lang: l, name: t.nom, tagline: t.accroche, description: t.description, for_whom: t.pourQui };
      });
      if (textes.length) {
        const { error } = await admin.from("collection_texts").upsert(textes, { onConflict: "collection_id,lang" });
        if (error) throw new Error("SAVE_FAILED");
      }
    } else {
      resume.push(`Collection « ${f.livre.collection} » inchangée.`);
    }

    /* Livre */
    const champsLivre = {
      slug: f.livre.slug,
      collection_id: collectionId,
      tome_no: f.livre.tome,
      title_he: f.livre.titreHebreu,
      chapters_count: f.livre.nombreChapitres,
      vocab_count: f.livre.nombreMotsVocabulaire,
    };
    let bookId = plan.livre.id;
    if (!bookId) {
      const { data: row, error } = await admin.from("books").insert(champsLivre).select("id").single();
      if (error || !row) throw new Error(error?.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
      bookId = row.id;
      resume.push(`Livre « ${f.livre.slug} » créé (éditions en préparation, donc masqué).`);
    } else {
      const [{ data: b }, { data: eds }, { data: chaps }] = await Promise.all([
        admin.from("books").select("*").eq("id", bookId).single(),
        admin.from("book_editions").select("id, lang, title, subtitle, blurb, level_note, learn_items, print_page_count, amazon_url").eq("book_id", bookId),
        admin.from("book_chapters").select("chapter_no, title_he").eq("book_id", bookId),
      ]);
      const edIds = (eds ?? []).map((e) => e.id);
      const { data: titres } = edIds.length
        ? await admin.from("edition_chapter_titles").select("edition_id, chapter_no, title").in("edition_id", edIds)
        : { data: [] };
      await snapshot(admin, "book_fiche", bookId, { livre: b, editions: eds, titres_chapitre_hebreu: chaps, titres_chapitre: titres }, context.userId);
      const { error } = await admin.from("books").update(champsLivre).eq("id", bookId);
      if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
      resume.push(plan.livre.renommeDepuis
        ? `Livre « ${plan.livre.renommeDepuis} » renommé « ${f.livre.slug} » et modifié ; version enregistrée dans l'historique.`
        : `Livre « ${f.livre.slug} » modifié ; version enregistrée dans l'historique.`);
    }
    await admin.from("book_chapters").delete().eq("book_id", bookId);
    if (f.livre.titresChapitreHebreu.length) {
      const { error } = await admin.from("book_chapters").insert(f.livre.titresChapitreHebreu.map((t) => ({ book_id: bookId!, chapter_no: t.chapitre, title_he: t.titre })));
      if (error) throw new Error("SAVE_FAILED");
    }

    /* Éditions */
    for (const p of plan.editions) {
      const e = f.editions[p.lang]!;
      const champs = {
        title: e.titre,
        subtitle: e.sousTitre,
        blurb: e.resume,
        level_note: e.noteNiveau,
        learn_items: e.apprendrez,
        print_page_count: e.pagesImprimees,
        amazon_url: e.lienAmazon,
      };
      let id = p.id;
      if (!id) {
        const { data: row, error } = await admin.from("book_editions").insert({ book_id: bookId, lang: p.lang, status: "preparation", ...champs }).select("id").single();
        if (error || !row) throw new Error("SAVE_FAILED");
        id = row.id;
      } else {
        const { error } = await admin.from("book_editions").update(champs).eq("id", id);
        if (error) throw new Error("SAVE_FAILED");
      }
      await admin.from("edition_chapter_titles").delete().eq("edition_id", id);
      if (e.titresChapitre.length) {
        const { error } = await admin.from("edition_chapter_titles").insert(e.titresChapitre.map((t) => ({ edition_id: id!, chapter_no: t.chapitre, title: t.titre })));
        if (error) throw new Error("SAVE_FAILED");
      }
      resume.push(`Édition ${p.lang === "fr" ? "française" : "anglaise"} ${p.action === "creer" ? "créée (en préparation)" : "modifiée (statut inchangé)"} : ${e.titresChapitre.length} titre(s) de chapitre.`);
    }
    return { slug: f.livre.slug, resume };
  });
