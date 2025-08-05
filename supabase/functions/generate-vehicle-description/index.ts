
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { vehicle, customPrompt } = await req.json();

    if (!vehicle) {
      throw new Error('Vehicle data is required');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create the base prompt with vehicle details
    const vehicleDetails = `Year: ${vehicle.year}
Make: ${vehicle.make}
Model: ${vehicle.model}
Price: $${(vehicle.price / 100).toLocaleString()}
Mileage: ${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' miles' : 'N/A'}
Exterior Color: ${vehicle.exterior_color || 'N/A'}
Interior Color: ${vehicle.interior_color || 'N/A'}
Condition: ${vehicle.condition || 'Used'}
Transmission: ${vehicle.transmission || 'Automatic'}
Fuel Type: ${vehicle.fuel_type || 'Gasoline'}
VIN: ${vehicle.vin || 'Available upon request'}
${vehicle.trim ? `Trim: ${vehicle.trim}` : ''}
${vehicle.features && vehicle.features.length > 0 ? `Features: ${vehicle.features.join(', ')}` : ''}
${vehicle.contact_phone ? `Contact: ${vehicle.contact_phone}` : ''}`;

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt ? 
      `${customPrompt}\n\nVehicle Details:\n${vehicleDetails}` :
      `Create a compelling and professional vehicle listing description for Facebook Marketplace. Here are the vehicle details:

${vehicleDetails}

Write a description that:
1. Highlights the vehicle's key selling points
2. Is engaging and professional
3. Includes relevant details that buyers care about
4. Is 150-300 words long
5. Ends with a call to action for interested buyers
6. Avoids excessive capitalization or spammy language

Keep it conversational but professional, focusing on value and reliability.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert automotive copywriter who creates compelling vehicle listings that attract buyers and highlight value propositions.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${errorData?.error?.message ? ` - ${errorData.error.message}` : ''}`);
    }

    const data = await response.json();
    const generatedDescription = data.choices[0].message.content;

    console.log(`Generated AI description for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);

    return new Response(JSON.stringify({ 
      success: true,
      description: generatedDescription 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-vehicle-description function:', error);
    
    // Provide a more detailed fallback description
    const fallbackDescription = vehicle ? 
      `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} - Well-maintained vehicle in excellent condition. Features ${vehicle.transmission || 'automatic'} transmission and ${vehicle.fuel_type || 'gasoline'} engine. ${vehicle.mileage ? `With ${vehicle.mileage.toLocaleString()} miles,` : ''} this reliable vehicle is perfect for daily driving. Contact us today for more details and to schedule a test drive. Don't miss this great opportunity!` :
      'Quality vehicle available for sale. Contact us for more details and to schedule a test drive.';

    // Return success with fallback description instead of error
    return new Response(JSON.stringify({ 
      success: true,
      description: fallbackDescription,
      fallback: true,
      originalError: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
