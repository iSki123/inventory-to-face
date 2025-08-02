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

    const { action, sourceId, userId } = await req.json();

    if (!action || !userId) {
      throw new Error('action and userId are required');
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
      throw new Error('Unauthorized');
    }

    switch (action) {
      case 'start_scraping':
        return await startScraping(supabaseClient, sourceId, userId);
      case 'get_scraping_status':
        return await getScrapingStatus(supabaseClient, sourceId);
      case 'process_scraped_data':
        return await processScrapedData(supabaseClient, sourceId, userId);
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Octoparse scraper error:', error);
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

  // Simulate Octoparse API integration
  // In a real implementation, this would call Octoparse API to start a task
  const mockScrapedData = generateMockVehicleData();

  // Update the source with scraped data timestamp
  await supabaseClient
    .from('vehicle_sources')
    .update({ 
      last_scraped_at: new Date().toISOString(),
      octoparse_task_id: `task_${Date.now()}`
    })
    .eq('id', sourceId);

  return new Response(
    JSON.stringify({ 
      success: true,
      taskId: `task_${Date.now()}`,
      message: 'Scraping started successfully',
      estimatedCompletion: '5-10 minutes',
      scrapedVehicles: mockScrapedData
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getScrapingStatus(supabaseClient: any, sourceId: string) {
  const { data: source } = await supabaseClient
    .from('vehicle_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

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

async function processScrapedData(supabaseClient: any, sourceId: string, userId: string) {
  // Generate mock vehicle data that would come from Octoparse
  const mockVehicleData = generateMockVehicleData();
  
  const insertedVehicles = [];

  for (const vehicleData of mockVehicleData) {
    try {
      const { data: inserted, error } = await supabaseClient
        .from('vehicles')
        .insert([{
          ...vehicleData,
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
      message: `Successfully imported ${insertedVehicles.length} vehicles`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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

function generateVIN() {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ1234567890';
  let vin = '';
  for (let i = 0; i < 17; i++) {
    vin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return vin;
}