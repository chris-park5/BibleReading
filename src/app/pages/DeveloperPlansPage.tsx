import { useMemo, useState } from "react";
import { BookPlus, FileUp, Trash2, X } from "lucide-react";
import * as api from "../utils/api";

type PresetPlan = {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  totalDays: number;
  schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
};

export function DeveloperPlansPage({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<PresetPlan[]>(() => api.getDeveloperPresetPlans());
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => new Set(plans.map((p) => p.id)), [plans]);

  const refresh = () => setPlans(api.getDeveloperPresetPlans());

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // 최소 스키마 검증
      if (!json?.id || !json?.title || !Array.isArray(json?.schedule)) {
        alert("올바른 계획 JSON이 아닙니다 (id, title, schedule 필요)");
        return;
      }

      if (ids.has(json.id)) {
        alert("이미 같은 id의 계획이 등록되어 있습니다");
        return;
      }

      const totalDays = Number(json.totalDays ?? json.schedule.length);
      api.addDeveloperPresetPlan({
        id: String(json.id),
        title: String(json.title),
        description: json.description ? String(json.description) : "",
        duration: json.duration ? String(json.duration) : `${totalDays}일`,
        totalDays,
        schedule: json.schedule,
      });
      refresh();
    } catch {
      alert("JSON 파일을 읽는데 실패했습니다");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleRemove = (id: string) => {
    if (!confirm("이 계획을 삭제할까요?")) return;
    api.removeDeveloperPresetPlan(id);
    refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl">
              <BookPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="mb-1">개발자 계획 등록</h1>
              <p className="text-gray-600">JSON 계획을 업로드하여 추천 계획으로 등록합니다</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
            닫기
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <label className="block text-gray-700 mb-2">계획 JSON 업로드</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".json"
              onChange={handleUpload}
              disabled={busy}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-gray-600">
              <FileUp className="w-5 h-5" />
              <span className="text-sm">id/title/schedule 필요</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="mb-4">등록된 개발자 계획</h2>
          {plans.length === 0 ? (
            <p className="text-gray-600">아직 등록된 계획이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {plans.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 border-2 border-gray-100 rounded-lg">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-sm text-gray-600">{p.totalDays}일 · id: {p.id}</div>
                  </div>
                  <button
                    onClick={() => handleRemove(p.id)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
