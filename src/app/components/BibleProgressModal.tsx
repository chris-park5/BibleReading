import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "./ui/dialog";
import { BIBLE_BOOKS, getBookChapters } from "../data/bibleBooks";
import { cn } from "./ui/utils";
import { BookOpen, Check, Search, X, LayoutGrid, List as ListIcon } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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

const BIBLE_GENRES = [
  { name: "모세오경", testament: "old", books: ["창세기", "출애굽기", "레위기", "민수기", "신명기"] },
  { name: "역사서 (구약)", testament: "old", books: ["여호수아", "사사기", "룻기", "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야", "에스더"] },
  { name: "시가서", testament: "old", books: ["욥기", "시편", "잠언", "전도서", "아가"] },
  { name: "대선지서", testament: "old", books: ["이사야", "예레미야", "예레미야 애가", "에스겔", "다니엘"] },
  { name: "소선지서", testament: "old", books: ["호세아", "요엘", "아모스", "오바댜", "요나", "미가", "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기"] },
  { name: "복음서", testament: "new", books: ["마태복음", "마가복음", "누가복음", "요한복음"] },
  { name: "역사서 (신약)", testament: "new", books: ["사도행전"] },
  { name: "바울서신", testament: "new", books: ["로마서", "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서"] },
  { name: "공동서신", testament: "new", books: ["히브리서", "야고보서", "베드로전서", "베드로후서", "요한1서", "요한2서", "요한3서", "유다서"] },
  { name: "예언서", testament: "new", books: ["요한계시록"] },
];

export function BibleProgressModal({ children, bookProgressRows }: BibleProgressModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Helper to get stats
  const getBookStats = (row: BookProgressRow) => {
    const standardChapters = getBookChapters(row.book);
    const completedFullCycles = Math.floor(row.completed / standardChapters);
    
    // Calculate display values for the current cycle
    let displayCompleted = row.completed % standardChapters;
    const isFullyDone = row.completed >= row.total && row.total > 0;
    
    if (isFullyDone && displayCompleted === 0) {
        displayCompleted = standardChapters;
    }
    
    // Percent for current cycle
    const currentPercent = standardChapters > 0 ? Math.min(100, (displayCompleted / standardChapters) * 100) : 0;
    
    return {
      standardChapters,
      completedFullCycles,
      displayCompleted,
      currentPercent,
      isFullyDone
    };
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookProgressRows;
    return bookProgressRows.filter(r => r.book.toLowerCase().includes(query));
  }, [bookProgressRows, searchQuery]);

  const renderGrid = (testamentFilter: "old" | "new" | "all") => (
    <div className="space-y-8 pb-4">
      {BIBLE_GENRES.filter(g => testamentFilter === "all" || g.testament === testamentFilter).map((genre) => {
        const genreRows = filteredRows.filter(r => genre.books.includes(r.book));
        if (genreRows.length === 0) return null;

        return (
          <div key={genre.name} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">{genre.name}</h3>
            <div className="grid grid-cols-3 gap-3">
              {genreRows.map(row => {
                const stats = getBookStats(row);
                
                return (
                  <div 
                    key={row.book} 
                    className="group relative flex flex-col justify-between min-h-[5.5rem] rounded-xl border border-border/60 bg-card overflow-hidden transition-all hover:border-primary/50"
                  >
                    {/* Progress Fill Background */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-blue-100/60 dark:bg-blue-900/20 transition-all duration-700 ease-in-out"
                      style={{ height: `${stats.currentPercent}%` }}
                    />

                    {/* Content */}
                    <div className="relative z-10 p-3 flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold text-[13px] leading-tight break-all">{row.book}</span>
                        {stats.completedFullCycles > 0 && (
                          <div className="shrink-0 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                            {stats.completedFullCycles}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right mt-2">
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          stats.currentPercent > 50 ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
                        )}>
                          {Math.round(stats.displayCompleted)}/{stats.standardChapters}장
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderList = (testamentFilter: "old" | "new" | "all") => {
    const targetBooks = BIBLE_GENRES.filter(g => testamentFilter === "all" || g.testament === testamentFilter).flatMap(g => g.books);
    const rowsToRender = filteredRows.filter(r => targetBooks.includes(r.book));

    return (
      <div className="space-y-2">
        {rowsToRender.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? "검색 결과가 없습니다." : "읽기 기록이 없습니다."}
            </p>
        ) : (
            rowsToRender.map(row => {
                const stats = getBookStats(row);
                const targetCycles = Math.max(1, Math.ceil(row.total / stats.standardChapters));

                return (
                    <div key={row.book} className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="text-sm font-semibold truncate">{row.book}</div>
                          {/* Cycle Indicators */}
                          <div className="flex gap-1 shrink-0">
                            {Array.from({ length: targetCycles }).map((_, i) => {
                              const isDone = i < stats.completedFullCycles;
                              const isCurrent = i === stats.completedFullCycles && !stats.isFullyDone;
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
                          {Math.round(stats.currentPercent)}%
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                         <span>{stats.displayCompleted}/{stats.standardChapters}장</span>
                      </div>
                      <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${stats.currentPercent}%` }} 
                        />
                      </div>
                    </div>
                );
            })
        )}
      </div>
    );
  };

  return (
    <Dialog onOpenChange={(open) => !open && setSearchQuery("")}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-background/95 backdrop-blur z-20 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              성경별 진행상황
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(prev => prev === "grid" ? "list" : "grid")}
                className="h-8 w-8 text-muted-foreground"
                title={viewMode === "grid" ? "리스트 보기" : "그리드 보기"}
              >
                {viewMode === "grid" ? <ListIcon className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 py-3 border-b shrink-0 bg-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="성경 이름 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9 text-sm"
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
          <div className="px-4 pt-2 shrink-0">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="old">구약</TabsTrigger>
              <TabsTrigger value="new">신약</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <TabsContent value="old" className="mt-0 pb-10">
              {viewMode === "grid" ? renderGrid("old") : renderList("old")}
            </TabsContent>
            <TabsContent value="new" className="mt-0 pb-10">
              {viewMode === "grid" ? renderGrid("new") : renderList("new")}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
