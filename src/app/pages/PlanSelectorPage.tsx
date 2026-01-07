import { useEffect, useState } from 'react';
import { BookOpen, LogOut, Plus } from 'lucide-react';
import { usePlans } from '../../hooks/usePlans';
import { usePlanStore } from '../../stores/plan.store';
import { useAuthStore } from '../../stores/auth.store';
import { ReadingPlanCard } from '../components/ReadingPlanCard';
import { CustomPlanCreator } from '../components/CustomPlanCreator';
import * as authService from '../../services/authService';
import * as planService from '../../services/planService';
import * as friendService from '../../services/friendService';
import * as api from '../utils/api';

import { bundledPresetPlans, normalizeSchedule } from '../plans/bundledPresets';

export function PlanSelectorPage({ embedded = false }: { embedded?: boolean }) {
  const { plans, createPlanAsync, deletePlanAsync, isCreating, isDeleting, refetch } = usePlans();
  const { selectPlan, deselectPlan, showCustomPlanCreator, toggleCustomPlanCreator } = usePlanStore();
  const logout = useAuthStore((state) => state.logout);
  const selectedPlanId = usePlanStore((state) => state.selectedPlanId);

  const [sharedPlanId, setSharedPlanId] = useState<string | null>(null);
  const [isSavingSharedPlan, setIsSavingSharedPlan] = useState(false);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === 'true';

  // 개발자 페이지에서 등록한 프리셋(로컬 저장)도 추천 목록에 포함
  const presetPlans = [...bundledPresetPlans, ...api.getDeveloperPresetPlans()];

  useEffect(() => {
    if (!plans.length) return;
    void (async () => {
      try {
        const res = await friendService.getSharePlan();
        setSharedPlanId(res.sharedPlanId);
      } catch {
        // ignore
      }
    })();
  }, [plans.length]);

  const handleChangeSharedPlan = async (nextPlanId: string | null) => {
    setIsSavingSharedPlan(true);
    try {
      await friendService.setSharePlan(nextPlanId);
      setSharedPlanId(nextPlanId);
    } catch (err) {
      console.error('Failed to set shared plan:', err);
      alert('공유할 계획 설정에 실패했습니다');
    } finally {
      setIsSavingSharedPlan(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    logout();
  };

  const handleSelectPlan = async (planId: string, isPreset: boolean) => {
    if (isPreset) {
      // 프리셋 계획을 사용자 계획으로 저장
      const presetPlan = presetPlans.find((p) => p.id === planId);
      if (presetPlan) {
        try {
          setAddingPresetId(planId);
          const normalizedSchedule = normalizeSchedule(presetPlan.schedule || []);

          const result = await createPlanAsync({
            name: presetPlan.title,
            startDate: new Date().toISOString().split('T')[0],
            totalDays: presetPlan.totalDays,
            schedule: normalizedSchedule,
            isCustom: false,
            presetId: presetPlan.id,  // Pass presetId for Master-Instance structure
          });
          selectPlan(result.plan.id);
        } catch (err: any) {
          console.error('Failed to create plan from preset:', err);
          const errorMessage = err.message || '계획 생성에 실패했습니다';
          alert(errorMessage);
        } finally {
          setAddingPresetId(null);
        }
      }
    } else {
      selectPlan(planId);
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

  const handleMovePlanUp = async (index: number) => {
    if (index === 0) return;
    
    const planToMove = plans[index];
    const targetPlan = plans[index - 1];
    
    try {
      await planService.updatePlanOrder(planToMove.id, targetPlan.displayOrder || index - 1);
      await refetch();
    } catch (err) {
      console.error('Failed to move plan:', err);
      alert('계획 이동에 실패했습니다');
    }
  };

  const handleMovePlanDown = async (index: number) => {
    if (index === plans.length - 1) return;
    
    const planToMove = plans[index];
    const targetPlan = plans[index + 1];
    
    try {
      await planService.updatePlanOrder(planToMove.id, targetPlan.displayOrder || index + 1);
      await refetch();
    } catch (err) {
      console.error('Failed to move plan:', err);
      alert('계획 이동에 실패했습니다');
    }
  };

  return (
    <div className={`${embedded ? 'p-6' : 'min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6'}`}>
      <div className="max-w-4xl mx-auto">
        {!embedded && (
          <div className="flex justify-between items-start mb-8">
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h1 className="mb-2">성경 읽기 계획</h1>
              <p className="text-gray-600">읽기 계획을 선택하거나 새로 만들어보세요</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-colors"
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
              className="px-4 py-2 text-sm bg-white text-gray-700 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-colors"
            >
              개발자 계획 등록
            </button>
          </div>
        )}

        <div className="mb-6 flex gap-4">
          <button
            onClick={() => toggleCustomPlanCreator(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-800 border-2 border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Plus className="w-5 h-5 text-blue-500" />
            새 계획 만들기
          </button>
        </div>

        {/* 내 계획 */}
        {plans.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4">내 계획</h2>

            <div className="mb-4 bg-white border-2 border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-600">친구에게 공유할 계획</p>
              <div className="mt-2 flex gap-2 items-center">
                <select
                  value={sharedPlanId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    void handleChangeSharedPlan(v ? v : null);
                  }}
                  disabled={isSavingSharedPlan}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="">공유 안 함</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-2">선택한 계획만 친구에게 표시됩니다.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((plan, index) => (
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

                      // 공유 계획이면 로컬 상태를 먼저 정리(드롭다운 값 불일치 방지)
                      if (sharedPlanId === plan.id) {
                        setSharedPlanId(null);
                        void friendService.setSharePlan(null).catch(() => {
                          // ignore
                        });
                      }

                      await deletePlanAsync(plan.id);
                    } catch (err) {
                      console.error('Failed to delete plan:', err);
                      alert('계획 삭제에 실패했습니다');
                    } finally {
                      setDeletingPlanId(null);
                    }
                  }}
                  canMoveUp={index > 0}
                  canMoveDown={index < plans.length - 1}
                  onMoveUp={() => handleMovePlanUp(index)}
                  onMoveDown={() => handleMovePlanDown(index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 프리셋 계획 */}
        <div>
          <h2 className="mb-4">추천 계획</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {presetPlans.map((plan: any) => {
              // 이미 추가된 계획인지 확인
              const isAlreadyAdded = plans.some(p => p.name === plan.title);
              
              return (
                <ReadingPlanCard
                  key={plan.id}
                  id={plan.id}
                  title={plan.title}
                  description={plan.description}
                  duration={plan.duration}
                  isSelected={false}
                  onSelect={() => {
                    if (isAlreadyAdded) {
                      alert(`"${plan.title}" 계획이 이미 추가되어 있습니다.`);
                      return;
                    }
                    handleSelectPlan(plan.id, true);
                  }}
                  disabled={isAlreadyAdded || isCreating}
                  busyLabel={addingPresetId === plan.id ? '추가중' : undefined}
                />
              );
            })}
          </div>
        </div>
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
