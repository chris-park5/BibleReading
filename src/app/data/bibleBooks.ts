export type BibleBook = {
  name: string;
  chapters: number;
};

function normalizeSearchKey(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[._-]+/g, "");
}

function getSearchVariants(value: string): string[] {
  const norm = normalizeSearchKey(value);
  if (!norm) return [];

  const variants = new Set<string>([norm]);

  // Allow users to type digits either as prefix or suffix.
  // Examples: "1요" <-> "요1", "2tim" <-> "tim2".
  const leading = norm.match(/^(\d+)(.+)$/);
  if (leading) variants.add(`${leading[2]}${leading[1]}`);

  const trailing = norm.match(/^(.+?)(\d+)$/);
  if (trailing) variants.add(`${trailing[2]}${trailing[1]}`);

  return Array.from(variants);
}

// 책 이름 검색용 약어/별칭 목록 (한글 약어 + 일부 영문 약어 지원)
export const BIBLE_BOOK_ALIASES: Record<string, string[]> = {
  // OT
  "창세기": ["창", "창세", "gen"],
  "출애굽기": ["출", "출애", "ex", "exo"],
  "레위기": ["레", "lev"],
  "민수기": ["민", "num"],
  "신명기": ["신", "deut", "dt"],
  "여호수아": ["수", "여호", "jos", "josh"],
  "사사기": ["삿", "사사", "judg", "jg"],
  "룻기": ["룻", "ruth", "ru"],
  "사무엘상": ["삼상", "1삼", "삼1", "1sam"],
  "사무엘하": ["삼하", "2삼", "삼2", "2sam"],
  "열왕기상": ["왕상", "1왕", "1ki", "1kgs"],
  "열왕기하": ["왕하", "2왕", "2ki", "2kgs"],
  "역대상": ["대상", "1대", "대1", "1ch", "1chr"],
  "역대하": ["대하", "2대", "대2", "2ch", "2chr"],
  "에스라": ["스", "ezr"],
  "느헤미야": ["느", "neh"],
  "에스더": ["에", "est"],
  "욥기": ["욥", "job"],
  "시편": ["시", "ps", "psa"],
  "잠언": ["잠", "prov", "pr"],
  "전도서": ["전", "전도", "ecc", "ec"],
  "아가": ["아", "아가서", "song", "ss", "sos"],
  "이사야": ["사", "사야", "isa"],
  "예레미야": ["렘", "jer"],
  "예레미야 애가": ["애", "애가", "lam"],
  "에스겔": ["겔", "ezek", "eze"],
  "다니엘": ["단", "dan"],
  "호세아": ["호", "hos"],
  "요엘": ["욜", "joel", "jl"],
  "아모스": ["암", "amos", "am"],
  "오바댜": ["옵", "obad", "ob"],
  "요나": ["욘", "jona", "jon"],
  "미가": ["미", "mic"],
  "나훔": ["나", "nah"],
  "하박국": ["합", "hab"],
  "스바냐": ["습", "zep", "zeph"],
  "학개": ["학", "hag"],
  "스가랴": ["슥", "zec", "zech"],
  "말라기": ["말", "mal"],

  // NT
  "마태복음": ["마", "마태", "mt", "mat"],
  "마가복음": ["막", "마가", "mk", "mar"],
  "누가복음": ["눅", "누가", "lk", "luk"],
  "요한복음": ["요", "요한", "jn", "joh"],
  "사도행전": ["행", "사도", "acts", "ac"],
  "로마서": ["롬", "로마", "rom", "ro"],
  "고린도전서": ["고전", "1고", "고1", "1cor", "1co"],
  "고린도후서": ["고후", "2고", "고2", "2cor", "2co"],
  "갈라디아서": ["갈", "gal"],
  "에베소서": ["엡", "eph"],
  "빌립보서": ["빌", "php", "phil"],
  "골로새서": ["골", "col"],
  "데살로니가전서": ["살전", "1살", "살1", "1th", "1thes"],
  "데살로니가후서": ["살후", "2살", "살2", "2th", "2thes"],
  "디모데전서": ["딤전", "1딤", "딤1", "1tim"],
  "디모데후서": ["딤후", "2딤", "딤2", "2tim"],
  "디도서": ["딛", "titus", "tit"],
  "빌레몬서": ["몬", "phlm", "phm"],
  "히브리서": ["히", "heb"],
  "야고보서": ["약", "jas", "jam"],
  "베드로전서": ["벧전", "1벧", "벧1", "1pet"],
  "베드로후서": ["벧후", "2벧", "벧2", "2pet"],
  "요한1서": ["요일", "1요", "요1", "1jn", "1john"],
  "요한2서": ["요이", "2요", "요2", "2jn", "2john"],
  "요한3서": ["요삼", "3요", "요3", "3jn", "3john"],
  "유다서": ["유", "jude", "jud"],
  "요한계시록": ["계", "계시", "rev", "re"],
};

