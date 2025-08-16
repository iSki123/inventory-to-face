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
    
    // Initialize Supabase client early to check settings
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

    // Check if edge functions are enabled globally
    const { data: globalSettings, error: globalError } = await supabaseClient
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'edge_functions_enabled')
      .maybeSingle();

    if (globalError) {
      console.error('Error fetching global edge function settings:', globalError);
    }

    const globalEnabled = globalSettings?.setting_value?.enabled !== false; // Default to true if not found
    
    if (!globalEnabled) {
      console.log('Edge functions are disabled globally');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Edge functions are currently disabled by administrator',
          code: 'EDGE_FUNCTIONS_DISABLED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    // Check specific function override
    const { data: overrideSettings, error: overrideError } = await supabaseClient
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'edge_function_overrides')
      .maybeSingle();

    if (overrideError) {
      console.error('Error fetching edge function overrides:', overrideError);
    }

    const overrides = overrideSettings?.setting_value || {};
    const functionEnabled = overrides['generate-vehicle-images'] !== false; // Default to enabled if not overridden
    
    if (!functionEnabled) {
      console.log('AI Vehicle Image Generation is disabled by administrator');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'AI Vehicle Image Generation is currently disabled by administrator',
          code: 'FUNCTION_DISABLED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }
    
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
    // (Already initialized above for settings check)

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

    // Get current vehicle images for reference (if available)
    const { data: currentVehicle } = await supabaseClient
      .from('vehicles')
      .select('images')
      .eq('id', vehicleId)
      .single();

    // Check if we have a reference image to use as seed
    const seedImageUrl = currentVehicle?.images?.[0];
    
    // Get AI image generation settings - individual configurations
    const { data: individualSettings, error: settingsError } = await supabaseClient
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_image_generation_individual')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching individual image settings:', settingsError);
    }

    // Default prompt template if not configured
    const defaultPrompt = `Reference this image for vehicle styling, lighting, background, damage, and customization:
{{SEED_IMAGE_URL}}

GOAL: Generate a clean, realistic photo that matches the seed image in **near-identical likeness**. The seed image is the **single source of truth**.

HARD CONSTRAINTS — DO NOT VIOLATE:
• Do NOT add, invent, or "upgrade" any feature that is not clearly visible in the seed image.
• Default to OEM/STOCK appearance for any part that is not clearly visible.
• If uncertain about a feature (occluded, blurry, partially cropped), OMIT it and keep OEM/STOCK.
• Ignore and REMOVE ad frames, banners, price boxes, watermarks, emoji/stickers, lot signage graphics, or any non-vehicle overlays from the seed image. These are NOT vehicle features.
• Keep the vehicle's ride height and stance exactly as in the seed image. **No lift/no lower** unless clearly shown.
• Keep wheels/tires exactly as shown (diameter/width/style/finish/sidewall look). Do NOT swap styles or sizes.
• Lighting mods: ONLY replicate lights that are clearly visible in the seed image (e.g., roof LED bar, grille lights, fogs, halos, pods). Match the **exact style, housing, lens, mounting location, and color temperature**. If not clearly present, DO NOT add any extra lights.
• Other mods/damage to replicate ONLY if clearly visible: step/nerf bars, racks, rain guards, body kits/flares, vinyl/wraps/decals, badges, mismatched panels, scratches, dents, chips, rust, scuffs, cracked parts. Match their exact location, size, and severity.

Vehicle data for accuracy:
{{YEAR}} {{MAKE}} {{MODEL}} {{TRIM}}, exterior: {{EXTERIOR_COLOR}}, interior: {{INTERIOR_COLOR}}, mileage: {{MILEAGE}}, engine: {{ENGINE}}, drivetrain: {{DRIVETRAIN}}, fuel: {{FUEL_TYPE}}.

View / Angle:
{{VIEW_DESCRIPTION}}

Composition:
• Vertical 9:16 (iPhone portrait)
• Vehicle occupies 65–70% of the frame
• ≥ 100px clear margin on both left & right sides
• Balanced space above & below
• Preserve the original background & lighting from the seed (sky, shadows, pavement/ground texture)
• Ensure the full vehicle is visible — no cropping/cutoffs

STRICT NO-TEXT POLICY:
No visible text of any kind in the image (no labels, overlays, price tags, UI boxes, borders, captions, numbers, or dealership graphics). The only allowed text is the **physical license plate** rendered as part of the car:
License plate: "{{DEALERSHIP_NAME}}".

Photography Style:
Ultra-high-resolution, realistic automotive photography with natural dynamic range, sharp focus, subtle depth-of-field. Keep the candid, modern iPhone look. Match perspective and lighting direction from the seed image.`;

    const defaultIndividualSettings = {
      front_34: { enabled: true, prompt: defaultPrompt, view: 'Front 3/4 — grille, headlights, driver\'s side' },
      side_profile: { enabled: true, prompt: defaultPrompt, view: 'Side profile — all wheels, full body' },
      rear_34: { enabled: false, prompt: defaultPrompt, view: 'Rear 3/4 — taillights, passenger side' },
      interior: { enabled: false, prompt: defaultPrompt, view: 'Interior — dashboard, seats, controls' }
    };

    const individualConfigs = individualSettings?.setting_value || defaultIndividualSettings;

    // Get enabled image configurations
    const enabledImages = Object.entries(individualConfigs)
      .filter(([_, config]: [string, any]) => config.enabled)
      .map(([key, config]: [string, any]) => ({
        key,
        prompt: config.prompt || defaultPrompt,
        view: config.view || `${key.replace('_', ' ')} view`
      }));

    if (enabledImages.length === 0) {
      console.log('No image configurations are enabled');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No image configurations are enabled',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${enabledImages.length} images with individual configurations`);
    console.log('Enabled image types:', enabledImages.map(img => img.key));

    // Function to replace all variables in the prompt template
    const buildPrompt = (promptTemplate: string, viewDescription: string) => {
      return promptTemplate
        .replace(/\{\{SEED_IMAGE_URL\}\}/g, seedImageUrl || 'N/A')
        .replace(/\{\{YEAR\}\}/g, vehicleData.year?.toString() || 'N/A')
        .replace(/\{\{MAKE\}\}/g, vehicleData.make || 'N/A')
        .replace(/\{\{MODEL\}\}/g, vehicleData.model || 'N/A')
        .replace(/\{\{TRIM\}\}/g, vehicleData.trim || 'N/A')
        .replace(/\{\{EXTERIOR_COLOR\}\}/g, vehicleData.exterior_color || 'N/A')
        .replace(/\{\{INTERIOR_COLOR\}\}/g, vehicleData.interior_color || 'N/A')
        .replace(/\{\{MILEAGE\}\}/g, vehicleData.mileage?.toString() || 'N/A')
        .replace(/\{\{ENGINE\}\}/g, vehicleData.engine || vehicleData.engine_nhtsa || 'N/A')
        .replace(/\{\{DRIVETRAIN\}\}/g, vehicleData.drivetrain || vehicleData.drivetrain_nhtsa || 'N/A')
        .replace(/\{\{FUEL_TYPE\}\}/g, vehicleData.fuel_type || vehicleData.fuel_type_nhtsa || 'N/A')
        .replace(/\{\{DEALERSHIP_NAME\}\}/g, dealershipName || 'N/A')
        .replace(/\{\{VIEW_DESCRIPTION\}\}/g, viewDescription);
    };

    // Build image prompts based on enabled configurations
    const imagePrompts = enabledImages.map((imageConfig) => ({
      angle: imageConfig.key,
      prompt: buildPrompt(imageConfig.prompt, imageConfig.view),
      viewDescription: imageConfig.view
    }));

    const generatedImages: string[] = [];
    const imageGenerationErrors: string[] = [];

    // Helper function to wait for a specific amount of time
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Enhanced rate limiting with jitter to prevent thundering herd
    const getBackoffDelay = (attempt: number, baseDelay: number = 2000): number => {
      const exponentialDelay = Math.pow(2, attempt - 1) * baseDelay;
      const jitter = Math.random() * 1000; // Add 0-1 second jitter
      return Math.min(exponentialDelay + jitter, 120000); // Cap at 2 minutes
    };

    // Helper function to parse rate limit delay from OpenAI response
    const parseRateLimitDelay = (errorMessage: string): number => {
      const retryAfterMatch = errorMessage.match(/(\d+\.?\d*) seconds/);
      if (retryAfterMatch) {
        const seconds = parseFloat(retryAfterMatch[1]);
        // Add buffer time to be safe and include jitter
        return Math.ceil(seconds * 1000) + Math.random() * 5000 + 5000; // Add 5-10 seconds buffer
      }
      return 60000; // Default 1 minute if can't parse
    };

    // Helper function to make API request with enhanced retry logic
    const generateImageWithRetry = async (imageConfig: any, maxRetries = 5): Promise<string | null> => {
      let lastRateLimitDelay = 0;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Generating ${imageConfig.angle} image (attempt ${attempt}/${maxRetries})...`);
          
          // Add progressive delay between attempts to reduce rate limit hits
          if (attempt > 1) {
            let delayTime = lastRateLimitDelay > 0 ? lastRateLimitDelay : getBackoffDelay(attempt, 3000);
            console.log(`Waiting ${Math.ceil(delayTime/1000)} seconds before attempt ${attempt}...`);
            await wait(delayTime);
            lastRateLimitDelay = 0; // Reset after using
          }
          
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
              output_format: 'png',
              background: 'auto'
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error(`OpenAI API error for ${imageConfig.angle}:`, response.status, errorData);
            
            // Handle rate limit specifically with enhanced logic
            if (response.status === 429) {
              try {
                const errorJson = JSON.parse(errorData);
                const waitTime = parseRateLimitDelay(errorJson.error?.message || '');
                lastRateLimitDelay = waitTime;
                
                if (attempt < maxRetries) {
                  console.log(`Rate limited. Will wait ${Math.ceil(waitTime/1000)} seconds before retry...`);
                  // Don't wait here, let the next iteration handle the delay
                  continue;
                } else {
                  console.error(`Max retries reached for ${imageConfig.angle} due to rate limiting`);
                  imageGenerationErrors.push(`${imageConfig.angle}: Rate limit exceeded after ${maxRetries} attempts`);
                  return null;
                }
              } catch (parseError) {
                console.error('Error parsing rate limit response:', parseError);
                lastRateLimitDelay = 60000; // Default to 1 minute
                if (attempt < maxRetries) continue;
                return null;
              }
            }
            
            // Handle organization verification error
            if (response.status === 403) {
              const errorMsg = `Organization verification required for gpt-image-1 model`;
              console.error(errorMsg);
              imageGenerationErrors.push(`${imageConfig.angle}: ${errorMsg}`);
              return null;
            }
            
            // Handle other client errors (don't retry)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              const errorMsg = `Client error ${response.status}: ${response.statusText}`;
              console.error(errorMsg);
              imageGenerationErrors.push(`${imageConfig.angle}: ${errorMsg}`);
              return null;
            }
            
            // Handle server errors (retry with backoff)
            if (response.status >= 500) {
              if (attempt < maxRetries) {
                const backoffTime = getBackoffDelay(attempt, 2000);
                console.log(`Server error. Retrying in ${Math.ceil(backoffTime/1000)} seconds...`);
                await wait(backoffTime);
                continue;
              }
              imageGenerationErrors.push(`${imageConfig.angle}: Server error after ${maxRetries} attempts`);
              return null;
            }
            
            // Other errors
            imageGenerationErrors.push(`${imageConfig.angle}: ${response.status} ${response.statusText}`);
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
            const backoffTime = getBackoffDelay(attempt, 2000);
            console.log(`Network error. Retrying in ${Math.ceil(backoffTime/1000)} seconds...`);
            await wait(backoffTime);
            continue;
          }
          imageGenerationErrors.push(`${imageConfig.angle}: ${error.message}`);
          return null;
        }
      }
      return null;
    };

    // Generate each image sequentially with enhanced rate limiting
    for (let i = 0; i < imagePrompts.length; i++) {
      const imageConfig = imagePrompts[i];
      
      // Add initial delay before first request to stagger multiple concurrent function calls
      if (i === 0) {
        const initialDelay = Math.random() * 5000; // 0-5 second random delay
        console.log(`Initial stagger delay: ${Math.ceil(initialDelay/1000)} seconds`);
        await wait(initialDelay);
      }
      
      const imageUrl = await generateImageWithRetry(imageConfig);
      if (imageUrl) {
        generatedImages.push(imageUrl);
      }
      
      // Add delay between different image requests to prevent rate limiting
      if (i < imagePrompts.length - 1) {
        const betweenDelay = 8000 + Math.random() * 4000; // 8-12 seconds between images
        console.log(`Waiting ${Math.ceil(betweenDelay/1000)} seconds before next image generation...`);
        await wait(betweenDelay);
      }
    }

    console.log(`Generated ${generatedImages.length} images for vehicle ${vehicleId}`);
    
    // Update vehicle with generated images even if only some were successful
    if (generatedImages.length > 0) {
      // Get updated current vehicle to preserve existing images
      const { data: updatedVehicle, error: fetchError } = await supabaseClient
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

      // Combine existing images with newly generated ones (filter out any nulls/undefined)
      const existingImages = (updatedVehicle?.images || []).filter(img => img && img.trim() !== '');
      const filteredGeneratedImages = generatedImages.filter(img => img && img.trim() !== '');
      const allImages = [...existingImages, ...filteredGeneratedImages];
      
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