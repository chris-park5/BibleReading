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
      {/* Progress Bar */}
      <div className="absolute top-3.5 left-0 w-full h-px bg-slate-100 rounded-full -z-10" />
      <div
        className="absolute top-3.5 left-0 h-px bg-blue-500/70 rounded-full -z-10 transition-all duration-300 ease-out"
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
                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold border transition-all duration-300 z-10 shadow-sm",
                  isCompleted
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isActive
                    ? "bg-white border-blue-200 text-blue-700 scale-110 ring-1 ring-blue-50"
                    : "bg-white border-slate-200 text-slate-400 group-hover:border-slate-300"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-[11px] font-bold transition-colors duration-300",
                  isActive ? "text-slate-900" : isCompleted ? "text-slate-600" : "text-slate-400"
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
