-- Add registered_by column to patients table to track who registered the patient
ALTER TABLE public.patients 
ADD COLUMN registered_by text DEFAULT NULL;

-- Add registered_by_role column to store the role of the person who registered
ALTER TABLE public.patients 
ADD COLUMN registered_by_role text DEFAULT NULL;