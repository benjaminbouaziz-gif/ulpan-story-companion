import { createFileRoute } from "@tanstack/react-router";
import { crawlLang, robotsTxt } from "@/lib/crawl.server";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(robotsTxt(crawlLang(request)), {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
