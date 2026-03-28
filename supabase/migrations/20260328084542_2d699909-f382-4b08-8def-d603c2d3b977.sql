-- Allow authenticated users to insert messages (for signup notifications)
CREATE POLICY "Authenticated users can send messages"
ON public.admin_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);