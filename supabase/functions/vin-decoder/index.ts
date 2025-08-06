import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { vin, vehicleId } = await req.json();

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