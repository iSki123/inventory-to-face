import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface VehicleSource {
  id: string;
  user_id: string;
  dealership_name: string;
  website_url: string;
  octoparse_task_id?: string;
  last_scraped_at?: string;
  scraping_enabled: boolean;
  scraping_frequency: number;
  created_at: string;
  updated_at: string;
}

export const useVehicleSources = (onVehiclesChanged?: () => void) => {
  const [sources, setSources] = useState<VehicleSource[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicle_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vehicle sources:', error);
        toast({
          title: "Error",
          description: "Failed to fetch vehicle sources",
          variant: "destructive",
        });
        return;
      }

      setSources((data as VehicleSource[]) || []);
    } catch (error) {
      console.error('Error fetching vehicle sources:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vehicle sources",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSource = async (sourceData: Omit<VehicleSource, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('vehicle_sources')
        .insert([{
          ...sourceData,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding vehicle source:', error);
        toast({
          title: "Error",
          description: "Failed to add vehicle source",
          variant: "destructive",
        });
        return null;
      }

      const newSource = data as VehicleSource;
      setSources(prev => [newSource, ...prev]);
      toast({
        title: "Success",
        description: "Vehicle source added successfully",
      });
      return newSource;
    } catch (error) {
      console.error('Error adding vehicle source:', error);
      toast({
        title: "Error",
        description: "Failed to add vehicle source",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateSource = async (id: string, updates: Partial<VehicleSource>) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_sources')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating vehicle source:', error);
        toast({
          title: "Error",
          description: "Failed to update vehicle source",
          variant: "destructive",
        });
        return null;
      }

      const updatedSource = data as VehicleSource;
      setSources(prev => prev.map(s => s.id === id ? updatedSource : s));
      toast({
        title: "Success",
        description: "Vehicle source updated successfully",
      });
      return updatedSource;
    } catch (error) {
      console.error('Error updating vehicle source:', error);
      toast({
        title: "Error",
        description: "Failed to update vehicle source",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_sources')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting vehicle source:', error);
        toast({
          title: "Error",
          description: "Failed to delete vehicle source",
          variant: "destructive",
        });
        return false;
      }

      setSources(prev => prev.filter(s => s.id !== id));
      toast({
        title: "Success",
        description: "Vehicle source deleted successfully",
      });
      return true;
    } catch (error) {
      console.error('Error deleting vehicle source:', error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle source",
        variant: "destructive",
      });
      return false;
    }
  };

  const startScraping = async (sourceId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const response = await supabase.functions.invoke('octoparse-scraper', {
        body: {
          action: 'start_scraping',
          sourceId,
          userId: user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        
        // Process the scraped vehicles immediately
        await processScrapedData(sourceId);
        await fetchSources(); // Refresh sources
        return result;
      } else {
        throw new Error(result.error || 'Scraping failed');
      }
    } catch (error) {
      console.error('Error starting scraping:', error);
      toast({
        title: "Error",
        description: "Failed to start scraping",
        variant: "destructive",
      });
      return null;
    }
  };

  const processScrapedData = async (sourceId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const response = await supabase.functions.invoke('octoparse-scraper', {
        body: {
          action: 'process_scraped_data',
          sourceId,
          userId: user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        return result;
      } else {
        throw new Error(result.error || 'Data processing failed');
      }
    } catch (error) {
      console.error('Error processing scraped data:', error);
      toast({
        title: "Error",
        description: "Failed to process scraped data",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      fetchSources();
    }
  }, [user]);

  const importSpecificTask = async (taskId: string, aiDescriptionPrompt?: string) => {
    try {
      if (!user) throw new Error('User not authenticated');

      console.log('Starting import for task ID:', taskId);
      console.log('User ID:', user.id);

      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      console.log('Session found, making edge function call...');

      const requestBody = {
        action: 'import_task',
        taskId,
        userId: user.id,
        aiDescriptionPrompt
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await supabase.functions.invoke('octoparse-scraper', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('Edge function response:', response);

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Edge function call failed');
      }

      const result = response.data;
      console.log('Edge function result:', result);
      
      if (result?.success) {
        toast({
          title: "Import Successful",
          description: result.message,
        });
        
        // Trigger vehicles refresh callback if provided
        if (onVehiclesChanged) {
          onVehiclesChanged();
        }
        
        return result;
      } else {
        console.error('Import failed with result:', result);
        throw new Error(result?.error || 'Task import failed');
      }
    } catch (error) {
      console.error('Error importing task:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import task data",
        variant: "destructive",
      });
      return null;
    }
  };

  const listAvailableTasks = async () => {
    try {
      if (!user) throw new Error('User not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await supabase.functions.invoke('octoparse-scraper', {
        body: {
          action: 'list_tasks',
          userId: user.id
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch tasks');
      }

      return response.data?.tasks || [];
    } catch (error) {
      console.error('Error fetching available tasks:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch available tasks",
        variant: "destructive",
      });
      return [];
    }
  };

  return {
    sources,
    loading,
    addSource,
    updateSource,
    deleteSource,
    startScraping,
    processScrapedData,
    importSpecificTask,
    listAvailableTasks,
    refetch: fetchSources,
  };
};