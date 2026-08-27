/**
 * Garde-fou CI : la clé de service ne doit apparaître que dans les deux
 * fichiers autorisés. Toute autre occurrence fait échouer la vérification.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";

const NEEDLE = "SUPABASE_SERVICE_ROLE_KEY";
const ALLOWED = new Set([
  "src/integrations/supabase/client.server.ts",
  "src/lib/supabase-admin.server.ts",
  "scripts/check-service-role.mjs",
]);
const SKIP = new Set(["node_modules", ".git", "dist", ".output", ".vinxi", ".lovable"]);

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) continue;
    const rel = posix.normalize(full.replace(/\\/g, "/").replace(/^\.\//, ""));
    if (ALLOWED.has(rel)) continue;
    if (readFileSync(full, "utf8").includes(NEEDLE)) offenders.push(rel);
  }
}

walk(".");

if (offenders.length > 0) {
  console.error(`${NEEDLE} apparaît hors des fichiers autorisés :`);
  for (const f of offenders) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${NEEDLE} : aucune fuite hors des fichiers autorisés.`);
