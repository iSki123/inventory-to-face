-- Tighten chat_messages SELECT policy to prevent cross-account data exposure
-- 1) Drop overly permissive policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'chat_messages' 
      AND policyname = 'Users can view messages'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view messages" ON public.chat_messages';
  END IF;
END$$;

-- 2) Create least-privilege SELECT policy scoped to dealership or ownership
CREATE POLICY "Users can view dealership or own messages"
ON public.chat_messages
FOR SELECT
USING (
  -- Owners/Admins/Managers can view
  public.get_current_user_role() = ANY (ARRAY['owner','admin','manager'])
  OR
  -- Message author can always view their own message
  auth.uid() = user_id
  OR
  -- Users can view messages authored by users in the same dealership
  EXISTS (
    SELECT 1
    FROM public.profiles p_sender
    JOIN public.profiles p_self ON p_self.user_id = auth.uid()
    WHERE p_sender.user_id = public.chat_messages.user_id
      AND p_sender.dealership_name IS NOT NULL
      AND p_self.dealership_name IS NOT NULL
      AND p_sender.dealership_name = p_self.dealership_name
  )
);

-- Note: Existing INSERT/UPDATE policies remain unchanged and already restrict mutation to the author
-- Admins retain full control via the existing "Admins can manage all messages" policy.