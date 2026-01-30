function expandChapters(chapterStr) {
  const result = [];
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

    // 한글 '장' 제거 및 하이픈 정규화
    const normalized = clean.replace(/[~–—]/g, "-");
    
    // "창세기 1-5" 같은 경우 "창세기 1-5"가 clean임.
    // 여기서 "장"만 떼면 "창세기 1-5".
    // parseInt("창세기 1") -> NaN.
    
    // !!! 문제 발견 가능성 !!!
    // reading.chapters가 "창세기 1-5" 처럼 책 이름이 포함되어 있으면?
    // 보통 reading.chapters에는 "1-5"만 들어있음. (book은 따로 있음)
    // 하지만 만약 "창세기 1-5"가 들어오면?

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
  return Array.from(new Set(result));
}

console.log("Test 1 (1-5):", expandChapters("1-5").length);
console.log("Test 2 (119):", expandChapters("119").length);
console.log("Test 3 (Gen 1-5):", expandChapters("창세기 1-5").length);