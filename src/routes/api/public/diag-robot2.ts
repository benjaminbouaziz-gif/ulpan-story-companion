import { createFileRoute } from "@tanstack/react-router";
import { appelerModele } from "@/lib/robot-provider.server";

export const Route = createFileRoute("/api/public/diag-robot2")({
  server: {
    handlers: {
      GET: async () => {
        const t0 = Date.now();
        try {
          const r = await appelerModele({
            model: "claude-sonnet-4-6",
            webSearch: true,
            system: "Tu écris en français.",
            user: "Écris un plan de 3 chapitres sur le raid d'Entebbe, 300 mots.",
          });
          return Response.json({ ok: true, ms: Date.now() - t0, modelUsed: r.modelUsed, outputTokens: r.outputTokens, inputTokens: r.inputTokens, truncated: r.truncated, len: r.text.length, head: r.text.slice(0, 200) });
        } catch (e) {
          return Response.json({ ok: false, ms: Date.now() - t0, message: e instanceof Error ? e.message : String(e) });
        }
      },
    },
  },
});
