import { Plus, Minus, RotateCcw, Check } from "lucide-react";
import { cn } from "../../ui/utils";
import { useCustomPlanCreator } from "../hooks/useCustomPlanCreator";

type Props = ReturnType<typeof useCustomPlanCreator>;

export function Step2BookSelection({
  activeTestament,
  setActiveTestament,
  otBooks,
  ntBooks,
  countsByBook,
  selectedBooks,
  otRepeat,
  setOtRepeat,
  ntRepeat,
  setNtRepeat,
  otAllSelected,
  ntAllSelected,
  setBookCount,
  setSectionAll,
  clearSection,
  clampRepeat,
}: Props) {
  const currentBooks = activeTestament === "OT" ? otBooks : ntBooks;
  const currentRepeat = activeTestament === "OT" ? otRepeat : ntRepeat;
  const setRepeat = activeTestament === "OT" ? setOtRepeat : setNtRepeat;
  const isAllSelected = activeTestament === "OT" ? otAllSelected : ntAllSelected;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="rounded-[28px] bg-slate-50/60 border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            책 선택
            <span className="text-[11px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">
              {selectedBooks.length}권
            </span>
          </div>
        </div>

        {/* Thin Sliding Segmented Control */}
        <div className="relative w-full rounded-full bg-white border border-slate-100 p-1 shadow-sm overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-1 w-1/2 rounded-full bg-blue-50 border border-blue-100 transition-transform duration-200 ease-out",
              activeTestament === "OT" ? "translate-x-0" : "translate-x-full"
            )}
          />
          <div className="relative grid grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveTestament("OT")}
              className={cn(
                "py-1.5 text-xs font-bold rounded-full transition-colors",
                activeTestament === "OT" ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              구약
            </button>
            <button
              type="button"
              onClick={() => setActiveTestament("NT")}
              className={cn(
                "py-1.5 text-xs font-bold rounded-full transition-colors",
                activeTestament === "NT" ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              신약
            </button>
          </div>
        </div>

        {/* Compact Controls */}
        <div className="flex items-center gap-2 flex-wrap rounded-2xl bg-white/70 border border-slate-100 shadow-sm p-1.5">
          {/* Bulk Repeat Stepper */}
          <div className="flex items-center rounded-full bg-white border border-slate-100 shadow-sm ring-1 ring-blue-50 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const v = Math.max(1, clampRepeat(currentRepeat - 1) || 1);
                setRepeat(v);
                if (isAllSelected) setSectionAll(activeTestament, v);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-600 transition-colors active:scale-95"
              aria-label="회독수 감소"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="px-2 text-[11px] font-extrabold text-slate-800 tabular-nums">
              {currentRepeat}회
            </div>
            <button
              type="button"
              onClick={() => {
                const v = Math.min(10, clampRepeat(currentRepeat + 1) || 1);
                setRepeat(v);
                if (isAllSelected) setSectionAll(activeTestament, v);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-600 transition-colors active:scale-95"
              aria-label="회독수 증가"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isAllSelected) {
                clearSection(activeTestament);
              } else {
                setSectionAll(activeTestament, clampRepeat(currentRepeat) || 1);
              }
            }}
            className={cn(
              "flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-extrabold transition-all border shadow-sm",
              isAllSelected
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-slate-100 hover:bg-slate-50 text-slate-800"
            )}
          >
            {isAllSelected ? "전체 해제" : "전체 선택"}
          </button>

          <button
            type="button"
            onClick={() => clearSection(activeTestament)}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors shrink-0"
            title="초기화"
            aria-label="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Book List */}
        <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
          {currentBooks.map((bn) => {
            const count = countsByBook.get(bn) ?? 0;
            const isSelected = count > 0;

            return (
              <div
                key={bn}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 rounded-2xl transition-all duration-200 select-none group",
                  isSelected
                    ? "bg-blue-50/60 border border-blue-100 shadow-sm"
                    : "bg-transparent border border-transparent hover:bg-white/60 hover:border-slate-100"
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left cursor-pointer flex items-center gap-3"
                  onClick={() => setBookCount(bn, isSelected ? 0 : 1)}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-slate-200 bg-white group-hover:border-blue-200"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold transition-colors",
                      isSelected ? "text-slate-900" : "text-slate-700"
                    )}
                  >
                    {bn}
                  </span>
                </button>

                {/* Micro Stepper */}
                <div
                  className={cn(
                    "flex items-center rounded-full bg-white border border-slate-100 shadow-sm ring-1 ring-blue-50 p-0.5 ml-2",
                    isSelected ? "" : "opacity-95"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-600 transition-colors active:scale-95"
                    aria-label={`${bn} 회독수 감소`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <div
                    className={cn(
                      "w-8 text-center text-[12px] font-extrabold tabular-nums transition-colors",
                      isSelected ? "text-blue-700" : "text-slate-400"
                    )}
                  >
                    {count}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookCount(bn, count + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-600 transition-colors active:scale-95"
                    aria-label={`${bn} 회독수 증가`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
