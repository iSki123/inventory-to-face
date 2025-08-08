-- Fix infinite recursion in profiles RLS policies
-- First, create a security definer function to check user roles safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON profiles;

-- Create new policies using the security definer function
CREATE POLICY "Users can view profiles" ON profiles
FOR SELECT
USING (
  auth.uid() = user_id OR 
  public.get_current_user_role() IN ('owner', 'admin')
);

CREATE POLICY "Users can update profiles" ON profiles
FOR UPDATE
USING (
  auth.uid() = user_id OR 
  public.get_current_user_role() IN ('owner', 'admin')
);

CREATE POLICY "Users can insert profiles" ON profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  public.get_current_user_role() IN ('owner', 'admin')
);

-- Also fix the vehicles policies to use the security definer function
DROP POLICY IF EXISTS "Users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can create vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles" ON vehicles;

-- Create new vehicle policies using the security definer function
CREATE POLICY "Users can view vehicles" ON vehicles
FOR SELECT
USING (
  user_id = auth.uid() OR 
  public.get_current_user_role() IN ('owner', 'admin') OR
  user_id IN ( 
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

CREATE POLICY "Users can update vehicles" ON vehicles
FOR UPDATE
USING (
  user_id = auth.uid() OR 
  public.get_current_user_role() IN ('owner', 'admin') OR
  user_id IN ( 
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

CREATE POLICY "Users can create vehicles" ON vehicles
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR 
  public.get_current_user_role() IN ('owner', 'admin')
);

CREATE POLICY "Users can delete vehicles" ON vehicles
FOR DELETE
USING (
  user_id = auth.uid() OR 
  public.get_current_user_role() IN ('owner', 'admin')
);