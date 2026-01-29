
export function expandChapters(chapterStr: string): string[] {
  const result: string[] = [];
  const parts = chapterStr.split(",");
  
  for (const part of parts) {
    const clean = part.trim();

    // If it contains ":", extract the chapter number (e.g. "18:9-16" -> "18")
    if (clean.includes(":")) {
      const chapter = clean.split(":")[0].replace(/[^0-9]/g, "");
      if (chapter) {
        result.push(chapter);
      } else {
        result.push(clean);
      }
      continue;
    }

    // If it contains "절", extract chapter number (e.g. "18장 9-16절" -> "18")
    if (clean.includes("절")) {
      const match = clean.match(/(\d+)장/);
      if (match && match[1]) {
        result.push(match[1]);
      } else {
        // Fallback: try parsing the start
        const num = parseInt(clean);
        if (!isNaN(num)) result.push(String(num));
        else result.push(clean);
      }
      continue;
    }

    const normalized = clean.replace(/[~–—]/g, "-");
    const trimmed = normalized.replace(/장/g, "");

    const range = trimmed.split("-");
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          result.push(String(i));
        }
      } else {
          result.push(trimmed);
      }
    } else {
      result.push(trimmed);
    }
  }
  return Array.from(new Set(result)); // Deduplicate
}
