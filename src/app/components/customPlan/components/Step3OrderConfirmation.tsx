import {
  GripVertical,
  Trash2,
  Shuffle,
  Calendar,
  BookOpen,
  TrendingUp,
  RotateCcw,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "../../ui/utils";
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
  setShowOtShuffleMenu: _setOtShuffle,
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
  computedTotalDays,
  totalChapters,
  avgChaptersPerDay,
}: Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl p-2 pl-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={separateTestamentReading}
                onChange={(e) => applySeparateMode(e.target.checked)}
              />
              <div className="w-9 h-5 bg-muted-foreground/30 peer-checked:bg-primary rounded-full transition-colors duration-200" />
              <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              구약/신약 따로 읽기
            </span>
          </label>
        </div>

        {!separateTestamentReading && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShuffleOptions((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border/50 hover:bg-accent hover:border-border text-foreground rounded-lg shadow-sm transition-all text-xs font-medium"
            >
              순서 섞기
            </button>

            {showShuffleOptions && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card text-card-foreground shadow-lg p-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  섞기 옵션
                </div>
                <button
                  type="button"
                  onClick={() => {
                    shuffleSelected("OT");
                    setShowShuffleOptions(false);
                  }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent text-sm flex items-center gap-2"
                >
                  구약만 섞기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    shuffleSelected("NT");
                    setShowShuffleOptions(false);
                  }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent text-sm flex items-center gap-2"
                >
                  신약만 섞기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    shuffleSelected("ALL");
                    setShowShuffleOptions(false);
                  }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent text-sm flex items-center gap-2"
                >
                  전체 랜덤
                </button>

                <div className="h-px bg-border my-1.5" />
                <button
                  type="button"
                  onClick={() => {
                    resetAllToCanonicalOrder();
                    setShowShuffleOptions(false);
                  }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-destructive/10 text-destructive text-sm flex items-center gap-2"
                >
                  기본 순서로 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main List Area */}
      {selectedBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/50">
          <BookOpen className="w-8 h-8 mb-2 opacity-20" />
          <div className="text-sm">아직 선택된 책이 없습니다.</div>
        </div>
      ) : separateTestamentReading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OT Column */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500/50" /> 구약
              </span>
              <div className="relative">
                <button
                  onClick={() => {
                    setShowOtShuffleMenu((v) => !v);
                    setShowNtShuffleMenu(false);
                  }}
                  className="px-2 py-1 hover:bg-muted rounded-md text-muted-foreground transition-colors text-xs font-medium"
                >
                  섞기
                </button>
                {showOtShuffleMenu && (
                  <div className="absolute right-0 mt-1 w-32 rounded-lg border border-border bg-card shadow-lg p-1 z-10">
                    <button
                      onClick={() => {
                        shuffleGroup("OT");
                        setShowOtShuffleMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
                    >
                      랜덤 섞기
                    </button>
                    <button
                      onClick={() => {
                        resetGroupToCanonicalOrder("OT");
                        setShowOtShuffleMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
                    >
                      초기화
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div
              ref={otStep3ScrollRef}
              className="bg-muted/20 rounded-xl p-2 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar space-y-2"
            >
              {splitSelected.ot.map((bn, idx) => (
                <DraggableItem
                  key={`ot-${bn}-${idx}`}
                  index={idx}
                  text={bn}
                  group="OT"
                  draggingGroup={draggingGroup}
                  draggingGroupIndex={draggingGroupIndex}
                  dropTargetIndex={dropTargetOtIndex}
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
                  onRemove={() => removeFromGroupAt("OT", idx)}
                />
              ))}
            </div>
          </div>

          {/* NT Column */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500/50" /> 신약
              </span>
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNtShuffleMenu((v) => !v);
                    setShowOtShuffleMenu(false);
                  }}
                  className="px-2 py-1 hover:bg-muted rounded-md text-muted-foreground transition-colors text-xs font-medium"
                >
                  섞기
                </button>
                {showNtShuffleMenu && (
                  <div className="absolute right-0 mt-1 w-32 rounded-lg border border-border bg-card shadow-lg p-1 z-10">
                    <button
                      onClick={() => {
                        shuffleGroup("NT");
                        setShowNtShuffleMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
                    >
                      랜덤 섞기
                    </button>
                    <button
                      onClick={() => {
                        resetGroupToCanonicalOrder("NT");
                        setShowNtShuffleMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
                    >
                      초기화
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div
              ref={ntStep3ScrollRef}
              className="bg-muted/20 rounded-xl p-2 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar space-y-2"
            >
              {splitSelected.nt.map((bn, idx) => (
                <DraggableItem
                  key={`nt-${bn}-${idx}`}
                  index={idx}
                  text={bn}
                  group="NT"
                  draggingGroup={draggingGroup}
                  draggingGroupIndex={draggingGroupIndex}
                  dropTargetIndex={dropTargetNtIndex}
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
                  onRemove={() => removeFromGroupAt("NT", idx)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={step3ScrollRef}
          className="bg-muted/20 rounded-xl p-2 max-h-[500px] overflow-y-auto custom-scrollbar space-y-2"
          onDragOver={(e) => {
            if (draggingIndex === null) return;
            e.preventDefault();
            handleStep3AutoScroll(e.clientY);
          }}
        >
          {selectedBooks.map((bn, idx) => (
            <DraggableItem
              key={`${bn}-${idx}`}
              index={idx}
              text={bn}
              isDragging={draggingIndex === idx}
              isDropTarget={
                dropTargetIndex === idx && draggingIndex !== null && draggingIndex !== idx
              }
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
              onRemove={() => removeSelectedAt(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper component for draggable items
function DraggableItem({
  index,
  text,
  group,
  draggingGroup,
  draggingGroupIndex,
  dropTargetIndex,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
}: any) {
  // Determine states for group mode if needed
  const effectivelyDragging = isDragging ?? (group && draggingGroup === group && draggingGroupIndex === index);
  const effectivelyDropTarget = isDropTarget ?? (group && dropTargetIndex === index && draggingGroup === group && draggingGroupIndex !== null && draggingGroupIndex !== index);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 transition-all duration-200 cursor-move group select-none relative overflow-hidden",
        effectivelyDragging ? "opacity-40 scale-95 shadow-none border-dashed" : "border-border/60 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5",
        effectivelyDropTarget ? "border-primary ring-2 ring-primary/20 z-10" : ""
      )}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted group-hover:bg-primary/50 transition-colors" />
      
      <span className="text-muted-foreground/40 group-hover:text-foreground/60 transition-colors">
        <GripVertical className="w-4 h-4" />
      </span>

      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-muted/50 text-muted-foreground text-xs font-semibold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        {index + 1}
      </span>

      <span className="text-sm font-medium text-foreground min-w-0 flex-1 break-words">
        {text}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
