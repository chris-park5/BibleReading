import { Check } from "lucide-react";
import { cn } from "../../ui/utils";

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
  const steps = [
    { id: 1, label: "정보 입력" },
    { id: 2, label: "범위 선택" },
    { id: 3, label: "순서 확인" },
  ];

  const handleStepClick = (targetStep: number) => {
    if (targetStep === 1) {
      setStep(1);
    } else if (targetStep === 2) {
      if (!step1Valid) {
        alert("날짜 범위를 올바르게 입력해주세요");
        return;
      }
      setStep(2);
    } else if (targetStep === 3) {
      if (!step1Valid) {
        alert("날짜 범위를 올바르게 입력해주세요");
        return;
      }
      if (!step2Valid) {
        alert("책을 1개 이상 선택해주세요");
        return;
      }
      setStep(3);
    }
  };

  const progressPercent = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <div className="relative">
      {/* Progress Bar Background */}
      <div className="absolute top-4 left-0 w-full h-0.5 bg-muted rounded-full -z-10" />
      
      {/* Active Progress Bar */}
      <div 
        className="absolute top-4 left-0 h-0.5 bg-primary rounded-full -z-10 transition-all duration-300 ease-out"
        style={{ width: `${progressPercent}%` }}
      />

      <div className="flex justify-between w-full">
        {steps.map((s) => {
          const isCompleted = step > s.id;
          const isActive = step === s.id;
          const isClickable = s.id < step || (s.id === step + 1 && (step === 1 ? step1Valid : step === 2 ? step2Valid : true)); // Allow clicking next if current is valid? Or just strictly history. Existing logic allows jumping if valid.

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStepClick(s.id)}
              className="group flex flex-col items-center gap-2 focus:outline-none"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 z-10",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground scale-100"
                    : isActive
                    ? "bg-background border-primary text-primary scale-110 shadow-sm"
                    : "bg-background border-muted text-muted-foreground group-hover:border-muted-foreground/50"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
