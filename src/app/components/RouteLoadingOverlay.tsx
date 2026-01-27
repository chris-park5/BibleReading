import { Skeleton } from "./ui/skeleton";

export function RouteLoadingOverlay({ visible, variant = "default" }: { visible: boolean; variant?: "home" | "friends" | "default" }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {variant === "friends" ? (
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="sticky top-0 z-10 bg-background/95 border-b border-border">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
          <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Default / Home Skeleton */
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="sticky top-0 z-10 bg-background/95 border-b border-border shadow-sm h-14 flex items-center px-4">
             <div className="w-full flex justify-between items-center max-w-4xl mx-auto">
                <Skeleton className="h-6 w-6 rounded-md" />
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                </div>
             </div>
          </div>
          <div className="max-w-4xl mx-auto p-4 space-y-6 pt-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* Bottom Navigation Skeleton */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="max-w-4xl mx-auto grid grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
             {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="py-3 flex flex-col items-center gap-1">
                   <Skeleton className="w-5 h-5 rounded-full" />
                   <Skeleton className="h-3 w-8" />
                </div>
             ))}
          </div>
       </nav>
    </div>
  );
}