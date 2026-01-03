import { BIBLE_BOOKS, getBookIndex } from "../data/bibleBooks";
import { getVerseCounts } from "../data/bibleVerseCounts";

type Reading = { book: string; chapters: string };

type GenerateParams = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startBook: string;
  endBook: string;
};

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1);
}

function diffDaysInclusive(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const ms = end.getTime() - start.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return days + 1;
}

function formatChapterRange(start: number, end: number): string {
  if (start === end) return `${start}장`;
  return `${start}-${end}장`;
}

function formatVerseRange(chapter: number, startVerse: number, endVerse: number): string {
  if (startVerse === endVerse) return `${chapter}장 ${startVerse}절`;
  return `${chapter}장 ${startVerse}-${endVerse}절`;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

export function generateScheduleFromBookRange(params: GenerateParams): {
  totalDays: number;
  schedule: Array<{ day: number; readings: Reading[] }>;
} {
  const { startDate, endDate, startBook, endBook } = params;
  const totalDays = diffDaysInclusive(startDate, endDate);
  if (!startDate || !endDate) throw new Error("시작/종료 날짜가 필요합니다");
  if (totalDays <= 0) throw new Error("종료 날짜는 시작 날짜 이후여야 합니다");

  const startIdx = getBookIndex(startBook);
  const endIdx = getBookIndex(endBook);
  if (startIdx < 0) throw new Error("시작 책을 찾을 수 없습니다");
  if (endIdx < 0) throw new Error("끝 책을 찾을 수 없습니다");
  if (endIdx < startIdx)
    throw new Error("끝 책은 시작 책 이후(또는 동일)여야 합니다");

  const rangeBooks = BIBLE_BOOKS.slice(startIdx, endIdx + 1);
  const totalChapters = rangeBooks.reduce((sum, b) => sum + b.chapters, 0);

  // 1) 기본: 장 단위로 분배
  if (totalChapters >= totalDays) {
    const base = Math.floor(totalChapters / totalDays);
    const remainder = totalChapters % totalDays;

    let bookCursor = 0;
    let chapterCursor = 1;
    const schedule: Array<{ day: number; readings: Reading[] }> = [];

    for (let day = 1; day <= totalDays; day++) {
      let target = base + (day <= remainder ? 1 : 0);
      const readings: Reading[] = [];

      while (target > 0) {
        const book = rangeBooks[bookCursor];
        if (!book) break;

        const remainingInBook = book.chapters - chapterCursor + 1;
        const take = Math.min(target, remainingInBook);
        const startChapter = chapterCursor;
        const endChapter = chapterCursor + take - 1;

        readings.push({
          book: book.name,
          chapters: formatChapterRange(startChapter, endChapter),
        });

        chapterCursor += take;
        target -= take;

        if (chapterCursor > book.chapters) {
          bookCursor += 1;
          chapterCursor = 1;
        }
      }

      schedule.push({ day, readings });
    }

    return { totalDays, schedule };
  }

  // 2) 장 수가 날짜보다 적으면: 절 단위로 분배
  const verseCountsByBook = rangeBooks.map((b) => ({ book: b.name, verses: getVerseCounts(b.name) }));
  const totalVerses = verseCountsByBook.reduce((acc, b) => acc + sum(b.verses), 0);

  if (totalDays > totalVerses) {
    throw new Error(
      `선택한 날짜(${totalDays}일)가 범위의 총 절 수(${totalVerses}절)보다 깁니다. 날짜를 줄이거나 더 넓은 범위를 선택해주세요.`
    );
  }

  const baseVerses = Math.floor(totalVerses / totalDays);
  const remainderVerses = totalVerses % totalDays;

  let bookCursor = 0;
  let chapterCursor = 1;
  let verseCursor = 1;

  const schedule: Array<{ day: number; readings: Reading[] }> = [];

  for (let day = 1; day <= totalDays; day++) {
    let target = baseVerses + (day <= remainderVerses ? 1 : 0);
    const readings: Reading[] = [];

    while (target > 0) {
      const current = verseCountsByBook[bookCursor];
      if (!current) break;

      const versesInThisChapter = current.verses[chapterCursor - 1];
      if (!versesInThisChapter) {
        // 다음 책으로
        bookCursor += 1;
        chapterCursor = 1;
        verseCursor = 1;
        continue;
      }

      const remainingInChapter = versesInThisChapter - verseCursor + 1;
      const take = Math.min(target, remainingInChapter);
      const startVerse = verseCursor;
      const endVerse = verseCursor + take - 1;

      readings.push({
        book: current.book,
        chapters: formatVerseRange(chapterCursor, startVerse, endVerse),
      });

      verseCursor += take;
      target -= take;

      if (verseCursor > versesInThisChapter) {
        chapterCursor += 1;
        verseCursor = 1;
      }

      if (chapterCursor > current.verses.length) {
        bookCursor += 1;
        chapterCursor = 1;
        verseCursor = 1;
      }
    }

    schedule.push({ day, readings });
  }

  return { totalDays, schedule };
}
