import { createFileRoute } from "@tanstack/react-router";
import { crawlLang, sitemapXml } from "@/lib/crawl.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(sitemapXml(crawlLang(request)), {
          headers: { "content-type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
