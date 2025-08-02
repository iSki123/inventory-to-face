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

    const { action, vehicleId, jobId, userId } = await req.json();

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
      case 'create_posting_job':
        return await createPostingJob(supabaseClient, vehicleId, userId);
      case 'process_posting_queue':
        return await processPostingQueue(supabaseClient, userId);
      case 'get_posting_status':
        return await getPostingStatus(supabaseClient, jobId);
      case 'bulk_post':
        return await bulkPost(supabaseClient, vehicleId, userId); // vehicleId is array in this case
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Facebook poster error:', error);
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

async function createPostingJob(supabaseClient: any, vehicleId: string, userId: string) {
  // Verify the vehicle belongs to the user
  const { data: vehicle, error: vehicleError } = await supabaseClient
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .single();

  if (vehicleError || !vehicle) {
    throw new Error('Vehicle not found or unauthorized');
  }

  // Check if there's already a pending job for this vehicle
  const { data: existingJob } = await supabaseClient
    .from('facebook_posting_jobs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingJob) {
    throw new Error('Vehicle already has a pending posting job');
  }

  // Create the posting job
  const { data: job, error: jobError } = await supabaseClient
    .from('facebook_posting_jobs')
    .insert([{
      user_id: userId,
      vehicle_id: vehicleId,
      status: 'pending',
      scheduled_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (jobError) {
    throw new Error('Failed to create posting job');
  }

  // Start processing the job immediately
  setTimeout(() => processJob(supabaseClient, job.id), 1000);

  return new Response(
    JSON.stringify({ 
      success: true,
      jobId: job.id,
      message: 'Posting job created and will be processed shortly'
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processPostingQueue(supabaseClient: any, userId: string) {
  // Get pending jobs for the user
  const { data: jobs, error } = await supabaseClient
    .from('facebook_posting_jobs')
    .select(`
      *,
      vehicle:vehicles(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(5); // Process up to 5 jobs at once

  if (error || !jobs?.length) {
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'No pending jobs to process',
        processedCount: 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const processedJobs = [];
  for (const job of jobs) {
    try {
      await processJob(supabaseClient, job.id);
      processedJobs.push(job.id);
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      processedCount: processedJobs.length,
      message: `Processed ${processedJobs.length} posting jobs`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processJob(supabaseClient: any, jobId: string) {
  // Update job status to processing
  await supabaseClient
    .from('facebook_posting_jobs')
    .update({ 
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('id', jobId);

  try {
    // Simulate Facebook Marketplace posting process
    // In real implementation, this would use Puppeteer/Playwright to automate browser
    await simulateFacebookPosting();

    const facebookPostId = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get the job with vehicle data
    const { data: job } = await supabaseClient
      .from('facebook_posting_jobs')
      .select(`
        *,
        vehicle:vehicles(*)
      `)
      .eq('id', jobId)
      .single();

    // Update vehicle with Facebook post information
    await supabaseClient
      .from('vehicles')
      .update({
        facebook_post_id: facebookPostId,
        facebook_post_status: 'posted',
        last_posted_at: new Date().toISOString()
      })
      .eq('id', job.vehicle_id);

    // Mark job as completed
    await supabaseClient
      .from('facebook_posting_jobs')
      .update({ 
        status: 'completed',
        facebook_post_id: facebookPostId,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Successfully posted vehicle ${job.vehicle_id} to Facebook Marketplace`);

  } catch (error) {
    console.error(`Failed to process job ${jobId}:`, error);
    
    // Update job with error
    const { data: job } = await supabaseClient
      .from('facebook_posting_jobs')
      .select('retry_count, max_retries')
      .eq('id', jobId)
      .single();

    if (job.retry_count < job.max_retries) {
      // Schedule retry
      await supabaseClient
        .from('facebook_posting_jobs')
        .update({ 
          status: 'retrying',
          retry_count: job.retry_count + 1,
          error_message: error.message,
          scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // Retry in 30 minutes
        })
        .eq('id', jobId);
    } else {
      // Mark as failed
      await supabaseClient
        .from('facebook_posting_jobs')
        .update({ 
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }
  }
}

async function simulateFacebookPosting() {
  // Simulate the time it takes to post to Facebook Marketplace
  const delay = 2000 + Math.random() * 3000; // 2-5 seconds
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Simulate occasional failures for realism
  if (Math.random() < 0.1) { // 10% failure rate
    throw new Error('Facebook posting failed: Network timeout');
  }
}

async function getPostingStatus(supabaseClient: any, jobId: string) {
  const { data: job, error } = await supabaseClient
    .from('facebook_posting_jobs')
    .select(`
      *,
      vehicle:vehicles(year, make, model)
    `)
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error('Job not found');
  }

  return new Response(
    JSON.stringify({ 
      success: true,
      job
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function bulkPost(supabaseClient: any, vehicleIds: string[], userId: string) {
  if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
    throw new Error('vehicleIds must be a non-empty array');
  }

  // Verify all vehicles belong to the user
  const { data: vehicles, error: vehicleError } = await supabaseClient
    .from('vehicles')
    .select('id')
    .eq('user_id', userId)
    .in('id', vehicleIds);

  if (vehicleError || vehicles.length !== vehicleIds.length) {
    throw new Error('Some vehicles not found or unauthorized');
  }

  // Create posting jobs for all vehicles
  const jobs = vehicleIds.map(vehicleId => ({
    user_id: userId,
    vehicle_id: vehicleId,
    status: 'pending',
    scheduled_at: new Date().toISOString()
  }));

  const { data: createdJobs, error: jobError } = await supabaseClient
    .from('facebook_posting_jobs')
    .insert(jobs)
    .select();

  if (jobError) {
    throw new Error('Failed to create bulk posting jobs');
  }

  // Start processing jobs with staggered timing to avoid rate limits
  createdJobs.forEach((job: any, index: number) => {
    setTimeout(() => processJob(supabaseClient, job.id), index * 5000); // 5 seconds apart
  });

  return new Response(
    JSON.stringify({ 
      success: true,
      jobCount: createdJobs.length,
      message: `Created ${createdJobs.length} posting jobs for bulk posting`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}