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

    // Build comprehensive vehicle description for prompts
    const vehicleDetails = [
      `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
      vehicleData.trim ? `${vehicleData.trim} trim` : null,
      vehicleData.exterior_color ? `${vehicleData.exterior_color} exterior` : null,
      vehicleData.interior_color ? `${vehicleData.interior_color} interior` : null,
      vehicleData.condition ? `${vehicleData.condition} condition` : null,
      vehicleData.fuel_type || vehicleData.fuel_type_nhtsa ? `${vehicleData.fuel_type || vehicleData.fuel_type_nhtsa} engine` : null,
      vehicleData.transmission || vehicleData.transmission_nhtsa ? `${vehicleData.transmission || vehicleData.transmission_nhtsa} transmission` : null,
      vehicleData.engine || vehicleData.engine_nhtsa ? `${vehicleData.engine || vehicleData.engine_nhtsa} engine` : null,
      vehicleData.body_style_nhtsa ? `${vehicleData.body_style_nhtsa} body style` : null,
      vehicleData.drivetrain || vehicleData.drivetrain_nhtsa ? `${vehicleData.drivetrain || vehicleData.drivetrain_nhtsa} drivetrain` : null,
      vehicleData.mileage ? `${vehicleData.mileage.toLocaleString()} miles` : null,
      vehicleData.features && vehicleData.features.length > 0 ? `with features: ${vehicleData.features.slice(0, 5).join(', ')}` : null
    ].filter(Boolean).join(', ');

    const basePromptSuffix = `Professional automotive dealership photography with ample space around the vehicle. The vehicle should be centered in the frame with significant flood area/buffer space on all sides to ensure no parts are cut off. Clean, bright dealership lot background with professional lighting. The vehicle has a visible license plate reading "${dealershipName}". Ultra high resolution, realistic automotive photography style. The vehicle should appear pristine and ready for sale.`;

    // Define the 4 image prompts with comprehensive vehicle information
    const imagePrompts = [
      {
        angle: 'front_angled',
        prompt: `${vehicleDetails}. Front 3/4 angle view showing the front grille, headlights, and driver's side of the vehicle. ${basePromptSuffix}`
      },
      {
        angle: 'side_profile',
        prompt: `${vehicleDetails}. Pure side profile view showing the complete side silhouette, wheels, and body lines of the vehicle. ${basePromptSuffix}`
      },
      {
        angle: 'rear_view',
        prompt: `${vehicleDetails}. Rear view showing the back of the vehicle, taillights, and rear bumper. ${basePromptSuffix}`
      },
      {
        angle: 'interior_door_open',
        prompt: `${vehicleDetails}. Interior view with driver's side door open, photographed from outside showing the cabin, seats, dashboard, steering wheel, and controls. Clean, well-lit interior with professional automotive photography lighting. Ample framing space around the vehicle opening. High resolution, realistic automotive photography style.`
      }
    ];

    const generatedImages: string[] = [];
    const imageGenerationErrors: string[] = [];

    // Helper function to wait for a specific amount of time
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to make API request with retry logic
    const generateImageWithRetry = async (imageConfig: any, maxRetries = 3): Promise<string | null> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Generating ${imageConfig.angle} image (attempt ${attempt}/${maxRetries})...`);
          
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
            
            // Handle rate limit specifically
            if (response.status === 429) {
              try {
                const errorJson = JSON.parse(errorData);
                const retryAfter = errorJson.error?.message?.match(/(\d+\.?\d*) seconds/);
                const waitTime = retryAfter ? Math.ceil(parseFloat(retryAfter[1])) * 1000 : 30000; // Default 30s
                
                if (attempt < maxRetries) {
                  console.log(`Rate limited. Waiting ${waitTime/1000} seconds before retry...`);
                  await wait(waitTime);
                  continue;
                }
              } catch (parseError) {
                console.error('Error parsing rate limit response:', parseError);
              }
            }
            
            // Handle organization verification error
            if (response.status === 403) {
              const errorMsg = `Organization verification required for gpt-image-1 model`;
              console.error(errorMsg);
              imageGenerationErrors.push(`${imageConfig.angle}: ${errorMsg}`);
              return null;
            }
            
            imageGenerationErrors.push(`${imageConfig.angle}: ${response.status} ${response.statusText}`);
            if (attempt < maxRetries && response.status >= 500) {
              // Retry on server errors with exponential backoff
              const backoffTime = Math.pow(2, attempt) * 1000;
              console.log(`Server error. Retrying in ${backoffTime/1000} seconds...`);
              await wait(backoffTime);
              continue;
            }
            return null;
          }

          const data = await response.json();
          if (data.data && data.data[0] && data.data[0].b64_json) {
            // Convert base64 to data URL
            const imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
            console.log(`Successfully generated ${imageConfig.angle} image`);
            return imageUrl;
          } else {
            console.error(`No image data returned for ${imageConfig.angle}`);
            imageGenerationErrors.push(`${imageConfig.angle}: No image data returned`);
            return null;
          }

        } catch (error) {
          console.error(`Error generating ${imageConfig.angle} image (attempt ${attempt}):`, error);
          if (attempt < maxRetries) {
            const backoffTime = Math.pow(2, attempt) * 1000;
            console.log(`Retrying in ${backoffTime/1000} seconds...`);
            await wait(backoffTime);
            continue;
          }
          imageGenerationErrors.push(`${imageConfig.angle}: ${error.message}`);
          return null;
        }
      }
      return null;
    };

    // Generate each image sequentially with proper rate limiting
    for (const imageConfig of imagePrompts) {
      const imageUrl = await generateImageWithRetry(imageConfig);
      if (imageUrl) {
        generatedImages.push(imageUrl);
      }
      
      // Add delay between requests to prevent rate limiting
      if (imageConfig !== imagePrompts[imagePrompts.length - 1]) {
        console.log('Waiting 3 seconds before next image generation...');
        await wait(3000);
      }
    }

    console.log(`Generated ${generatedImages.length} images for vehicle ${vehicleId}`);
    
    // Update vehicle with generated images even if only some were successful
    if (generatedImages.length > 0) {
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
    } else {
      console.error('No images were successfully generated');
      // Update the vehicle to mark that image generation was attempted but failed
      await supabaseClient
        .from('vehicles')
        .update({
          ai_image_generation_completed_at: new Date().toISOString()
        })
        .eq('id', vehicleId);
    }


    return new Response(
      JSON.stringify({
        success: generatedImages.length > 0,
        vehicleId,
        generatedImages: generatedImages.length,
        images: generatedImages,
        errors: imageGenerationErrors.length > 0 ? imageGenerationErrors : undefined,
        message: generatedImages.length > 0 
          ? `Successfully generated ${generatedImages.length} AI images for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`
          : `Failed to generate any images for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}. Errors: ${imageGenerationErrors.join(', ')}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: generatedImages.length > 0 ? 200 : 500
      }
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