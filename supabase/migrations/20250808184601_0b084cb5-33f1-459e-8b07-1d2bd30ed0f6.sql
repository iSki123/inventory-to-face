-- Create chat channels table
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  attachments JSONB,
  reactions JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat moderation table
CREATE TABLE public.chat_moderation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'delete', 'pin', 'unpin', 'mute_user'
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user achievements table
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL, -- 'first_sale', 'top_seller', 'deal_closer', 'monthly_winner'
  achievement_data JSONB,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_announced BOOLEAN DEFAULT false
);

-- Create chat user status table
CREATE TABLE public.chat_user_status (
  user_id UUID NOT NULL PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_muted BOOLEAN DEFAULT false,
  muted_until TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_status ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_channels
CREATE POLICY "Anyone can view active channels" ON public.chat_channels
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage channels" ON public.chat_channels
  FOR ALL USING (get_current_user_role() = ANY(ARRAY['owner', 'admin']));

-- Create policies for chat_messages
CREATE POLICY "Users can view messages" ON public.chat_messages
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Authenticated users can insert messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_deleted);

CREATE POLICY "Users can update their own messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all messages" ON public.chat_messages
  FOR ALL USING (get_current_user_role() = ANY(ARRAY['owner', 'admin']));

-- Create policies for chat_moderation
CREATE POLICY "Admins can view moderation logs" ON public.chat_moderation
  FOR SELECT USING (get_current_user_role() = ANY(ARRAY['owner', 'admin', 'manager']));

CREATE POLICY "Admins can insert moderation actions" ON public.chat_moderation
  FOR INSERT WITH CHECK (get_current_user_role() = ANY(ARRAY['owner', 'admin']) AND auth.uid() = moderator_id);

-- Create policies for user_achievements
CREATE POLICY "Users can view achievements" ON public.user_achievements
  FOR SELECT USING (true);

CREATE POLICY "System can insert achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (true);

-- Create policies for chat_user_status
CREATE POLICY "Users can view status" ON public.chat_user_status
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own status" ON public.chat_user_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status" ON public.chat_user_status
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default channels
INSERT INTO public.chat_channels (name, display_name, description) VALUES
  ('general', '#general', 'General discussion and announcements'),
  ('sales-wins', '#sales-wins', 'Celebrate your successful deals'),
  ('customer-stories', '#customer-stories', 'Share funny and interesting customer interactions'),
  ('tips-tricks', '#tips-tricks', 'Share sales tips and industry knowledge'),
  ('deals-trades', '#deals-trades', 'Discuss deals and trade opportunities'),
  ('announcements', '#announcements', 'Important platform announcements');

-- Create triggers for updated_at
CREATE TRIGGER update_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_user_status_updated_at
  BEFORE UPDATE ON public.chat_user_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically announce vehicle sales
CREATE OR REPLACE FUNCTION public.announce_vehicle_sale()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for vehicle sales announcements
CREATE TRIGGER announce_vehicle_sale_trigger
  AFTER UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.announce_vehicle_sale();