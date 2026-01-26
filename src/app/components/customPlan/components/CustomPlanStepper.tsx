export function CustomPlanStepper({
  step,
  setStep,
  step1Valid,
  step2Valid,
}: {
  step: 1 | 2 | 3;
  setStep: (s: 1 | 2 | 3) => void;
  step1Valid: boolean;
  step2Valid: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
            step === 1
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-accent"
          }`}
        >
          정보 입력
        </button>

        <span className="text-muted-foreground/60 shrink-0">→</span>

        <button
          type="button"
          onClick={() => {
            if (!step1Valid) {
              alert("날짜 범위를 올바르게 입력해주세요");
              return;
            }
            setStep(2);
          }}
          className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
            step === 2
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-accent"
          }`}
        >
          범위 선택
        </button>

        <span className="text-muted-foreground/60 shrink-0">→</span>

        <button
          type="button"
          onClick={() => {
            if (!step1Valid) {
              alert("날짜 범위를 올바르게 입력해주세요");
              return;
            }
            if (!step2Valid) {
              alert("책을 1개 이상 선택해주세요");
              return;
            }
            setStep(3);
          }}
          className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs sm:text-sm whitespace-nowrap transition-colors ${
            step === 3
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-accent"
          }`}
        >
          순서 확인
        </button>
      </div>
    </div>
  );
}