export function getBookSearchKeys(bookName: string): string[] {
  const aliases = BIBLE_BOOK_ALIASES[bookName] ?? [];
  return [bookName, ...aliases];
}

export function matchesBookSearch(bookName: string, query: string): boolean {
  const qVariants = getSearchVariants(query);
  if (qVariants.length === 0) return true;

  for (const key of getBookSearchKeys(bookName)) {
    const keyVariants = getSearchVariants(key);
    for (const kv of keyVariants) {
      for (const qv of qVariants) {
        if (kv.includes(qv)) return true;
      }
    }
  }
  return false;
}

// 개역개정 기준 일반적인 책 이름(한글) + 장 수
export const BIBLE_BOOKS: BibleBook[] = [
  { name: "창세기", chapters: 50 },
  { name: "출애굽기", chapters: 40 },
  { name: "레위기", chapters: 27 },
  { name: "민수기", chapters: 36 },
  { name: "신명기", chapters: 34 },
  { name: "여호수아", chapters: 24 },
  { name: "사사기", chapters: 21 },
  { name: "룻기", chapters: 4 },
  { name: "사무엘상", chapters: 31 },
  { name: "사무엘하", chapters: 24 },
  { name: "열왕기상", chapters: 22 },
  { name: "열왕기하", chapters: 25 },
  { name: "역대상", chapters: 29 },
  { name: "역대하", chapters: 36 },
  { name: "에스라", chapters: 10 },
  { name: "느헤미야", chapters: 13 },
  { name: "에스더", chapters: 10 },
  { name: "욥기", chapters: 42 },
  { name: "시편", chapters: 150 },
  { name: "잠언", chapters: 31 },
  { name: "전도서", chapters: 12 },
  { name: "아가", chapters: 8 },
  { name: "이사야", chapters: 66 },
  { name: "예레미야", chapters: 52 },
  { name: "예레미야 애가", chapters: 5 },
  { name: "에스겔", chapters: 48 },
  { name: "다니엘", chapters: 12 },
  { name: "호세아", chapters: 14 },
  { name: "요엘", chapters: 3 },
  { name: "아모스", chapters: 9 },
  { name: "오바댜", chapters: 1 },
  { name: "요나", chapters: 4 },
  { name: "미가", chapters: 7 },
  { name: "나훔", chapters: 3 },
  { name: "하박국", chapters: 3 },
  { name: "스바냐", chapters: 3 },
  { name: "학개", chapters: 2 },
  { name: "스가랴", chapters: 14 },
  { name: "말라기", chapters: 4 },
  { name: "마태복음", chapters: 28 },
  { name: "마가복음", chapters: 16 },
  { name: "누가복음", chapters: 24 },
  { name: "요한복음", chapters: 21 },
  { name: "사도행전", chapters: 28 },
  { name: "로마서", chapters: 16 },
  { name: "고린도전서", chapters: 16 },
  { name: "고린도후서", chapters: 13 },
  { name: "갈라디아서", chapters: 6 },
  { name: "에베소서", chapters: 6 },
  { name: "빌립보서", chapters: 4 },
  { name: "골로새서", chapters: 4 },
  { name: "데살로니가전서", chapters: 5 },
  { name: "데살로니가후서", chapters: 3 },
  { name: "디모데전서", chapters: 6 },
  { name: "디모데후서", chapters: 4 },
  { name: "디도서", chapters: 3 },
  { name: "빌레몬서", chapters: 1 },
  { name: "히브리서", chapters: 13 },
  { name: "야고보서", chapters: 5 },
  { name: "베드로전서", chapters: 5 },
  { name: "베드로후서", chapters: 3 },
  { name: "요한1서", chapters: 5 },
  { name: "요한2서", chapters: 1 },
  { name: "요한3서", chapters: 1 },
  { name: "유다서", chapters: 1 },
  { name: "요한계시록", chapters: 22 },
];

export function getBookIndex(bookName: string): number {
  return BIBLE_BOOKS.findIndex((b) => b.name === bookName);
}

export function getBookChapters(bookName: string): number {
  // Handle known typos
  if (bookName === "역대대상") bookName = "역대상";

  const book = BIBLE_BOOKS.find((b) => b.name === bookName);
  if (!book) {
    console.error(`알 수 없는 책 이름: ${bookName}`);
    return 0; // Fallback to avoid crash
  }
  return book.chapters;
}
