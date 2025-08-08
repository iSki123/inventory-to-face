-- Update vehicles RLS policies to allow admin access to all vehicles
DROP POLICY IF EXISTS "Users can view vehicles from their dealership" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles from their dealership" ON vehicles;
DROP POLICY IF EXISTS "Users can create their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete their own vehicles" ON vehicles;

-- Create new policies that allow admins and owners to see all vehicles
CREATE POLICY "Users can view vehicles" ON vehicles
FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin')
  ) OR
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
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin')
  ) OR
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
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can delete vehicles" ON vehicles
FOR DELETE
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin')
  )
);