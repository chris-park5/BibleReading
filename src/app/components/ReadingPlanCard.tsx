import type { ReactNode } from "react";
import { BookOpen, Check, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface ReadingPlanCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  isSelected: boolean;
  onSelect: () => void;
  clickable?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
  canDelete?: boolean;
  onDelete?: () => void;
  disabled?: boolean;
  busyLabel?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function ReadingPlanCard({
  title,
  description,
  duration,
  isSelected,
  onSelect,
  clickable = true,
  headerAction,
  footer,
  canDelete = false,
  onDelete,
  disabled = false,
  busyLabel,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: ReadingPlanCardProps) {
  const isBusy = !!busyLabel;
  const isDisabled = disabled || isBusy;
  const isClickable = clickable && !isDisabled;

  const showStatusBadge = isBusy || disabled;
  const statusBadgeText = isBusy ? busyLabel : disabled ? "추가됨" : null;

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onSelect : undefined}
      onKeyDown={(e) => {
        if (!isClickable) return;
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`w-full p-6 rounded-[32px] text-left transition-all ${
        isDisabled
          ? "bg-muted/40 opacity-60 cursor-not-allowed border-none shadow-none"
          : isSelected
          ? "ring-2 ring-primary bg-primary/5 shadow-sm"
          : isClickable
          ? "bg-card hover:bg-accent cursor-pointer border-none shadow-sm"
          : "bg-card border-none shadow-sm"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-[18px] ${
            isSelected ? "bg-primary/10" : "bg-muted"
          }`}
        >
          <BookOpen
            className={`w-6 h-6 ${
              isSelected ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0 break-words">
          <div className="flex items-start justify-between gap-3">
            <h3 className="mb-1 flex-1 min-w-0 break-words">{title}</h3>

            <div className="flex items-center gap-1 shrink-0">
              {headerAction && <div className="mr-1">{headerAction}</div>}

              {isSelected && !showStatusBadge && (
                <Check className="w-6 h-6 text-primary" />
              )}

              {showStatusBadge && statusBadgeText && (
                <div className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
                  {statusBadgeText}
                </div>
              )}

              {!showStatusBadge && (canMoveUp || canMoveDown) && (
                <div className="flex gap-1">
                  {canMoveUp && onMoveUp && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveUp();
                      }}
                      className="p-1.5 rounded-lg hover:bg-accent text-primary transition-colors"
                      title="위로 이동"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                  )}
                  {canMoveDown && onMoveDown && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveDown();
                      }}
                      className="p-1.5 rounded-lg hover:bg-accent text-primary transition-colors"
                      title="아래로 이동"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {!showStatusBadge && canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="계획 삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {description && <p className="text-muted-foreground mb-2">{description}</p>}
          {duration && <p className="text-primary">{duration}</p>}

          {footer && <div className="mt-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
