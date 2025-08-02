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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { leadId, conversationHistory } = await req.json();

    if (!leadId || !conversationHistory) {
      throw new Error('leadId and conversationHistory are required');
    }

    // Fetch lead details for context
    const { data: lead, error: leadError } = await supabaseClient
      .from('leads')
      .select(`
        *,
        vehicle:vehicles(year, make, model, price, mileage, exterior_color, description),
        user:profiles!leads_user_id_fkey(first_name, last_name, dealership_name, phone)
      `)
      .eq('id', leadId)
      .single();

    if (leadError) {
      throw new Error(`Failed to fetch lead: ${leadError.message}`);
    }

    // Create AI prompt with lead context
    const vehicleInfo = lead.vehicle 
      ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model} - $${(lead.vehicle.price / 100).toLocaleString()}`
      : 'vehicle information not available';

    const dealershipInfo = lead.user
      ? `${lead.user.dealership_name || 'Our dealership'} - Contact: ${lead.user.first_name} ${lead.user.last_name}`
      : 'dealership information';

    const systemPrompt = `You are a professional automotive sales representative for ${dealershipInfo}. 
    
Lead Details:
- Customer: ${lead.customer_name}
- Vehicle of Interest: ${vehicleInfo}
- Lead Source: ${lead.source}
- Lead Status: ${lead.status}

Your goals:
1. Be helpful, professional, and personable
2. Answer questions about the vehicle accurately
3. Build rapport and trust with the customer
4. Qualify the lead and understand their needs
5. Schedule appointments or test drives when appropriate
6. Always maintain a positive, enthusiastic tone about our vehicles and service

Guidelines:
- Keep responses concise but informative (2-3 sentences max)
- Use natural, conversational language
- Reference specific vehicle details when relevant
- Suggest next steps (viewing, test drive, financing discussion)
- Be honest about vehicle condition and pricing
- Show enthusiasm for helping them find the right vehicle

Conversation History:
${conversationHistory}

Generate a professional, personalized response that continues this conversation naturally.`;

    // Generate AI response
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
            content: systemPrompt
          },
          { 
            role: 'user', 
            content: 'Generate an appropriate response to continue this conversation.'
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const aiResponse = await response.json();
    const generatedText = aiResponse.choices[0].message.content;

    // Calculate cost (approximate - 1 credit per 1000 tokens)
    const tokenCount = aiResponse.usage?.total_tokens || 0;
    const costInCredits = Math.ceil(tokenCount / 1000);

    return new Response(JSON.stringify({ 
      response: generatedText,
      model: 'gpt-4.1-2025-04-14',
      tokens: tokenCount,
      cost: costInCredits
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-lead-response:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});