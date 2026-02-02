import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1) Load .env (optional)
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return;
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    });
    console.log("Loaded .env file");
  }
} catch (e) {
  console.log("Error reading .env file:", e);
}

// Prefer env vars; fall back to the same values used by backfill script (local tooling).
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://okginpltwhwtjsqdrlfo.supabase.co/";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZ2lucGx0d2h3dGpzcWRybGZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY5MDcxMiwiZXhwIjoyMDgzMjY2NzEyfQ.jgvxUMSrXf4qPcRtHnImHwLiuFx1we_CG-i5m6quZZA";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const stripZeroWidth = (v) => String(v ?? "").replace(ZERO_WIDTH_RE, "");

function isVerseLike(chaptersRaw) {
  const s = stripZeroWidth(chaptersRaw).trim();
  if (!s) return false;

  // Examples:
  // - "시편 27:1-6"
  // - "27:1-6"
  // - "27장 1-6절"
  // - "27장 1절"
  // - "27:1"
  const hasColonVerse = /\d+\s*:\s*\d+/.test(s);
  const hasKoreanVerse = /절/.test(s);
  const hasKoreanChapterVerse = /\d+\s*장\s*\d+/.test(s) && hasKoreanVerse;

  return hasColonVerse || hasKoreanVerse || hasKoreanChapterVerse;
}

function num(v) {
  const n = v === null || v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function isIntegerish(n) {
  if (!Number.isFinite(n)) return false;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

async function fetchAllRows(tableName) {
  const parentKey = tableName === "plan_schedules" ? "plan_id" : "preset_id";
  const selectCols = `id, ${parentKey}, day, book, chapters, order_index, chapter_count`;

  const rows = [];
  const PAGE_SIZE = 1000;

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select(selectCols)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return { rows, parentKey };
}

async function run() {
  const tableName = String(process.argv[2] ?? "plan_schedules").trim() || "plan_schedules";
  const suspiciousLimit = Math.max(1, Number(process.argv[3] ?? 30) || 30);

  console.log(`Verifying chapter_count backfill in ${tableName}...`);

  const { rows, parentKey } = await fetchAllRows(tableName);

  const verseRows = rows.filter((r) => isVerseLike(r.chapters));

  const stats = {
    total: rows.length,
    verseLike: verseRows.length,
    verseLikeZeroOrNull: 0,
    verseLikeInteger: 0,
    verseLikeFractional: 0,
    verseLikeBetween0And1: 0,
  };

  const suspicious = [];

  for (const r of verseRows) {
    const cc = num(r.chapter_count);

    if (!Number.isFinite(cc) || cc === 0) stats.verseLikeZeroOrNull += 1;
    if (Number.isFinite(cc) && isIntegerish(cc)) stats.verseLikeInteger += 1;
    if (Number.isFinite(cc) && !isIntegerish(cc)) stats.verseLikeFractional += 1;
    if (Number.isFinite(cc) && cc > 0 && cc < 1) stats.verseLikeBetween0And1 += 1;

    // Heuristic: verse-like chapters *often* yield fractional (<1) values.
    // If it stays integer, it may still be valid (e.g., full-chapter coverage),
    // but it is worth spot-checking.
    const shouldFlag = !Number.isFinite(cc) || cc === 0 || isIntegerish(cc);

    if (shouldFlag && suspicious.length < suspiciousLimit) {
      suspicious.push({
        id: r.id,
        parent: r[parentKey],
        day: r.day,
        book: r.book,
        chapters: r.chapters,
        chapter_count: r.chapter_count,
      });
    }
  }

  console.log("\nSummary");
  console.log(`- total rows: ${stats.total}`);
  console.log(`- verse-like rows: ${stats.verseLike}`);
  console.log(`- verse-like chapter_count null/0: ${stats.verseLikeZeroOrNull}`);
  console.log(`- verse-like chapter_count integer: ${stats.verseLikeInteger}`);
  console.log(`- verse-like chapter_count fractional: ${stats.verseLikeFractional}`);
  console.log(`- verse-like chapter_count (0,1): ${stats.verseLikeBetween0And1}`);

  if (suspicious.length > 0) {
    console.log(`\nSample suspicious rows (up to ${suspiciousLimit})`);
    suspicious.forEach((r, i) => {
      console.log(
        `${String(i + 1).padStart(2, "0")}. id=${r.id} ${parentKey}=${r.parent} day=${r.day} book=${stripZeroWidth(r.book)} chapters=${stripZeroWidth(r.chapters)} chapter_count=${r.chapter_count}`
      );
    });
  } else {
    console.log("\nNo suspicious rows found by heuristic.");
  }
}

run().catch((err) => {
  console.error("verify failed:", err);
  process.exit(1);
});
