/**
 * API Client (barrel)
 *
 * 외부에서 import하는 public API(export) 시그니처를 유지하면서
 * 내부 구현은 src/app/utils/api/* 로 분리합니다.
 */

export { supabase, setAccessToken, getAccessToken } from "./api/_internal";

export { getDeveloperPresetPlans, addDeveloperPresetPlan, removeDeveloperPresetPlan } from "./api/developerPlans";

export {
  signUp,
  getUsernameEmail,
  signIn,
  signInWithGoogle,
  signOut,
  getSession,
  getMyProfile,
  updateUsername,
  updatePassword,
  checkStreak,
} from "./api/auth";

export { createPlan, getPlans, seedPresetSchedules, deletePlan, updatePlanOrder } from "./api/plans";

export { updateReadingProgress, updateProgress, getProgress } from "./api/progress";

export {
  addFriend,
  getFriends,
  getFriendProgress,
  deleteFriend,
  getSharePlan,
  setSharePlan,
  respondFriendRequest,
  cancelFriendRequest,
  getFriendStatus,
  getLeaderboard,
} from "./api/friends";

export { saveNotification, getNotifications } from "./api/notifications";

export { getVapidPublicKey, savePushSubscription, sendTestPush } from "./api/push";

export { deleteAccount } from "./api/account";
