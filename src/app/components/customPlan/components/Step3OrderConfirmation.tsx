import { useCustomPlanCreator } from "../hooks/useCustomPlanCreator";

type Props = ReturnType<typeof useCustomPlanCreator>;

export function Step3OrderConfirmation({
  separateTestamentReading,
  applySeparateMode,
  showShuffleOptions,
  setShowShuffleOptions,
  shuffleSelected,
  resetAllToCanonicalOrder,
  selectedBooks,
  showOtShuffleMenu,
  setShowOtShuffleMenu,
  setShowNtShuffleMenu,
  shuffleGroup,
  resetGroupToCanonicalOrder,
  splitSelected,
  otStep3ScrollRef,
  setDraggingGroup,
  setDraggingGroupIndex,
  setDropTargetOtIndex,
  setDropTargetNtIndex,
  draggingGroup,
  draggingGroupIndex,
  dropTargetOtIndex,
  handleStep3AutoScroll,
  moveWithinGroup,
  removeFromGroupAt,
  showNtShuffleMenu,
  setShowOtShuffleMenu: _setOtShuffle, // Duplicate prop usage alias
  setShowNtShuffleMenu: _setNtShuffle,
  ntStep3ScrollRef,
  dropTargetNtIndex,
  step3ScrollRef,
  draggingIndex,
  setDraggingIndex,
  setDropTargetIndex,
  dropTargetIndex,
  moveSelected,
  removeSelectedAt,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
          <div>
            <div className="text-sm text-muted-foreground">
              선택된 리스트 최종 확인
            </div>
            <div className="text-xs text-muted-foreground">
              드래그로 순서 변경
            </div>
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
          <div className="text-sm text-muted-foreground">
            아직 선택된 책이 없습니다.
          </div>
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

              <div
                ref={otStep3ScrollRef}
                className="max-h-72 overflow-y-auto pr-1 space-y-2"
              >
                {splitSelected.ot.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    구약이 비어 있습니다.
                  </div>
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
                        if (
                          draggingGroupIndex === null ||
                          draggingGroupIndex === idx
                        ) {
                          setDropTargetOtIndex(null);
                          return;
                        }
                        moveWithinGroup("OT", draggingGroupIndex, idx);
                        setDraggingGroup(null);
                        setDraggingGroupIndex(null);
                        setDropTargetOtIndex(null);
                      }}
                      className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors cursor-move active:cursor-grabbing ${
                        draggingGroup === "OT" && draggingGroupIndex === idx
                          ? "opacity-60"
                          : ""
                      } ${
                        dropTargetOtIndex === idx &&
                        draggingGroup === "OT" &&
                        draggingGroupIndex !== null &&
                        draggingGroupIndex !== idx
                          ? "border-primary ring-2 ring-ring"
                          : "border-border"
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-muted-foreground/60 shrink-0 select-none">
                        ≡
                      </span>
                      <span className="text-sm text-foreground min-w-0 flex-1 break-words">
                        {bn}
                      </span>
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

              <div
                ref={ntStep3ScrollRef}
                className="max-h-72 overflow-y-auto pr-1 space-y-2"
              >
                {splitSelected.nt.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    신약이 비어 있습니다.
                  </div>
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
                        if (
                          draggingGroupIndex === null ||
                          draggingGroupIndex === idx
                        ) {
                          setDropTargetNtIndex(null);
                          return;
                        }
                        moveWithinGroup("NT", draggingGroupIndex, idx);
                        setDraggingGroup(null);
                        setDraggingGroupIndex(null);
                        setDropTargetNtIndex(null);
                      }}
                      className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors cursor-move active:cursor-grabbing ${
                        draggingGroup === "NT" && draggingGroupIndex === idx
                          ? "opacity-60"
                          : ""
                      } ${
                        dropTargetNtIndex === idx &&
                        draggingGroup === "NT" &&
                        draggingGroupIndex !== null &&
                        draggingGroupIndex !== idx
                          ? "border-primary ring-2 ring-ring"
                          : "border-border"
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-muted-foreground/60 shrink-0 select-none">
                        ≡
                      </span>
                      <span className="text-sm text-foreground min-w-0 flex-1 break-words">
                        {bn}
                      </span>
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
                    dropTargetIndex === idx &&
                    draggingIndex !== null &&
                    draggingIndex !== idx
                      ? "border-primary ring-2 ring-ring"
                      : "border-border"
                  }`}
                  title="드래그해서 이동"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                    {idx + 1}
                  </span>

                  <span className="text-muted-foreground/60 shrink-0 select-none">
                    ≡
                  </span>

                  <span className="text-sm text-foreground min-w-0 flex-1 break-words">
                    {bn}
                  </span>

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
  );
}
