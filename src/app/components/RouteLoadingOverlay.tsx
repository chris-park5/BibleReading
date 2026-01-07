import { Loader2 } from "lucide-react";

export function RouteLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white border-2 border-gray-200 rounded-xl px-6 py-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        <p className="text-gray-700">로딩 중...</p>
      </div>
    </div>
  );
}
