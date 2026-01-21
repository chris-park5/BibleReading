import { BookHeart, Plus, Sparkles } from "lucide-react";
import { setHashTab } from "../tabHash";

export function HomeEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <div className="relative bg-card p-6 rounded-full border border-border shadow-sm">
          <BookHeart className="w-12 h-12 text-primary" strokeWidth={1.5} />
        </div>
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
      </div>
      <div className="max-w-xs space-y-2">
        <h3 className="text-xl font-bold">아직 읽기 계획이 없으시네요</h3>
        <p className="text-muted-foreground">
          새로운 성경 읽기 계획을 시작하고
          <br />
          말씀과 함께하는 여정을 떠나보세요.
        </p>
      </div>
      <button
        onClick={() => setHashTab("add")}
        className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
      >
        <Plus className="w-5 h-5" />
        새 계획 시작하기
      </button>
    </div>
  );
}
