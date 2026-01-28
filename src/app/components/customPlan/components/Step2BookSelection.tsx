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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-muted/30 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-foreground flex items-center gap-2">
            책 선택
            <span className="text-xs font-normal text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
              {selectedBooks.length}권 선택됨
            </span>
          </div>
        </div>

        {/* Sliding Segmented Control */}
        <div className="bg-muted rounded-xl p-1 flex relative">
          <button
            type="button"
            onClick={() => setActiveTestament("OT")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 z-10",
              activeTestament === "OT"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            구약
          </button>
          <button
            type="button"
            onClick={() => setActiveTestament("NT")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 z-10",
              activeTestament === "NT"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            신약
          </button>
        </div>

        {/* Bulk Actions Toolbar (Compact) */}
        <div className="flex items-center gap-2 bg-background/60 rounded-xl p-1.5 border border-border/40 shadow-sm">
          {/* Bulk Repeat Stepper */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const v = Math.max(1, clampRepeat(currentRepeat - 1) || 1);
                setRepeat(v);
                if (isAllSelected) setSectionAll(activeTestament, v);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-background hover:bg-accent text-muted-foreground shadow-sm transition-all active:scale-95"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="w-9 text-center text-xs font-bold text-foreground">
              {currentRepeat}회
            </div>
            <button
              type="button"
              onClick={() => {
                const v = Math.min(10, clampRepeat(currentRepeat + 1) || 1);
                setRepeat(v);
                if (isAllSelected) setSectionAll(activeTestament, v);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-background hover:bg-accent text-muted-foreground shadow-sm transition-all active:scale-95"
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
              "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm",
              isAllSelected
                ? "bg-primary text-primary-foreground border-primary shadow-inner"
                : "bg-background border-border hover:bg-accent text-foreground"
            )}
          >
            {isAllSelected ? "선택 해제" : "전체 선택"}
          </button>

          <button
            type="button"
            onClick={() => clearSection(activeTestament)}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Book List */}
        <div className="max-h-[400px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
          {currentBooks.map((bn) => {
            const count = countsByBook.get(bn) ?? 0;
            const isSelected = count > 0;

            return (
              <div
                key={bn}
                className={cn(
                  "flex items-center justify-between p-2 rounded-xl transition-all duration-200 select-none group",
                  isSelected
                    ? "bg-primary/5"
                    : "bg-transparent hover:bg-muted/40"
                )}
              >
                <div 
                  className="flex-1 cursor-pointer flex items-center gap-3"
                  onClick={() => setBookCount(bn, isSelected ? 0 : 1)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                    isSelected 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "border-muted-foreground/30 bg-background group-hover:border-primary/30"
                  )}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    isSelected ? "text-primary" : "text-foreground/80"
                  )}>
                    {bn}
                  </span>
                </div>

                {/* Micro Stepper */}
                <div className="flex items-center bg-background rounded-lg border border-border/40 shadow-sm p-0.5 ml-2">
                  <button
                    type="button"
                    onClick={() => setBookCount(bn, Math.max(0, count - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <div
                    className={cn(
                      "w-8 text-center text-sm font-bold transition-all",
                      isSelected ? "text-primary scale-110" : "text-muted-foreground/40"
                    )}
                  >
                    {count}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookCount(bn, count + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors active:scale-95"
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
