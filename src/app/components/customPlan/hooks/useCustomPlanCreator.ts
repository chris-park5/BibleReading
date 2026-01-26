import { useMemo, useRef, useState } from "react";
import { BIBLE_BOOKS } from "../../../data/bibleBooks";
import { generateScheduleFromSelectedBooks } from "../../../utils/generateScheduleFromSelectedBooks";
import { disambiguateScheduleForDb } from "../../../utils/scheduleUniq";

export type Reading = {
  book: string;
  chapters: string;
};

export type PlanData = {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  schedule: Array<{ day: number; readings: Reading[] }>;
  isCustom: boolean;
};

export type Testament = "OT" | "NT";

export function useCustomPlanCreator({
  onSave,
}: {
  onSave: (planData: PlanData) => void;
}) {
  type Step = 1 | 2 | 3;
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const MAX_PLAN_NAME_LENGTH = 255;
  const MAX_TOTAL_DAYS = 3650;
  const MAX_SCHEDULE_ROWS = 20000;
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

  const [activeTestament, setActiveTestament] = useState<Testament>("OT");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  
  // Drag and Drop & Shuffle states
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
    const maxSpeed = 18; // px

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

  return {
    step, setStep,
    name, setName,
    startDate, setStartDate,
    endDate, setEndDate,
    MAX_PLAN_NAME_LENGTH,
    MAX_TOTAL_DAYS,
    maxEndDate,
    computedTotalDays,
    isDateRangeInvalid,
    finalName,
    isFinalNameValid,
    autoPlanName,
    
    activeTestament, setActiveTestament,
    otBooks, ntBooks,
    selectedBooks,
    countsByBook,
    otRepeat, setOtRepeat,
    ntRepeat, setNtRepeat,
    otAllSelected, ntAllSelected,
    setBookCount, setSectionAll, clearSection, clampRepeat,

    separateTestamentReading, applySeparateMode,
    splitSelected,
    showShuffleOptions, setShowShuffleOptions,
    showOtShuffleMenu, setShowOtShuffleMenu,
    showNtShuffleMenu, setShowNtShuffleMenu,
    
    // Drag & Drop
    draggingIndex, setDraggingIndex,
    dropTargetIndex, setDropTargetIndex,
    draggingGroup, setDraggingGroup,
    draggingGroupIndex, setDraggingGroupIndex,
    dropTargetOtIndex, setDropTargetOtIndex,
    dropTargetNtIndex, setDropTargetNtIndex,

    // Refs
    step3ScrollRef,
    otStep3ScrollRef,
    ntStep3ScrollRef,

    // Actions
    removeSelectedAt,
    moveSelected,
    shuffleSelected,
    resetAllToCanonicalOrder,
    
    moveWithinGroup,
    removeFromGroupAt,
    shuffleGroup,
    resetGroupToCanonicalOrder,
    
    handleStep3AutoScroll,
    handleSave,
    isCreateDisabled,
    goNext, goPrev,
    step1Valid, step2Valid,
    
    uniqueBookCount,
    duplicateEntryCount,
    totalChapters,
    avgChaptersPerDay
  };
}
