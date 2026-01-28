import { Calendar, Info } from "lucide-react";
import { useCustomPlanCreator } from "../hooks/useCustomPlanCreator";

type Props = ReturnType<typeof useCustomPlanCreator>;

export function Step1PlanInfo({
  name,
  setName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  MAX_PLAN_NAME_LENGTH,
  MAX_TOTAL_DAYS,
  maxEndDate,
  computedTotalDays,
  isFinalNameValid,
  finalName,
  autoPlanName,
}: Props) {
  const parseDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split("-").map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const formatDateYMD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Plan Name Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-base font-semibold text-foreground">
            계획 이름
          </label>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {(name ?? "").length}/{MAX_PLAN_NAME_LENGTH}
          </span>
        </div>
        
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_PLAN_NAME_LENGTH}
          className="w-full px-4 py-3 border-none bg-muted/30 rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all text-base placeholder:text-muted-foreground/50"
          placeholder="예) 성경 1년 1독 / 구약 90일 정복"
        />

        {!isFinalNameValid && finalName.length > MAX_PLAN_NAME_LENGTH && (
          <div className="text-sm text-destructive mt-2 flex items-center gap-1">
            <Info className="w-4 h-4" />
            이름이 너무 깁니다. (최대 {MAX_PLAN_NAME_LENGTH}자)
          </div>
        )}
        
        {!name.trim() && autoPlanName && (
          <div className="mt-2 p-3 bg-primary/5 text-primary rounded-lg text-sm flex items-start gap-2 border border-primary/10">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium">자동 설정:</span> 이름을 비우면 
              <span className="font-bold ml-1">"{autoPlanName}"</span>(으)로 저장됩니다.
            </div>
          </div>
        )}
      </div>

      {/* Date Range Section */}
      <div className="bg-muted/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Calendar className="w-5 h-5 text-primary" />
            날짜 범위 설정
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
            최대 {MAX_TOTAL_DAYS}일
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              시작 날짜
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStartDate(nextStart);

                if (!nextStart) return;
                const max = (() => {
                  const s = parseDate(nextStart);
                  const m = new Date(s);
                  m.setDate(m.getDate() + (MAX_TOTAL_DAYS - 1));
                  return formatDateYMD(m);
                })();

                setEndDate((prevEnd) => {
                  if (!prevEnd) return nextStart;
                  if (prevEnd < nextStart) return nextStart;
                  if (prevEnd > max) return max;
                  return prevEnd;
                });
              }}
              className="w-full px-3 py-2.5 bg-background border-none rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 cursor-pointer text-sm font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              종료 날짜
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={maxEndDate}
              onChange={(e) => {
                const nextEnd = e.target.value;
                if (!nextEnd) {
                  setEndDate(nextEnd);
                  return;
                }

                if (startDate && nextEnd < startDate) {
                  setEndDate(startDate);
                  return;
                }

                if (maxEndDate && nextEnd > maxEndDate) {
                  setEndDate(maxEndDate);
                  return;
                }

                setEndDate(nextEnd);
              }}
              className="w-full px-3 py-2.5 bg-background border-none rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 cursor-pointer text-sm font-medium"
            />
          </div>
        </div>

        {/* Validation / Summary */}
        <div className="pt-2">
          {computedTotalDays !== null && computedTotalDays > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">총 기간:</span>
              <span className="font-bold text-primary text-lg">{computedTotalDays}일</span>
              {computedTotalDays > MAX_TOTAL_DAYS && (
                <span className="text-destructive text-xs font-medium ml-2">
                  (기간 초과: 종료 날짜를 줄여주세요)
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/60">
              시작과 종료 날짜를 선택해주세요.
            </div>
          )}
          
          {maxEndDate && (
            <p className="text-[10px] text-muted-foreground mt-1 ml-1">
              * 현재 시작일 기준 최대 종료일: {maxEndDate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
