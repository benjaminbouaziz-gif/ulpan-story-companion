/**
 * BRIQUE 6 — LE TUYAU DU ROBOT.
 *
 * Le fournisseur DÉCOULE du nom du modèle : le reste du code ne connaît que
 * `appelerModele`. Trois familles acceptées aujourd'hui :
 *
 *   claude-…            → Anthropic          (secret ANTHROPIC_API_KEY)
 *   gemini-…            → Google AI Studio   (secret GEMINI_API_KEY)
 *   google/gemini-…     → passerelle Lovable (clé LOVABLE_API_KEY, déjà là)
 *
 * La recherche en ligne n'est activée que si la version de prompt la demande,
 * et seulement là où le fournisseur la propose (Anthropic, Google direct).
 *
 * Ce module est SERVEUR SEULEMENT : la clé est lue dans le corps de la
 * fonction, jamais au chargement du module, jamais renvoyée à l'écran.
 * Ni le contenu envoyé ni la réponse reçue ne sont journalisés.
 */

export type Fournisseur = "anthropic" | "google" | "lovable";

export type AppelResultat = {
  text: string;
  modelUsed: string;
  costUsd: number | null;
  /** Jetons produits, tels que déclarés par le fournisseur. */
  outputTokens: number | null;
  inputTokens: number | null;
  /** Vrai si la réponse s'est arrêtée sur le plafond de longueur. */
  truncated: boolean;
};

/** Assez haut pour laisser passer un document entier (plan complet, annexes). */
const MAX_TOKENS = 32000;

export function fournisseurDuModele(model: string): Fournisseur | null {
  const m = model.trim().toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gemini")) return "google";
  if (m.startsWith("google/gemini")) return "lovable";
  return null;
}

/** Le nom du secret attendu, pour le dire à l'écran sans jamais lire la valeur. */
export function secretDuModele(model: string): string | null {
  switch (fournisseurDuModele(model)) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "google":
      return "GEMINI_API_KEY";
    case "lovable":
      return "LOVABLE_API_KEY";
    default:
      return null;
  }
}

/** Vrai si la clé du fournisseur de ce modèle est configurée. */
export function cleConfiguree(model: string): boolean {
  const secret = secretDuModele(model);
  if (!secret) return false;
  const value = process.env[secret];
  return typeof value === "string" && value.trim().length > 0;
}

/** La recherche en ligne est-elle possible chez ce fournisseur ? */
export function rechercheEnLignePossible(model: string): boolean {
  const f = fournisseurDuModele(model);
  return f === "anthropic" || f === "google";
}

/**
 * Le message d'erreur ne masque plus rien : on distingue le REFUS de la PANNE,
 * et on inscrit toujours le code HTTP, la durée écoulée et le début du corps
 * renvoyé par le fournisseur (2000 caractères). Jamais la clé.
 */
function texteErreur(
  status: number,
  body: string,
  contexte: { url: string; model: string; elapsedMs: number },
): string {
  const brut = body.replace(/\s+/g, " ").slice(0, 2000);
  const queue = `HTTP ${status} · ${contexte.model} · ${contexte.url} · ${contexte.elapsedMs} ms · réponse : ${brut || "(corps vide)"}`;
  let cause: string;
  if (status === 401 || status === 403) cause = "Clé d'API refusée par le fournisseur";
  else if (status === 404) cause = "Modèle inconnu du fournisseur";
  else if (status === 400 || status === 422) cause = "Requête refusée par le fournisseur";
  else if (status === 402) cause = "Crédits épuisés chez le fournisseur";
  else if (status === 429) cause = "Fournisseur saturé (trop de demandes)";
  else if (status === 413) cause = "Requête trop grosse pour le fournisseur";
  else if (status === 504 || status === 524 || status === 522)
    cause = "Appel coupé par le fournisseur avant la fin de la réponse (délai dépassé côté fournisseur)";
  else if (status >= 500) cause = "Panne passagère du fournisseur";
  else cause = "Appel refusé";
  return `${cause} — ${queue}`;
}

/** Erreur réseau (rien n'est sorti, ou la connexion est tombée). */
function texteErreurReseau(
  e: unknown,
  contexte: { url: string; model: string; elapsedMs: number },
): string {
  const m = e instanceof Error ? e.message : String(e);
  return `Appel non abouti (réseau) — ${contexte.model} · ${contexte.url} · ${contexte.elapsedMs} ms · ${m.slice(0, 2000)}`;
}

