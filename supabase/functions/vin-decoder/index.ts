import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NHTSAVinResponse {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  BodyClass?: string;
  FuelTypePrimary?: string;
  TransmissionStyle?: string;
  EngineHP?: string;
  EngineCylinders?: string;
  DisplacementL?: string;
  VehicleType?: string;
  DriveType?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

interface VinDecodingResult {
  body_style_nhtsa?: string;
  fuel_type_nhtsa?: string;
  transmission_nhtsa?: string;
  engine_nhtsa?: string;
  vehicle_type_nhtsa?: string;
  drivetrain_nhtsa?: string;
  vin_decoded_at: string;
  success: boolean;
  error?: string;
}

async function decodeVin(vin: string): Promise<VinDecodingResult> {
  const now = new Date().toISOString();
  
  if (!vin || vin.length !== 17) {
    return {
      success: false,
      error: 'Invalid VIN format',
      vin_decoded_at: now
    };
  }

  try {
    console.log(`Decoding VIN: ${vin}`);
    
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValues/${vin}?format=json`
    );

    if (!response.ok) {
      console.error(`NHTSA API error: ${response.status}`);
      return {
        success: false,
        error: `NHTSA API error: ${response.status}`,
        vin_decoded_at: now
      };
    }

    const data = await response.json();
    const vinData: NHTSAVinResponse = data.Results?.[0] || {};

    if (vinData.ErrorCode && vinData.ErrorCode !== '0') {
      console.error(`VIN decoding error: ${vinData.ErrorText}`);
      return {
        success: false,
        error: vinData.ErrorText || 'VIN decoding failed',
        vin_decoded_at: now
      };
    }

    // Build engine description from available data
    let engineDesc = '';
    if (vinData.EngineCylinders) {
      engineDesc += `${vinData.EngineCylinders} Cylinder`;
    }
    if (vinData.DisplacementL) {
      engineDesc += engineDesc ? ` ${vinData.DisplacementL}L` : `${vinData.DisplacementL}L`;
    }
    if (vinData.EngineHP) {
      engineDesc += engineDesc ? ` ${vinData.EngineHP}HP` : `${vinData.EngineHP}HP`;
    }

    const result = {
      body_style_nhtsa: vinData.BodyClass || undefined,
      fuel_type_nhtsa: vinData.FuelTypePrimary || undefined,
      transmission_nhtsa: vinData.TransmissionStyle || undefined,
      engine_nhtsa: engineDesc || undefined,
      vehicle_type_nhtsa: vinData.VehicleType || undefined,
      drivetrain_nhtsa: vinData.DriveType || undefined,
      vin_decoded_at: now,
      success: true
    };

    console.log('VIN decoded successfully:', result);
    return result;
  } catch (error) {
    console.error('VIN decoding error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      vin_decoded_at: now
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vin, vehicleId } = await req.json();

    if (!vin) {
      return new Response(
        JSON.stringify({ error: 'VIN is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const decodingResult = await decodeVin(vin);

    // If vehicleId is provided, update the vehicle record
    if (vehicleId && decodingResult.success) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          body_style_nhtsa: decodingResult.body_style_nhtsa,
          fuel_type_nhtsa: decodingResult.fuel_type_nhtsa,
          transmission_nhtsa: decodingResult.transmission_nhtsa,
          engine_nhtsa: decodingResult.engine_nhtsa,
          vehicle_type_nhtsa: decodingResult.vehicle_type_nhtsa,
          drivetrain_nhtsa: decodingResult.drivetrain_nhtsa,
          vin_decoded_at: decodingResult.vin_decoded_at
        })
        .eq('id', vehicleId);

      if (updateError) {
        console.error('Error updating vehicle with VIN data:', updateError);
      }
    }

    return new Response(
      JSON.stringify(decodingResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in vin-decoder function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});