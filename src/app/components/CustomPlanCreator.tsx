import { X, BookPlus, Check } from "lucide-react";
import { useCustomPlanCreator, PlanData } from "./customPlan/hooks/useCustomPlanCreator";
import { CustomPlanStepper } from "./customPlan/components/CustomPlanStepper";
import { Step1PlanInfo } from "./customPlan/components/Step1PlanInfo";
import { Step2BookSelection } from "./customPlan/components/Step2BookSelection";
import { Step3OrderConfirmation } from "./customPlan/components/Step3OrderConfirmation";

interface CustomPlanCreatorProps {
  onClose: () => void;
  onSave: (planData: PlanData) => void;
}

export function CustomPlanCreator({ onClose, onSave }: CustomPlanCreatorProps) {
  const hookProps = useCustomPlanCreator({ onSave });
  const {
    step,
    setStep,
    step1Valid,
    step2Valid,
    goNext,
    goPrev,
    handleSave,
    isCreateDisabled,
    selectedBooks,
    computedTotalDays,
    uniqueBookCount,
    duplicateEntryCount,
    totalChapters,
    avgChaptersPerDay,
    handleStep3AutoScroll,
    draggingIndex,
    draggingGroup,
    otStep3ScrollRef,
    ntStep3ScrollRef,
    step3ScrollRef,
  } = hookProps;

  const handleGlobalDragOver = (e: React.DragEvent) => {
    if (step !== 3) return;
    
    if (draggingIndex !== null || draggingGroup !== null) {
      e.preventDefault();
      
      if (draggingGroup === 'OT') {
         handleStep3AutoScroll(e.clientY, otStep3ScrollRef.current);
      } else if (draggingGroup === 'NT') {
         handleStep3AutoScroll(e.clientY, ntStep3ScrollRef.current);
      } else if (draggingIndex !== null) {
         handleStep3AutoScroll(e.clientY, step3ScrollRef.current);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 sm:p-6 z-[100]"
      onDragOver={handleGlobalDragOver}
    >
      <div className="bg-card text-card-foreground shadow-xl rounded-[28px] max-w-2xl w-full max-h-[90vh] overflow-y-auto relative border border-slate-100">
        <div className="sticky top-0 bg-card/80 backdrop-blur border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BookPlus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2>새 계획 만들기</h2>
                <p className="text-muted-foreground text-sm">날짜 + 책 선택</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 sm:p-6 space-y-6">
          {/* Stepper */}
          <CustomPlanStepper
            step={step}
            setStep={setStep}
            step1Valid={step1Valid}
            step2Valid={step2Valid}
          />

          {/* Step 1 */}
          {step === 1 && <Step1PlanInfo {...hookProps} />}

          {/* Step 2 */}
          {step === 2 && <Step2BookSelection {...hookProps} />}

          {/* Step 3 */}
          {step === 3 && <Step3OrderConfirmation {...hookProps} />}
        </div>

        <div className="sticky bottom-0 bg-card/80 backdrop-blur border-t border-slate-100 px-5 py-4 sm:p-6 space-y-3">
          {/* 수치 기반 요약 */}
          <div className="text-xs sm:text-sm text-muted-foreground">
            {selectedBooks.length === 0 ||
            computedTotalDays === null ||
            computedTotalDays <= 0 ? (
              <span className="text-muted-foreground">
                책과 날짜를 선택하면 요약이 표시됩니다.
              </span>
            ) : (
              <span>
                총 <span className="font-medium">{uniqueBookCount}권</span>
                {duplicateEntryCount > 0 && (
                  <span className="text-muted-foreground">
                    (+중복 {duplicateEntryCount})
                  </span>
                )}
                {` (${totalChapters}장)을 `}
                <span className="font-medium">{computedTotalDays}일</span> 동안
                읽습니다.
                {avgChaptersPerDay !== null && (
                  <span className="text-muted-foreground">
                    {" "}
                    (하루 평균 {parseFloat(avgChaptersPerDay.toFixed(1))}장)
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-3 py-2.5 border-none shadow-sm bg-background rounded-lg hover:bg-accent transition-colors text-sm"
            >
              취소
            </button>

            <div className="flex-1 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="flex-1 px-3 py-2.5 border-none shadow-sm bg-background rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  이전
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  다음
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isCreateDisabled}
                  className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:hover:bg-primary text-sm flex items-center justify-center"
                >
                  계획생성
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
