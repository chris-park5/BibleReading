import { WifiOff } from "lucide-react";

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="bg-card text-card-foreground border border-border rounded-xl px-3 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">오프라인입니다</p>
        </div>
      </div>
    </div>
  );
}
