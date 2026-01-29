import { getVerseCounts } from "../data/bibleVerseCounts";

export interface ChapterRange {
  ch: number;
  startVerse: number;
  endVerse: number;
}

export interface ReadingRef {
  day: number;
  index: number;
  weight: number; // 0.0 ~ 1.0 (contribution to this instance)
}

export interface ChapterInstance {
  book: string;
  ch: number;
  readings: ReadingRef[];
  isFullChapter: boolean; // roughly true if covers ~100% verses
}

// Parse string like "22:1-8" or "22" into simplified ranges
// Returns array because "1-3" becomes 3 ranges: 1:Full, 2:Full, 3:Full
export function parseChapterRanges(raw: string, bookName: string): ChapterRange[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];

  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  const result: ChapterRange[] = [];
  const verseCounts = tryGetVerseCounts(bookName);

  for (const part of parts) {
    const clean = part.trim();
    const normalized = clean.replace(/[~–—]/g, "-");

    // 1. "22:1-8" or "22:1-8장"
    const colonMatch = normalized.match(/^(\d+):(\d+)-(\d+)(?:장|절)?$/);
    if (colonMatch) {
      const ch = parseInt(colonMatch[1]);
      const start = parseInt(colonMatch[2]);
      const end = parseInt(colonMatch[3]);
      result.push({ ch, startVerse: start, endVerse: end });
      continue;
    }

    // 2. "22:1" or "22:1절"
    const colonSingleMatch = normalized.match(/^(\d+):(\d+)(?:장|절)?$/);
    if (colonSingleMatch) {
      const ch = parseInt(colonSingleMatch[1]);
      const v = parseInt(colonSingleMatch[2]);
      result.push({ ch, startVerse: v, endVerse: v });
      continue;
    }

    // 3. Korean format "1장 22-25절"
    // Also handles "1장 22-25" (implicit '절' at end) or "1장22-25절"
    const krRangeMatch = normalized.match(/^(\d+)장\s*(\d+)-(\d+)(?:절)?$/);
    if (krRangeMatch) {
      const ch = parseInt(krRangeMatch[1]);
      const start = parseInt(krRangeMatch[2]);
      const end = parseInt(krRangeMatch[3]);
      result.push({ ch, startVerse: start, endVerse: end });
      continue;
    }

    // 4. Korean format "1장 22절"
    const krSingleMatch = normalized.match(/^(\d+)장\s*(\d+)(?:절)?$/);
    if (krSingleMatch) {
       const ch = parseInt(krSingleMatch[1]);
       const v = parseInt(krSingleMatch[2]);
       result.push({ ch, startVerse: v, endVerse: v });
       continue;
    }

    // 5. "1-3" (Chapters 1 to 3) or "1" (Chapter 1)
    const cleaned = normalized.replace(/장/g, "").replace(/절/g, "").trim(); 
    const dashMatch = cleaned.match(/^(\d+)-(\d+)$/);
    if (dashMatch) {
      const start = parseInt(dashMatch[1]);
      const end = parseInt(dashMatch[2]);
      for (let c = start; c <= end; c++) {
        const limit = verseCounts ? (verseCounts[c - 1] ?? 999) : 999;
        result.push({ ch: c, startVerse: 1, endVerse: limit });
      }
      continue;
    }

    const singleNum = parseInt(cleaned);
    if (!isNaN(singleNum)) {
      const limit = verseCounts ? (verseCounts[singleNum - 1] ?? 999) : 999;
      result.push({ ch: singleNum, startVerse: 1, endVerse: limit });
      continue;
    }
  }
  return result;
}

function tryGetVerseCounts(bookName: string): number[] | null {
  try {
    return getVerseCounts(bookName);
  } catch {
    return null;
  }
}

