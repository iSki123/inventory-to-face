import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useChatModerationActions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const clearAllMessages = async () => {
    if (!user) throw new Error("User must be logged in");

    setIsLoading(true);
    try {
      // Mark all messages as deleted instead of actually deleting them
      const { error } = await supabase
        .from("chat_messages")
        .update({ is_deleted: true })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all messages

      if (error) throw error;

      // Record moderation action
      await supabase
        .from("chat_moderation")
        .insert({
          moderator_id: user.id,
          action_type: "clear_all",
          reason: "Admin cleared all chat messages",
        });

      // Invalidate all chat message queries
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMessage = async (messageId: string, reason?: string) => {
    if (!user) throw new Error("User must be logged in");

    const { error } = await supabase
      .from("chat_messages")
      .update({ is_deleted: true })
      .eq("id", messageId);

    if (error) throw error;

    // Record moderation action
    await supabase
      .from("chat_moderation")
      .insert({
        message_id: messageId,
        moderator_id: user.id,
        action_type: "delete",
        reason: reason || "Message deleted by moderator",
      });

    queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
  };

  const pinMessage = async (messageId: string) => {
    if (!user) throw new Error("User must be logged in");

    const { error } = await supabase
      .from("chat_messages")
      .update({ is_pinned: true })
      .eq("id", messageId);

    if (error) throw error;

    await supabase
      .from("chat_moderation")
      .insert({
        message_id: messageId,
        moderator_id: user.id,
        action_type: "pin",
        reason: "Message pinned by moderator",
      });

    queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
  };

  const unpinMessage = async (messageId: string) => {
    if (!user) throw new Error("User must be logged in");

    const { error } = await supabase
      .from("chat_messages")
      .update({ is_pinned: false })
      .eq("id", messageId);

    if (error) throw error;

    await supabase
      .from("chat_moderation")
      .insert({
        message_id: messageId,
        moderator_id: user.id,
        action_type: "unpin",
        reason: "Message unpinned by moderator",
      });

    queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
  };

  const muteUser = async (userId: string, duration?: number) => {
    if (!user) throw new Error("User must be logged in");

    const muteUntil = duration 
      ? new Date(Date.now() + duration * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from("chat_user_status")
      .upsert({
        user_id: userId,
        is_muted: true,
        muted_until: muteUntil,
      }, {
        onConflict: "user_id",
      });

    if (error) throw error;

    await supabase
      .from("chat_moderation")
      .insert({
        moderator_id: user.id,
        action_type: "mute_user",
        reason: `User muted${duration ? ` for ${duration} minutes` : " indefinitely"}`,
      });
  };

  const unmuteUser = async (userId: string) => {
    if (!user) throw new Error("User must be logged in");

    const { error } = await supabase
      .from("chat_user_status")
      .update({
        is_muted: false,
        muted_until: null,
      })
      .eq("user_id", userId);

    if (error) throw error;

    await supabase
      .from("chat_moderation")
      .insert({
        moderator_id: user.id,
        action_type: "unmute_user",
        reason: "User unmuted by moderator",
      });
  };

  const getChatAnalytics = async () => {
    setIsLoading(true);
    try {
      // Get total message count
      const { count: totalMessages } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false);

      // Get active users count (users who sent messages in last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeUsersData } = await supabase
        .from("chat_messages")
        .select("user_id")
        .eq("is_deleted", false)
        .gte("created_at", oneDayAgo);

      const uniqueActiveUsers = new Set(activeUsersData?.map(m => m.user_id)).size;

      // Get channel statistics
      const { data: channelStats } = await supabase
        .from("chat_messages")
        .select("channel_id, chat_channels!inner(display_name)")
        .eq("is_deleted", false);

      const channelCounts = channelStats?.reduce((acc: any, msg: any) => {
        const channelName = msg.chat_channels?.display_name;
        if (channelName) {
          acc[channelName] = (acc[channelName] || 0) + 1;
        }
        return acc;
      }, {});

      const channelStatsArray = Object.entries(channelCounts || {}).map(([channel, messages]) => ({
        channel,
        messages,
      }));

      return {
        totalMessages: totalMessages || 0,
        activeUsers: uniqueActiveUsers,
        channelStats: channelStatsArray,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    clearAllMessages,
    deleteMessage,
    pinMessage,
    unpinMessage,
    muteUser,
    unmuteUser,
    getChatAnalytics,
    isLoading,
  };
};