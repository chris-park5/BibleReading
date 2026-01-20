// Bundled preset plans available in the client bundle.
// Admin workflow:
// - Add a new preset: drop a JSON file into src/app/plans/ (no other code changes)
// - Remove a preset: delete the JSON file (no other code changes)
//
// This uses Vite's import.meta.glob to automatically include all preset JSON files.

export interface BundledPresetPlan {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  totalDays: number;
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>;
}

type PresetJsonModule = { default: unknown } | unknown;

function isBundledPresetPlan(value: any): value is BundledPresetPlan {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.totalDays === "number" &&
    Number.isFinite(value.totalDays) &&
    Array.isArray(value.schedule)
  );
}

function loadAllBundledPresetPlans(): BundledPresetPlan[] {
  const modules = import.meta.glob("./*.json", { eager: true }) as Record<
    string,
    PresetJsonModule
  >;

  const plans: BundledPresetPlan[] = [];
  const seenIds = new Set<string>();

  for (const [path, mod] of Object.entries(modules)) {
    const raw = (mod as any)?.default ?? mod;

    if (!isBundledPresetPlan(raw)) {
      console.error(
        `[preset] Invalid preset JSON format: ${path}. See docs/PRESET_PLAN_FORMAT.md`
      );
      continue;
    }

    if (seenIds.has(raw.id)) {
      console.error(`[preset] Duplicate preset id detected: ${raw.id} (${path})`);
      continue;
    }

    seenIds.add(raw.id);
    plans.push(raw);
  }

  // Deterministic ordering (avoid Object iteration order differences)
  plans.sort((a, b) => a.id.localeCompare(b.id));
  return plans;
}

export const bundledPresetPlans: BundledPresetPlan[] = loadAllBundledPresetPlans();

export function normalizeSchedule(
  schedule: BundledPresetPlan["schedule"]
): BundledPresetPlan["schedule"] {
  const normalizeChapters = (value: string) => {
    const v = String(value ?? "").trim();
    if (!v) return v;

    // Handle "18:9-16" -> "18장 9-16절" or "18:9" -> "18장 9절"
    // Regex matches: start with digits, colon, digits, optionally dash and digits.
    const verseMatch = v.match(/^(\d+):(\d+)(?:-(\d+))?$/);
    if (verseMatch) {
      const chapter = verseMatch[1];
      const startVerse = verseMatch[2];
      const endVerse = verseMatch[3];
      return endVerse 
        ? `${chapter}장 ${startVerse}-${endVerse}절`
        : `${chapter}장 ${startVerse}절`;
    }

    if (v.includes("장") || v.includes("절")) return v;
    return `${v}장`;
  };

  return (schedule || []).map((d) => ({
    day: d.day,
    readings: (d.readings || []).map((r) => ({
      book: r.book,
      chapters: normalizeChapters(r.chapters),
    })),
  }));
}

export function getBundledPresetPlan(presetId: string): BundledPresetPlan | null {
  return bundledPresetPlans.find((p) => p.id === presetId) ?? null;
}

export function getBundledPresetSchedule(presetId: string) {
  const plan = getBundledPresetPlan(presetId);
  return plan ? normalizeSchedule(plan.schedule) : null;
}
