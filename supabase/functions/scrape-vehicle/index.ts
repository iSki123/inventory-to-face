import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Try to link to user from Authorization header, if provided
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) userId = data.user.id;
    }

    const body = await req.json();
    const vehicles = Array.isArray(body?.vehicles) ? body.vehicles : (body?.vehicle ? [body.vehicle] : []);
    if (vehicles.length === 0) throw new Error('No vehicle data received');

    const inserted: any[] = [];
    const updated: any[] = [];
    const errors: any[] = [];

    const normColor = (s?: string) => (s || '').toString();

    for (const v of vehicles) {
      try {
        const payload: any = {
          year: v.year ?? null,
          make: v.make ?? '',
          model: v.model ?? '',
          trim: v.trim ?? null,
          vin: v.vin ?? null,
          mileage: typeof v.mileage === 'number' ? v.mileage : parseInt(String(v.mileage || '').replace(/[^0-9]/g,'')) || null,
          price: typeof v.price === 'number' ? v.price : ((parseFloat(String(v.price||'').replace(/[^0-9.]/g,''))||0) * 100) || null,
          body_style_nhtsa: v.body_style || null,
          exterior_color: normColor(v.exterior_color || v.exteriorColor),
          interior_color: normColor(v.interior_color || v.interiorColor),
          fuel_type: v.fuel_type || v.fuelType || null,
          transmission: v.transmission || null,
          images: Array.isArray(v.images) ? v.images.filter(Boolean).slice(0,10) : [],
          description: v.description || `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim(),
          location: v.location || null,
          contact_phone: v.contact_phone || null,
          contact_email: v.contact_email || null,
          user_id: userId,
          status: 'available',
          facebook_post_status: 'draft',
          updated_at: new Date().toISOString(),
        };

        // Attempt upsert by (user_id, vin)
        let existingId: string | null = null;
        if (payload.vin && userId) {
          const { data: existing } = await supabase
            .from('vehicles')
            .select('id')
            .eq('user_id', userId)
            .eq('vin', payload.vin)
            .maybeSingle();
          existingId = existing?.id ?? null;
        }

        if (existingId) {
          const { data, error } = await supabase
            .from('vehicles')
            .update(payload)
            .eq('id', existingId)
            .select()
            .maybeSingle();
          if (error) throw error;
          updated.push(data);
        } else {
          // Ensure user_id exists when inserting
          if (!payload.user_id) throw new Error('Missing user; please authenticate extension');
          payload.created_at = new Date().toISOString();
          const { data, error } = await supabase
            .from('vehicles')
            .insert([payload])
            .select()
            .single();
          if (error) throw error;
          inserted.push(data);
        }
      } catch (e) {
        errors.push({ vin: v?.vin, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: inserted.length, updated: updated.length, errors, vehicles: { inserted, updated } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('scrape-vehicle error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
