import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  created_at: string;
  updated_at: string;
}

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*');

      if (error) throw error;

      // Convert array to key-value object
      const settingsMap = data.reduce((acc, setting) => {
        acc[setting.setting_key] = setting.setting_value;
        return acc;
      }, {} as Record<string, any>);

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching site settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch site settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));

      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    }
  };

  const getSetting = (key: string, defaultValue: any = null) => {
    return settings[key] || defaultValue;
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    updateSetting,
    getSetting,
    refetch: fetchSettings
  };
};