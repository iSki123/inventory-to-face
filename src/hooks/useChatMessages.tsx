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
        .limit(50); // Reduced limit for better performance

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
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Real-time subscription
  useEffect(() => {
    if (!channelId) return;

    console.log(`Setting up real-time subscription for channel: ${channelId}`);

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
        async (payload) => {
          console.log('New message received via real-time:', payload);
          
          // Get the profile data for the new message
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('user_id', payload.new.user_id)
            .single();

          // Create the full message object with profile data
          const newMessage = {
            ...payload.new,
            profiles: profileData
          } as ChatMessage;

          // Update the query cache directly with the new message
          queryClient.setQueryData(
            ["chat-messages", channelId],
            (oldData: ChatMessage[] | undefined) => {
              if (!oldData) return [newMessage];
              
              // Check if message already exists (avoid duplicates) - including temp messages
              const messageExists = oldData.some(msg => 
                msg.id === newMessage.id || 
                (msg.id.startsWith('temp-') && msg.user_id === newMessage.user_id && msg.message_content === newMessage.message_content)
              );
              if (messageExists) {
                // Replace temp message with real message
                return oldData.map(msg => 
                  (msg.id.startsWith('temp-') && msg.user_id === newMessage.user_id && msg.message_content === newMessage.message_content)
                    ? newMessage 
                    : msg
                );
              }
              
              // Add the new message to the end of the list
              return [...oldData, newMessage];
            }
          );
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
        async (payload) => {
          console.log('Message updated via real-time:', payload);
          
          // Get the profile data for the updated message
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('user_id', payload.new.user_id)
            .single();

          // Create the full message object with profile data
          const updatedMessage = {
            ...payload.new,
            profiles: profileData
          } as ChatMessage;

          // Update the specific message in the query cache
          queryClient.setQueryData(
            ["chat-messages", channelId],
            (oldData: ChatMessage[] | undefined) => {
              if (!oldData) return [updatedMessage];
              
              return oldData.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              );
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('Message deleted via real-time:', payload);
          
          // Remove the deleted message from the query cache
          queryClient.setQueryData(
            ["chat-messages", channelId],
            (oldData: ChatMessage[] | undefined) => {
              if (!oldData) return [];
              return oldData.filter(msg => msg.id !== payload.old.id);
            }
          );
        }
      )
      .subscribe((status) => {
        console.log('Chat subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to real-time updates for channel ${channelId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Real-time subscription error for channel ${channelId}`);
          setIsConnected(false);
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏰ Real-time subscription timed out for channel ${channelId}`);
          setIsConnected(false);
        }
      });

    return () => {
      console.log(`Cleaning up real-time subscription for channel: ${channelId}`);
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
    onMutate: async ({ content, messageType, vehicleId }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["chat-messages", channelId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(["chat-messages", channelId]);

      // Get current user profile for optimistic update
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('user_id', user?.id)
        .single();

      // Optimistically update to the new value
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`, // Temporary ID
        channel_id: channelId,
        user_id: user?.id || '',
        message_content: content,
        message_type: messageType,
        parent_message_id: undefined,
        vehicle_id: vehicleId,
        attachments: undefined,
        reactions: {},
        is_pinned: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: currentUserProfile
      };

      queryClient.setQueryData<ChatMessage[]>(
        ["chat-messages", channelId],
        (old) => [...(old ?? []), optimisticMessage]
      );

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage };
    },
    onError: (error, variables, context) => {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(["chat-messages", channelId], context.previousMessages);
      }
    },
    onSuccess: (data, variables, context) => {
      // Don't remove the optimistic message here - let the real-time subscription handle it
      // This prevents the message from disappearing before the real-time update arrives
      console.log('Message sent successfully:', data);
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