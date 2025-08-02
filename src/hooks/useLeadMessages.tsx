import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface LeadMessage {
  id: string;
  lead_id: string;
  sender_type: 'customer' | 'agent' | 'ai';
  message_content: string;
  is_ai_generated: boolean;
  ai_model?: string;
  ai_prompt?: string;
  generation_cost: number;
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string;
  attachments?: string[];
  message_type: 'text' | 'image' | 'file' | 'voice';
  created_at: string;
}

export const useLeadMessages = (leadId?: string) => {
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMessages = async () => {
    if (!leadId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast({
          title: "Error",
          description: "Failed to fetch messages",
          variant: "destructive",
        });
        return;
      }

      setMessages((data as LeadMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addMessage = async (messageData: Omit<LeadMessage, 'id' | 'created_at' | 'is_read' | 'is_sent' | 'sent_at'>) => {
    try {
      const { data, error } = await supabase
        .from('lead_messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('Error adding message:', error);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return null;
      }

      const newMessage = data as LeadMessage;
      setMessages(prev => [...prev, newMessage]);
      return newMessage;
    } catch (error) {
      console.error('Error adding message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return null;
    }
  };

  const generateAIResponse = async (leadId: string, conversationHistory: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-lead-response', {
        body: {
          leadId,
          conversationHistory,
        }
      });

      if (error) {
        console.error('Error generating AI response:', error);
        toast({
          title: "Error",
          description: "Failed to generate AI response",
          variant: "destructive",
        });
        return null;
      }

      return data.response;
    } catch (error) {
      console.error('Error generating AI response:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI response",
        variant: "destructive",
      });
      return null;
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('lead_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) {
        console.error('Error marking message as read:', error);
        return false;
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  };

  // Set up real-time subscription for messages
  useEffect(() => {
    if (!leadId || !user) return;

    const subscription = supabase
      .channel(`messages_${leadId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'lead_messages',
          filter: `lead_id=eq.${leadId}`
        }, 
        (payload) => {
          console.log('Message change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as LeadMessage;
            setMessages(prev => [...prev, newMessage]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as LeadMessage;
            setMessages(prev => prev.map(m => 
              m.id === updatedMessage.id ? updatedMessage : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [leadId, user]);

  useEffect(() => {
    fetchMessages();
  }, [leadId]);

  return {
    messages,
    loading,
    addMessage,
    generateAIResponse,
    markAsRead,
    refetch: fetchMessages,
  };
};