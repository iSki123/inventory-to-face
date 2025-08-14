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
      console.error('OpenAI API key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { vehicleId, vehicleData, dealershipName } = await req.json();
    console.log('Request data:', { vehicleId, vehicleData: !!vehicleData, dealershipName });

    if (!vehicleId || !vehicleData) {
      console.error('Vehicle ID and data are required');
      return new Response(
        JSON.stringify({ success: false, error: 'Vehicle ID and data are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client with service role for database updates
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if AI image generation is enabled site-wide
    const { data: settings, error: settingsError } = await supabaseClient
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_image_generation_enabled')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching site settings:', settingsError);
    }

    const isEnabled = settings?.setting_value?.enabled !== false; // Default to true if not found
    
    if (!isEnabled) {
      console.log('AI image generation is disabled site-wide');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'AI image generation is currently disabled site-wide' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const basePromptSuffix = `Professional automotive dealership photography with MANDATORY 80-pixel minimum bleed/margin between the vehicle edges and all image borders. The vehicle must be completely centered in the frame with substantial buffer space on all sides - NO PART of the vehicle should touch or approach the image edges. Maintain at least 80px clear space around the entire vehicle perimeter. Clean, bright dealership lot background with professional lighting. The vehicle has a visible license plate reading "${dealershipName}". Ultra high resolution, realistic automotive photography style with professional framing standards. The vehicle should appear pristine and ready for sale with complete visibility and generous border spacing.`;

    // Define 2 key image prompts (reduced from 4 to prevent timeouts)
    const imagePrompts = [
      {
        angle: 'front_angled',
        prompt: `${vehicleDetails}. Front 3/4 angle view showing the front grille, headlights, and driver's side of the vehicle. ${basePromptSuffix}`
      },
      {
        angle: 'side_profile',
        prompt: `${vehicleDetails}. Pure side profile view showing the complete side silhouette, wheels, and body lines of the vehicle. ${basePromptSuffix}`
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
            // Convert base64 to binary data for storage upload
            const base64Data = data.data[0].b64_json;
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Generate unique filename
            const filename = `${vehicleId}/${imageConfig.angle}_${Date.now()}.png`;
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
              .from('ai-vehicle-images')
              .upload(filename, binaryData, {
                contentType: 'image/png',
                upsert: false
              });

            if (uploadError) {
              console.error(`Storage upload error for ${imageConfig.angle}:`, uploadError);
              imageGenerationErrors.push(`${imageConfig.angle}: Upload failed - ${uploadError.message}`);
              return null;
            }

            // Get public URL for the uploaded image
            const { data: urlData } = supabaseClient.storage
              .from('ai-vehicle-images')
              .getPublicUrl(filename);

            console.log(`Successfully generated and uploaded ${imageConfig.angle} image`);
            return urlData.publicUrl;
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
      
      // Add delay between requests to prevent rate limiting (reduced for timeout prevention)
      if (imageConfig !== imagePrompts[imagePrompts.length - 1]) {
        console.log('Waiting 1 second before next image generation...');
        await wait(1000); // Reduced from 3000ms to 1000ms
      }
    }

    console.log(`Generated ${generatedImages.length} images for vehicle ${vehicleId}`);
    
    // Update vehicle with generated images even if only some were successful
    if (generatedImages.length > 0) {
      // Get current vehicle to preserve existing images
      const { data: currentVehicle, error: fetchError } = await supabaseClient
        .from('vehicles')
        .select('images')
        .eq('id', vehicleId)
        .single();

      if (fetchError) {
        console.error('Error fetching current vehicle images:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch vehicle: ${fetchError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Combine existing images with newly generated ones
      const existingImages = currentVehicle?.images || [];
      const allImages = [...existingImages, ...generatedImages];
      
      console.log(`Combining ${existingImages.length} existing images with ${generatedImages.length} AI-generated images`);

      // Update vehicle with combined images
      const { error: updateError } = await supabaseClient
        .from('vehicles')
        .update({
          images: allImages,
          ai_images_generated: true,
          ai_image_generation_completed_at: new Date().toISOString()
        })
        .eq('id', vehicleId);

      if (updateError) {
        console.error('Error updating vehicle with generated images:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update vehicle: ${updateError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
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