/**
 * Anthropic EN FLUX. Un appel long non streamé est coupé par la façade du
 * fournisseur (524) au bout de ~2 min : le flux tient la connexion ouverte et
 * laisse passer les plans entiers.
 */
async function appelAnthropic(
  model: string,
  webSearch: boolean,
  system: string,
  user: string,
): Promise<AppelResultat> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
  const url = "https://api.anthropic.com/v1/messages";
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        stream: true,
        system,
        messages: [{ role: "user", content: user }],
        ...(webSearch
          ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }] }
          : {}),
      }),
    });
  } catch (e) {
    throw new Error(texteErreurReseau(e, { url, model, elapsedMs: Date.now() - t0 }));
  }
  if (!res.ok)
    throw new Error(
      texteErreur(res.status, await res.text(), { url, model, elapsedMs: Date.now() - t0 }),
    );
  if (!res.body) throw new Error(`Réponse sans corps du fournisseur — HTTP ${res.status}.`);

  let texte = "";
  let modelUsed = model;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let stopReason: string | null = null;
  let reste = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      reste += decoder.decode(value, { stream: true });
      const lignes = reste.split("\n");
      reste = lignes.pop() ?? "";
      for (const ligne of lignes) {
        if (!ligne.startsWith("data:")) continue;
        const brut = ligne.slice(5).trim();
        if (!brut || brut === "[DONE]") continue;
        let ev: any;
        try {
          ev = JSON.parse(brut);
        } catch {
          continue;
        }
        if (ev.type === "message_start") {
          modelUsed = ev.message?.model ?? model;
          inputTokens = ev.message?.usage?.input_tokens ?? inputTokens;
        } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          texte += ev.delta.text ?? "";
        } else if (ev.type === "message_delta") {
          stopReason = ev.delta?.stop_reason ?? stopReason;
          outputTokens = ev.usage?.output_tokens ?? outputTokens;
        } else if (ev.type === "error") {
          throw new Error(
            `Erreur en cours de réponse du fournisseur — ${model} · ${Date.now() - t0} ms · ${JSON.stringify(ev.error).slice(0, 2000)}`,
          );
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Erreur en cours")) throw e;
    throw new Error(texteErreurReseau(e, { url, model, elapsedMs: Date.now() - t0 }));
  }

  return {
    text: texte,
    modelUsed,
    costUsd: null,
    outputTokens,
    inputTokens,
    truncated: stopReason === "max_tokens",
  };
}


async function appelGoogle(
  model: string,
  webSearch: boolean,
  system: string,
  user: string,
): Promise<AppelResultat> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("La clé GEMINI_API_KEY n'est pas configurée.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
    },
  );
  if (!res.ok) throw new Error(texteErreur(res.status, await res.text()));
  const json = (await res.json()) as {
    modelVersion?: string;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return {
    text,
    modelUsed: json.modelVersion ?? model,
    costUsd: null,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? null,
    inputTokens: json.usageMetadata?.promptTokenCount ?? null,
    truncated: json.candidates?.[0]?.finishReason === "MAX_TOKENS",
  };
}

async function appelLovable(model: string, system: string, user: string): Promise<AppelResultat> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("La clé LOVABLE_API_KEY n'est pas configurée.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(texteErreur(res.status, await res.text()));
  const json = (await res.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: { finish_reason?: string; message?: { content?: string } }[];
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    modelUsed: json.model ?? model,
    costUsd: null,
    outputTokens: json.usage?.completion_tokens ?? null,
    inputTokens: json.usage?.prompt_tokens ?? null,
    truncated: json.choices?.[0]?.finish_reason === "length",
  };
}

export async function appelerModele(input: {
  model: string;
  webSearch: boolean;
  system: string;
  user: string;
}): Promise<AppelResultat> {
  const f = fournisseurDuModele(input.model);
  const web = input.webSearch && rechercheEnLignePossible(input.model);
  switch (f) {
    case "anthropic":
      return appelAnthropic(input.model, web, input.system, input.user);
    case "google":
      return appelGoogle(input.model, web, input.system, input.user);
    case "lovable":
      return appelLovable(input.model, input.system, input.user);
    default:
      throw new Error(
        `Modèle inconnu de l'atelier : « ${input.model} ». Modèles acceptés : claude-…, gemini-…, google/gemini-…`,
      );
  }
}
