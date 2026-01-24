import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { BIBLE_BOOKS, getBookChapters } from "../data/bibleBooks";
import { cn } from "./ui/utils";
import { BookOpen, Check, Search, X } from "lucide-react";
import { Input } from "./ui/input";

interface BookProgressRow {
  book: string;
  completed: number;
  total: number;
  percent: number;
}

interface BibleProgressModalProps {
  children: React.ReactNode;
  bookProgressRows: BookProgressRow[];
}

export function BibleProgressModal({ children, bookProgressRows }: BibleProgressModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const getBookCategory = (bookName: string) => {
    const index = BIBLE_BOOKS.findIndex(b => b.name === bookName);
    if (index === -1) return "unknown";
    return index < 39 ? "old" : "new";
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookProgressRows;
    return bookProgressRows.filter(r => r.book.toLowerCase().includes(query));
  }, [bookProgressRows, searchQuery]);

  const otRows = filteredRows.filter(r => getBookCategory(r.book) === "old");
  const ntRows = filteredRows.filter(r => getBookCategory(r.book) === "new");

  const renderList = (rows: BookProgressRow[]) => (
    <div className="space-y-2">
        {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? "검색 결과가 없습니다." : "읽기 기록이 없습니다."}
            </p>
        ) : (
            rows.map(row => {
                const standardChapters = getBookChapters(row.book);
                const targetCycles = Math.max(1, Math.ceil(row.total / standardChapters));
                const completedFullCycles = Math.floor(row.completed / standardChapters);
                
                // Calculate display values for the current cycle
                let displayCompleted = row.completed % standardChapters;
                const isFullyDone = row.completed >= row.total && row.total > 0;
                
                if (isFullyDone && displayCompleted === 0) {
                    displayCompleted = standardChapters;
                }
                
                const currentPercent = Math.min(100, (displayCompleted / standardChapters) * 100);

                return (
                    <div key={row.book} className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="text-sm font-semibold truncate">{row.book}</div>
                          {/* Cycle Indicators */}
                          <div className="flex gap-1 shrink-0">
                            {Array.from({ length: targetCycles }).map((_, i) => {
                              const isDone = i < completedFullCycles;
                              const isCurrent = i === completedFullCycles && !isFullyDone;
                              return (
                                <div 
                                  key={i} 
                                  className={cn(
                                    "w-4 h-4 rounded-full flex items-center justify-center border text-[10px]",
                                    isDone 
                                      ? "bg-blue-500 border-blue-500 text-white" 
                                      : isCurrent 
                                        ? "border-blue-500 text-blue-500 bg-blue-50" 
                                        : "border-muted-foreground/30 text-muted-foreground/30"
                                  )}
                                >
                                  {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : (i + 1)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground shrink-0">
                          {Math.round(currentPercent)}%
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                         <span>{displayCompleted}/{standardChapters}장</span>
                      </div>
                      <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${currentPercent}%` }} 
                        />
                      </div>
                    </div>
                );
            })
        )}
    </div>
  );

  return (
    <Dialog onOpenChange={(open) => !open && setSearchQuery("")}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            성경별 진행상황
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="성경 이름 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="old" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="old">구약</TabsTrigger>
              <TabsTrigger value="new">신약</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <TabsContent value="old" className="mt-0">
              {renderList(otRows)}
            </TabsContent>
            <TabsContent value="new" className="mt-0">
              {renderList(ntRows)}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
