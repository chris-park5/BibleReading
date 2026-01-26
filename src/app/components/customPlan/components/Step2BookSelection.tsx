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
  return (
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
                  <div className="w-10 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                    x{otRepeat}
                  </div>
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
                  <div
                    key={bn}
                    className="flex items-center gap-2 border border-border rounded-lg px-2 py-2 bg-background min-w-0"
                  >
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
                      <div
                        className={`w-9 text-center text-xs sm:text-sm font-medium ${
                          count > 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
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
                  <div className="w-10 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                    x{ntRepeat}
                  </div>
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
                  <div
                    key={bn}
                    className="flex items-center gap-2 border border-border rounded-lg px-2 py-2 bg-background min-w-0"
                  >
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
                      <div
                        className={`w-9 text-center text-xs sm:text-sm font-medium ${
                          count > 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
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
  );
}
