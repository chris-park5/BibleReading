import { BookOpen, Check, Trash2 } from "lucide-react";

interface ReadingPlanCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  isSelected: boolean;
  onSelect: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}

export function ReadingPlanCard({
  title,
  description,
  duration,
  isSelected,
  onSelect,
  canDelete = false,
  onDelete,
}: ReadingPlanCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`relative w-full p-6 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      {isSelected && (
        <div className="absolute top-4 right-4">
          <Check className="w-6 h-6 text-blue-500" />
        </div>
      )}

      {canDelete && onDelete && (
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
