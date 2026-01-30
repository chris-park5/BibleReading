function expandChapters(chapterStr) {
  const result = [];
  const parts = chapterStr.split(",");
  
  for (const part of parts) {
    const clean = part.trim();

    if (clean.includes(":")) {
      const chapter = clean.split(":")[0].replace(/[^0-9]/g, "");
      if (chapter) {
        result.push(chapter);
      } else {
        result.push(clean);
      }
      continue;
    }

    if (clean.includes("절")) {
      const match = clean.match(/(\d+)장/);
      if (match && match[1]) {
        result.push(match[1]);
      } else {
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
      // Remove non-digits to handle cases like "Gen 1" or "창세기 1"
      const startStr = range[0].replace(/[^0-9]/g, "");
      const endStr = range[1].replace(/[^0-9]/g, "");

      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          result.push(String(i));
        }
      } else {
          result.push(trimmed);
      }
    } else {
      // Single chapter case: try to extract number if possible
      const numStr = trimmed.replace(/[^0-9]/g, "");
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
         result.push(String(num));
      } else {
         result.push(trimmed);
      }
    }
  }
  return Array.from(new Set(result));
}

console.log("Test 1 (1-5):", expandChapters("1-5").length); // Expect 5
console.log("Test 2 (119):", expandChapters("119").length); // Expect 1
console.log("Test 3 (Gen 1-5):", expandChapters("창세기 1-5").length); // Expect 5
console.log("Test 4 (Gen 1):", expandChapters("창세기 1").length); // Expect 1
