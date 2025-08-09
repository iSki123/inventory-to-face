-- Fix function search path security warnings

-- Update get_current_user_role function to have immutable search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Update announce_vehicle_sale function to have immutable search_path  
CREATE OR REPLACE FUNCTION public.announce_vehicle_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  channel_id UUID;
BEGIN
  -- Only announce when status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    -- Get the sales-wins channel ID
    SELECT id INTO channel_id FROM public.chat_channels WHERE name = 'sales-wins';
    
    IF channel_id IS NOT NULL THEN
      -- Insert achievement announcement
      INSERT INTO public.chat_messages (channel_id, user_id, message_content, message_type)
      VALUES (
        channel_id,
        NEW.user_id,
        FORMAT('🎉 Just sold a %s %s %s for $%s! Great work!', NEW.year, NEW.make, NEW.model, NEW.price),
        'achievement'
      );
      
      -- Record achievement
      INSERT INTO public.user_achievements (user_id, achievement_type, achievement_data, is_announced)
      VALUES (
        NEW.user_id,
        'vehicle_sale',
        jsonb_build_object('vehicle_id', NEW.id, 'price', NEW.price, 'make', NEW.make, 'model', NEW.model, 'year', NEW.year),
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;