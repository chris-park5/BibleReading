const DEVELOPER_PLANS_KEY = "bible-reading-dev-plans";

export function getDeveloperPresetPlans(): any[] {
  try {
    const stored = localStorage.getItem(DEVELOPER_PLANS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addDeveloperPresetPlan(plan: any): void {
  const plans = getDeveloperPresetPlans();
  plans.push(plan);
  localStorage.setItem(DEVELOPER_PLANS_KEY, JSON.stringify(plans));
}

export function removeDeveloperPresetPlan(planId: string): void {
  const plans = getDeveloperPresetPlans();
  const filtered = plans.filter((p) => p.id !== planId);
  localStorage.setItem(DEVELOPER_PLANS_KEY, JSON.stringify(filtered));
}
