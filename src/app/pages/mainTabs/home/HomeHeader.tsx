import { Bell, Flame, Settings, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { setHashTab } from "../tabHash";

interface HomeHeaderProps {
  incomingRequestsCount: number;
  readingStreak: number;
  loginStreak: number;
  longestLoginStreak: number;
}

export function HomeHeader({
  incomingRequestsCount,
  readingStreak,
  loginStreak,
  longestLoginStreak,
}: HomeHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xl font-bold text-foreground">Bible Plan</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center gap-1.5 p-1 hover:bg-accent rounded-full transition-colors outline-none pl-3 group">
                {incomingRequestsCount > 0 && (
                  <span className="hidden sm:inline text-[11px] font-bold text-red-500 animate-pulse whitespace-nowrap">
                    새 친구 요청이 있습니다
                  </span>
                )}
                <div className="relative p-1">
                  <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {incomingRequestsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-background" />
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>알림</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setHashTab("settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>알림 설정</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHashTab("friends", "requests")}>
                <Users className="mr-2 h-4 w-4" />
                <span>친구 요청</span>
                {incomingRequestsCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {incomingRequestsCount}
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors cursor-pointer outline-none"
              >
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {readingStreak ?? 0}일
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">연속 읽기 (하루에 읽기만 해도 인정)</p>
                  <p className="text-xl font-bold text-foreground">{readingStreak ?? 0}일</p>
                </div>
                <div className="w-full h-px bg-border/60 my-1" />
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">연속 접속</p>
                  <p className="text-sm font-semibold text-foreground">{loginStreak ?? 0}일</p>
                  <p className="text-[10px] text-muted-foreground">최고 기록 {longestLoginStreak ?? 0}일</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
