import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  message_content: string;
  message_type: string;
  parent_message_id?: string;
  vehicle_id?: string;
  attachments?: any;
  reactions?: any;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    role?: string;
  };
}

export const useChatMessages = (channelId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  // Fetch messages
  const query = useQuery({
    queryKey: ["chat-messages", channelId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!channelId) return [];

      // First get the messages
      const { data: messages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", channelId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(100);

      if (messagesError) {
        console.error("Error fetching chat messages:", messagesError);
        throw messagesError;
      }

      if (!messages || messages.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(messages.map(m => m.user_id))];

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Continue without profiles rather than failing
      }

      // Combine messages with profile data
      const messagesWithProfiles = messages.map(message => ({
        ...message,
        profiles: profiles?.find(p => p.user_id === message.user_id) || null
      }));

      return messagesWithProfiles;
    },
    enabled: !!channelId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`chat-messages-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          // Invalidate and refetch messages to get the full data with joins
          queryClient.invalidateQueries({ queryKey: ["chat-messages", channelId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          queryClient.invalidateQueries({ queryKey: ["chat-messages", channelId] });
        }
      )
      .subscribe((status) => {
        console.log('Chat subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [channelId, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      messageType,
      vehicleId,
    }: {
      content: string;
      messageType: string;
      vehicleId?: string;
    }) => {
      if (!user || !channelId) {
        throw new Error("User must be logged in and channel must be selected");
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert([
          {
            channel_id: channelId,
            user_id: user.id,
            message_content: content,
            message_type: messageType,
            vehicle_id: vehicleId,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        throw error;
      }

      return data;
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    },
  });

  // Update user status
  useEffect(() => {
    if (!user) return;

    const updateUserStatus = async () => {
      await supabase
        .from("chat_user_status")
        .upsert(
          {
            user_id: user.id,
            is_online: true,
            last_seen: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );
    };

    updateUserStatus();

    // Update status every 30 seconds
    const interval = setInterval(updateUserStatus, 30000);

    // Mark as offline when leaving
    const handleBeforeUnload = async () => {
      await supabase
        .from("chat_user_status")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [user]);

  const sendMessage = async (content: string, messageType: string = 'text', vehicleId?: string) => {
    return sendMessageMutation.mutateAsync({ content, messageType, vehicleId });
  };

  return {
    ...query,
    sendMessage,
    isConnected,
    isSending: sendMessageMutation.isPending,
  };
};