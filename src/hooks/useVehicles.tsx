import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { processVehicleColors } from '@/lib/colorMapping';
import { useSiteSettings } from '@/hooks/useSiteSettings';

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
  price: number;
  original_price?: number;
  condition?: 'new' | 'used' | 'certified';
  description?: string;
  ai_description?: string;
  features?: string[];
  images?: string[];
  ai_images_generated?: boolean;
  ai_image_generation_requested_at?: string;
  ai_image_generation_completed_at?: string;
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
  // NHTSA VIN decoded fields
  body_style_nhtsa?: string;
  drivetrain_nhtsa?: string;
  engine_nhtsa?: string;
  fuel_type_nhtsa?: string;
  transmission_nhtsa?: string;
  vehicle_type_nhtsa?: string;
  vin_decoded_at?: string;
  created_at: string;
  updated_at: string;
}

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { getSetting } = useSiteSettings();
  
  // Queue for managing sequential notifications
  const notificationQueueRef = useRef<Array<() => void>>([]);
  const isProcessingQueueRef = useRef(false);
  
  // Function to process the notification queue sequentially
  const processNotificationQueue = async () => {
    if (isProcessingQueueRef.current || notificationQueueRef.current.length === 0) {
      return;
    }
    
    isProcessingQueueRef.current = true;
    
    while (notificationQueueRef.current.length > 0) {
      const notification = notificationQueueRef.current.shift();
      if (notification) {
        notification();
        // Wait 2 seconds between notifications to prevent overlap
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    isProcessingQueueRef.current = false;
  };

  // Function to add notification to queue
  const queueNotification = (notification: () => void) => {
    notificationQueueRef.current.push(notification);
    processNotificationQueue();
  };
  // Set up real-time subscription for vehicles table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vehicles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time vehicle update:', payload);
          console.log('Update type:', payload.eventType);
          console.log('Vehicle data:', payload.new);
          
          if (payload.eventType === 'INSERT') {
            const newVehicle = payload.new as Vehicle;
            setVehicles(prev => {
              // Check if vehicle already exists to avoid duplicates
              const exists = prev.some(v => v.id === newVehicle.id);
              if (exists) return prev;
              return [newVehicle, ...prev];
            });
            
            // Queue the notification instead of showing immediately to prevent overlap
            queueNotification(() => {
              toast({
                title: "New Vehicle Added",
                description: `${newVehicle.year} ${newVehicle.make} ${newVehicle.model} has been imported`,
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedVehicle = payload.new as Vehicle;
            setVehicles(prev => prev.map(v => 
              v.id === updatedVehicle.id ? updatedVehicle : v
            ));
            
            // Show toast for image generation completion only if AI image generation is enabled
            if (updatedVehicle.ai_images_generated && updatedVehicle.images && updatedVehicle.images.length > 0) {
              // Check if the site setting allows AI image generation
              supabase
                .from('site_settings')
                .select('setting_value')
                .eq('setting_key', 'ai_image_generation_enabled')
                .maybeSingle()
                .then(({ data }) => {
                  const isEnabled = (data?.setting_value as any)?.enabled !== false;
                  if (isEnabled) {
                    toast({
                      title: "AI Images Generated",
                      description: `Generated ${updatedVehicle.images.length} images for ${updatedVehicle.year} ${updatedVehicle.make} ${updatedVehicle.model}`,
                    });
                  }
                });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedVehicle = payload.old as Vehicle;
            setVehicles(prev => prev.filter(v => v.id !== deletedVehicle.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Remove undefined keys to avoid nulling existing DB values on update
  const pruneUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    const cleaned: Record<string, any> = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v !== undefined) cleaned[k] = v;
    });
    return cleaned as Partial<T>;
  };

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          body_style_nhtsa,
          drivetrain_nhtsa,
          engine_nhtsa,
          fuel_type_nhtsa,
          transmission_nhtsa,
          vehicle_type_nhtsa,
          vin_decoded_at
        `)
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

      const vehicles = (data as Vehicle[]) || [];
      console.log('Fetched vehicles with NHTSA data:', vehicles.length);
      
      // Log VIN decoded status for debugging
      const decodedCount = vehicles.filter(v => v.vin_decoded_at).length;
      console.log(`${decodedCount} vehicles have VIN decoded data`);
      
      setVehicles(vehicles);

      // Backfill UI fields (fuel_type, transmission) from NHTSA values if missing or outdated
      (async () => {
        try {
          const fixes = vehicles
            .map(v => {
              let mappedFuel: string | undefined;
              let mappedTrans: string | undefined;
              if (v.fuel_type_nhtsa) {
                const ft = v.fuel_type_nhtsa.toLowerCase();
                if (ft.includes('electric')) mappedFuel = 'Electric';
                else if (ft.includes('hybrid') && ft.includes('plug')) mappedFuel = 'Plug-in hybrid';
                else if (ft.includes('hybrid')) mappedFuel = 'Hybrid';
                else if (ft.includes('diesel')) mappedFuel = 'Diesel';
                else if (ft.includes('flex')) mappedFuel = 'Flex';
                else mappedFuel = 'Gasoline';
              }
              if (v.transmission_nhtsa) {
                const tr = v.transmission_nhtsa.toLowerCase();
                mappedTrans = tr.includes('manual') ? 'Manual transmission' : 'Automatic transmission';
              }
              const needsFuelFix = typeof mappedFuel !== 'undefined' && v.fuel_type !== mappedFuel;
              const needsTransFix = typeof mappedTrans !== 'undefined' && v.transmission !== mappedTrans;
              if (needsFuelFix || needsTransFix) {
                return { id: v.id, fuel_type: needsFuelFix ? mappedFuel : undefined, transmission: needsTransFix ? mappedTrans : undefined };
              }
              return null;
            })
            .filter(Boolean) as { id: string; fuel_type?: string; transmission?: string }[];

          if (fixes.length) {
            // Update local state immediately
            setVehicles(prev => prev.map(v => {
              const f = fixes.find(x => x.id === v.id);
              return f ? { ...v, ...(f.fuel_type ? { fuel_type: f.fuel_type } : {}), ...(f.transmission ? { transmission: f.transmission } : {}) } : v;
            }));

            // Persist to DB (non-blocking per-vehicle updates)
            await Promise.allSettled(
              fixes.map(f =>
                supabase
                  .from('vehicles')
                  .update(pruneUndefined({ fuel_type: f.fuel_type, transmission: f.transmission }))
                  .eq('id', f.id)
              )
            );
          }
        } catch (e) {
          console.error('Backfill of UI fields from NHTSA failed', e);
        }
      })();

      // Auto-decode VINs for vehicles that have VINs but no decoded data (non-blocking)
      const vehiclesToDecode = vehicles.filter(v => 
        v.vin && v.vin.length === 17 && !v.vin_decoded_at
      );

      if (vehiclesToDecode.length > 0) {
        console.log(`Found ${vehiclesToDecode.length} vehicles needing VIN decode...`);
        
        // Decode in batches to prevent overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < vehiclesToDecode.length; i += batchSize) {
          const batch = vehiclesToDecode.slice(i, i + batchSize);
          
          // Process batch concurrently but wait for completion before next batch
          await Promise.allSettled(
            batch.map(async (vehicle) => {
              try {
                const { data: vinData, error: vinError } = await supabase.functions.invoke('vin-decoder', {
                  body: { 
                    vin: vehicle.vin,
                    vehicleId: vehicle.id 
                  }
                });

                if (!vinError && vinData?.success) {
                  console.log(`VIN decoded for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
                  
                  // Update vehicle in state with the new VIN data
                  const decoded = vinData.vinData || {};
                  // Pre-compute UI-mapped fields so we can also persist them to DB
                  let mappedFuelType: string | undefined;
                  let mappedTransmission: string | undefined;
                  let mappedBodyStyle: string | undefined;
                  if (decoded.body_style_nhtsa) {
                    const bs = (decoded.body_style_nhtsa as string).toLowerCase();
                    if (bs.includes('convertible')) mappedBodyStyle = 'Convertible';
                    else if (bs.includes('coupe')) mappedBodyStyle = 'Coupe';
                    else if (bs.includes('hatchback')) mappedBodyStyle = 'Hatchback';
                    else if (bs.includes('sedan')) mappedBodyStyle = 'Sedan';
                    else if (bs.includes('suv') || bs.includes('sport utility')) mappedBodyStyle = 'SUV';
                    else if (bs.includes('pickup') || bs.includes('truck')) mappedBodyStyle = 'Truck';
                    else if (bs.includes('van') || bs.includes('minivan')) mappedBodyStyle = 'Van/Minivan';
                    else if (bs.includes('wagon')) mappedBodyStyle = 'Wagon';
                  }
                  if (decoded.fuel_type_nhtsa) {
                    const ft = (decoded.fuel_type_nhtsa as string).toLowerCase();
                    if (ft.includes('electric')) mappedFuelType = 'Electric';
                    else if (ft.includes('hybrid') && ft.includes('plug')) mappedFuelType = 'Plug-in hybrid';
                    else if (ft.includes('hybrid')) mappedFuelType = 'Hybrid';
                    else if (ft.includes('diesel')) mappedFuelType = 'Diesel';
                    else if (ft.includes('flex')) mappedFuelType = 'Flex';
                    else mappedFuelType = 'Gasoline';
                  }
                  if (decoded.transmission_nhtsa) {
                    const tr = (decoded.transmission_nhtsa as string).toLowerCase();
                    mappedTransmission = tr.includes('manual') ? 'Manual transmission' : 'Automatic transmission';
                  }

                  // Update local state immediately for responsiveness
                  setVehicles(prevVehicles => {
                    return prevVehicles.map(v => {
                      if (v.id === vehicle.id) {
                        const updatedVehicle = { ...v, ...decoded } as Vehicle;
                        if (mappedBodyStyle) updatedVehicle.body_style_nhtsa = mappedBodyStyle;
                        if (decoded.fuel_type_nhtsa) updatedVehicle.fuel_type_nhtsa = decoded.fuel_type_nhtsa as string;
                        if (typeof mappedFuelType !== 'undefined') updatedVehicle.fuel_type = mappedFuelType;
                        if (decoded.transmission_nhtsa) updatedVehicle.transmission_nhtsa = decoded.transmission_nhtsa as string;
                        if (typeof mappedTransmission !== 'undefined') updatedVehicle.transmission = mappedTransmission;
                        return updatedVehicle;
                      }
                      return v;
                    });
                  });

                  // Persist mapped UI fields so future refreshes keep them
                  try {
                    await supabase
                      .from('vehicles')
                      .update(pruneUndefined({
                        fuel_type: mappedFuelType,
                        transmission: mappedTransmission,
                      }))
                      .eq('id', vehicle.id);
                  } catch (e) {
                    console.error('Failed to persist VIN-mapped UI fields', e);
                  }
                } else {
                  console.error(`VIN decode failed for ${vehicle.vin}:`, vinError);
                }
              } catch (error) {
                console.error(`Error decoding VIN ${vehicle.vin}:`, error);
              }
            })
          );
          
          // Small delay between batches
          if (i + batchSize < vehiclesToDecode.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
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
      const processedData = processVehicleColors(vehicleData);

      // Default contact info from profile when missing
      const defaults = {
        contact_phone: (processedData as any).contact_phone ?? profile?.phone ?? '',
        contact_email: (processedData as any).contact_email ?? profile?.email ?? '',
        location: (processedData as any).location ?? profile?.location ?? '',
      };

      const { data, error } = await supabase
        .from('vehicles')
        .insert([{
          ...processedData,
          ...defaults,
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
      
      // Auto-decode VIN if present and not already decoded
      if (newVehicle.vin && newVehicle.vin.length === 17 && !newVehicle.vin_decoded_at) {
        try {
          const { data: vinData, error: vinError } = await supabase.functions.invoke('vin-decoder', {
            body: { 
              vin: newVehicle.vin,
              vehicleId: newVehicle.id 
            }
          });

          if (!vinError && vinData?.success) {
            console.log(`VIN decoded automatically for new vehicle: ${newVehicle.year} ${newVehicle.make} ${newVehicle.model}`);
            const decoded = vinData.vinData || {};
            const mapped: Partial<Vehicle> = { ...decoded };

            // Map body style to Facebook-friendly categories
            if (decoded.body_style_nhtsa) {
              const bs = (decoded.body_style_nhtsa as string).toLowerCase();
              if (bs.includes('convertible')) mapped.body_style_nhtsa = 'Convertible';
              else if (bs.includes('coupe')) mapped.body_style_nhtsa = 'Coupe';
              else if (bs.includes('hatchback')) mapped.body_style_nhtsa = 'Hatchback';
              else if (bs.includes('sedan')) mapped.body_style_nhtsa = 'Sedan';
              else if (bs.includes('suv') || bs.includes('sport utility')) mapped.body_style_nhtsa = 'SUV';
              else if (bs.includes('pickup') || bs.includes('truck')) mapped.body_style_nhtsa = 'Truck';
              else if (bs.includes('van') || bs.includes('minivan')) mapped.body_style_nhtsa = 'Van/Minivan';
              else if (bs.includes('wagon')) mapped.body_style_nhtsa = 'Wagon';
            }

            // Map fuel type to UI field
            if (decoded.fuel_type_nhtsa) {
              const ft = (decoded.fuel_type_nhtsa as string).toLowerCase();
              if (ft.includes('electric')) mapped.fuel_type = 'Electric';
              else if (ft.includes('hybrid') && ft.includes('plug')) mapped.fuel_type = 'Plug-in hybrid';
              else if (ft.includes('hybrid')) mapped.fuel_type = 'Hybrid';
              else if (ft.includes('diesel')) mapped.fuel_type = 'Diesel';
              else if (ft.includes('flex')) mapped.fuel_type = 'Flex';
              else mapped.fuel_type = 'Gasoline';
            }

            // Map transmission to UI field
            if (decoded.transmission_nhtsa) {
              const tr = (decoded.transmission_nhtsa as string).toLowerCase();
              mapped.transmission = tr.includes('manual') ? 'Manual transmission' : 'Automatic transmission';
            }

            setVehicles(prev => prev.map(v => 
              v.id === newVehicle.id 
                ? { ...v, ...mapped }
                : v
            ));

            // Persist mapped UI fields so they survive future refreshes
            try {
              await supabase
                .from('vehicles')
                .update(pruneUndefined({
                  fuel_type: mapped.fuel_type,
                  transmission: mapped.transmission,
                }))
                .eq('id', newVehicle.id);
            } catch (e) {
              console.error('Failed to persist VIN-mapped fields for new vehicle', e);
            }
          }
        } catch (error) {
          console.error(`Error auto-decoding VIN for new vehicle:`, error);
        }
      }

      // Auto-generate AI images if vehicle has fewer than 3 images
      const imageCount = newVehicle.images?.length || 0;
      if (imageCount < 3) {
        console.log(`Vehicle ${newVehicle.year} ${newVehicle.make} ${newVehicle.model} has only ${imageCount} images, triggering AI generation`);
        try {
          // Don't await this - let it run in background
          generateAIImages([newVehicle.id]);
        } catch (error) {
          console.error('Failed to trigger AI image generation for new vehicle:', error);
        }
      }
      
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
      const processedUpdates = (updates.exterior_color || updates.interior_color) 
        ? processVehicleColors(updates) 
        : updates;

      const { data, error } = await supabase
        .from('vehicles')
        .update(pruneUndefined(processedUpdates))
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

  const generateAIImages = async (vehicleIds: string[]) => {
    setLoading(true);
    
    // Check if AI image generation is enabled site-wide
    const { data: settings } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_image_generation_enabled')
      .maybeSingle();

    const isEnabled = (settings?.setting_value as any)?.enabled !== false; // Default to true
    
    if (!isEnabled) {
      toast({
        title: "Feature Disabled",
        description: "AI image generation is currently disabled site-wide",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    toast({
      title: "Generating AI Images",
      description: `Starting AI image generation for ${vehicleIds.length} vehicle${vehicleIds.length > 1 ? 's' : ''}...`,
    });

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const vehicleId of vehicleIds) {
        try {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (!vehicle) continue;

          console.log(`Generating AI images for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          const { data, error } = await supabase.functions.invoke('generate-vehicle-images', {
            body: { 
              vehicleId,
              vehicleData: vehicle,
              dealershipName: profile?.dealership_name || 'DEALER'
            }
          });

          if (!error && data?.success) {
            console.log(`Generated ${data.generatedImages} AI images for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
            successCount++;
          } else {
            console.error('AI image generation failed:', error?.message || data?.error || 'Unknown error');
            errorCount++;
          }
        } catch (error) {
          console.error('Error generating AI images:', error);
          errorCount++;
        }
      }

      toast({
        title: "AI Image Generation Complete",
        description: `Generated images for ${successCount} vehicle${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      await fetchVehicles(); // Refresh to get updated images
    } catch (error) {
      console.error('Bulk AI image generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI images. Please try again.",
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
    generateAIImages,
    refetch: fetchVehicles,
  };
};