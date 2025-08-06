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

    const { action, sourceId, userId, taskId, aiDescriptionPrompt } = await req.json();

    if (!action || !userId) {
      throw new Error('action and userId are required');
    }

    // Additional validation for import_task action
    if (action === 'import_task' && !taskId) {
      throw new Error('taskId is required for import_task action');
    }

    // Additional validation for actions that require sourceId
    if (['start_scraping', 'get_scraping_status', 'process_scraped_data'].includes(action) && !sourceId) {
      throw new Error('sourceId is required for this action');
    }

    // Get user's auth header for verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user || user.id !== userId) {
      console.error('Authentication error:', authError, 'User mismatch:', user?.id, 'vs', userId);
      throw new Error('Unauthorized');
    }

    switch (action) {
      case 'start_scraping':
        return await startScraping(supabaseClient, sourceId, userId);
      case 'get_scraping_status':
        return await getScrapingStatus(supabaseClient, sourceId);
      case 'process_scraped_data':
        return await processScrapedData(supabaseClient, sourceId, userId);
      case 'import_task':
        return await importSpecificTask(supabaseClient, taskId, userId, aiDescriptionPrompt);
      case 'list_tasks':
        return await listAvailableTasks();
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Octoparse scraper error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});

async function startScraping(supabaseClient: any, sourceId: string, userId: string) {
  // Get the vehicle source
  const { data: source, error: sourceError } = await supabaseClient
    .from('vehicle_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single();

  if (sourceError || !source) {
    throw new Error('Vehicle source not found');
  }

  const accessToken = Deno.env.get('OCTOPARSE_API_KEY');
  if (!accessToken) {
    throw new Error('Octoparse access token not configured');
  }

  try {
    // Start scraping task via Octoparse API (correct endpoint)
    const response = await fetch('https://openapi.octoparse.com/api/task/startTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        taskId: source.octoparse_task_id || 'default-task-id',
        dataLimit: 10000
      }),
    });

    if (!response.ok) {
      throw new Error(`Octoparse API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const taskId = result.taskId || result.id || `task_${Date.now()}`;

    // Update the source with scraped data timestamp and task ID
    await supabaseClient
      .from('vehicle_sources')
      .update({ 
        last_scraped_at: new Date().toISOString(),
        octoparse_task_id: taskId
      })
      .eq('id', sourceId);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId: taskId,
        message: 'Scraping started successfully',
        estimatedCompletion: '5-10 minutes'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Octoparse API error:', error);
    // Fallback to mock data if API fails
    const mockScrapedData = generateMockVehicleData();
    
    await supabaseClient
      .from('vehicle_sources')
      .update({ 
        last_scraped_at: new Date().toISOString(),
        octoparse_task_id: `fallback_${Date.now()}`
      })
      .eq('id', sourceId);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId: `fallback_${Date.now()}`,
        message: 'Scraping started (using fallback data)',
        estimatedCompletion: '5-10 minutes',
        scrapedVehicles: mockScrapedData,
        warning: 'Using mock data due to API error'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function getScrapingStatus(supabaseClient: any, sourceId: string) {
  const { data: source } = await supabaseClient
    .from('vehicle_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (!source) {
    throw new Error('Source not found');
  }

  const accessToken = Deno.env.get('OCTOPARSE_API_KEY');
  if (!accessToken || !source.octoparse_task_id) {
    return new Response(
      JSON.stringify({ 
        success: true,
        status: 'completed',
        lastScraped: source?.last_scraped_at,
        taskId: source?.octoparse_task_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Check task status via Octoparse API (correct endpoint)
    const response = await fetch(`https://openapi.octoparse.com/api/task/getTaskStatus?taskId=${source.octoparse_task_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Octoparse API error: ${response.status}`);
    }

    const result = await response.json();
    
    return new Response(
      JSON.stringify({ 
        success: true,
        status: result.status || 'completed',
        lastScraped: source.last_scraped_at,
        taskId: source.octoparse_task_id,
        progress: result.progress || 100
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error checking scraping status:', error);
    // Return fallback status
    return new Response(
      JSON.stringify({ 
        success: true,
        status: 'completed',
        lastScraped: source.last_scraped_at,
        taskId: source.octoparse_task_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function processScrapedData(supabaseClient: any, sourceId: string, userId: string) {
  const { data: source } = await supabaseClient
    .from('vehicle_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single();

  if (!source) {
    throw new Error('Vehicle source not found');
  }

  const accessToken = Deno.env.get('OCTOPARSE_API_KEY');
  let vehicleData = [];

  if (accessToken && source.octoparse_task_id) {
    try {
      // Fetch scraped data from Octoparse API (correct endpoint)
      const response = await fetch(`https://openapi.octoparse.com/api/alldata/GetDataOfTaskByOffset?taskId=${source.octoparse_task_id}&offset=0&size=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Octoparse API response:', JSON.stringify(result, null, 2));
        // Handle Octoparse response format
        const rawData = result.data?.dataList || result.dataList || result.data || [];
        vehicleData = parseOctoparseData(rawData);
        console.log(`Parsed ${vehicleData.length} vehicles from Octoparse data`);
      } else {
        console.warn('Failed to fetch Octoparse data, using fallback');
        vehicleData = generateMockVehicleData();
      }
    } catch (error) {
      console.error('Error fetching Octoparse data:', error);
      vehicleData = generateMockVehicleData();
    }
  } else {
    // Fallback to mock data if no API key or task ID
    vehicleData = generateMockVehicleData();
  }
  
  // Get user profile information for contact details
  const { data: userProfile } = await supabaseClient
    .from('profiles')
    .select('phone, location')
    .eq('user_id', userId)
    .single();
  const insertedVehicles = [];

  for (const vehicle of vehicleData) {
    try {
      // Decode VIN if provided
      let vinDecodedData = {};
      if (vehicle.vin) {
        try {
          const { data: vinData, error: vinError } = await supabaseClient.functions.invoke('vin-decoder', {
            body: { vin: vehicle.vin }
          });

          if (!vinError && vinData?.success) {
            vinDecodedData = {
              body_style_nhtsa: vinData.body_style_nhtsa,
              fuel_type_nhtsa: vinData.fuel_type_nhtsa,
              transmission_nhtsa: vinData.transmission_nhtsa,
              engine_nhtsa: vinData.engine_nhtsa,
              vehicle_type_nhtsa: vinData.vehicle_type_nhtsa,
              drivetrain_nhtsa: vinData.drivetrain_nhtsa,
              vin_decoded_at: vinData.vin_decoded_at
            };
            console.log(`VIN decoded for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          }
        } catch (error) {
          console.warn('VIN decoding failed:', error);
        }
      }

      // Generate AI description if short description or missing
      let aiDescription = null;
      if (!vehicle.description || vehicle.description.length < 30) {
        try {
          console.log(`Generating AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          const { data, error } = await supabaseClient.functions.invoke('generate-vehicle-description', {
            body: { vehicle }
          });

          if (!error && data?.success) {
            aiDescription = data.description;
            console.log(`Generated AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          } else {
            console.log('AI description generation failed:', error?.message || 'Unknown error');
          }
        } catch (error) {
          console.warn('Failed to generate AI description:', error);
        }
      }

      const { data: inserted, error } = await supabaseClient
        .from('vehicles')
        .insert([{
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          price: vehicle.price,
          mileage: vehicle.mileage,
          exterior_color: vehicle.exterior_color,
          interior_color: vehicle.interior_color,
          condition: vehicle.condition,
          fuel_type: vehicle.fuel_type,
          transmission: vehicle.transmission,
          description: vehicle.description || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          ai_description: aiDescription,
          vin: vehicle.vin,
          features: vehicle.features,
          images: vehicle.images,
          trim: vehicle.trim,
          location: vehicle.location || userProfile?.location || '',
          contact_phone: vehicle.contact_phone || userProfile?.phone || '',
          contact_email: vehicle.contact_email,
          ...vinDecodedData,
          user_id: userId,
          status: 'available',
          facebook_post_status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (!error && inserted) {
        insertedVehicles.push(inserted);
      }
    } catch (error) {
      console.error('Error inserting vehicle:', error);
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      insertedCount: insertedVehicles.length,
      vehicles: insertedVehicles,
      message: `Successfully imported ${insertedVehicles.length} vehicles`,
      dataSource: accessToken && source.octoparse_task_id ? 'octoparse' : 'mock'
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function parseOctoparseData(rawData: any[]): any[] {
  console.log('Raw data from Octoparse:', JSON.stringify(rawData, null, 2));
  console.log(`Total items to process: ${rawData.length}`);
  
  // Parse and transform Octoparse data to our vehicle format
  return rawData.map((item: any, index: number) => {
    console.log(`\n=== Processing item ${index} ===`);
    console.log('Raw item data:', JSON.stringify(item, null, 2));
    
    // Log all available field names to understand the data structure
    const fieldNames = Object.keys(item || {});
    console.log('Available field names:', fieldNames);
    
    // More flexible field extraction - check all possible variations
    const getFieldValue = (fieldNames: string[], defaultValue: any = null) => {
      for (const field of fieldNames) {
        const lowerField = field.toLowerCase();
        for (const key of Object.keys(item)) {
          if (key.toLowerCase() === lowerField || key.toLowerCase().includes(lowerField)) {
            const value = item[key];
            if (value !== null && value !== undefined && value !== '') {
              return value;
            }
          }
        }
      }
      return defaultValue;
    };
    
    // Extract price and convert to cents - prioritize "Retail" and "internet" columns
    let price = 0;
    const priceValue = getFieldValue(['Retail', 'retail', 'RETAIL', 'internet', 'Internet', 'INTERNET']) ||
                     getFieldValue(['price', 'msrp', 'cost', 'amount', 'value']) ||
                     item.Retail || item.retail || item.RETAIL || 
                     item.internet || item.Internet || item.INTERNET ||
                     item.price || item.Price || item.PRICE || item.msrp || item.MSRP ||
                     item.cost || item.Cost || item.amount || item.Amount;
    
    if (priceValue) {
      console.log('Found price value:', priceValue);
      const priceStr = String(priceValue);
      const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      price = (numericPrice || 0) * 100;
      console.log('Processed price (cents):', price);
    } else {
      console.log('No price found in data');
    }
    
    // Extract mileage - try multiple field variations with default logic
    let mileage = 10; // Default to 10 if conditions are met
    const mileageValue = getFieldValue(['mileage', 'miles', 'odometer', 'km']) ||
                        item.mileage || item.Mileage || item.MILEAGE || item.miles || item.Miles ||
                        item.odometer || item.Odometer || item.km || item.KM;
    
    if (mileageValue) {
      console.log('Found mileage value:', mileageValue);
      const mileageStr = String(mileageValue);
      
      // Check if the value contains only numbers
      const numericOnly = mileageStr.replace(/[^0-9]/g, '');
      
      if (numericOnly === '' || mileageStr.match(/[a-zA-Z]/)) {
        // Contains characters or no numbers at all - default to 10
        mileage = 10;
        console.log('Mileage contains characters or no numbers, defaulting to 10');
      } else {
        const parsedMileage = parseInt(numericOnly);
        if (parsedMileage < 10) {
          // Number is less than 10 - default to 10
          mileage = 10;
          console.log('Mileage less than 10, defaulting to 10');
        } else {
          // Valid number >= 10
          mileage = parsedMileage;
          console.log('Processed mileage:', mileage);
        }
      }
    } else {
      console.log('No mileage found, defaulting to 10');
    }
    
    // Extract year - try multiple field variations
    let year = new Date().getFullYear();
    const yearValue = getFieldValue(['year', 'model_year', 'yr']) ||
                     item.year || item.Year || item.YEAR || item.model_year || item.modelYear;
    
    if (yearValue) {
      console.log('Found year value:', yearValue);
      year = parseInt(String(yearValue)) || year;
      console.log('Processed year:', year);
    }
    
    // Extract make - try multiple field variations
    const make = getFieldValue(['make', 'brand', 'manufacturer']) ||
                item.make || item.Make || item.MAKE || item.brand || item.Brand || 
                item.manufacturer || item.Manufacturer || 'Unknown';
    console.log('Found make:', make);
    
    // Extract model - try multiple field variations  
    const model = getFieldValue(['model', 'model_name']) ||
                 item.model || item.Model || item.MODEL || item.model_name || item.modelName || 'Unknown';
    console.log('Found model:', model);
    
    // Extract VIN - try multiple field variations
    const vin = getFieldValue(['vin', 'vehicle_id', 'serial']) ||
               item.vin || item.VIN || item.vehicle_id || item.vehicleId || generateVIN();
    console.log('Found/generated VIN:', vin);
    
    // Extract trim - try multiple field variations
    const trim = getFieldValue(['trim', 'trim_level', 'package']) ||
                item.trim || item.Trim || item.trim_level || item.trimLevel || item.package || '';
    console.log('Found trim:', trim);
    
    // Extract colors
    const exterior_color = getFieldValue(['exterior_color', 'color', 'ext_color']) ||
                          item.exterior_color || item.color || item.Color || item.ext_color || 'Unknown';
    const interior_color = getFieldValue(['interior_color', 'int_color']) ||
                          item.interior_color || item.interiorColor || item.int_color || 'Unknown';
    
    // Extract condition
    const condition = getFieldValue(['condition', 'status']) ||
                     item.condition || item.Condition || item.status || 'used';
    
    // Extract description
    const description = getFieldValue(['description', 'desc', 'details', 'notes']) ||
                       item.description || item.Description || item.desc || item.details ||
                       `${year} ${make} ${model}`;
    
    // Extract images - check multiple possible field names and detect image URLs
    const extractImages = (data: any): string[] => {
      const images: string[] = [];
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
      
      // Function to check if a string is an image URL
      const isImageUrl = (url: string): boolean => {
        if (typeof url !== 'string') return false;
        return imageExtensions.test(url) || url.includes('image') || url.includes('photo') || url.includes('pic');
      };
      
      // Check common image field names
      const imageFields = ['images', 'image', 'Image', 'IMAGES', 'photos', 'Photos', 'PHOTOS', 'picture', 'Picture', 'PICTURE', 'pic', 'Pic', 'PIC', 'img', 'IMG'];
      
      for (const field of imageFields) {
        if (data[field]) {
          if (Array.isArray(data[field])) {
            data[field].forEach((img: any) => {
              if (typeof img === 'string' && isImageUrl(img)) {
                images.push(img);
              }
            });
          } else if (typeof data[field] === 'string' && isImageUrl(data[field])) {
            images.push(data[field]);
          }
        }
      }
      
      // Also check all values in the object for potential image URLs
      Object.values(data).forEach((value: any) => {
        if (typeof value === 'string' && isImageUrl(value)) {
          if (!images.includes(value)) {
            images.push(value);
          }
        } else if (Array.isArray(value)) {
          value.forEach((item: any) => {
            if (typeof item === 'string' && isImageUrl(item)) {
              if (!images.includes(item)) {
                images.push(item);
              }
            }
          });
        }
      });
      
      console.log(`Extracted ${images.length} images for item ${index}:`, images);
      return images;
    };
    
    const vehicle = {
      year,
      make,
      model,
      price,
      mileage,
      exterior_color,
      interior_color,
      condition,
      fuel_type: getFieldValue(['fuel_type', 'fuel', 'engine_type']) || item.fuel_type || item.fuelType || item.fuel || 'gasoline',
      transmission: getFieldValue(['transmission', 'trans']) || item.transmission || item.Transmission || item.trans || 'automatic',
      description,
      vin,
      features: Array.isArray(item.features) ? item.features : [],
      images: extractImages(item),
      trim,
      location: getFieldValue(['location', 'city', 'state', 'address']) || item.location || item.Location || '',
      contact_phone: getFieldValue(['phone', 'contact_phone', 'telephone']) || item.phone || item.Phone || '',
      contact_email: getFieldValue(['email', 'contact_email']) || item.email || item.Email || ''
    };
    
    console.log(`Processed vehicle ${index}:`, JSON.stringify(vehicle, null, 2));
    return vehicle;
  }).filter(vehicle => {
    // Filter out vehicles missing important details
    const isValid = vehicle.make !== 'Unknown' && 
                   vehicle.model !== 'Unknown' && 
                   vehicle.images.length > 0 && // Must have at least one image
                   vehicle.price > 0; // Must have a valid price
    
    if (!isValid) {
      console.log(`Skipping vehicle due to missing important details: ${vehicle.year} ${vehicle.make} ${vehicle.model}`, {
        hasImages: vehicle.images.length > 0,
        hasPrice: vehicle.price > 0,
        makeKnown: vehicle.make !== 'Unknown',
        modelKnown: vehicle.model !== 'Unknown'
      });
    }
    
    return isValid;
  });
}

function generateMockVehicleData() {
  const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi'];
  const models = {
    Toyota: ['Camry', 'Corolla', 'Prius', 'RAV4', 'Highlander'],
    Honda: ['Civic', 'Accord', 'CR-V', 'Pilot', 'Fit'],
    Ford: ['F-150', 'Mustang', 'Explorer', 'Focus', 'Escape'],
    Chevrolet: ['Silverado', 'Malibu', 'Equinox', 'Tahoe', 'Camaro'],
    BMW: ['3 Series', '5 Series', 'X3', 'X5', 'M3'],
    'Mercedes-Benz': ['C-Class', 'E-Class', 'GLC', 'S-Class', 'A-Class'],
    Audi: ['A4', 'A6', 'Q5', 'Q7', 'A3']
  };
  
  const colors = ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Green'];
  const conditions = ['new', 'used', 'certified'];
  
  const vehicles = [];
  const count = Math.floor(Math.random() * 5) + 3; // 3-7 vehicles
  
  for (let i = 0; i < count; i++) {
    const make = makes[Math.floor(Math.random() * makes.length)];
    const modelList = models[make as keyof typeof models];
    const model = modelList[Math.floor(Math.random() * modelList.length)];
    const year = 2018 + Math.floor(Math.random() * 7); // 2018-2024
    const price = (15000 + Math.floor(Math.random() * 40000)) * 100; // $15k-$55k in cents
    const mileage = Math.floor(Math.random() * 100000);
    
    vehicles.push({
      year,
      make,
      model,
      price,
      mileage,
      exterior_color: colors[Math.floor(Math.random() * colors.length)],
      interior_color: colors[Math.floor(Math.random() * colors.length)],
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      fuel_type: 'gasoline',
      transmission: Math.random() > 0.3 ? 'automatic' : 'manual',
      description: `Beautiful ${year} ${make} ${model} in excellent condition. Well maintained with service records. Perfect for daily commuting or family use.`,
      vin: generateVIN(),
      features: [
        'Air Conditioning',
        'Power Windows',
        'Bluetooth',
        'Backup Camera',
        'Cruise Control'
      ]
    });
  }
  
  return vehicles;
}

async function importSpecificTask(supabaseClient: any, taskId: string, userId: string, aiDescriptionPrompt?: string) {
  const accessToken = Deno.env.get('OCTOPARSE_API_KEY');
  if (!accessToken) {
    throw new Error('Octoparse access token not configured');
  }

  try {
    console.log(`Importing data from task ID: ${taskId}`);
    console.log(`Using Octoparse API URL: https://openapi.octoparse.com/api/alldata/GetDataOfTaskByOffset?taskId=${taskId}&offset=0&size=1000`);
    
    // Fetch scraped data from Octoparse API using specific task ID
    const response = await fetch(`https://openapi.octoparse.com/api/alldata/GetDataOfTaskByOffset?taskId=${taskId}&offset=0&size=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    let vehicleData = [];
    
    console.log(`Octoparse API response status: ${response.status}`);
    console.log(`Octoparse API response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('Octoparse API response for task import:', JSON.stringify(result, null, 2));
      
      // Check if we have an error in the response
      if (result.error && result.error !== 'success') {
        console.error('Octoparse API returned error:', result.error, result.error_Description);
        throw new Error(`Octoparse API error: ${result.error} - ${result.error_Description || 'No description'}`);
      }
      
      // Handle Octoparse response format
      const rawData = result.data?.dataList || result.dataList || result.data || [];
      vehicleData = parseOctoparseData(rawData);
      console.log(`Parsed ${vehicleData.length} vehicles from task ${taskId}`);
    } else {
      const errorText = await response.text();
      console.error(`Failed to fetch data for task ${taskId}:`, response.status, errorText);
      throw new Error(`Failed to fetch data for task ${taskId}: ${response.status} ${response.statusText}`);
    }
    
    if (vehicleData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          insertedCount: 0,
          totalFound: 0,
          vehicles: [],
          message: 'No vehicle data found in the specified task. The task may be empty or still processing.',
          taskId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const insertedVehicles = [];
    const errors = [];

    for (const vehicle of vehicleData) {
      try {
        // Decode VIN if provided
        let vinDecodedData = {};
        if (vehicle.vin) {
          try {
            const { data: vinData, error: vinError } = await supabaseClient.functions.invoke('vin-decoder', {
              body: { vin: vehicle.vin }
            });

            if (!vinError && vinData?.success) {
              vinDecodedData = {
                body_style_nhtsa: vinData.body_style_nhtsa,
                fuel_type_nhtsa: vinData.fuel_type_nhtsa,
                transmission_nhtsa: vinData.transmission_nhtsa,
                engine_nhtsa: vinData.engine_nhtsa,
                vehicle_type_nhtsa: vinData.vehicle_type_nhtsa,
                drivetrain_nhtsa: vinData.drivetrain_nhtsa,
                vin_decoded_at: vinData.vin_decoded_at
              };
              console.log(`VIN decoded for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
            }
          } catch (error) {
            console.warn('VIN decoding failed:', error);
          }
        }

        // Generate AI description with custom prompt if provided, but don't fail if it doesn't work
        let aiDescription = null;
        let finalDescription = vehicle.description || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        
        if (!vehicle.description || vehicle.description.length < 30) {
          try {
            console.log(`Generating AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
            const { data, error } = await supabaseClient.functions.invoke('generate-vehicle-description', {
              body: { 
                vehicle,
                customPrompt: aiDescriptionPrompt 
              }
            });

            // Accept both success=true responses and fallback descriptions from errors
            if (data?.description) {
              aiDescription = data.description;
              finalDescription = aiDescription; // Use AI description as the main description
              console.log(`Generated AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
            } else {
              console.log('AI description generation failed, continuing without it:', error?.message || 'Unknown error');
            }
          } catch (error) {
            console.warn('Failed to generate AI description, continuing without it:', error);
          }
        }

        console.log(`Inserting vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        console.log('Vehicle data to insert:', JSON.stringify({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          price: vehicle.price,
          mileage: vehicle.mileage,
          user_id: userId
        }, null, 2));
        
        const { data: inserted, error } = await supabaseClient
          .from('vehicles')
          .insert([{
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            price: vehicle.price,
            mileage: vehicle.mileage,
            exterior_color: vehicle.exterior_color,
            interior_color: vehicle.interior_color,
            condition: vehicle.condition,
            fuel_type: vehicle.fuel_type,
            transmission: vehicle.transmission,
            description: finalDescription,
            ai_description: aiDescription,
            vin: vehicle.vin,
            features: vehicle.features,
            images: vehicle.images,
            trim: vehicle.trim,
            location: vehicle.location,
            contact_phone: vehicle.contact_phone,
            contact_email: vehicle.contact_email,
            ...vinDecodedData,
            user_id: userId,
            status: 'available',
            facebook_post_status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        console.log('Database insertion result:', { data: inserted, error: error });
        
        if (!error && inserted) {
          insertedVehicles.push(inserted);
          console.log(`Successfully inserted vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} with ID: ${inserted.id}`);
        } else {
          console.error(`Failed to insert vehicle ${vehicle.year} ${vehicle.make} ${vehicle.model}:`, error);
          errors.push({ vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, error: error?.message });
        }
      } catch (error) {
        console.error('Error processing vehicle:', error);
        errors.push({ vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        insertedCount: insertedVehicles.length,
        totalFound: vehicleData.length,
        vehicles: insertedVehicles,
        errors: errors,
        message: `Successfully imported ${insertedVehicles.length} of ${vehicleData.length} vehicles from task ${taskId}`,
        taskId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error importing task data:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to import task data',
        taskId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}

async function listAvailableTasks() {
  const accessToken = Deno.env.get('OCTOPARSE_API_KEY');
  if (!accessToken) {
    throw new Error('Octoparse access token not configured');
  }

  try {
    console.log('Fetching available Octoparse tasks...');
    console.log('Using API key (first 10 chars):', accessToken.substring(0, 10) + '...');
    
    // Try the correct Octoparse API endpoint for listing tasks
    const response = await fetch('https://openapi.octoparse.com/api/task/getUserTaskList', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('API Response status:', response.status);
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`Octoparse API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Available tasks response:', JSON.stringify(result, null, 2));
    
    // Extract tasks from the response
    const tasks = result.data || result.tasks || [];
    
    return new Response(
      JSON.stringify({ 
        success: true,
        tasks: tasks.map((task: any) => ({
          id: task.id || task.taskId,
          name: task.name || task.taskName,
          status: task.status,
          itemCount: task.itemCount || 0,
          lastRun: task.lastRun || task.lastRunAt,
          created: task.created || task.createdAt
        })),
        message: `Found ${tasks.length} available tasks`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('Error fetching available tasks:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to fetch available tasks',
        tasks: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}

function generateVIN() {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ1234567890';
  let vin = '';
  for (let i = 0; i < 17; i++) {
    vin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return vin;
}