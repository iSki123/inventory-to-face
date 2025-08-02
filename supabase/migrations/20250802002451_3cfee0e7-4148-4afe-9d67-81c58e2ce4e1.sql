-- Create leads table for managing customer inquiries
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  
  -- Lead contact information
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Lead source and content
  source TEXT DEFAULT 'facebook_marketplace' CHECK (source IN ('facebook_marketplace', 'website', 'phone', 'walk_in', 'referral', 'other')),
  initial_message TEXT NOT NULL,
  
  -- Lead status and priority
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'follow_up', 'qualified', 'sold', 'lost')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Lead scoring and metadata
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  is_qualified BOOLEAN DEFAULT false,
  expected_close_date DATE,
  estimated_value INTEGER, -- in cents
  
  -- Interaction tracking
  last_contact_at TIMESTAMP WITH TIME ZONE,
  next_follow_up_at TIMESTAMP WITH TIME ZONE,
  response_count INTEGER DEFAULT 0,
  
  -- Facebook Marketplace specific
  facebook_thread_id TEXT,
  facebook_post_id TEXT,
  
  -- Additional metadata
  notes TEXT,
  tags TEXT[],
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_messages table for conversation history
CREATE TABLE public.lead_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  
  -- Message details
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'ai')),
  message_content TEXT NOT NULL,
  
  -- AI generation metadata
  is_ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT,
  ai_prompt TEXT,
  generation_cost INTEGER DEFAULT 0, -- in credits
  
  -- Message status
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT true,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Attachments and metadata
  attachments TEXT[], -- Array of file URLs
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leads
CREATE POLICY "Users can view leads from their dealership" 
ON public.leads 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  assigned_to = auth.uid() OR
  user_id IN (
    SELECT profiles.user_id 
    FROM public.profiles 
    WHERE profiles.dealership_name = (
      SELECT dealership_name 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    ) AND profiles.dealership_name IS NOT NULL
  )
);

CREATE POLICY "Users can create leads for their dealership" 
ON public.leads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update leads from their dealership" 
ON public.leads 
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  assigned_to = auth.uid() OR
  user_id IN (
    SELECT profiles.user_id 
    FROM public.profiles 
    WHERE profiles.dealership_name = (
      SELECT dealership_name 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    ) AND profiles.dealership_name IS NOT NULL
  )
);

CREATE POLICY "Users can delete their own leads" 
ON public.leads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for lead_messages
CREATE POLICY "Users can view messages for accessible leads" 
ON public.lead_messages 
FOR SELECT 
USING (
  lead_id IN (
    SELECT id FROM public.leads 
    WHERE user_id = auth.uid() OR assigned_to = auth.uid() OR
    user_id IN (
      SELECT profiles.user_id 
      FROM public.profiles 
      WHERE profiles.dealership_name = (
        SELECT dealership_name 
        FROM public.profiles 
        WHERE user_id = auth.uid()
      ) AND profiles.dealership_name IS NOT NULL
    )
  )
);

CREATE POLICY "Users can create messages for accessible leads" 
ON public.lead_messages 
FOR INSERT 
WITH CHECK (
  lead_id IN (
    SELECT id FROM public.leads 
    WHERE user_id = auth.uid() OR assigned_to = auth.uid() OR
    user_id IN (
      SELECT profiles.user_id 
      FROM public.profiles 
      WHERE profiles.dealership_name = (
        SELECT dealership_name 
        FROM public.profiles 
        WHERE user_id = auth.uid()
      ) AND profiles.dealership_name IS NOT NULL
    )
  )
);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update lead's last_contact_at when a new message is added
CREATE OR REPLACE FUNCTION public.update_lead_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads 
  SET 
    last_contact_at = NEW.created_at,
    response_count = response_count + 1,
    updated_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger to update lead when new message is added
CREATE TRIGGER update_lead_on_message
AFTER INSERT ON public.lead_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_last_contact();

-- Create indexes for better performance
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_vehicle_id ON public.leads(vehicle_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_priority ON public.leads(priority);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_last_contact_at ON public.leads(last_contact_at DESC);

CREATE INDEX idx_lead_messages_lead_id ON public.lead_messages(lead_id);
CREATE INDEX idx_lead_messages_sender_type ON public.lead_messages(sender_type);
CREATE INDEX idx_lead_messages_created_at ON public.lead_messages(created_at DESC);