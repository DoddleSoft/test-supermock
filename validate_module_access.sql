-- ============================================================
-- RPC: validate_module_access
-- Purpose: Validate if a student can access a specific module
-- Prevents re-entry to completed modules
-- Returns detailed validation result
-- ============================================================

CREATE OR REPLACE FUNCTION validate_module_access(
  p_attempt_id UUID,
  p_module_type TEXT,
  p_student_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_attempt_module RECORD;
  v_student_id UUID;
  v_attempt RECORD;
BEGIN
  -- Get student_id from email
  SELECT student_id INTO v_student_id
  FROM student_profiles
  WHERE email = p_student_email AND status = 'active';

  IF v_student_id IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Student profile not found or inactive',
      'error_code', 'STUDENT_NOT_FOUND'
    );
  END IF;

  -- Get the mock attempt details
  SELECT 
    id,
    student_id,
    status,
    scheduled_test_id
  INTO v_attempt
  FROM mock_attempts
  WHERE id = p_attempt_id;

  IF v_attempt.id IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Exam attempt not found',
      'error_code', 'ATTEMPT_NOT_FOUND'
    );
  END IF;

  -- Verify ownership
  IF v_attempt.student_id != v_student_id THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Access denied: This attempt does not belong to you',
      'error_code', 'UNAUTHORIZED'
    );
  END IF;

  -- Check if attempt is abandoned or completed
  IF v_attempt.status IN ('abandoned', 'completed') THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'This exam attempt is already ' || v_attempt.status,
      'error_code', 'ATTEMPT_CLOSED'
    );
  END IF;

  -- Find the attempt_module for this module type
  SELECT 
    am.id,
    am.module_id,
    am.status,
    am.started_at,
    am.completed_at,
    am.time_remaining_seconds,
    m.module_type
  INTO v_attempt_module
  FROM attempt_modules am
  JOIN modules m ON m.id = am.module_id
  WHERE am.attempt_id = p_attempt_id
    AND m.module_type = p_module_type
  LIMIT 1;

  IF v_attempt_module.id IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Module not found for this attempt',
      'error_code', 'MODULE_NOT_FOUND'
    );
  END IF;

  -- CRITICAL CHECK: If module is completed, deny access
  IF v_attempt_module.status = 'completed' THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'This module has already been completed and cannot be re-attempted',
      'error_code', 'MODULE_COMPLETED',
      'completed_at', v_attempt_module.completed_at
    );
  END IF;

  -- Check if module has timed out (time_remaining_seconds = 0 or less)
  IF v_attempt_module.time_remaining_seconds IS NOT NULL 
     AND v_attempt_module.time_remaining_seconds <= 0 THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Time has expired for this module',
      'error_code', 'TIME_EXPIRED'
    );
  END IF;

  -- All checks passed - allow access
  RETURN json_build_object(
    'allowed', true,
    'attempt_module_id', v_attempt_module.id,
    'module_status', v_attempt_module.status,
    'time_remaining_seconds', v_attempt_module.time_remaining_seconds,
    'started_at', v_attempt_module.started_at
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Database error: ' || SQLERRM,
      'error_code', 'DB_ERROR'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_module_access(UUID, TEXT, TEXT) TO authenticated;

-- Example usage:
-- SELECT validate_module_access(
--   '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- attempt_id
--   'reading',                                       -- module_type
--   'student@example.com'                           -- student_email
-- );
