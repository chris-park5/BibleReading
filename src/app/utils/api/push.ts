import { fetchAPI } from "./_internal";

// ============================================================================
// Web Push APIs
// ============================================================================

export async function getVapidPublicKey(): Promise<{ publicKey: string }> {
  const result = await fetchAPI(
    "/push/public-key",
    {
      method: "GET",
    },
    false
  );

  if (!result?.publicKey || typeof result.publicKey !== "string") {
    throw new Error("VAPID public key를 가져오지 못했습니다");
  }

  return { publicKey: result.publicKey };
}

export async function savePushSubscription(input: {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}) {
  return fetchAPI("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendTestPush() {
  return fetchAPI("/push/test", { method: "POST" });
}
