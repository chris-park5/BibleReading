export type TabKey = "home" | "progress" | "add" | "friends" | "settings";

export function parseTabFromHash(hash: string): { tab: TabKey | null; sub: string | null } {
  // expected: #/home, #/progress, #/add, #/friends, #/friends/requests, #/settings
  const trimmed = (hash || "").trim();
  if (!trimmed.startsWith("#/")) return { tab: null, sub: null };
  const parts = trimmed.slice(2).split("/");
  const key = parts[0] as TabKey;
  const sub = parts[1] || null;

  if (key === "home" || key === "progress" || key === "add" || key === "friends" || key === "settings") {
    return { tab: key, sub };
  }
  return { tab: null, sub: null };
}

export function setHashTab(tab: TabKey, sub?: string) {
  window.location.hash = sub ? `#/${tab}/${sub}` : `#/${tab}`;
}
