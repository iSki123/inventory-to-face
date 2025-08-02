import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Lead {
  id: string;
  user_id: string;
  vehicle_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  source: 'facebook_marketplace' | 'website' | 'phone' | 'walk_in' | 'referral' | 'other';
  initial_message: string;
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'follow_up' | 'qualified' | 'sold' | 'lost';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  lead_score: number;
  is_qualified: boolean;
  expected_close_date?: string;
  estimated_value?: number;
  last_contact_at?: string;
  next_follow_up_at?: string;
  response_count: number;
  facebook_thread_id?: string;
  facebook_post_id?: string;
  notes?: string;
  tags?: string[];
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  vehicle?: {
    year: number;
    make: string;
    model: string;
    price: number;
  } | null;
  assigned_user?: {
    first_name: string;
    last_name: string;
  } | null;
}

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          vehicle:vehicles(year, make, model, price),
          assigned_user:profiles!leads_assigned_to_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        toast({
          title: "Error",
          description: "Failed to fetch leads",
          variant: "destructive",
        });
        return;
      }

      setLeads((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'response_count' | 'lead_score' | 'is_qualified'>) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          user_id: user.id,
        }])
        .select(`
          *,
          vehicle:vehicles(year, make, model, price),
          assigned_user:profiles!leads_assigned_to_fkey(first_name, last_name)
        `)
        .single();

      if (error) {
        console.error('Error adding lead:', error);
        toast({
          title: "Error",
          description: "Failed to add lead",
          variant: "destructive",
        });
        return null;
      }

      const newLead = data as any;
      setLeads(prev => [newLead, ...prev]);
      toast({
        title: "Success",
        description: "Lead added successfully",
      });
      return newLead;
    } catch (error) {
      console.error('Error adding lead:', error);
      toast({
        title: "Error",
        description: "Failed to add lead",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          vehicle:vehicles(year, make, model, price),
          assigned_user:profiles!leads_assigned_to_fkey(first_name, last_name)
        `)
        .single();

      if (error) {
        console.error('Error updating lead:', error);
        toast({
          title: "Error",
          description: "Failed to update lead",
          variant: "destructive",
        });
        return null;
      }

      const updatedLead = data as any;
      setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
      return updatedLead;
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting lead:', error);
        toast({
          title: "Error",
          description: "Failed to delete lead",
          variant: "destructive",
        });
        return false;
      }

      setLeads(prev => prev.filter(l => l.id !== id));
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
      return false;
    }
  };

  // Set up real-time subscription for leads
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('leads_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'leads',
        }, 
        (payload) => {
          console.log('Lead change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            fetchLeads(); // Refetch to get joined data
          } else if (payload.eventType === 'UPDATE') {
            fetchLeads(); // Refetch to get joined data
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  return {
    leads,
    loading,
    addLead,
    updateLead,
    deleteLead,
    refetch: fetchLeads,
  };
};