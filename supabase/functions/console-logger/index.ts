import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    const { logs } = await req.json()
    
    if (!Array.isArray(logs) || logs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No logs provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if console logging is enabled
    const { data: setting } = await supabaseClient
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'console_logging_enabled')
      .single()

    if (!setting?.setting_value?.enabled) {
      return new Response(
        JSON.stringify({ message: 'Console logging is disabled' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare logs for insertion
    const logsToInsert = logs.map((log: any) => ({
      user_id: user.id,
      session_id: log.session_id || 'unknown',
      timestamp: log.timestamp || new Date().toISOString(),
      log_level: log.level || 'log',
      message: log.message || '',
      data: log.data || null,
      url: log.url || null,
      source: log.source || 'extension',
      user_agent: log.user_agent || null
    }))

    // Insert logs into database
    const { error: insertError } = await supabaseClient
      .from('console_logs')
      .insert(logsToInsert)

    if (insertError) {
      console.error('Error inserting logs:', insertError)
      throw insertError
    }

    console.log(`Inserted ${logsToInsert.length} console logs for user ${user.id}`)

    return new Response(
      JSON.stringify({ 
        message: `Successfully logged ${logsToInsert.length} entries`,
        inserted: logsToInsert.length 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Console logger error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})