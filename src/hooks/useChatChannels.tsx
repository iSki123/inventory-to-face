import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChatChannel {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useChatChannels = () => {
  return useQuery({
    queryKey: ["chat-channels"],
    queryFn: async (): Promise<ChatChannel[]> => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching chat channels:", error);
        throw error;
      }

      return data || [];
    },
  });
};