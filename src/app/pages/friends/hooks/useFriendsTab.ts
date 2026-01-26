import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";
import { parseTabFromHash } from "../../mainTabs/tabHash";

export function useFriendsTab(isActive: boolean) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  // Sync activeTab with hash sub-path
  useEffect(() => {
    if (isActive) {
      const { sub } = parseTabFromHash(window.location.hash);
      if (sub === "requests") {
        setActiveTab("requests");
      }
    }
  }, [isActive]);

  // 1. Fetch Friends & Requests
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends", userId],
    queryFn: friendService.getFriends,
    enabled: !!userId && isActive,
    refetchInterval: 30000,
  });

  // 2. Fetch Leaderboard (includes progress for all friends + self)
  const { data: leaderboardData, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["leaderboard", userId],
    queryFn: friendService.getLeaderboard,
    enabled: !!userId && isActive,
    refetchInterval: 30000,
  });

  const friends = friendsData?.friends || [];
  const incomingRequests = friendsData?.incomingRequests || [];
  const outgoingRequests = friendsData?.outgoingRequests || [];
  const leaderboard = leaderboardData?.leaderboard || [];

  return {
    userId,
    activeTab,
    setActiveTab,
    selectedFriendId,
    setSelectedFriendId,
    isAddFriendOpen,
    setIsAddFriendOpen,
    friends,
    incomingRequests,
    outgoingRequests,
    leaderboard,
    loadingFriends,
    loadingLeaderboard,
  };
}
