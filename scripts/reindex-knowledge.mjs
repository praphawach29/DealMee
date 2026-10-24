/**
 * Rebuild knowledge chunks for shops that already have Q&A rows or documents.
 *
 *   node --import ./scripts/register-hooks.mjs --experimental-strip-types scripts/reindex-knowledge.mjs
 *   node --import ./scripts/register-hooks.mjs --experimental-strip-types scripts/reindex-knowledge.mjs --shop <uuid>
 *   node --import ./scripts/register-hooks.mjs --experimental-strip-types scripts/reindex-knowledge.mjs --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Embeddings use GEMINI_API_KEY (preferred) or OPENAI_API_KEY, including keys
 * saved in /admin/system-settings, and a shop's own Gemini or OpenAI key.
 * Files uploaded before this migration were stored only as Q&A summaries.
 * Re-upload a long file to store its full text.
 */
import { reindexFromEnv } from '../src/lib/knowledge/reindex.ts'

try {
  const result = await reindexFromEnv(process.argv.slice(2))
  console.log(JSON.stringify({ shops: result.reports.length, dryRun: result.dryRun }, null, 2))
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
