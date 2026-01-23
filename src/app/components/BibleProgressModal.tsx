import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { BIBLE_BOOKS, getBookChapters } from "../data/bibleBooks";
import { cn } from "./ui/utils";
import { BookOpen } from "lucide-react";

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
  // Split OT/NT
  // OT: Genesis (0) to Malachi (38)
  // NT: Matthew (39) to Revelation (65)
  // We can use the index in BIBLE_BOOKS.
  
  const getBookCategory = (bookName: string) => {
    const index = BIBLE_BOOKS.findIndex(b => b.name === bookName);
    if (index === -1) return "unknown";
    return index < 39 ? "old" : "new";
  };

  const otRows = bookProgressRows.filter(r => getBookCategory(r.book) === "old");
  const ntRows = bookProgressRows.filter(r => getBookCategory(r.book) === "new");

  const renderList = (rows: BookProgressRow[]) => (
    <div className="space-y-2">
        {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
                읽기 기록이 없습니다.
            </p>
        ) : (
            rows.map(row => {
                // Re-implement the visual bar style from the original code
                const standardChapters = getBookChapters(row.book);
                const isMultiCycle = row.total > standardChapters;
                let cycleBadge = null;
                
                if (isMultiCycle) {
                    const currentCycle = Math.floor(row.completed / standardChapters) + 1;
                    const totalCycles = Math.ceil(row.total / standardChapters);
                    const isDone = row.completed >= row.total;
                    cycleBadge = (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium ml-2">
                            {isDone ? `${totalCycles}회독 완료` : `${currentCycle}회독 진행중`}
                        </span>
                    );
                }

                return (
                    <div key={row.book} className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex items-center">
                          <div className="text-sm font-medium truncate">{row.book}</div>
                          {cycleBadge}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground shrink-0">{row.percent}%</div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                         <span>{row.completed}/{row.total}장</span>
                      </div>
                      <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                );
            })
        )}
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            성경별 읽기 기록
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="old" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="old">구약</TabsTrigger>
              <TabsTrigger value="new">신약</TabsTrigger>
            </TabsList>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <TabsContent value="old" className="mt-0">
              {renderList(otRows)}
            </TabsContent>
            <TabsContent value="new" className="mt-0">
              {renderList(ntRows)}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
