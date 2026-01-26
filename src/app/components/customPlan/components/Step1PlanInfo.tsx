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
    <div className="space-y-4">
      <div className="border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm text-muted-foreground">계획 이름</div>
            <div className="text-xs text-muted-foreground">비우면 자동</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {(name ?? "").length}/{MAX_PLAN_NAME_LENGTH}
          </div>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_PLAN_NAME_LENGTH}
          className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
          placeholder="예) 성경 1년 1독 / 구약 90일"
        />

        {!isFinalNameValid && finalName.length > MAX_PLAN_NAME_LENGTH && (
          <div className="text-sm text-destructive mt-2">
            이름이 너무 깁니다. (최대 {MAX_PLAN_NAME_LENGTH}자)
          </div>
        )}
        {!name.trim() && autoPlanName && (
          <div className="mt-2 text-sm text-muted-foreground">
            자동 이름: <span className="font-medium text-foreground">{autoPlanName}</span>
          </div>
        )}
      </div>

      <div className="border border-border rounded-xl p-4">
        <div className="mb-3">
          <div className="text-sm text-muted-foreground">날짜 범위</div>
          <div className="text-xs text-muted-foreground">최대 {MAX_TOTAL_DAYS}일</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              시작 날짜
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStartDate(nextStart);

                // Keep endDate within [startDate, startDate + MAX_TOTAL_DAYS - 1]
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
              className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
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
              className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-3">
          {computedTotalDays !== null && <span>현재 {computedTotalDays}일</span>}
          {maxEndDate && <span className="ml-2">(최대 종료 날짜: {maxEndDate})</span>}
          {computedTotalDays !== null && computedTotalDays > MAX_TOTAL_DAYS && (
            <div className="mt-1 text-destructive">
              기간이 너무 깁니다. 종료 날짜를 줄여주세요.
            </div>
          )}
          {computedTotalDays !== null && computedTotalDays <= 0 && (
            <div className="mt-1 text-destructive">
              종료 날짜는 시작 날짜 이후여야 합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
