import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { processVehicleColors } from '@/lib/colorMapping';
import { decodeVin } from '@/lib/vinDecoding';

export interface Vehicle {
  id: string;
  user_id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  mileage?: number;
  exterior_color?: string;
  interior_color?: string;
  exterior_color_standardized?: string;
  interior_color_standardized?: string;
  fuel_type?: string;
  transmission?: string;
  engine?: string;
  drivetrain?: string;
  body_style_nhtsa?: string;
  fuel_type_nhtsa?: string;
  transmission_nhtsa?: string;
  engine_nhtsa?: string;
  vehicle_type_nhtsa?: string;
  drivetrain_nhtsa?: string;
  vin_decoded_at?: string;
  price: number;
  original_price?: number;
  condition?: 'new' | 'used' | 'certified';
  description?: string;
  ai_description?: string;
  features?: string[];
  images?: string[];
  facebook_post_id?: string;
  facebook_post_status?: 'draft' | 'posted' | 'sold' | 'expired' | 'error';
  last_posted_at?: string;
  location?: string;
  contact_phone?: string;
  contact_email?: string;
  status?: 'available' | 'pending' | 'sold' | 'draft';
  is_featured?: boolean;
  view_count?: number;
  lead_count?: number;
  created_at: string;
  updated_at: string;
}

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vehicles:', error);
        toast({
          title: "Error",
          description: "Failed to fetch vehicles",
          variant: "destructive",
        });
        return;
      }

      setVehicles((data as Vehicle[]) || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vehicles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) throw new Error('User not authenticated');

      // Process colors before saving
      let processedData = processVehicleColors(vehicleData);

      // Decode VIN if provided
      if (processedData.vin) {
        try {
          const vinData = await decodeVin(processedData.vin);
          if (vinData.success) {
            processedData = {
              ...processedData,
              body_style_nhtsa: vinData.body_style_nhtsa,
              fuel_type_nhtsa: vinData.fuel_type_nhtsa,
              transmission_nhtsa: vinData.transmission_nhtsa,
              engine_nhtsa: vinData.engine_nhtsa,
              vehicle_type_nhtsa: vinData.vehicle_type_nhtsa,
              drivetrain_nhtsa: vinData.drivetrain_nhtsa,
              vin_decoded_at: vinData.vin_decoded_at
            };
            toast({
              title: "Success",
              description: "VIN decoded successfully",
            });
          }
        } catch (vinError) {
          console.warn('VIN decoding failed:', vinError);
          // Continue without VIN data
        }
      }

      const { data, error } = await supabase
        .from('vehicles')
        .insert([{
          ...processedData,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding vehicle:', error);
        toast({
          title: "Error",
          description: "Failed to add vehicle",
          variant: "destructive",
        });
        return null;
      }

      const newVehicle = data as Vehicle;
      setVehicles(prev => [newVehicle, ...prev]);
      toast({
        title: "Success",
        description: "Vehicle added successfully",
      });
      return newVehicle;
    } catch (error) {
      console.error('Error adding vehicle:', error);
      toast({
        title: "Error",
        description: "Failed to add vehicle",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    try {
      // Process colors if they're being updated
      let processedUpdates = (updates.exterior_color || updates.interior_color) 
        ? processVehicleColors(updates) 
        : updates;

      // Decode VIN if it's being updated and different from existing
      if (updates.vin) {
        const existingVehicle = vehicles.find(v => v.id === id);
        if (!existingVehicle?.vin_decoded_at || existingVehicle.vin !== updates.vin) {
          try {
            const vinData = await decodeVin(updates.vin);
            if (vinData.success) {
              processedUpdates = {
                ...processedUpdates,
                body_style_nhtsa: vinData.body_style_nhtsa,
                fuel_type_nhtsa: vinData.fuel_type_nhtsa,
                transmission_nhtsa: vinData.transmission_nhtsa,
                engine_nhtsa: vinData.engine_nhtsa,
                vehicle_type_nhtsa: vinData.vehicle_type_nhtsa,
                drivetrain_nhtsa: vinData.drivetrain_nhtsa,
                vin_decoded_at: vinData.vin_decoded_at
              };
              toast({
                title: "Success",
                description: "VIN decoded successfully",
              });
            }
          } catch (vinError) {
            console.warn('VIN decoding failed:', vinError);
            // Continue without VIN data
          }
        }
      }

      const { data, error } = await supabase
        .from('vehicles')
        .update(processedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating vehicle:', error);
        toast({
          title: "Error",
          description: "Failed to update vehicle",
          variant: "destructive",
        });
        return null;
      }

      const updatedVehicle = data as Vehicle;
      setVehicles(prev => prev.map(v => v.id === id ? updatedVehicle : v));
      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });
      return updatedVehicle;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        title: "Error",
        description: "Failed to update vehicle",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting vehicle:', error);
        toast({
          title: "Error",
          description: "Failed to delete vehicle",
          variant: "destructive",
        });
        return false;
      }

      setVehicles(prev => prev.filter(v => v.id !== id));
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
      return true;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle",
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkDeleteVehicles = async (vehicleIds: string[]) => {
    try {
      if (vehicleIds.length === 0) return false;

      const { error } = await supabase
        .from('vehicles')
        .delete()
        .in('id', vehicleIds);

      if (error) {
        console.error('Error bulk deleting vehicles:', error);
        toast({
          title: "Error",
          description: "Failed to delete selected vehicles",
          variant: "destructive",
        });
        return false;
      }

      setVehicles(prev => prev.filter(v => !vehicleIds.includes(v.id)));
      toast({
        title: "Success",
        description: `Successfully deleted ${vehicleIds.length} vehicle${vehicleIds.length > 1 ? 's' : ''}`,
      });
      return true;
    } catch (error) {
      console.error('Error bulk deleting vehicles:', error);
      toast({
        title: "Error",
        description: "Failed to delete selected vehicles",
        variant: "destructive",
      });
      return false;
    }
  };

  const postToFacebook = async (vehicleId: string) => {
    try {
      // This would integrate with Facebook Marketplace API
      // For now, we'll simulate the posting process
      await updateVehicle(vehicleId, {
        facebook_post_status: 'posted',
        last_posted_at: new Date().toISOString(),
      });
      
      toast({
        title: "Success",
        description: "Vehicle posted to Facebook Marketplace",
      });
      return true;
    } catch (error) {
      console.error('Error posting to Facebook:', error);
      await updateVehicle(vehicleId, {
        facebook_post_status: 'error',
      });
      toast({
        title: "Error",
        description: "Failed to post to Facebook Marketplace",
        variant: "destructive",
      });
      return false;
    }
  };

  const generateAIDescriptions = async (vehicleIds: string[]) => {
    setLoading(true);
    toast({
      title: "Generating AI Descriptions",
      description: `Starting AI description generation for ${vehicleIds.length} vehicle${vehicleIds.length > 1 ? 's' : ''}...`,
    });

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const vehicleId of vehicleIds) {
        try {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (!vehicle) continue;

          console.log(`Generating AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          const { data, error } = await supabase.functions.invoke('generate-vehicle-description', {
            body: { vehicle }
          });

          if (!error && data?.success) {
            await updateVehicle(vehicleId, { ai_description: data.description });
            successCount++;
            console.log(`Generated AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          } else {
            console.error('AI description generation failed:', error?.message || 'Unknown error');
            errorCount++;
          }
        } catch (error) {
          console.error('Error generating AI description:', error);
          errorCount++;
        }
      }

      toast({
        title: "AI Description Generation Complete",
        description: `Generated descriptions for ${successCount} vehicle${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      await fetchVehicles(); // Refresh to get updated descriptions
    } catch (error) {
      console.error('Bulk AI description generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI descriptions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  return {
    vehicles,
    loading,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    bulkDeleteVehicles,
    postToFacebook,
    generateAIDescriptions,
    refetch: fetchVehicles,
  };
};