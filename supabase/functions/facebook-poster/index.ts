
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

    const requestBody = await req.json();
    const { action } = requestBody;

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
        const { vehicleId, status, facebookPostId } = requestBody;
        return await updateVehicleStatus(supabaseClient, vehicleId, status, facebookPostId, user.id);
      case 'store_posting_url':
        const { vehicleId: urlVehicleId, postingUrl } = requestBody;
        return await storePostingUrl(supabaseClient, urlVehicleId, postingUrl, user.id);
      case 'deduct_credit':
        const { vehicle_id, credit_amount } = requestBody;
        return await deductCredit(supabaseClient, vehicle_id, credit_amount, user.id);
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
      exterior_color_standardized: vehicle.exterior_color_standardized,
      interior_color_standardized: vehicle.interior_color_standardized,
      condition: vehicle.condition,
      description: vehicle.description,
      ai_description: vehicle.ai_description,
      images: vehicle.images || [],
      features: vehicle.features || [],
      vin: vehicle.vin,
      location: vehicle.location,
      contact_phone: vehicle.contact_phone,
      contact_email: vehicle.contact_email,
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission,
      // Include NHTSA-decoded fields for richer mapping
      fuel_type_nhtsa: vehicle.fuel_type_nhtsa,
      transmission_nhtsa: vehicle.transmission_nhtsa,
      vehicle_type_nhtsa: vehicle.vehicle_type_nhtsa,
      drivetrain_nhtsa: vehicle.drivetrain_nhtsa,
      body_style_nhtsa: vehicle.body_style_nhtsa
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

    // If posting is successful, deduct 1 credit using a transaction
    if (status === 'posted') {
      const { data, error } = await supabaseClient.rpc('deduct_credit_and_update_vehicle', {
        p_vehicle_id: vehicleId,
        p_user_id: userId,
        p_facebook_post_id: facebookPostId,
        p_update_data: updateData
      });

      if (error) {
        console.error('Error deducting credit and updating vehicle:', error);
        if (error.message?.includes('insufficient credits')) {
          throw new Error('Insufficient credits to post vehicle');
        }
        throw new Error('Failed to process vehicle posting');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          vehicle: data.vehicle,
          credits: data.credits,
          message: `Vehicle posted successfully. ${data.credits} credits remaining.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // For non-posted status updates, just update the vehicle normally
      const { data, error } = await supabaseClient
        .from('vehicles')
        .update(updateData)
        .eq('id', vehicleId)
        .eq('user_id', userId)
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
    }
    
  } catch (error) {
    console.error('Error in updateVehicleStatus:', error);
    throw error;
  }
}

async function deductCredit(supabaseClient: any, vehicleId: string, creditAmount: number, userId: string) {
  try {
    console.log(`Deducting ${creditAmount} credit(s) for vehicle ${vehicleId} for user ${userId}`);
    
    // Get current user credits and check if sufficient
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    if (!profile || profile.credits < creditAmount) {
      throw new Error(`Insufficient credits. Available: ${profile?.credits || 0}, Required: ${creditAmount}`);
    }

    // Deduct credits
    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        credits: profile.credits - creditAmount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('credits')
      .single();

    if (updateError) {
      console.error('Error updating user credits:', updateError);
      throw new Error('Failed to deduct credits');
    }

    console.log(`Credit deduction successful. New balance: ${updatedProfile.credits}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        remaining_credits: updatedProfile.credits,
        deducted_amount: creditAmount,
        message: `Successfully deducted ${creditAmount} credit(s). ${updatedProfile.credits} credits remaining.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error in deductCredit:', error);
    throw error;
  }
}

async function storePostingUrl(supabaseClient: any, vehicleId: string, postingUrl: string, userId: string) {
  try {
    console.log(`Storing posting URL for vehicle ${vehicleId}: ${postingUrl}`);
    
    // Update the vehicle with the posting URL
    const { data, error } = await supabaseClient
      .from('vehicles')
      .update({ 
        facebook_posting_url: postingUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error storing posting URL:', error);
      throw new Error('Failed to store posting URL');
    }

    console.log(`Posting URL stored successfully for vehicle ${vehicleId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        vehicle: data,
        message: `Posting URL stored successfully`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error in storePostingUrl:', error);
    throw error;
  }