// Group readings into Instances
// readings: Array of { day, index, rawChapters } sorted by sequence
export function clusterReadings(
  bookName: string, 
  readings: Array<{ day: number; index: number; rawChapters: string }>
): ChapterInstance[] {
  const verseCounts = tryGetVerseCounts(bookName);
  
  // Flatten all ranges with their source reading info
  // However, we want to group by CHAPTER first.
  // Then within chapter, detect overlaps.
  
  type ReadingItem = { day: number; index: number; range: ChapterRange };
  const itemsByChapter = new Map<number, ReadingItem[]>();

  for (const r of readings) {
    const ranges = parseChapterRanges(r.rawChapters, bookName);
    for (const rng of ranges) {
      if (!itemsByChapter.has(rng.ch)) {
        itemsByChapter.set(rng.ch, []);
      }
      itemsByChapter.get(rng.ch)!.push({ day: r.day, index: r.index, range: rng });
    }
  }

  const instances: ChapterInstance[] = [];

  for (const [ch, items] of itemsByChapter.entries()) {
    // items are sorted by day/order
    // We cluster them into "Passes"
    
    // Simple logic:
    // If an item overlaps with the current cluster's accumulated range, it starts a NEW cluster (Repeat).
    // EXCEPT if the overlap is minimal? No, strictly repeat reading = overlap.
    // "Splitting a chapter" means ranges are DISJOINT (or adjacent).
    
    // Accumulator for current cluster
    let currentCluster: ReadingItem[] = [];
    let currentCoverage = new Set<number>(); // Store covered verses to check overlap

    const finalizeCluster = () => {
      if (currentCluster.length === 0) return;
      
      // Calculate weights
      const totalVerses = verseCounts ? (verseCounts[ch - 1] ?? 100) : 100;
      
      // If we have precise verse counts, weight = (range length) / totalVerses
      // BUT if the cluster covers >100% (repeats inside cluster? shouldn't happen with our overlap check), clamp?
      // Wait, if we split "22:1-8" (8 vs) and "22:9-16" (8 vs). Total 31.
      // Weight 1: 8/31. Weight 2: 8/31.
      // Sum = 16/31. Approx 0.5.
      // This is the "Fractional" approach.
      
      // If no verse counts, distribute equally? 
      // Or just sum(range length) / (max range end found)?
      
      // User wants "Completed Chapters" count.
      // If I read 16/31 verses, have I read 0.5 chapters?
      // Yes.
      
      const refs: ReadingRef[] = currentCluster.map(item => {
        const len = item.range.endVerse - item.range.startVerse + 1;
        // If verseCounts exists, use it. Else assume standard chapter length ~30?
        // Or if we don't have counts, rely on "1 / items.length" approach?
        // "1 / items.length" is safer if we don't trust verse parsing.
        // But "22:1-8" parsing relies on format.
        
        let w = 0;
        if (verseCounts) {
           w = len / totalVerses;
        } else {
           // Fallback: If "1-100" (Full), weight 1.
           // If partial, hard to guess.
           // Let's assume if it looks like a full chapter (start=1, end>20), weight 1.
           // Else 0.5?
           // Better: Uniform distribution among cluster members?
           // "22:1-8" and "22:9-16". 2 items. Each 0.5.
           // This requires knowing the cluster size beforehand. We do (in finalize).
           w = 1; // placeholder, re-norm below
        }
        return { day: item.day, index: item.index, weight: w };
      });

      if (!verseCounts) {
        // Renormalize to sum to 1.0
        const count = refs.length;
        refs.forEach(r => r.weight = 1 / count);
      }

      instances.push({
        book: bookName,
        ch,
        readings: refs,
        isFullChapter: true // simplified
      });
    };

    for (const item of items) {
      // Check overlap
      let overlap = false;
      for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
        if (currentCoverage.has(v)) {
          overlap = true;
          break;
        }
      }

      if (overlap) {
        // Start new cluster (Repeat detected)
        finalizeCluster();
        currentCluster = [item];
        currentCoverage = new Set();
        for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
          currentCoverage.add(v);
        }
      } else {
        // Add to current cluster (Disjoint part)
        currentCluster.push(item);
        for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
          currentCoverage.add(v);
        }
      }
    }
    finalizeCluster();
  }

  return instances;
}
