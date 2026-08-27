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

function texteErreur(status: number, body: string): string {
  const court = body.slice(0, 400);
  if (status === 401 || status === 403) return "Clé d'API refusée par le fournisseur.";
  if (status === 429) return "Fournisseur saturé (trop de demandes) : réessayer plus tard.";
  if (status === 402) return "Crédits épuisés chez le fournisseur.";
  if (status >= 500) return `Panne passagère du fournisseur (${status}).`;
  return `Appel refusé (${status}) : ${court}`;
}

async function appelAnthropic(
  model: string,
  webSearch: boolean,
  system: string,
  user: string,
): Promise<AppelResultat> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
      ...(webSearch
        ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }] }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(texteErreur(res.status, await res.text()));
  const json = (await res.json()) as {
    model?: string;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    content?: { type: string; text?: string }[];
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
  return {
    text,
    modelUsed: json.model ?? model,
    costUsd: null,
    outputTokens: json.usage?.output_tokens ?? null,
    inputTokens: json.usage?.input_tokens ?? null,
    truncated: json.stop_reason === "max_tokens",
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
