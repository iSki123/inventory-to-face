-- Fix the overly permissive leads table RLS policy to prevent competitors/malicious employees from accessing customer data

-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view leads from their dealership" ON public.leads;

-- Create new, more secure policies with granular access control

-- 1. Users can view their own leads (leads they created)
CREATE POLICY "Users can view their own leads" 
ON public.leads 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can view leads specifically assigned to them
CREATE POLICY "Users can view assigned leads" 
ON public.leads 
FOR SELECT 
USING (auth.uid() = assigned_to);

-- 3. Owners and admins can view all leads from their dealership (for management oversight)
CREATE POLICY "Admins and owners can view dealership leads" 
ON public.leads 
FOR SELECT 
USING (
  get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text])
  AND user_id IN (
    SELECT profiles.user_id 
    FROM profiles 
    WHERE profiles.dealership_name = (
      SELECT profiles_1.dealership_name 
      FROM profiles profiles_1 
      WHERE profiles_1.user_id = auth.uid()
    ) 
    AND profiles.dealership_name IS NOT NULL
  )
);

-- 4. Managers can view leads from their dealership (if needed for business operations)
CREATE POLICY "Managers can view dealership leads" 
ON public.leads 
FOR SELECT 
USING (
  get_current_user_role() = 'manager'::text
  AND user_id IN (
    SELECT profiles.user_id 
    FROM profiles 
    WHERE profiles.dealership_name = (
      SELECT profiles_1.dealership_name 
      FROM profiles profiles_1 
      WHERE profiles_1.user_id = auth.uid()
    ) 
    AND profiles.dealership_name IS NOT NULL
  )
);

-- Update the UPDATE policy to match the new security model
DROP POLICY IF EXISTS "Users can update leads from their dealership" ON public.leads;

-- Users can only update their own leads or leads assigned to them
CREATE POLICY "Users can update their own or assigned leads" 
ON public.leads 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (auth.uid() = assigned_to)
);

-- Admins, owners, and managers can update leads from their dealership
CREATE POLICY "Management can update dealership leads" 
ON public.leads 
FOR UPDATE 
USING (
  get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
  AND user_id IN (
    SELECT profiles.user_id 
    FROM profiles 
    WHERE profiles.dealership_name = (
      SELECT profiles_1.dealership_name 
      FROM profiles profiles_1 
      WHERE profiles_1.user_id = auth.uid()
    ) 
    AND profiles.dealership_name IS NOT NULL
  )
);