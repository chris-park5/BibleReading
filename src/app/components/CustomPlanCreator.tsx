import { useMemo, useState } from "react";
import { X, BookPlus } from "lucide-react";
import { BIBLE_BOOKS } from "../data/bibleBooks";
import { generateScheduleFromSelectedBooks } from "../utils/generateScheduleFromSelectedBooks";

interface Reading {
  book: string;
  chapters: string;
}

interface CustomPlanCreatorProps {
  onClose: () => void;
  onSave: (planData: {
    name: string;
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

  const [otRepeat, setOtRepeat] = useState(1);
  const [ntRepeat, setNtRepeat] = useState(1);

  const otBooks = useMemo(() => BIBLE_BOOKS.slice(0, 39).map((b) => b.name), []);
  const ntBooks = useMemo(() => BIBLE_BOOKS.slice(39).map((b) => b.name), []);

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
    let next = [...list];
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
      const { totalDays, schedule } = generateScheduleFromSelectedBooks({
        startDate,
        endDate,
        selectedBooks,
      });

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

      onSave({
        name: finalName,
        startDate,
        endDate,
        totalDays,
        schedule,
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
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2>새 계획 만들기</h2>
                <p className="text-gray-600 text-sm">날짜 + 책 선택</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stepper */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border-2 text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 1 ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                정보 입력
              </button>

              <span className="text-gray-400 shrink-0">→</span>

              <button
                type="button"
                onClick={() => {
                  if (!step1Valid) {
                    alert("날짜 범위를 올바르게 입력해주세요");
                    return;
                  }
                  setStep(2);
                }}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border-2 text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 2 ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                범위 선택
              </button>

              <span className="text-gray-400 shrink-0">→</span>

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
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border-2 text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  step === 3 ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                순서 확인
              </button>
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm text-gray-600">계획 이름</div>
                    <div className="text-xs text-gray-500">비우면 자동</div>
                  </div>
                  <div className="text-xs text-gray-500">{(name ?? "").length}/{MAX_PLAN_NAME_LENGTH}</div>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_PLAN_NAME_LENGTH}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="예) 성경 1년 1독 / 구약 90일"
                />
                {!isFinalNameValid && finalName.length > MAX_PLAN_NAME_LENGTH && (
                  <div className="text-sm text-red-600 mt-2">이름이 너무 깁니다. (최대 {MAX_PLAN_NAME_LENGTH}자)</div>
                )}
                {!name.trim() && autoPlanName && (
                  <div className="mt-2 text-sm text-gray-600">
                    자동 이름: <span className="font-medium text-gray-800">{autoPlanName}</span>
                  </div>
                )}
              </div>

              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="mb-3">
                  <div className="text-sm text-gray-600">날짜 범위</div>
                  <div className="text-xs text-gray-500">최대 {MAX_TOTAL_DAYS}일</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">시작 날짜</label>
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">종료 날짜</label>
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-3">
                  {computedTotalDays !== null && <span>현재 {computedTotalDays}일</span>}
                  {maxEndDate && <span className="ml-2">(최대 종료 날짜: {maxEndDate})</span>}
                  {computedTotalDays !== null && computedTotalDays > MAX_TOTAL_DAYS && (
                    <div className="mt-1 text-red-600">기간이 너무 깁니다. 종료 날짜를 줄여주세요.</div>
                  )}
                  {computedTotalDays !== null && computedTotalDays <= 0 && (
                    <div className="mt-1 text-red-600">종료 날짜는 시작 날짜 이후여야 합니다.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-4">책 선택</div>

                {/* OT/NT Tabs */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTestament("OT")}
                    className={`px-2 py-1.5 rounded-lg border-2 text-xs sm:text-sm whitespace-nowrap transition-colors min-w-0 ${
                      activeTestament === "OT"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    구약
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTestament("NT")}
                    className={`px-2 py-1.5 rounded-lg border-2 text-xs sm:text-sm whitespace-nowrap transition-colors min-w-0 ${
                      activeTestament === "NT"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    신약
                  </button>

                  <div className="flex-1" />
                </div>

                {/* Active Tab Panel */}
                {activeTestament === "OT" ? (
                  <div className="border border-gray-200 rounded-lg p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-medium text-gray-800">구약</div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
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

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.max(1, clampRepeat(otRepeat - 1) || 1);
                              setOtRepeat(v);
                              if (otAllSelected) setSectionAll("OT", v);
                            }}
                            className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                            title="-"
                          >
                            −
                          </button>
                          <div className="w-10 text-center text-xs sm:text-sm font-medium text-gray-700">x{otRepeat}</div>
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.min(10, clampRepeat(otRepeat + 1) || 1);
                              setOtRepeat(v);
                              if (otAllSelected) setSectionAll("OT", v);
                            }}
                            className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                            title="+"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => clearSection("OT")}
                            className="px-2 py-1.5 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors text-xs sm:text-sm"
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
                          <div key={bn} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-2 bg-white min-w-0">
                            <button
                              type="button"
                              onClick={() => setBookCount(bn, count + 1)}
                              className="flex-1 min-w-0 text-left"
                              title={bn}
                            >
                              <div className="text-sm text-gray-800 truncate">{bn}</div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                                title="-1"
                              >
                                −
                              </button>
                              <div className={`w-9 text-center text-xs sm:text-sm font-medium ${count > 0 ? "text-blue-700" : "text-gray-400"}`}>
                                x{count}
                              </div>
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, count + 1)}
                                className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
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
                  <div className="border border-gray-200 rounded-lg p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-medium text-gray-800">신약</div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
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

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.max(1, clampRepeat(ntRepeat - 1) || 1);
                              setNtRepeat(v);
                              if (ntAllSelected) setSectionAll("NT", v);
                            }}
                            className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                            title="-"
                          >
                            −
                          </button>
                          <div className="w-10 text-center text-xs sm:text-sm font-medium text-gray-700">x{ntRepeat}</div>
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.min(10, clampRepeat(ntRepeat + 1) || 1);
                              setNtRepeat(v);
                              if (ntAllSelected) setSectionAll("NT", v);
                            }}
                            className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                            title="+"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => clearSection("NT")}
                            className="px-2 py-1.5 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors text-xs sm:text-sm"
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
                          <div key={bn} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-2 bg-white min-w-0">
                            <button
                              type="button"
                              onClick={() => setBookCount(bn, count + 1)}
                              className="flex-1 min-w-0 text-left"
                              title={bn}
                            >
                              <div className="text-sm text-gray-800 truncate">{bn}</div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                                className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
                                title="-1"
                              >
                                −
                              </button>
                              <div className={`w-9 text-center text-xs sm:text-sm font-medium ${count > 0 ? "text-blue-700" : "text-gray-400"}`}>
                                x{count}
                              </div>
                              <button
                                type="button"
                                onClick={() => setBookCount(bn, count + 1)}
                                className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-sm"
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

                <div className="text-xs text-gray-500 mt-3 break-words">
                  선택: {selectedBooks.length}항목
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
                  <div>
                    <div className="text-sm text-gray-600">선택된 리스트 최종 확인</div>
                    <div className="text-xs text-gray-500">드래그로 순서 변경</div>
                  </div>
                </div>

                {selectedBooks.length === 0 ? (
                  <div className="text-sm text-gray-500">아직 선택된 책이 없습니다.</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto pr-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedBooks.map((bn, idx) => (
                        <div key={`${bn}-${idx}`} className="inline-flex items-center gap-2">
                          <div
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
                            className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 max-w-full min-w-0 transition-colors ${
                              draggingIndex === idx ? "opacity-60" : ""
                            } ${
                              dropTargetIndex === idx && draggingIndex !== null && draggingIndex !== idx
                                ? "border-blue-500 ring-2 ring-blue-200"
                                : "border-gray-200"
                            }`}
                            title="드래그해서 이동"
                          >
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm text-gray-800 truncate max-w-[9rem]">{bn}</span>

                            <button
                              type="button"
                              onClick={() => removeSelectedAt(idx)}
                              className="w-6 h-6 rounded-lg border-2 border-gray-200 hover:bg-red-50 text-red-600 shrink-0 text-sm"
                              title="삭제"
                            >
                              ×
                            </button>
                          </div>

                          {idx < selectedBooks.length - 1 && (
                            <span className="text-gray-400 select-none">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-3 break-words">
                  중복 선택 = 2독/3독
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-6 space-y-3">
          {/* 수치 기반 요약 */}
          <div className="text-xs sm:text-sm text-gray-700">
            {selectedBooks.length === 0 || computedTotalDays === null || computedTotalDays <= 0 ? (
              <span className="text-gray-500">책과 날짜를 선택하면 요약이 표시됩니다.</span>
            ) : (
              <span>
                총 <span className="font-medium">{uniqueBookCount}권</span>
                {duplicateEntryCount > 0 && (
                  <span className="text-gray-600">(+중복 {duplicateEntryCount})</span>
                )}
                {` (${totalChapters}장)을 `}
                <span className="font-medium">{computedTotalDays}일</span> 동안 읽습니다.
                {avgChaptersPerDay !== null && (
                  <span className="text-gray-600"> (하루 평균 {avgChaptersPerDay.toFixed(1)}장)</span>
                )}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              취소
            </button>

            <div className="flex-1 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  이전
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 px-3 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  다음
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isCreateDisabled}
                  className="flex-1 px-3 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:hover:bg-blue-500 text-sm"
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
