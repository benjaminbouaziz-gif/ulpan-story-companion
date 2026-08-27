import { createFileRoute } from "@tanstack/react-router";

/** Route de DIAGNOSTIC temporaire — à supprimer après enquête. */
export const Route = createFileRoute("/api/public/diag-robot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const model = url.searchParams.get("model") ?? "claude-sonnet-4-6";
        const maxTokens = Number(url.searchParams.get("max_tokens") ?? "32000");
        const web = url.searchParams.get("web") === "1";
        const key = process.env["ANTHROPIC_API_KEY"];
        if (!key) return Response.json({ error: "clé absente" }, { status: 500 });

        const endpoint = "https://api.anthropic.com/v1/messages";
        const body = {
          model,
          max_tokens: maxTokens,
          system: "Réponds en un mot.",
          messages: [{ role: "user", content: "Dis: ok" }],
          ...(web
            ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }] }
            : {}),
        };
        const t0 = Date.now();
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
          });
          const text = await res.text();
          return Response.json({
            endpoint,
            model,
            maxTokens,
            web,
            status: res.status,
            elapsedMs: Date.now() - t0,
            body: text.slice(0, 2000),
          });
        } catch (e) {
          return Response.json({
            endpoint,
            model,
            maxTokens,
            web,
            networkError: e instanceof Error ? e.message : String(e),
            elapsedMs: Date.now() - t0,
          });
        }
      },
    },
  },
});
