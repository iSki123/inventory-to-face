
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { action } = await req.json();

    if (!action) {
      throw new Error('action is required');
    }

    // Get user's auth header for verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    switch (action) {
      case 'get_pending_vehicles':
        return await getPendingVehicles(supabaseClient, user.id);
      case 'update_vehicle_status':
        const { vehicleId, status, facebookPostId } = await req.json();
        return await updateVehicleStatus(supabaseClient, vehicleId, status, facebookPostId, user.id);
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Facebook poster error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});

async function getPendingVehicles(supabaseClient: any, userId: string) {
  try {
    // Get vehicles that are ready to post (status = 'available' and facebook_post_status = 'draft')
    const { data: vehicles, error } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'available')
      .in('facebook_post_status', ['draft', 'error'])
      .order('created_at', { ascending: true });
      // Removed the .limit(10) to fetch ALL vehicles

    if (error) {
      console.error('Error fetching vehicles:', error);
      throw new Error('Failed to fetch vehicles');
    }

    // Transform the data for the extension
    const transformedVehicles = (vehicles || []).map(vehicle => ({
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      price: vehicle.price,
      mileage: vehicle.mileage,
      exterior_color: vehicle.exterior_color,
      interior_color: vehicle.interior_color,
      condition: vehicle.condition,
      description: vehicle.description,
      images: vehicle.images || [],
      features: vehicle.features || [],
      vin: vehicle.vin,
      location: vehicle.location,
      contact_phone: vehicle.contact_phone,
      contact_email: vehicle.contact_email,
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission
    }));

    console.log(`Found ${transformedVehicles.length} vehicles ready to post for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        vehicles: transformedVehicles,
        count: transformedVehicles.length,
        message: `Found ${transformedVehicles.length} vehicles ready to post`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error in getPendingVehicles:', error);
    throw error;
  }
}

async function updateVehicleStatus(supabaseClient: any, vehicleId: string, status: string, facebookPostId: string | null, userId: string) {
  try {
    const updateData: any = {
      facebook_post_status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'posted' && facebookPostId) {
      updateData.facebook_post_id = facebookPostId;
      updateData.last_posted_at = new Date().toISOString();
    }

    const { data, error } = await supabaseClient
      .from('vehicles')
      .update(updateData)
      .eq('id', vehicleId)
      .eq('user_id', userId) // Ensure user owns this vehicle
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle status:', error);
      throw new Error('Failed to update vehicle status');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        vehicle: data,
        message: `Vehicle status updated to ${status}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error in updateVehicleStatus:', error);
    throw error;
  }
}
