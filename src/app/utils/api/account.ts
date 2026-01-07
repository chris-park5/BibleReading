import { fetchAPI } from "./_internal";

export async function deleteAccount(): Promise<{ success: boolean }> {
  return fetchAPI("/account", { method: "DELETE" });
}
