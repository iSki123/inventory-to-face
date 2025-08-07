import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
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

    // Define the 4 image prompts with dealership license plate
    const imagePrompts = [
      {
        angle: 'front_angled',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} in ${vehicleData.exterior_color || 'standard'} color. Front 3/4 angle view showing the front and driver's side of the vehicle. The vehicle has a license plate that reads "${dealershipName}" on it. Clean dealership lot background, bright natural lighting, high resolution, realistic automotive photography style. The vehicle should look pristine and ready for sale.`
      },
      {
        angle: 'side_profile',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} in ${vehicleData.exterior_color || 'standard'} color. Pure side profile view showing the complete side of the vehicle. The vehicle has a license plate that reads "${dealershipName}" on it. Clean dealership lot background, bright natural lighting, high resolution, realistic automotive photography style. The vehicle should look pristine and ready for sale.`
      },
      {
        angle: 'rear_view',
        prompt: `Professional automotive photography of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} in ${vehicleData.exterior_color || 'standard'} color. Rear view showing the back of the vehicle. The vehicle has a license plate that reads "${dealershipName}" on it. Clean dealership lot background, bright natural lighting, high resolution, realistic automotive photography style. The vehicle should look pristine and ready for sale.`
      },
      {
        angle: 'interior_door_open',
        prompt: `Professional automotive photography showing the interior of a ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.interior_color || 'standard'} interior. Driver's side door is open, photographed from outside the vehicle showing the interior cabin, seats, dashboard, and steering wheel. Clean, well-lit interior, high resolution, realistic automotive photography style. The interior should look clean and inviting.`
      }
    ];

    const generatedImages: string[] = [];
    const imageGenerationErrors: string[] = [];

    // Generate each image sequentially to avoid rate limits
    for (const imageConfig of imagePrompts) {
      try {
        console.log(`Generating ${imageConfig.angle} image...`);
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: imageConfig.prompt,
            n: 1,
            size: '1024x1024',
            quality: 'high',
            output_format: 'png'
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`OpenAI API error for ${imageConfig.angle}:`, response.status, errorData);
          imageGenerationErrors.push(`${imageConfig.angle}: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].b64_json) {
          // Convert base64 to data URL
          const imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
          generatedImages.push(imageUrl);
          console.log(`Successfully generated ${imageConfig.angle} image`);
        } else {
          console.error(`No image data returned for ${imageConfig.angle}`);
          imageGenerationErrors.push(`${imageConfig.angle}: No image data returned`);
        }

        // Small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error generating ${imageConfig.angle} image:`, error);
        imageGenerationErrors.push(`${imageConfig.angle}: ${error.message}`);
      }
    }

    console.log(`Generated ${generatedImages.length} images for vehicle ${vehicleId}`);
    
    if (generatedImages.length === 0) {
      throw new Error('Failed to generate any images: ' + imageGenerationErrors.join(', '));
    }

    // Update vehicle with generated images
    const { error: updateError } = await supabaseClient
      .from('vehicles')
      .update({
        images: generatedImages,
        ai_images_generated: true,
        ai_image_generation_completed_at: new Date().toISOString()
      })
      .eq('id', vehicleId);

    if (updateError) {
      console.error('Error updating vehicle with generated images:', updateError);
      throw new Error(`Failed to update vehicle: ${updateError.message}`);
    }

    console.log('Successfully updated vehicle with AI-generated images');

    return new Response(
      JSON.stringify({
        success: true,
        vehicleId,
        generatedImages: generatedImages.length,
        images: generatedImages,
        errors: imageGenerationErrors.length > 0 ? imageGenerationErrors : undefined,
        message: `Successfully generated ${generatedImages.length} AI images for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-vehicle-images function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});