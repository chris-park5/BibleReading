import { BookOpen, Check, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface ReadingPlanCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  isSelected: boolean;
  onSelect: () => void;
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

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (isDisabled) return;
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`relative w-full p-6 rounded-xl border-2 text-left transition-all ${
        isDisabled
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-blue-300 cursor-pointer"
      }`}
    >
      {isSelected && (
        <div className="absolute top-4 right-4">
          <Check className="w-6 h-6 text-blue-500" />
        </div>
      )}

      {isBusy && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-gray-200 text-gray-600 text-sm rounded-full">
          {busyLabel}
        </div>
      )}

      {!isBusy && disabled && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-gray-200 text-gray-600 text-sm rounded-full">
          추가됨
        </div>
      )}

      {canDelete && onDelete && !isBusy && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
          title="계획 삭제"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}

      {/* 순서 변경 버튼 */}
      {(canMoveUp || canMoveDown) && !isBusy && (
        <div className="absolute top-4 right-14 flex gap-1">
          {canMoveUp && onMoveUp && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
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
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              title="아래로 이동"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-lg ${
            isSelected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          <BookOpen
            className={`w-6 h-6 ${
              isSelected ? "text-blue-600" : "text-gray-600"
            }`}
          />
        </div>
        <div className="flex-1">
          <h3 className="mb-1">{title}</h3>
          <p className="text-gray-600 mb-2">{description}</p>
          <p className="text-blue-600">{duration}</p>
        </div>
      </div>
    </div>
  );
}
