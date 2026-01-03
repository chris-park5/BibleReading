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
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  type Testament = "OT" | "NT";
  const [activeTestament, setActiveTestament] = useState<Testament>("OT");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);

  const otBooks = useMemo(() => BIBLE_BOOKS.slice(0, 39).map((b) => b.name), []);
  const ntBooks = useMemo(() => BIBLE_BOOKS.slice(39).map((b) => b.name), []);

  const visibleBooks = activeTestament === "OT" ? otBooks : ntBooks;

  const selectedLabel = useMemo(() => {
    if (selectedBooks.length === 0) return "(선택된 책 없음)";
    return `(${selectedBooks.join(", ")})`;
  }, [selectedBooks]);

  const toggleBook = (bookName: string) => {
    setSelectedBooks((prev) => {
      if (prev.includes(bookName)) {
        return prev.filter((b) => b !== bookName);
      }
      // UI 표시도 성경 순서대로 보여주기 위해 index 기준 정렬
      const next = [...prev, bookName];
      const order = new Map(BIBLE_BOOKS.map((b, i) => [b.name, i] as const));
      next.sort((a, b) => (order.get(a)! - order.get(b)!));
      return next;
    });
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

      const autoName = `(${selectedBooks.join(", ")})`;
      const finalName = name.trim() || autoName;

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
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">종료 날짜</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
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

            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-700 font-medium">선택한 책 {selectedLabel}</div>
                <div className="text-sm text-gray-500">
                  여러 권 선택 가능
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {visibleBooks.map((bn) => {
                  const isSelected = selectedBooks.includes(bn);
                  return (
                    <button
                      key={bn}
                      type="button"
                      onClick={() => toggleBook(bn)}
                      className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      title={bn}
                    >
                      {bn}
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
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            계획 생성
          </button>
        </div>
      </div>
    </div>
  );
}
