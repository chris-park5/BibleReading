export type TabKey = "home" | "progress" | "add" | "friends" | "settings";

export function parseTabFromHash(hash: string): TabKey | null {
  // expected: #/home, #/progress, #/add, #/friends, #/settings
  const trimmed = (hash || "").trim();
  if (!trimmed.startsWith("#/")) return null;
  const key = trimmed.slice(2);
  if (key === "home" || key === "progress" || key === "add" || key === "friends" || key === "settings") {
    return key;
  }
  return null;
}

export function setHashTab(tab: TabKey) {
  window.location.hash = `#/${tab}`;
}
