import { useState } from 'react';
import { BookOpen, LogOut, Plus } from 'lucide-react';
import { usePlans } from '../../hooks/usePlans';
import { usePlanStore } from '../../stores/plan.store';
import { useAuthStore } from '../../stores/auth.store';
import { ReadingPlanCard } from '../components/ReadingPlanCard';
import { CustomPlanCreator } from '../components/CustomPlanCreator';
import * as authService from '../../services/authService';
import * as api from '../utils/api';
import { bundledPresetPlans, normalizeSchedule } from '../plans/bundledPresets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export function PlanSelectorPage({ embedded = false }: { embedded?: boolean }) {
  const { plans, createPlanAsync, deletePlanAsync, isCreating, isDeleting } = usePlans();
  const { selectPlan, deselectPlan, showCustomPlanCreator, toggleCustomPlanCreator } = usePlanStore();
  const logout = useAuthStore((state) => state.logout);
  const selectedPlanId = usePlanStore((state) => state.selectedPlanId);

  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [presetStartDates, setPresetStartDates] = useState<Record<string, string>>({});

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === 'true';

  // 개발자 페이지에서 등록한 프리셋(로컬 저장)도 추천 목록에 포함
  const presetPlans = [...bundledPresetPlans, ...api.getDeveloperPresetPlans()];

  const handleSignOut = async () => {
    await authService.signOut();
    logout();
  };

  const handleAddPresetPlan = async (presetId: string, startDate: string) => {
    const presetPlan = presetPlans.find((p) => p.id === presetId);
    if (!presetPlan) return;

    if (!startDate) {
      alert('시작 날짜를 선택해주세요');
      return;
    }

    try {
      setAddingPresetId(presetId);
      const normalizedSchedule = normalizeSchedule(presetPlan.schedule || []);

      const result = await createPlanAsync({
        name: presetPlan.title,
        startDate,
        totalDays: presetPlan.totalDays,
        schedule: normalizedSchedule,
        isCustom: false,
        presetId: presetPlan.id,
      });
      selectPlan(result.plan.id);
      // Switch to 'my-plans' tab logic could be added here if we had access to the tabs state, 
      // but strictly following the request, we just add it. 
      // User might want to see it in "My Plans" tab.
    } catch (err: any) {
      console.error('Failed to create plan from preset:', err);
      const errorMessage = err.message || '계획 생성에 실패했습니다';
      alert(errorMessage);
    } finally {
      setAddingPresetId(null);
    }
  };

  const handleCreateCustomPlan = async (planData: {
    name: string;
    startDate: string;
    endDate?: string;
    totalDays: number;
    schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
    isCustom: boolean;
  }) => {
    try {
      const result = await createPlanAsync(planData);
      selectPlan(result.plan.id);
      toggleCustomPlanCreator(false);
    } catch (err: any) {
      console.error('Failed to create custom plan:', err);
      const errorMessage = err.message || '계획 생성에 실패했습니다';
      alert(errorMessage);
    }
  };

  return (
    <div className={embedded ? "p-4 sm:p-6" : "min-h-screen bg-muted/30 p-6"}>
      <div className="max-w-4xl mx-auto">
        {!embedded && (
          <div className="flex justify-between items-start mb-8">
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h1 className="mb-2">성경 읽기 계획</h1>
              <p className="text-muted-foreground">읽기 계획을 선택하거나 새로 만들어보세요</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-card text-muted-foreground border border-border hover:bg-accent rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              로그아웃
            </button>
          </div>
        )}

        {!embedded && devPageEnabled && (
          <div className="mb-4 flex justify-end">
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

        <Tabs defaultValue="my-plans" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="my-plans" className="h-full text-base">나의 계획</TabsTrigger>
            <TabsTrigger value="add-plan" className="h-full text-base">계획 추가</TabsTrigger>
          </TabsList>

          <TabsContent value="my-plans" className="space-y-6">
            {plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                <div className="p-4 bg-background rounded-full shadow-sm">
                   <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg">진행 중인 계획이 없습니다</h3>
                    <p className="text-muted-foreground mt-1">
                    '계획 추가' 탭에서 새로운 성경 읽기를 시작해보세요.
                    </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {plans.map((plan) => (
                  <ReadingPlanCard
                    key={plan.id}
                    id={plan.id}
                    title={plan.name}
                    description={
                      plan.isCustom
                        ? '사용자 지정 계획'
                        : `${plan.startDate}부터 시작`
                    }
                    duration={`${plan.totalDays}일`}
                    isSelected={false}
                    onSelect={() => {}}
                    canDelete
                    busyLabel={deletingPlanId === plan.id ? '삭제중' : undefined}
                    onDelete={async () => {
                      if (isDeleting) return;
                      const ok = window.confirm('이 계획을 삭제할까요?');
                      if (!ok) return;

                      try {
                        setDeletingPlanId(plan.id);

                        // 선택된 계획이면 즉시 해제해서 UI가 빠르게 반응하도록 함
                        if (selectedPlanId === plan.id) {
                          deselectPlan();
                        }

                        await deletePlanAsync(plan.id);
                      } catch (err) {
                        console.error('Failed to delete plan:', err);
                        alert('계획 삭제에 실패했습니다');
                      } finally {
                        setDeletingPlanId(null);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add-plan" className="space-y-8">
            {/* Custom Plan Button Section */}
            <div className="bg-card/50 border border-border rounded-xl p-6">
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
                  // 이미 추가된 계획인지 확인
                  const isAlreadyAdded = plans.some(p => p.name === plan.title);
                  const today = new Date().toISOString().split('T')[0];
                  const startDate = presetStartDates[plan.id] ?? today;
                  const isBusy = addingPresetId === plan.id;
                  const isDisabled = isAlreadyAdded || isCreating || isBusy;
                  
                  return (
                    <ReadingPlanCard
                      key={plan.id}
                      id={plan.id}
                      title={plan.title}
                      description={plan.description}
                      duration={plan.duration}
                      isSelected={false}
                      clickable={false}
                      onSelect={() => {}}
                      disabled={isAlreadyAdded || isCreating}
                      busyLabel={isBusy ? '추가중' : undefined}
                      headerAction={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAlreadyAdded) {
                              alert(`"${plan.title}" 계획이 이미 추가되어 있습니다.`);
                              return;
                            }
                            void handleAddPresetPlan(plan.id, startDate);
                          }}
                          disabled={isDisabled}
                          className="p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50 text-primary"
                          title="추가"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      }
                      footer={
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-3 pt-2"
                        >
                          <label className="text-sm text-muted-foreground shrink-0">시작 날짜</label>
                          <input
                            type="date"
                            value={startDate}
                            disabled={isDisabled}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPresetStartDates((prev) => ({ ...prev, [plan.id]: v }));
                            }}
                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 text-sm"
                          />
                        </div>
                      }
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

    </div>
  );
}