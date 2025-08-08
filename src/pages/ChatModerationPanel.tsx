import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChatModerationActions } from "@/hooks/useChatModerationActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Pin, PinOff, Volume2, VolumeX, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function ChatModerationPanel() {
  const { profile } = useAuth();
  const {
    clearAllMessages,
    deleteMessage,
    pinMessage,
    unpinMessage,
    muteUser,
    unmuteUser,
    getChatAnalytics,
    isLoading
  } = useChatModerationActions();

  const [analytics, setAnalytics] = useState<any>(null);

  const canModerate = profile?.role === 'owner' || profile?.role === 'admin';

  if (!canModerate) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleClearAllMessages = async () => {
    try {
      await clearAllMessages();
      toast.success("All chat messages cleared successfully");
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error("Failed to clear messages");
    }
  };

  const handleGetAnalytics = async () => {
    try {
      const data = await getChatAnalytics();
      setAnalytics(data);
      toast.success("Analytics loaded");
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error("Failed to load analytics");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chat Moderation Panel</h1>
        <p className="text-muted-foreground">
          Manage community chat channels and moderate user interactions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Moderation Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Moderation Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Chat Messages
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Chat Messages</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all messages from all chat channels. 
                    This cannot be undone. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearAllMessages}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading ? "Clearing..." : "Clear All Messages"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled>
                  <Pin className="h-4 w-4 mr-1" />
                  Pin Message
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <VolumeX className="h-4 w-4 mr-1" />
                  Mute User
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select messages in the chat to use these actions
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Chat Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGetAnalytics} disabled={isLoading} className="w-full">
              <BarChart3 className="h-4 w-4 mr-2" />
              {isLoading ? "Loading..." : "Load Analytics"}
            </Button>

            {analytics && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.totalMessages || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Messages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analytics.activeUsers || 0}</div>
                    <div className="text-sm text-muted-foreground">Active Users</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Channel Activity</h4>
                  {analytics.channelStats?.map((channel: any) => (
                    <div key={channel.channel} className="flex justify-between items-center">
                      <span className="text-sm">{channel.channel}</span>
                      <Badge variant="secondary">{channel.messages} messages</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Moderation Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Moderation Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent moderation actions to display
              </p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}