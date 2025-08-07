import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to decode a single VIN and update the vehicle
async function decodeVin(vin: string, vehicleId: string, supabaseClient: any): Promise<boolean> {
  try {
    console.log(`Decoding VIN: ${vin}`);
    
    // Call NHTSA VIN decoding API
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
    
    if (!response.ok) {
      console.error(`NHTSA API error for VIN ${vin}: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const results = data.Results || [];

    // Extract relevant fields from NHTSA response
    const getVariableValue = (variableName: string) => {
      const result = results.find((r: any) => r.Variable === variableName);
      return result?.Value || null;
    };

    const vinData = {
      body_style_nhtsa: getVariableValue('Body Class'),
      drivetrain_nhtsa: getVariableValue('Drive Type'),
      engine_nhtsa: getVariableValue('Engine Model') || getVariableValue('Engine Configuration'),
      fuel_type_nhtsa: getVariableValue('Fuel Type - Primary'),
      transmission_nhtsa: getVariableValue('Transmission Style'),
      vehicle_type_nhtsa: getVariableValue('Vehicle Type'),
      vin_decoded_at: new Date().toISOString()
    };

    console.log('Extracted VIN data:', vinData);

    // Update vehicle with decoded VIN data
    const { error: updateError } = await supabaseClient
      .from('vehicles')
      .update(vinData)
      .eq('id', vehicleId);

    if (updateError) {
      console.error('Error updating vehicle with VIN data:', updateError);
      return false;
    }

    console.log(`Successfully updated vehicle ${vehicleId} with VIN data`);
    return true;
    
  } catch (error) {
    console.error(`Error decoding VIN ${vin}:`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    const { vin, vehicleId, action, batch_size } = requestBody;

    // Handle batch decode action for cron job
    if (action === 'batch_decode') {
      console.log('Starting batch VIN decode process...');
      
      // Get vehicles with VINs that haven't been decoded yet
      const { data: vehicles, error: fetchError } = await supabaseClient
        .from('vehicles')
        .select('id, vin')
        .not('vin', 'is', null)
        .is('vin_decoded_at', null)
        .limit(batch_size || 10);

      if (fetchError) {
        console.error('Error fetching vehicles for batch decode:', fetchError);
        throw new Error('Failed to fetch vehicles for batch decode');
      }

      if (!vehicles || vehicles.length === 0) {
        console.log('No vehicles found for VIN decoding');
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'No vehicles found for VIN decoding',
            decoded_count: 0
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Found ${vehicles.length} vehicles to decode VINs for`);
      let decoded_count = 0;

      // Process each vehicle with intelligent timing
      for (const vehicle of vehicles) {
        if (vehicle.vin && vehicle.vin.length === 17) {
          try {
            const success = await decodeVin(vehicle.vin, vehicle.id, supabaseClient);
            if (success) decoded_count++;
            
            // Smart delay based on time of day (EST)
            const now = new Date();
            const estHour = (now.getUTCHours() - 5 + 24) % 24; // Convert to EST
            const isBusinessHours = estHour >= 6 && estHour <= 18;
            const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
            
            // Longer delays during business hours to be more respectful
            const delayMs = (isBusinessHours && isWeekday) ? 2000 : 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
          } catch (error) {
            console.error(`Failed to decode VIN for vehicle ${vehicle.id}:`, error);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Batch decode completed. ${decoded_count}/${vehicles.length} vehicles processed`,
          decoded_count
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle single VIN decode (original functionality)

    if (!vin || vin.length !== 17) {
      throw new Error('Valid 17-character VIN is required');
    }

    // Get user's auth header for verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }

    // Call NHTSA VIN decoding API
    console.log(`Decoding VIN: ${vin}`);
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
    
    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.Results || [];

    // Extract relevant fields from NHTSA response
    const getVariableValue = (variableName: string) => {
      const result = results.find((r: any) => r.Variable === variableName);
      return result?.Value || null;
    };

    const vinData = {
      body_style_nhtsa: getVariableValue('Body Class'),
      drivetrain_nhtsa: getVariableValue('Drive Type'),
      engine_nhtsa: getVariableValue('Engine Model') || getVariableValue('Engine Configuration'),
      fuel_type_nhtsa: getVariableValue('Fuel Type - Primary'),
      transmission_nhtsa: getVariableValue('Transmission Style'),
      vehicle_type_nhtsa: getVariableValue('Vehicle Type'),
      vin_decoded_at: new Date().toISOString()
    };

    console.log('Extracted VIN data:', vinData);

    // Update vehicle with decoded VIN data if vehicleId is provided
    if (vehicleId) {
      const { error: updateError } = await supabaseClient
        .from('vehicles')
        .update(vinData)
        .eq('id', vehicleId);

      if (updateError) {
        console.error('Error updating vehicle with VIN data:', updateError);
        throw new Error('Failed to update vehicle with VIN data');
      }

      console.log(`Successfully updated vehicle ${vehicleId} with VIN data`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        vinData,
        message: vehicleId ? 'Vehicle updated with VIN data' : 'VIN decoded successfully'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('VIN decoder error:', error);
    
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