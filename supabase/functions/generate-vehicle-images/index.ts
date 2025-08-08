import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== AI Vehicle Image Generation Started ===');
    
    const huggingFaceToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!huggingFaceToken) {
      throw new Error('Hugging Face access token not configured');
    }

    const { vehicleId, vehicleData, dealershipName } = await req.json();
    console.log('Request data:', { vehicleId, vehicleData: !!vehicleData, dealershipName });

    if (!vehicleId || !vehicleData) {
      throw new Error('Vehicle ID and data are required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    console.log('Starting AI image generation for vehicle:', {
      id: vehicleId,
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model
    });

    // Update vehicle to mark AI image generation as requested
    await supabaseClient
      .from('vehicles')
      .update({ 
        ai_image_generation_requested_at: new Date().toISOString()
      })
      .eq('id', vehicleId);

    // Initialize Hugging Face client
    const hf = new HfInference(huggingFaceToken);

    // Define image types to generate
    const imageTypes = [
      {
        type: 'front_angled',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}, front three-quarter view, ${vehicleData.exterior_color || 'metallic'} color, parked in front of ${dealershipName || 'luxury car dealership'}, showroom quality, studio lighting, high resolution, commercial photography style`
      },
      {
        type: 'side_profile',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}, side profile view, ${vehicleData.exterior_color || 'metallic'} color, clean background, showroom quality, studio lighting, high resolution, commercial photography style`
      },
      {
        type: 'rear_view',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}, rear view, ${vehicleData.exterior_color || 'metallic'} color, parked in front of ${dealershipName || 'luxury car dealership'}, showroom quality, studio lighting, high resolution, commercial photography style`
      },
      {
        type: 'interior_view',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}, interior view showing dashboard and front seats, ${vehicleData.interior_color || 'black'} interior, showroom quality, studio lighting, high resolution, commercial photography style`
      }
    ];

    const generatedImages = [];
    const imageErrors = [];

    // Generate images sequentially to avoid rate limiting
    for (const imageConfig of imageTypes) {
      try {
        console.log(`Generating ${imageConfig.type} image...`);
        
        const image = await hf.textToImage({
          inputs: imageConfig.prompt,
          model: 'black-forest-labs/FLUX.1-schnell', // Fast and high quality
        });

        // Convert the blob to a base64 string
        const arrayBuffer = await image.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUrl = `data:image/png;base64,${base64}`;

        generatedImages.push({
          type: imageConfig.type,
          url: dataUrl,
          description: `AI generated ${imageConfig.type} view of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`
        });

        console.log(`Successfully generated ${imageConfig.type} image`);
        
        // Small delay between generations to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Hugging Face API error for ${imageConfig.type}:`, error);
        imageErrors.push({
          type: imageConfig.type,
          error: error.message || 'Unknown error'
        });
      }
    }

    console.log(`Generated ${generatedImages.length} images for vehicle ${vehicleId}`);

    if (generatedImages.length === 0) {
      console.error('Failed to generate any images:', imageErrors.map(e => `${e.type}: ${e.error}`).join(', '));
      throw new Error(`Failed to generate any images: ${imageErrors.map(e => `${e.type}: ${e.error}`).join(', ')}`);
    }

    // Update vehicle with generated images
    const imageUrls = generatedImages.map(img => img.url);
    const { error: updateError } = await supabaseClient
      .from('vehicles')
      .update({ 
        images: imageUrls,
        ai_images_generated: true,
        ai_image_generation_completed_at: new Date().toISOString()
      })
      .eq('id', vehicleId);

    if (updateError) {
      console.error('Failed to update vehicle with images:', updateError);
      throw new Error(`Failed to update vehicle: ${updateError.message}`);
    }

    console.log(`Successfully updated vehicle ${vehicleId} with ${generatedImages.length} AI-generated images`);

    return new Response(JSON.stringify({ 
      success: true,
      vehicleId,
      imagesGenerated: generatedImages.length,
      images: generatedImages,
      errors: imageErrors.length > 0 ? imageErrors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-vehicle-images function:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});