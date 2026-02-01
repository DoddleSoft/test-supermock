CREATE OR REPLACE FUNCTION public.validate_student_attempt_access(
  p_student_id UUID,
  p_mock_attempt_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM mock_attempts ma
    -- Join to get the student's profile and center
    INNER JOIN student_profiles sp ON ma.student_id = sp.student_id
    -- Left join to scheduled_tests (only if it exists) to verify center consistency
    LEFT JOIN scheduled_tests st ON ma.scheduled_test_id = st.id
    WHERE 
      -- 1. Check if this specific attempt exists for this student
      ma.id = p_mock_attempt_id
      AND ma.student_id = p_student_id
      
      -- 2. Ensure student status is valid (optional, remove if not needed)
      AND sp.status = 'active'
      
      -- 3. Center Validation Logic:
      -- If it's a scheduled test, ensure the test's center matches the student's center.
      -- If it's not a scheduled test (NULL), we assume it's a self-practice derived from the student's center.
      AND (
        st.id IS NULL 
        OR st.center_id = sp.center_id
      )
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.validate_student_attempt_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_student_attempt_access(UUID, UUID) TO anon;