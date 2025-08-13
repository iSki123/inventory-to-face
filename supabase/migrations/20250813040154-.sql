-- Fix the deduct_credit_and_update_vehicle function to properly handle updates
-- The issue is that we're using COALESCE which keeps existing values when new values exist
-- We need to actually use the provided values when they're not null

CREATE OR REPLACE FUNCTION public.deduct_credit_and_update_vehicle(p_vehicle_id uuid, p_user_id uuid, p_facebook_post_id text, p_update_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_credits INTEGER;
  updated_vehicle RECORD;
  result JSONB;
  actual_user_id UUID;
BEGIN
  -- Get the actual user ID from auth context if p_user_id is null
  IF p_user_id IS NULL THEN
    actual_user_id := auth.uid();
  ELSE
    actual_user_id := p_user_id;
  END IF;
  
  -- Log for debugging
  RAISE LOG 'deduct_credit_and_update_vehicle called with vehicle_id: %, user_id: %, facebook_post_id: %, update_data: %', 
    p_vehicle_id, actual_user_id, p_facebook_post_id, p_update_data;
  
  -- Get current credits with row lock to prevent race conditions
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = actual_user_id 
  FOR UPDATE;
  
  -- Check if user has sufficient credits
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', actual_user_id;
  END IF;
  
  IF current_credits < 1 THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;
  
  -- Deduct 1 credit
  UPDATE public.profiles 
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = actual_user_id;
  
  RAISE LOG 'Credits deducted successfully for user: %', actual_user_id;
  
  -- Update vehicle with the provided data, using the update_data values when provided
  UPDATE public.vehicles 
  SET 
    facebook_post_status = CASE 
      WHEN p_update_data ? 'facebook_post_status' THEN (p_update_data->>'facebook_post_status')::text
      ELSE facebook_post_status 
    END,
    facebook_post_id = CASE 
      WHEN p_facebook_post_id IS NOT NULL THEN p_facebook_post_id
      WHEN p_update_data ? 'facebook_post_id' THEN (p_update_data->>'facebook_post_id')::text
      ELSE facebook_post_id 
    END,
    last_posted_at = CASE 
      WHEN p_update_data ? 'last_posted_at' THEN (p_update_data->>'last_posted_at')::timestamp with time zone
      ELSE last_posted_at 
    END,
    updated_at = CASE 
      WHEN p_update_data ? 'updated_at' THEN (p_update_data->>'updated_at')::timestamp with time zone
      ELSE now() 
    END
  WHERE id = p_vehicle_id AND user_id = actual_user_id
  RETURNING * INTO updated_vehicle;
  
  -- Check if vehicle was actually updated
  IF updated_vehicle IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found or access denied. Vehicle ID: %, User ID: %', p_vehicle_id, actual_user_id;
  END IF;
  
  RAISE LOG 'Vehicle updated successfully: %, status: %, post_id: %', updated_vehicle.id, updated_vehicle.facebook_post_status, updated_vehicle.facebook_post_id;
  
  -- Get updated credits count
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = actual_user_id;
  
  -- Return both vehicle data and credits
  SELECT jsonb_build_object(
    'vehicle', to_jsonb(updated_vehicle),
    'credits', current_credits
  ) INTO result;
  
  RETURN result;
END;
$function$;