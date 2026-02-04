import { useState, useMemo } from 'react';
import { BookOpen, LogOut, Plus, Trash2, Calendar } from 'lucide-react';
import { usePlans } from '../../hooks/usePlans';
import { usePlanStore } from '../../stores/plan.store';
import { useAuthStore } from '../../stores/auth.store';
import { ReadingPlanCard } from '../components/ReadingPlanCard';
import { CustomPlanCreator } from '../components/CustomPlanCreator';
import * as authService from '../../services/authService';
import * as api from '../utils/api';
import { bundledPresetPlans, normalizeSchedule } from '../plans/bundledPresets';
import { expandChapters } from '../utils/expandChapters';
import { Tabs, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import { AchievementReportModal } from '../components/AchievementReportModal';

export function PlanSelectorPage({ embedded = false }: { embedded?: boolean }) {
  const { plans, createPlanAsync, deletePlanAsync, isCreating, isDeleting } = usePlans();
  const { selectPlan, deselectPlan, showCustomPlanCreator, toggleCustomPlanCreator } = usePlanStore();
  const logout = useAuthStore((state) => state.logout);
  const selectedPlanId = usePlanStore((state) => state.selectedPlanId);

  const [activeTab, setActiveTab] = useState("my-plans");
  
  // Dialog States
  const [selectedMyPlan, setSelectedMyPlan] = useState<any | null>(null);
  const [selectedAddPlan, setSelectedAddPlan] = useState<any | null>(null);
  const [dialogStartDate, setDialogStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCompletedReport, setShowCompletedReport] = useState(false);

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === 'true';

  const presetPlans = [...bundledPresetPlans, ...api.getDeveloperPresetPlans()];

  const activePlans = useMemo(() => plans.filter((p: any) => (p?.status ?? "active") === "active"), [plans]);
  const completedPlans = useMemo(() => plans.filter((p: any) => (p?.status ?? "active") === "completed"), [plans]);

  const handleSignOut = async () => {
    await authService.signOut();
    logout();
  };

  const handleAddPresetPlan = async () => {
    if (!selectedAddPlan) return;
    if (!dialogStartDate) {
      alert('시작 날짜를 선택해주세요');
      return;
    }

    try {
      const normalizedSchedule = normalizeSchedule(selectedAddPlan.schedule || []);

      let totalChapters = 0;
      if (normalizedSchedule) {
        normalizedSchedule.forEach((day: any) => {
          if (day.readings) {
            day.readings.forEach((r: any) => {
              totalChapters += expandChapters(r.chapters).length;
            });
          }
        });
      }

      const result = await createPlanAsync({
        name: selectedAddPlan.title,
        startDate: dialogStartDate,
        totalDays: selectedAddPlan.totalDays,
        totalChapters,
        schedule: normalizedSchedule,
        isCustom: false,
        presetId: selectedAddPlan.id,
      });
      selectPlan(result.plan.id);
      setActiveTab("my-plans");
      setSelectedAddPlan(null);
    } catch (err: any) {
      console.error('Failed to create plan from preset:', err);
      const errorMessage = err.message || '계획 생성에 실패했습니다';
      alert(errorMessage);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedMyPlan) return;
    if (isDeleting) return;
    
    const ok = window.confirm('정말 이 계획을 삭제하시겠습니까?');
    if (!ok) return;

    try {
      if (selectedPlanId === selectedMyPlan.id) {
        deselectPlan();
      }
      await deletePlanAsync(selectedMyPlan.id);
      setSelectedMyPlan(null);
    } catch (err) {
      console.error('Failed to delete plan:', err);
      alert('계획 삭제에 실패했습니다');
    }
  };

  const handleCreateCustomPlan = async (planData: {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    totalDays: number;
    totalChapters: number;
    schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
    isCustom: boolean;
  }) => {
    try {
      const result = await createPlanAsync(planData);
      selectPlan(result.plan.id);
      toggleCustomPlanCreator(false);
      setActiveTab("my-plans");
    } catch (err: any) {
      console.error('Failed to create custom plan:', err);
      const errorMessage = err.message || '계획 생성에 실패했습니다';
      alert(errorMessage);
    }
  };

  // Helper to find description for existing plan
  const getPlanDescription = (plan: any) => {
    if (plan.presetId) {
      const preset = presetPlans.find(p => p.id === plan.presetId);
      return preset?.description || "설명 없음";
    }
    return "사용자 지정 계획"; // Or try to show stored description if we had it
  };

  return (
    <div className={embedded ? "" : "min-h-screen pb-24"}>
      {!embedded && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-foreground">계획</p>
            </div>
            <div className="w-32">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my-plans">나의 계획</SelectItem>
                  <SelectItem value="add-plan">계획 추가</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? "p-4 sm:p-6" : "max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pt-6"}>
        {!embedded && devPageEnabled && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                window.location.hash = '#/dev';
              }}
              className="px-4 py-2 text-sm bg-card text-muted-foreground border border-border hover:bg-accent rounded-lg transition-colors"
            >
              개발자 계획 등록
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* My Plans Tab */}
          <TabsContent value="my-plans" className="space-y-6 mt-0">
            {activePlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                <div className="p-4 bg-background rounded-full shadow-sm">
                   <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg">진행 중인 계획이 없습니다</h3>
                    <p className="text-muted-foreground mt-1">
                    '계획 추가'에서 새로운 성경 읽기를 시작해보세요.
                    </p>
                </div>
                <button
                    onClick={() => setActiveTab("add-plan")}
                    className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
                >
                    계획 추가하러 가기
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="bg-primary/10 text-primary p-1 rounded-md">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    나의 계획
                  </h2>
                  <button
                    onClick={() => setActiveTab("add-plan")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    계획 추가
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {activePlans.map((plan) => (
                    <ReadingPlanCard
                      key={plan.id}
                      id={plan.id}
                      title={plan.name}
                      description="" // Hide description in list
                      duration=""    // Hide duration in list
                      isSelected={false}
                      onSelect={() => setSelectedMyPlan(plan)}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedPlans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="bg-primary/10 text-primary p-1 rounded-md">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    완료된 계획
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {completedPlans.map((plan: any) => (
                    <ReadingPlanCard
                      key={plan.id}
                      id={plan.id}
                      title={plan.name}
                      description="" 
                      duration={plan?.completedAt ? `완료: ${String(plan.completedAt).split("T")[0]}` : "완료"}
                      isSelected={false}
                      onSelect={() => setSelectedMyPlan(plan)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Add Plan Tab */}
          <TabsContent value="add-plan" className="space-y-8 mt-0">
            {/* Custom Plan Button Section */}
            <div className="bg-card border-none shadow-sm rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-2">나만의 계획 만들기</h3>
                <p className="text-muted-foreground text-sm mb-4">원하는 범위와 기간을 설정하여 맞춤형 읽기표를 생성합니다.</p>
                <button
                    onClick={() => toggleCustomPlanCreator(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm w-full sm:w-auto font-medium"
                >
                    <Plus className="w-5 h-5" />
                    맞춤 계획 추가
                </button>
            </div>

            {/* Recommended Plans Section */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="bg-primary/10 text-primary p-1 rounded-md"><BookOpen className="w-4 h-4"/></span>
                추천 계획
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {presetPlans.map((plan: any) => {
                  const isAlreadyAdded = plans.some(p => p.name === plan.title);
                  
                  // Calculate average chapters
                  let totalChapters = 0;
                  if (plan.schedule) {
                    plan.schedule.forEach((day: any) => {
                      if (day.readings) {
                        day.readings.forEach((r: any) => {
                          totalChapters += expandChapters(r.chapters).length;
                        });
                      }
                    });
                  }
                  const rawAvg = plan.totalDays > 0 ? totalChapters / plan.totalDays : 0;
                  const avg = parseFloat(rawAvg.toFixed(1));
                  const avgText = `하루 평균 ${avg}장`;

                  return (
                    <ReadingPlanCard
                      key={plan.id}
                      id={plan.id}
                      title={plan.title}
                      description="" // Hide description in list
                      duration={avgText}
                      isSelected={false}
                      onSelect={() => {
                        if (isAlreadyAdded) {
                          alert(`"${plan.title}" 계획이 이미 추가되어 있습니다.`);
                          return;
                        }
                        setDialogStartDate(new Date().toISOString().split('T')[0]);
                        setSelectedAddPlan(plan);
                      }}
                      disabled={isAlreadyAdded}
                    />
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {showCustomPlanCreator && (
        <CustomPlanCreator
          onClose={() => toggleCustomPlanCreator(false)}
          onSave={handleCreateCustomPlan}
        />
      )}

      {/* My Plan Details Dialog */}
      <Dialog open={!!selectedMyPlan} onOpenChange={(open) => !open && setSelectedMyPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedMyPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/30 rounded-xl space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">시작 날짜</span>
                <span className="font-medium">{selectedMyPlan?.startDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">종료 날짜</span>
                <span className="font-medium">{selectedMyPlan?.endDate || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">총 기간</span>
                <span className="font-medium">{selectedMyPlan?.totalDays}일</span>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">계획 설명</h4>
              <p className="text-sm text-muted-foreground bg-card border border-border p-3 rounded-lg min-h-[80px]">
                {selectedMyPlan && getPlanDescription(selectedMyPlan)}
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <div className="flex gap-2 w-full sm:w-auto sm:justify-start">
              {(selectedMyPlan?.status ?? 'active') === 'completed' ? (
                <button
                  onClick={() => setShowCompletedReport(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
                >
                  리포트 보기
                </button>
              ) : (
                <button
                  onClick={handleDeletePlan}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  계획 삭제
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedMyPlan(null)}
              className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedMyPlan && (selectedMyPlan?.status ?? 'active') === 'completed' && showCompletedReport && (
        <AchievementReportModal
          plan={selectedMyPlan}
          // Snapshot 기반이므로 progress는 더미로 전달 (모달 내부에서 snapshot 모드로만 렌더)
          progress={{ userId: '', planId: selectedMyPlan.id, completedDays: [], lastUpdated: '' } as any}
          dailyStats={[]}
          open={true}
          onClose={() => setShowCompletedReport(false)}
          variant="completed"
          snapshot={selectedMyPlan?.completionSnapshot}
        />
      )}

      {/* Add Plan Details Dialog */}
      <Dialog open={!!selectedAddPlan} onOpenChange={(open) => !open && setSelectedAddPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedAddPlan?.title}</DialogTitle>
            <DialogDescription>{selectedAddPlan?.duration}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h4 className="text-sm font-medium mb-2">계획 설명</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                {selectedAddPlan?.description}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                시작 날짜 설정
              </label>
              <input
                type="date"
                value={dialogStartDate}
                onChange={(e) => setDialogStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <button
              onClick={() => setSelectedAddPlan(null)}
              className="flex-1 px-4 py-2.5 border border-border bg-background hover:bg-accent rounded-lg transition-colors text-sm font-medium"
            >
              취소
            </button>
            <button
              onClick={handleAddPresetPlan}
              disabled={isCreating}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isCreating ? "추가 중..." : "계획 추가하기"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}