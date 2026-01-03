import { BookOpen, LogOut, Plus } from 'lucide-react';
import { usePlans } from '../../hooks/usePlans';
import { usePlanStore } from '../../stores/plan.store';
import { useAuthStore } from '../../stores/auth.store';
import { ReadingPlanCard } from '../components/ReadingPlanCard';
import { CustomPlanCreator } from '../components/CustomPlanCreator';
import * as api from '../utils/api';

// Import preset plans
import oneYearPlan from '../plans/one-year.json';
import ninetyDayPlan from '../plans/ninety-day.json';
import newTestamentPlan from '../plans/new-testament.json';
import psalmsProverbsPlan from '../plans/psalms-proverbs.json';
import oneYearNewTwoOldOnePlan from '../plans/one-year_newtwo_oldone.json';

const basePresetPlans = [
  oneYearPlan,
  ninetyDayPlan,
  newTestamentPlan,
  psalmsProverbsPlan,
  oneYearNewTwoOldOnePlan,
];

export function PlanSelectorPage({ embedded = false }: { embedded?: boolean }) {
  const { plans, createPlanAsync, deletePlanAsync, isDeleting } = usePlans();
  const { selectPlan, deselectPlan, showCustomPlanCreator, toggleCustomPlanCreator } = usePlanStore();
  const logout = useAuthStore((state) => state.logout);
  const selectedPlanId = usePlanStore((state) => state.selectedPlanId);

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === 'true';

  // 개발자 페이지에서 등록한 프리셋(로컬 저장)도 추천 목록에 포함
  const presetPlans = [...basePresetPlans, ...api.getDeveloperPresetPlans()];

  const handleSignOut = async () => {
    await api.signOut();
    logout();
  };

  const handleSelectPlan = async (planId: string, isPreset: boolean) => {
    if (isPreset) {
      // 프리셋 계획을 사용자 계획으로 저장
      const presetPlan = presetPlans.find((p) => p.id === planId);
      if (presetPlan) {
        try {
          const normalizeChapters = (value: string) => {
            const v = String(value ?? '').trim();
            if (!v) return v;
            if (v.includes('장') || v.includes('절')) return v;
            return `${v}장`;
          };

          const normalizedSchedule = (presetPlan.schedule || []).map((d: any) => ({
            day: d.day,
            readings: (d.readings || []).map((r: any) => ({
              book: r.book,
              chapters: normalizeChapters(r.chapters),
            })),
          }));

          const result = await createPlanAsync({
            name: presetPlan.title,
            startDate: new Date().toISOString().split('T')[0],
            totalDays: presetPlan.totalDays,
            schedule: normalizedSchedule,
            isCustom: false,
          });
          selectPlan(result.plan.id);
        } catch (err) {
          console.error('Failed to create plan from preset:', err);
          alert('계획 생성에 실패했습니다');
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
    } catch (err) {
      console.error('Failed to create custom plan:', err);
      alert('계획 생성에 실패했습니다');
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
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-white rounded-lg transition-colors"
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
              className="px-4 py-2 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors"
            >
              개발자 계획 등록
            </button>
          </div>
        )}

        <div className="mb-6 flex gap-4">
          <button
            onClick={() => toggleCustomPlanCreator(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            사용자 지정 계획 만들기
          </button>
        </div>

        {/* 내 계획 */}
        {plans.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4">내 계획</h2>
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
                  isSelected={selectedPlanId === plan.id}
                  onSelect={() => handleSelectPlan(plan.id, false)}
                  canDelete
                  onDelete={async () => {
                    if (isDeleting) return;
                    const ok = window.confirm('이 계획을 삭제할까요?');
                    if (!ok) return;

                    try {
                      await deletePlanAsync(plan.id);
                      if (selectedPlanId === plan.id) {
                        deselectPlan();
                      }
                    } catch (err) {
                      console.error('Failed to delete plan:', err);
                      alert('계획 삭제에 실패했습니다');
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 프리셋 계획 */}
        <div>
          <h2 className="mb-4">추천 계획</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {presetPlans.map((plan: any) => (
              <ReadingPlanCard
                key={plan.id}
                id={plan.id}
                title={plan.title}
                description={plan.description}
                duration={plan.duration}
                isSelected={false}
                onSelect={() => handleSelectPlan(plan.id, true)}
              />
            ))}
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
