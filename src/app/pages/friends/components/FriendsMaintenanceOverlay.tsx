import { Wrench } from "lucide-react";

export function FriendsMaintenanceOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 p-8 bg-card border border-border rounded-2xl shadow-lg text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <Wrench className="w-8 h-8 text-primary" />
        </div>
        
        <h2 className="text-xl font-bold text-foreground">
          페이지 수정 중입니다
        </h2>
        
        <p className="text-muted-foreground text-sm leading-relaxed">
          더 나은 서비스를 위해 친구 기능을 개선하고 있습니다.<br />
          당분간 이용이 불가능한 점 양해 부탁드립니다.
        </p>

        <div className="pt-2">
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            빠른 시일 내에 복구하겠습니다
          </span>
        </div>
      </div>
    </div>
  );
}
