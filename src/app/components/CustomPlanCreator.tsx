import { useMemo, useState } from "react";
import { X, BookPlus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
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

  const otBooks = useMemo(() => BIBLE_BOOKS.slice(0, 39).map((b) => b.name), []);
  const ntBooks = useMemo(() => BIBLE_BOOKS.slice(39).map((b) => b.name), []);

  const visibleBooks = activeTestament === "OT" ? otBooks : ntBooks;

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

  const addBook = (bookName: string) => {
    setSelectedBooks((prev) => [...prev, bookName]);
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

  const addAll = (testament: "OT" | "NT" | "ALL") => {
    const books =
      testament === "OT"
        ? BIBLE_BOOKS.slice(0, 39).map((b) => b.name)
        : testament === "NT"
          ? BIBLE_BOOKS.slice(39).map((b) => b.name)
          : BIBLE_BOOKS.map((b) => b.name);
    setSelectedBooks((prev) => [...prev, ...books]);
  };

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
                <h2>사용자 지정 계획 만들기</h2>
                <p className="text-gray-600">
                  시작/종료 날짜와 책 범위를 선택하세요
                </p>
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
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">계획 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_PLAN_NAME_LENGTH}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="비워두면 (책 범위)로 자동 생성"
              />
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-sm text-gray-500">
              날짜 범위는 최대 {MAX_TOTAL_DAYS}일(약 10년)까지 가능합니다.
              {computedTotalDays !== null && (
                <span className="ml-2">(현재 {computedTotalDays}일)</span>
              )}
              {computedTotalDays !== null && computedTotalDays > MAX_TOTAL_DAYS && (
                <div className="mt-1 text-red-600">
                  기간이 너무 깁니다. 종료 날짜를 줄여주세요.
                </div>
              )}
              {computedTotalDays !== null && computedTotalDays <= 0 && (
                <div className="mt-1 text-red-600">종료 날짜는 시작 날짜 이후여야 합니다.</div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTestament("OT")}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
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
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    activeTestament === "NT"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  신약
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBooks([]);
                }}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                선택 초기화
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addAll("OT")}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                구약 전체 추가
              </button>
              <button
                type="button"
                onClick={() => addAll("NT")}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                신약 전체 추가
              </button>
              <button
                type="button"
                onClick={() => addAll("ALL")}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                성경 전체 추가
              </button>
              <button
                type="button"
                onClick={() => setSelectedBooks([])}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                전체 해제
              </button>
            </div>

            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-700 font-medium">선택한 책 {selectedLabel}</div>
                <div className="text-sm text-gray-500">
                  여러 권/중복 선택 가능
                </div>
              </div>

              {selectedBooks.length > 0 && (
                <div className="mb-3 border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="text-sm text-gray-600 mb-2">읽기 순서 (위/아래로 순서 변경 가능)</div>
                  <div className="space-y-2">
                    {selectedBooks.map((bn, idx) => (
                      <div key={`${bn}-${idx}`} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-800 truncate">
                            {idx + 1}. {bn}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => moveSelected(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                          title="위로"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelected(idx, idx + 1)}
                          disabled={idx === selectedBooks.length - 1}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                          title="아래로"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSelectedAt(idx)}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {visibleBooks.map((bn) => {
                  const count = countsByBook.get(bn) ?? 0;
                  return (
                    <button
                      key={bn}
                      type="button"
                      onClick={() => addBook(bn)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                        count > 0 ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                      title={bn}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{bn}</span>
                        {count > 0 && <span className="text-xs text-blue-700">x{count}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-sm text-gray-500">
              기본은 장 단위로 생성하며, 날짜가 더 길면 절 단위로 자동 생성합니다.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-6 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={selectedBooks.length === 0 || !startDate || !endDate || isDateRangeInvalid}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:hover:bg-blue-500"
          >
            계획 생성
          </button>
        </div>
      </div>
    </div>
  );
}
