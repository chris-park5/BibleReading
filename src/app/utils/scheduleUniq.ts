const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

export function stripZeroWidth(value: unknown): string {
  return String(value ?? "").replace(ZERO_WIDTH_RE, "");
}

export function disambiguateScheduleForDb(
  schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>
): {
  schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
  duplicatesFixed: number;
} {
  const seen = new Map<string, number>();
  let duplicatesFixed = 0;

  const next = (schedule ?? []).map((d) => {
    const readings = (d.readings ?? []).map((r) => {
      const book = String(r.book ?? "");
      const baseChapters = stripZeroWidth(r.chapters);
      const key = `${d.day}|${book}|${baseChapters}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n === 1) return { book, chapters: baseChapters };
      duplicatesFixed += 1;
      return { book, chapters: `${baseChapters}${"\u200B".repeat(n - 1)}` };
    });

    return { day: d.day, readings };
  });

  return { schedule: next, duplicatesFixed };
}
