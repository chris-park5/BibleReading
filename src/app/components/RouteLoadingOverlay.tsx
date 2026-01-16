import { Skeleton } from "./ui/skeleton";

export function RouteLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/30">
      {/* Main Content Area Skeleton */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          
          {/* Date Navigator Skeleton */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1 flex flex-col items-center gap-2">
                 <Skeleton className="h-3 w-16" />
                 <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="w-9 h-9 rounded-lg" />
            </div>
          </div>

          {/* TodayReading Skeleton - Mimicking the main card */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
             {/* Title area */}
             <div className="space-y-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
             </div>
             
             {/* Reading List Items */}
             <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                   <div key={i} className="flex items-center gap-4 p-3 border border-border rounded-lg">
                      <Skeleton className="w-6 h-6 rounded-md shrink-0" />
                      <div className="flex-1 space-y-2">
                         <Skeleton className="h-5 w-3/4" />
                         <Skeleton className="h-3 w-1/2" />
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Additional Content Skeleton */}
           <div className="bg-card border border-border rounded-xl p-6 space-y-4 opacity-60">
             <Skeleton className="h-5 w-1/4" />
             <div className="grid grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
             </div>
          </div>

        </div>
      </div>

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