import { UserPlus, UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

import { useFriendsTab } from "./friends/hooks/useFriendsTab";
import { SharedPlanSettings } from "./friends/components/SharedPlanSettings";
import { AddFriendForm } from "./friends/components/AddFriendForm";
import { FriendProfileDialog } from "./friends/components/FriendProfileDialog";
import { LeaderboardView } from "./friends/components/LeaderboardView";
import { FriendsListView } from "./friends/components/FriendsListView";
import { RequestsView } from "./friends/components/RequestsView";

export function FriendsTabPage({ isActive = true }: { isActive?: boolean }) {
  const {
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
  } = useFriendsTab(isActive);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">친구</h1>
          </div>

          {/* Add Friend Button */}
          <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-colors shadow-sm text-sm">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">친구 추가</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>친구 추가</DialogTitle>
              </DialogHeader>
              <AddFriendForm onSuccess={() => setIsAddFriendOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-primary/10 rounded-lg">
            <UsersRound className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">친구들과 함께</h2>
            <p className="text-muted-foreground text-sm">함께 읽으며 격려하세요</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="leaderboard">랭킹</TabsTrigger>
            <TabsTrigger value="friends">친구 목록</TabsTrigger>
            <TabsTrigger value="requests">
              요청
              {(incomingRequests.length > 0) && (
                <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="mt-0">
            <LeaderboardView
              leaderboard={leaderboard}
              loading={loadingLeaderboard}
              currentUserId={userId}
              onSelectFriend={setSelectedFriendId}
            />
          </TabsContent>

          <TabsContent value="friends" className="mt-0 space-y-6">
            <SharedPlanSettings />
            <FriendsListView
              friends={friends}
              leaderboard={leaderboard}
              loading={loadingFriends || loadingLeaderboard}
              onSelectFriend={setSelectedFriendId}
            />
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <RequestsView
              incoming={incomingRequests}
              outgoing={outgoingRequests}
              loading={loadingFriends}
            />
          </TabsContent>
        </Tabs>

        {/* Friend Profile Dialog */}
        <FriendProfileDialog 
          friendId={selectedFriendId} 
          onClose={() => setSelectedFriendId(null)} 
        />
      </div>
    </div>
  );
}