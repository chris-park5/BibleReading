import { useMemo, useRef, useState } from "react";
import { X, BookPlus } from "lucide-react";
import { BIBLE_BOOKS } from "../data/bibleBooks";
import { generateScheduleFromSelectedBooks } from "../utils/generateScheduleFromSelectedBooks";
import { disambiguateScheduleForDb } from "../utils/scheduleUniq";

interface Reading {
  book: string;
  chapters: string;
}

interface CustomPlanCreatorProps {
  onClose: () => void;
  onSave: (planData: {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    totalDays: number;
    schedule: Array<{ day: number; readings: Reading[] }>;
    isCustom: boolean;
  }) => void;
}

export function CustomPlanCreator({ onClose, onSave }: CustomPlanCreatorProps) {
  type Step = 1 | 2 | 3;
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const MAX_PLAN_NAME_LENGTH = 255;
  // Hard limits to keep the app/server stable for very large plans.
  // These are conservative and can be tuned later.
  const MAX_TOTAL_DAYS = 3650; // ~10 years
  const MAX_SCHEDULE_ROWS = 20000; // total (day x readings) rows
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const parseDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split("-").map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const formatDateYMD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const computedTotalDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const ms = end.getTime() - start.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
    return Number.isFinite(days) ? days : null;
  }, [startDate, endDate]);

  const maxEndDate = useMemo(() => {
    if (!startDate) return "";
    const start = parseDate(startDate);
    const max = new Date(start);
    max.setDate(max.getDate() + (MAX_TOTAL_DAYS - 1));
    return formatDateYMD(max);
  }, [startDate]);

  const isDateRangeInvalid =
    computedTotalDays === null || computedTotalDays <= 0 || computedTotalDays > MAX_TOTAL_DAYS;

  type Testament = "OT" | "NT";
  const [activeTestament, setActiveTestament] = useState<Testament>("OT");
  // NOTE: duplicates are allowed (e.g., 성경 2독).
  // Order in this array is the reading order.
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [showShuffleOptions, setShowShuffleOptions] = useState(false);
  const [separateTestamentReading, setSeparateTestamentReading] = useState(false);
  const [showOtShuffleMenu, setShowOtShuffleMenu] = useState(false);
  const [showNtShuffleMenu, setShowNtShuffleMenu] = useState(false);
  const [draggingGroup, setDraggingGroup] = useState<"OT" | "NT" | null>(null);
  const [draggingGroupIndex, setDraggingGroupIndex] = useState<number | null>(null);
  const [dropTargetOtIndex, setDropTargetOtIndex] = useState<number | null>(null);
  const [dropTargetNtIndex, setDropTargetNtIndex] = useState<number | null>(null);
  const step3ScrollRef = useRef<HTMLDivElement | null>(null);
  const otStep3ScrollRef = useRef<HTMLDivElement | null>(null);
  const ntStep3ScrollRef = useRef<HTMLDivElement | null>(null);

  const [otRepeat, setOtRepeat] = useState(1);
  const [ntRepeat, setNtRepeat] = useState(1);

  const otBooks = useMemo(() => BIBLE_BOOKS.slice(0, 39).map((b) => b.name), []);
  const ntBooks = useMemo(() => BIBLE_BOOKS.slice(39).map((b) => b.name), []);

  const otSet = useMemo(() => new Set(otBooks), [otBooks]);
  const ntSet = useMemo(() => new Set(ntBooks), [ntBooks]);

  const countsByBook = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of selectedBooks) {
      map.set(b, (map.get(b) ?? 0) + 1);
    }
    return map;
  }, [selectedBooks]);

  const selectedLabel = useMemo(() => {
    if (selectedBooks.length === 0) return "(선택된 책 없음)";
    const first = selectedBooks[0];
    const last = selectedBooks[selectedBooks.length - 1];
    return selectedBooks.length === 1 ? `(${first})` : `(${first} ~ ${last}, 총 ${selectedBooks.length}항목)`;
  }, [selectedBooks]);

  const autoPlanName = useMemo(() => {
    if (selectedBooks.length === 0) return "";

    const allBooks = BIBLE_BOOKS.map((b) => b.name);
    const allSet = new Set(allBooks);
    const otSet = new Set(BIBLE_BOOKS.slice(0, 39).map((b) => b.name));
    const ntSet = new Set(BIBLE_BOOKS.slice(39).map((b) => b.name));

    const counts = new Map<string, number>();
    for (const b of selectedBooks) counts.set(b, (counts.get(b) ?? 0) + 1);

    const uniformReadCount = (set: Set<string>) => {
      let n: number | null = null;
      for (const b of set) {
        const c = counts.get(b) ?? 0;
        if (c === 0) return null;
        if (n === null) n = c;
        else if (n !== c) return null;
      }
      for (const [b] of counts) {
        if (!set.has(b)) return null;
      }
      return n;
    };

    const allN = uniformReadCount(allSet);
    if (allN) return allN === 1 ? `성경 전체 (66권)` : `성경 전체 ${allN}독`;

    const otN = uniformReadCount(otSet);
    if (otN) return otN === 1 ? `구약 전체 (39권)` : `구약 전체 ${otN}독`;

    const ntN = uniformReadCount(ntSet);
    if (ntN) return ntN === 1 ? `신약 전체 (27권)` : `신약 전체 ${ntN}독`;

    if (selectedBooks.length === 1) return selectedBooks[0];
    const first = selectedBooks[0];
    const last = selectedBooks[selectedBooks.length - 1];
    return `${first} ~ ${last} (${selectedBooks.length}항목)`;
  }, [selectedBooks]);

  const finalName = useMemo(() => (name.trim() || autoPlanName).trim(), [name, autoPlanName]);
  const isFinalNameValid = finalName.length > 0 && finalName.length <= MAX_PLAN_NAME_LENGTH;

  const uniqueBookCount = useMemo(() => new Set(selectedBooks).size, [selectedBooks]);
  const duplicateEntryCount = useMemo(
    () => Math.max(0, selectedBooks.length - uniqueBookCount),
    [selectedBooks.length, uniqueBookCount]
  );

  const totalChapters = useMemo(() => {
    if (selectedBooks.length === 0) return 0;
    const chapterByName = new Map(BIBLE_BOOKS.map((b) => [b.name, b.chapters] as const));
    return selectedBooks.reduce((acc, n) => acc + (chapterByName.get(n) ?? 0), 0);
  }, [selectedBooks]);

  const avgChaptersPerDay = useMemo(() => {
    if (!computedTotalDays || computedTotalDays <= 0) return null;
    if (totalChapters <= 0) return 0;
    return totalChapters / computedTotalDays;
  }, [computedTotalDays, totalChapters]);

  const addBook = (bookName: string) => {
    setSelectedBooks((prev) => [...prev, bookName]);
  };

  const clampRepeat = (n: number) => {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.floor(n)));
  };

  const applyCountForBook = (list: string[], bookName: string, desiredCountRaw: number) => {
    const desiredCount = clampRepeat(desiredCountRaw);
    const next = [...list];
    const currentCount = next.reduce((acc, n) => acc + (n === bookName ? 1 : 0), 0);

    if (desiredCount > currentCount) {
      const add = desiredCount - currentCount;
      for (let i = 0; i < add; i++) next.push(bookName);
      return next;
    }

    if (desiredCount < currentCount) {
      let remove = currentCount - desiredCount;
      for (let i = next.length - 1; i >= 0 && remove > 0; i--) {
        if (next[i] === bookName) {
          next.splice(i, 1);
          remove -= 1;
        }
      }
      return next;
    }

    return next;
  };

  const setBookCount = (bookName: string, desiredCount: number) => {
    setSelectedBooks((prev) => applyCountForBook(prev, bookName, desiredCount));
  };

  const setSectionAll = (testament: Testament, repeatCount: number) => {
    const books = testament === "OT" ? otBooks : ntBooks;
    setSelectedBooks((prev) => {
      let next = [...prev];
      for (const b of books) next = applyCountForBook(next, b, repeatCount);
      return next;
    });
  };

  const clearSection = (testament: Testament) => {
    const books = testament === "OT" ? otBooks : ntBooks;
    setSelectedBooks((prev) => {
      let next = [...prev];
      for (const b of books) next = applyCountForBook(next, b, 0);
      return next;
    });
  };

  const removeSelectedAt = (index: number) => {
    setSelectedBooks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSelected = (from: number, to: number) => {
    setSelectedBooks((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const shuffleArray = <T,>(arr: T[]) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const shuffleSelected = (mode: "OT" | "NT" | "ALL") => {
    setSelectedBooks((prev) => {
      if (prev.length <= 1) return prev;

      if (mode === "ALL") {
        return shuffleArray(prev);
      }

      const isTarget = (book: string) => (mode === "OT" ? otSet.has(book) : ntSet.has(book));
      const indices = [] as number[];
      const values = [] as string[];

      for (let i = 0; i < prev.length; i++) {
        if (isTarget(prev[i])) {
          indices.push(i);
          values.push(prev[i]);
        }
      }

      if (values.length <= 1) return prev;

      const shuffled = shuffleArray(values);
      const next = [...prev];
      for (let k = 0; k < indices.length; k++) {
        next[indices[k]] = shuffled[k];
      }
      return next;
    });
  };

  const splitSelected = useMemo(() => {
    const ot: string[] = [];
    const nt: string[] = [];
    for (const b of selectedBooks) {
      if (otSet.has(b)) ot.push(b);
      else if (ntSet.has(b)) nt.push(b);
      else ot.push(b);
    }
    return { ot, nt };
  }, [ntSet, otSet, selectedBooks]);

  const applySeparateMode = (enabled: boolean) => {
    setSeparateTestamentReading(enabled);
    setShowShuffleOptions(false);
    setShowOtShuffleMenu(false);
    setShowNtShuffleMenu(false);
    setDraggingGroup(null);
    setDraggingGroupIndex(null);
    setDropTargetOtIndex(null);
    setDropTargetNtIndex(null);

    if (!enabled) return;
    // Group into OT then NT for a stable two-column UX.
    setSelectedBooks((prev) => {
      const ot: string[] = [];
      const nt: string[] = [];
      for (const b of prev) {
        if (otSet.has(b)) ot.push(b);
        else if (ntSet.has(b)) nt.push(b);
        else ot.push(b);
      }
      return [...ot, ...nt];
    });
  };

  const moveWithinGroup = (group: "OT" | "NT", from: number, to: number) => {
    const cur = group === "OT" ? splitSelected.ot : splitSelected.nt;
    if (from < 0 || from >= cur.length) return;
    if (to < 0 || to >= cur.length) return;
    const nextGroup = [...cur];
    const [item] = nextGroup.splice(from, 1);
    nextGroup.splice(to, 0, item);
    const other = group === "OT" ? splitSelected.nt : splitSelected.ot;
    setSelectedBooks(group === "OT" ? [...nextGroup, ...other] : [...other, ...nextGroup]);
  };

  const removeFromGroupAt = (group: "OT" | "NT", index: number) => {
    const cur = group === "OT" ? splitSelected.ot : splitSelected.nt;
    if (index < 0 || index >= cur.length) return;
    const nextGroup = cur.filter((_, i) => i !== index);
    const other = group === "OT" ? splitSelected.nt : splitSelected.ot;
    setSelectedBooks(group === "OT" ? [...nextGroup, ...other] : [...other, ...nextGroup]);
  };

  const shuffleGroup = (group: "OT" | "NT") => {
    const cur = group === "OT" ? splitSelected.ot : splitSelected.nt;
    if (cur.length <= 1) return;
    const nextGroup = shuffleArray(cur);
    const other = group === "OT" ? splitSelected.nt : splitSelected.ot;
    setSelectedBooks(group === "OT" ? [...nextGroup, ...other] : [...other, ...nextGroup]);
  };

  const resetAllToCanonicalOrder = () => {
    setSelectedBooks((prev) => {
      if (prev.length <= 1) return prev;
      const counts = new Map<string, number>();
      for (const b of prev) counts.set(b, (counts.get(b) ?? 0) + 1);

      const next: string[] = [];
      for (const b of otBooks) {
        const c = counts.get(b) ?? 0;
        for (let i = 0; i < c; i++) next.push(b);
        if (c > 0) counts.delete(b);
      }
      for (const b of ntBooks) {
        const c = counts.get(b) ?? 0;
        for (let i = 0; i < c; i++) next.push(b);
        if (c > 0) counts.delete(b);
      }

      // If any unknown books exist, preserve their relative order at the end.
      if (counts.size > 0) {
        for (const b of prev) {
          const c = counts.get(b);
          if (!c) continue;
          next.push(b);
          const remaining = c - 1;
          if (remaining <= 0) counts.delete(b);
          else counts.set(b, remaining);
        }
      }

      return next;
    });
  };

  const resetGroupToCanonicalOrder = (group: "OT" | "NT") => {
    const cur = group === "OT" ? splitSelected.ot : splitSelected.nt;
    if (cur.length <= 1) return;

    const counts = new Map<string, number>();
    for (const b of cur) counts.set(b, (counts.get(b) ?? 0) + 1);

    const canonical = group === "OT" ? otBooks : ntBooks;
    const nextGroup: string[] = [];
    for (const b of canonical) {
      const c = counts.get(b) ?? 0;
      for (let i = 0; i < c; i++) nextGroup.push(b);
      if (c > 0) counts.delete(b);
    }

    if (counts.size > 0) {
      for (const b of cur) {
        const c = counts.get(b);
        if (!c) continue;
        nextGroup.push(b);
        const remaining = c - 1;
        if (remaining <= 0) counts.delete(b);
        else counts.set(b, remaining);
      }
    }

    const other = group === "OT" ? splitSelected.nt : splitSelected.ot;
    setSelectedBooks(group === "OT" ? [...nextGroup, ...other] : [...other, ...nextGroup]);
  };

  const handleStep3AutoScroll = (clientY: number, elOverride?: HTMLDivElement | null) => {
    const el = elOverride ?? step3ScrollRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const edge = 48; // px
    const maxSpeed = 18; // px per dragover

    const topZone = rect.top + edge;
    const bottomZone = rect.bottom - edge;

    if (clientY < topZone) {
      const strength = Math.min(1, (topZone - clientY) / edge);
      el.scrollTop -= Math.ceil(maxSpeed * strength);
    } else if (clientY > bottomZone) {
      const strength = Math.min(1, (clientY - bottomZone) / edge);
      el.scrollTop += Math.ceil(maxSpeed * strength);
    }
  };

  const step1Valid = !isDateRangeInvalid && !!startDate && !!endDate;
  const step2Valid = selectedBooks.length > 0;

  const handleSave = () => {
    if (!startDate || !endDate) {
      alert("시작 날짜와 종료 날짜를 입력해주세요");
      return;
    }

    if (selectedBooks.length === 0) {
      alert("책을 1개 이상 선택해주세요");
      return;
    }

    try {
      const { totalDays, schedule } = (() => {
        if (!separateTestamentReading) {
          return generateScheduleFromSelectedBooks({
            startDate,
            endDate,
            selectedBooks,
          });
        }

        const otSelected = selectedBooks.filter((b) => otSet.has(b));
        const ntSelected = selectedBooks.filter((b) => ntSet.has(b));

        if (otSelected.length === 0 || ntSelected.length === 0) {
          throw new Error("구약/신약을 각각 1개 이상 선택해주세요.");
        }

        const ot = generateScheduleFromSelectedBooks({ startDate, endDate, selectedBooks: otSelected });
        const nt = generateScheduleFromSelectedBooks({ startDate, endDate, selectedBooks: ntSelected });

        if (ot.totalDays !== nt.totalDays) {
          throw new Error("구약/신약 계획 날짜가 일치하지 않습니다. 날짜를 다시 확인해주세요.");
        }

        const merged = ot.schedule.map((d, idx) => ({
          day: d.day,
          readings: [...(d.readings ?? []), ...(nt.schedule[idx]?.readings ?? [])],
        }));

        return { totalDays: ot.totalDays, schedule: merged };
      })();

      if (totalDays > MAX_TOTAL_DAYS) {
        alert(`계획 기간이 너무 깁니다. 최대 ${MAX_TOTAL_DAYS}일까지 가능합니다.`);
        return;
      }

      const scheduleRows = schedule.reduce((acc, d) => acc + (d.readings?.length ?? 0), 0);
      if (scheduleRows > MAX_SCHEDULE_ROWS) {
        alert(
          `계획이 너무 큽니다. (읽기 항목 ${scheduleRows}개) 최대 ${MAX_SCHEDULE_ROWS}개까지 가능합니다.\n\n날짜 범위를 줄이거나, 하루에 읽기 항목이 너무 많이 생기지 않도록 책/순서를 조정해주세요.`
        );
        return;
      }

      const finalName = name.trim() || autoPlanName;

      if (!finalName) {
        alert("계획 이름을 입력해주세요");
        return;
      }

      if (finalName.length > MAX_PLAN_NAME_LENGTH) {
        alert(`계획 이름이 너무 깁니다. (최대 ${MAX_PLAN_NAME_LENGTH}자)`);
        return;
      }

      const fixed = disambiguateScheduleForDb(schedule);
      if (fixed.duplicatesFixed > 0) {
        const ok = window.confirm(
          `같은 날짜에 동일한 읽기 항목이 ${fixed.duplicatesFixed}개 중복되어 자동으로 보정했습니다.\n\n계속 진행할까요?`
        );
        if (!ok) return;
      }

      onSave({
        name: finalName,
        description: undefined,
        startDate,
        endDate,
        totalDays,
        schedule: fixed.schedule,
        isCustom: true,
      });
    } catch (err: any) {
      alert(err?.message || "계획 생성에 실패했습니다");
    }
  };

  const isCreateDisabled =
    selectedBooks.length === 0 ||
    !startDate ||
    !endDate ||
    isDateRangeInvalid ||
    !isFinalNameValid;

  const goNext = () => {
    if (step === 1) {
      if (!step1Valid) {
        alert("날짜 범위를 올바르게 입력해주세요");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!step2Valid) {
        alert("책을 1개 이상 선택해주세요");
        return;
      }
      setStep(3);
    }
  };

  const goPrev = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const otAllSelected = useMemo(() => otBooks.every((b) => (countsByBook.get(b) ?? 0) > 0), [otBooks, countsByBook]);
  const ntAllSelected = useMemo(() => ntBooks.every((b) => (countsByBook.get(b) ?? 0) > 0), [ntBooks, countsByBook]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-card text-card-foreground border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card/80 backdrop-blur border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BookPlus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2>새 계획 만들기</h2>
                <p className="text-muted-foreground text-sm">날짜 + 책 선택</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stepper */}
          <div className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 1 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                }`}
              >
                정보 입력
              </button>

              <span className="text-muted-foreground/60 shrink-0">→</span>

              <button
                type="button"
                onClick={() => {
                  if (!step1Valid) {
                    alert("날짜 범위를 올바르게 입력해주세요");
                    return;
                  }
                  setStep(2);
                }}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 2 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                }`}
              >
                범위 선택
              </button>

              <span className="text-muted-foreground/60 shrink-0">→</span>

              <button
                type="button"
                onClick={() => {
                  if (!step1Valid) {
                    alert("날짜 범위를 올바르게 입력해주세요");
                    return;
                  }
                  if (!step2Valid) {
                    alert("책을 1개 이상 선택해주세요");
                    return;
                  }
                  setStep(3);
                }}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 3 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                }`}
              >
                순서 확인
              </button>
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm text-muted-foreground">계획 이름</div>
                    <div className="text-xs text-muted-foreground">비우면 자동</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{(name ?? "").length}/{MAX_PLAN_NAME_LENGTH}</div>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_PLAN_NAME_LENGTH}
                  className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
                  placeholder="예) 성경 1년 1독 / 구약 90일"
                />
                


                {!isFinalNameValid && finalName.length > MAX_PLAN_NAME_LENGTH && (
                  <div className="text-sm text-destructive mt-2">이름이 너무 깁니다. (최대 {MAX_PLAN_NAME_LENGTH}자)</div>
                )}
                {!name.trim() && autoPlanName && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    자동 이름: <span className="font-medium text-foreground">{autoPlanName}</span>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-xl p-4">
                <div className="mb-3">
                  <div className="text-sm text-muted-foreground">날짜 범위</div>
                  <div className="text-xs text-muted-foreground">최대 {MAX_TOTAL_DAYS}일</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">시작 날짜</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setStartDate(nextStart);

                        // Keep endDate within [startDate, startDate + MAX_TOTAL_DAYS - 1]
                        if (!nextStart) return;
                        const max = (() => {
                          const s = parseDate(nextStart);
                          const m = new Date(s);
                          m.setDate(m.getDate() + (MAX_TOTAL_DAYS - 1));
                          return formatDateYMD(m);
                        })();

                        setEndDate((prevEnd) => {
                          if (!prevEnd) return nextStart;
                          if (prevEnd < nextStart) return nextStart;
                          if (prevEnd > max) return max;
                          return prevEnd;
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">종료 날짜</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      max={maxEndDate}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        if (!nextEnd) {
                          setEndDate(nextEnd);
                          return;
                        }

                        if (startDate && nextEnd < startDate) {
                          setEndDate(startDate);
                          return;
                        }

                        if (maxEndDate && nextEnd > maxEndDate) {
                          setEndDate(maxEndDate);
                          return;
                        }

                        setEndDate(nextEnd);
                      }}
                      className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-3">
                  {computedTotalDays !== null && <span>현재 {computedTotalDays}일</span>}
                  {maxEndDate && <span className="ml-2">(최대 종료 날짜: {maxEndDate})</span>}
                  {computedTotalDays !== null && computedTotalDays > MAX_TOTAL_DAYS && (
                    <div className="mt-1 text-destructive">기간이 너무 깁니다. 종료 날짜를 줄여주세요.</div>
                  )}
                  {computedTotalDays !== null && computedTotalDays <= 0 && (
                    <div className="mt-1 text-destructive">종료 날짜는 시작 날짜 이후여야 합니다.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-4">책 선택</div>

                {/* OT/NT Tabs */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTestament("OT")}
                    className={`px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors min-w-0 ${
                      activeTestament === "OT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    구약
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTestament("NT")}
                    className={`px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors min-w-0 ${
                      activeTestament === "NT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    신약
                  </button>

                  <div className="flex-1" />
                </div>

                {/* Active Tab Panel */}
                {activeTestament === "OT" ? (
                  <div className="border border-border rounded-lg p-3 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div className="font-medium text-foreground">구약</div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <label className="inline-flex items-center gap-2 text-sm text-foreground whitespace-nowrap shrink-0">
                          <input
                            type="checkbox"
                            checked={otAllSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) setSectionAll("OT", clampRepeat(otRepeat) || 1);
                              else clearSection("OT");
                            }}
                          />
                          전체 선택
                        </label>

                        <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.max(1, clampRepeat(otRepeat - 1) || 1);
                              setOtRepeat(v);
                              if (otAllSelected) setSectionAll("OT", v);
                            }}
                            className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                            title="-"
                          >
                            −
                          </button>
                          <div className="w-10 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">x{otRepeat}</div>
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.min(10, clampRepeat(otRepeat + 1) || 1);
                              setOtRepeat(v);
                              if (otAllSelected) setSectionAll("OT", v);
                            }}
                            className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                            title="+"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => clearSection("OT")}
                            className="px-2 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs sm:text-sm whitespace-nowrap"
                            title="구약 초기화"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                      {otBooks.map((bn) => {
                        const count = countsByBook.get(bn) ?? 0;
                        return (
                          <div key={bn} className="flex items-center gap-2 border border-border rounded-lg px-2 py-2 bg-background min-w-0">
                            <button
                              type="button"
                              onClick={() => setBookCount(bn, count + 1)}
                              className="flex-1 min-w-0 text-left"
                              title={bn}
                            >
                              <div className="text-sm text-foreground truncate">{bn}</div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                                title="-1"
                              >
                                −
                              </button>
                              <div className={`w-9 text-center text-xs sm:text-sm font-medium ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                x{count}
                              </div>
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, count + 1)}
                                className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                                title="+1"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg p-3 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div className="font-medium text-foreground">신약</div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <label className="inline-flex items-center gap-2 text-sm text-foreground whitespace-nowrap shrink-0">
                          <input
                            type="checkbox"
                            checked={ntAllSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) setSectionAll("NT", clampRepeat(ntRepeat) || 1);
                              else clearSection("NT");
                            }}
                          />
                          전체 선택
                        </label>

                        <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.max(1, clampRepeat(ntRepeat - 1) || 1);
                              setNtRepeat(v);
                              if (ntAllSelected) setSectionAll("NT", v);
                            }}
                            className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                            title="-"
                          >
                            −
                          </button>
                          <div className="w-10 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">x{ntRepeat}</div>
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.min(10, clampRepeat(ntRepeat + 1) || 1);
                              setNtRepeat(v);
                              if (ntAllSelected) setSectionAll("NT", v);
                            }}
                            className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                            title="+"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => clearSection("NT")}
                            className="px-2 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs sm:text-sm whitespace-nowrap"
                            title="신약 초기화"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                      {ntBooks.map((bn) => {
                        const count = countsByBook.get(bn) ?? 0;
                        return (
                          <div key={bn} className="flex items-center gap-2 border border-border rounded-lg px-2 py-2 bg-background min-w-0">
                            <button
                              type="button"
                              onClick={() => setBookCount(bn, count + 1)}
                              className="flex-1 min-w-0 text-left"
                              title={bn}
                            >
                              <div className="text-sm text-foreground truncate">{bn}</div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                                title="-1"
                              >
                                −
                              </button>
                              <div className={`w-9 text-center text-xs sm:text-sm font-medium ${count > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                x{count}
                              </div>
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, count + 1)}
                                className="w-7 h-7 rounded-lg border border-border hover:bg-accent text-sm"
                                title="+1"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-3 break-words">
                  선택: {selectedBooks.length}항목
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
                  <div>
                    <div className="text-sm text-muted-foreground">선택된 리스트 최종 확인</div>
                    <div className="text-xs text-muted-foreground">드래그로 순서 변경</div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={separateTestamentReading}
                        onChange={(e) => applySeparateMode(e.target.checked)}
                      />
                      구약/신약 따로 읽기
                    </label>

                    {!separateTestamentReading && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowShuffleOptions((v) => !v)}
                          className="px-2 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs sm:text-sm whitespace-nowrap"
                          title="섞기"
                        >
                          섞기
                        </button>

                        {showShuffleOptions && (
                          <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-card text-card-foreground shadow-sm p-1 z-10">
                            <button
                              type="button"
                              onClick={() => {
                                shuffleSelected("OT");
                                setShowShuffleOptions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                            >
                              구약만 섞기
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                shuffleSelected("NT");
                                setShowShuffleOptions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                            >
                              신약만 섞기
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                shuffleSelected("ALL");
                                setShowShuffleOptions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                            >
                              랜덤 섞기
                            </button>

                            <div className="h-px bg-border my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                resetAllToCanonicalOrder();
                                setShowShuffleOptions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                            >
                              기본 순서로 초기화
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedBooks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">아직 선택된 책이 없습니다.</div>
                ) : separateTestamentReading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* OT */}
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-medium">구약</div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtShuffleMenu((v) => !v);
                              setShowNtShuffleMenu(false);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs sm:text-sm whitespace-nowrap"
                          >
                            섞기
                          </button>
                          {showOtShuffleMenu && (
                            <div className="absolute right-0 mt-2 w-32 rounded-lg border border-border bg-card text-card-foreground shadow-sm p-1 z-10">
                              <button
                                type="button"
                                onClick={() => {
                                  shuffleGroup("OT");
                                  setShowOtShuffleMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                              >
                                랜덤 섞기
                              </button>

                              <div className="h-px bg-border my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  resetGroupToCanonicalOrder("OT");
                                  setShowOtShuffleMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                              >
                                초기화
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div ref={otStep3ScrollRef} className="max-h-72 overflow-y-auto pr-1 space-y-2">
                        {splitSelected.ot.length === 0 ? (
                          <div className="text-sm text-muted-foreground">구약이 비어 있습니다.</div>
                        ) : (
                          splitSelected.ot.map((bn, idx) => (
                            <div
                              key={`ot-${bn}-${idx}`}
                              draggable
                              onDragStart={() => {
                                setDraggingGroup("OT");
                                setDraggingGroupIndex(idx);
                                setDropTargetOtIndex(null);
                                setDropTargetNtIndex(null);
                              }}
                              onDragEnd={() => {
                                setDraggingGroup(null);
                                setDraggingGroupIndex(null);
                                setDropTargetOtIndex(null);
                                setDropTargetNtIndex(null);
                              }}
                              onDragOver={(e) => {
                                if (draggingGroup !== "OT") return;
                                e.preventDefault();
                                setDropTargetOtIndex(idx);
                                handleStep3AutoScroll(e.clientY, otStep3ScrollRef.current);
                              }}
                              onDrop={() => {
                                if (draggingGroup !== "OT") return;
                                if (draggingGroupIndex === null || draggingGroupIndex === idx) {
                                  setDropTargetOtIndex(null);
                                  return;
                                }
                                moveWithinGroup("OT", draggingGroupIndex, idx);
                                setDraggingGroup(null);
                                setDraggingGroupIndex(null);
                                setDropTargetOtIndex(null);
                              }}
                              className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors cursor-move active:cursor-grabbing ${
                                draggingGroup === "OT" && draggingGroupIndex === idx ? "opacity-60" : ""
                              } ${
                                dropTargetOtIndex === idx && draggingGroup === "OT" && draggingGroupIndex !== null && draggingGroupIndex !== idx
                                  ? "border-primary ring-2 ring-ring"
                                  : "border-border"
                              }`}
                            >
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-muted-foreground/60 shrink-0 select-none">≡</span>
                              <span className="text-sm text-foreground min-w-0 flex-1 break-words">{bn}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromGroupAt("OT", idx);
                                }}
                                className="w-8 h-8 rounded-lg border border-border hover:bg-destructive/10 text-destructive shrink-0 text-sm"
                                title="삭제"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* NT */}
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-medium">신약</div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowNtShuffleMenu((v) => !v);
                              setShowOtShuffleMenu(false);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs sm:text-sm whitespace-nowrap"
                          >
                            섞기
                          </button>
                          {showNtShuffleMenu && (
                            <div className="absolute right-0 mt-2 w-32 rounded-lg border border-border bg-card text-card-foreground shadow-sm p-1 z-10">
                              <button
                                type="button"
                                onClick={() => {
                                  shuffleGroup("NT");
                                  setShowNtShuffleMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                              >
                                랜덤 섞기
                              </button>

                              <div className="h-px bg-border my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  resetGroupToCanonicalOrder("NT");
                                  setShowNtShuffleMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                              >
                                초기화
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div ref={ntStep3ScrollRef} className="max-h-72 overflow-y-auto pr-1 space-y-2">
                        {splitSelected.nt.length === 0 ? (
                          <div className="text-sm text-muted-foreground">신약이 비어 있습니다.</div>
                        ) : (
                          splitSelected.nt.map((bn, idx) => (
                            <div
                              key={`nt-${bn}-${idx}`}
                              draggable
                              onDragStart={() => {
                                setDraggingGroup("NT");
                                setDraggingGroupIndex(idx);
                                setDropTargetOtIndex(null);
                                setDropTargetNtIndex(null);
                              }}
                              onDragEnd={() => {
                                setDraggingGroup(null);
                                setDraggingGroupIndex(null);
                                setDropTargetOtIndex(null);
                                setDropTargetNtIndex(null);
                              }}
                              onDragOver={(e) => {
                                if (draggingGroup !== "NT") return;
                                e.preventDefault();
                                setDropTargetNtIndex(idx);
                                handleStep3AutoScroll(e.clientY, ntStep3ScrollRef.current);
                              }}
                              onDrop={() => {
                                if (draggingGroup !== "NT") return;
                                if (draggingGroupIndex === null || draggingGroupIndex === idx) {
                                  setDropTargetNtIndex(null);
                                  return;
                                }
                                moveWithinGroup("NT", draggingGroupIndex, idx);
                                setDraggingGroup(null);
                                setDraggingGroupIndex(null);
                                setDropTargetNtIndex(null);
                              }}
                              className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors cursor-move active:cursor-grabbing ${
                                draggingGroup === "NT" && draggingGroupIndex === idx ? "opacity-60" : ""
                              } ${
                                dropTargetNtIndex === idx && draggingGroup === "NT" && draggingGroupIndex !== null && draggingGroupIndex !== idx
                                  ? "border-primary ring-2 ring-ring"
                                  : "border-border"
                              }`}
                            >
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-muted-foreground/60 shrink-0 select-none">≡</span>
                              <span className="text-sm text-foreground min-w-0 flex-1 break-words">{bn}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromGroupAt("NT", idx);
                                }}
                                className="w-8 h-8 rounded-lg border border-border hover:bg-destructive/10 text-destructive shrink-0 text-sm"
                                title="삭제"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={step3ScrollRef}
                    className="max-h-72 overflow-y-auto pr-1"
                    onDragOver={(e) => {
                      if (draggingIndex === null) return;
                      e.preventDefault();
                      handleStep3AutoScroll(e.clientY);
                    }}
                  >
                    <div className="space-y-2">
                      {selectedBooks.map((bn, idx) => (
                        <div
                          key={`${bn}-${idx}`}
                          draggable
                          onDragStart={() => {
                            setDraggingIndex(idx);
                            setDropTargetIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggingIndex(null);
                            setDropTargetIndex(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropTargetIndex(idx);
                            handleStep3AutoScroll(e.clientY);
                          }}
                          onDrop={() => {
                            if (draggingIndex === null || draggingIndex === idx) {
                              setDropTargetIndex(null);
                              return;
                            }
                            moveSelected(draggingIndex, idx);
                            setDraggingIndex(null);
                            setDropTargetIndex(null);
                          }}
                          className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors cursor-move active:cursor-grabbing ${
                            draggingIndex === idx ? "opacity-60" : ""
                          } ${
                            dropTargetIndex === idx && draggingIndex !== null && draggingIndex !== idx
                              ? "border-primary ring-2 ring-ring"
                              : "border-border"
                          }`}
                          title="드래그해서 이동"
                        >
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                            {idx + 1}
                          </span>

                          <span className="text-muted-foreground/60 shrink-0 select-none">≡</span>

                          <span className="text-sm text-foreground min-w-0 flex-1 break-words">{bn}</span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelectedAt(idx);
                            }}
                            className="w-8 h-8 rounded-lg border border-border hover:bg-destructive/10 text-destructive shrink-0 text-sm"
                            title="삭제"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-3 break-words">
                  중복 선택 = 2독/3독
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card/80 backdrop-blur border-t border-border p-6 space-y-3">
          {/* 수치 기반 요약 */}
          <div className="text-xs sm:text-sm text-muted-foreground">
            {selectedBooks.length === 0 || computedTotalDays === null || computedTotalDays <= 0 ? (
              <span className="text-muted-foreground">책과 날짜를 선택하면 요약이 표시됩니다.</span>
            ) : (
              <span>
                총 <span className="font-medium">{uniqueBookCount}권</span>
                {duplicateEntryCount > 0 && (
                  <span className="text-muted-foreground">(+중복 {duplicateEntryCount})</span>
                )}
                {` (${totalChapters}장)을 `}
                <span className="font-medium">{computedTotalDays}일</span> 동안 읽습니다.
                {avgChaptersPerDay !== null && (
                  <span className="text-muted-foreground"> (하루 평균 {parseFloat(avgChaptersPerDay.toFixed(1))}장)</span>
                )}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-3 py-2.5 border border-border bg-background rounded-lg hover:bg-accent transition-colors text-sm"
            >
              취소
            </button>

            <div className="flex-1 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="flex-1 px-3 py-2.5 border border-border bg-background rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  이전
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  다음
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isCreateDisabled}
                  className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:hover:bg-primary text-sm"
                >
                  계획 생성
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
