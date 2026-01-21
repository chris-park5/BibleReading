import { Bell, Flame, Settings, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { setHashTab } from "../tabHash";

interface HomeHeaderProps {
  incomingRequestsCount: number;
  streak: number;
}

export function HomeHeader({
  incomingRequestsCount,
  streak,
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
                  <span className="text-[10px] sm:text-[11px] font-bold text-red-500 animate-pulse whitespace-nowrap">
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

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-900/30">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
              {streak ?? 0}일
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
