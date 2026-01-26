-- RPC Function to fetch module data with security checks using student_id
CREATE OR REPLACE FUNCTION public.get_module_data_for_attempt(
  p_mock_attempt_id UUID,
  p_module_id UUID,
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_student_id UUID;
  v_student_center_id UUID;
  v_module_center_id UUID;
  v_paper_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Verify the student exists and get their center
  SELECT center_id
  INTO v_student_center_id
  FROM student_profiles
  WHERE student_id = p_student_id
    AND status = 'active';

  IF v_student_center_id IS NULL THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  -- Step 2: Verify the mock attempt exists and belongs to the student
  SELECT 
    ma.student_id,
    ma.paper_id
  INTO 
    v_attempt_student_id,
    v_paper_id
  FROM mock_attempts ma
  WHERE ma.id = p_mock_attempt_id;

  -- Check if attempt exists
  IF v_attempt_student_id IS NULL THEN
    RAISE EXCEPTION 'Mock attempt not found';
  END IF;

  -- Verify the attempt belongs to the provided student
  IF v_attempt_student_id != p_student_id THEN
    RAISE EXCEPTION 'Access denied: Mock attempt does not belong to this student';
  END IF;

  -- Step 3: Verify the module belongs to the same center as the student
  SELECT center_id
  INTO v_module_center_id
  FROM modules
  WHERE id = p_module_id;

  IF v_module_center_id IS NULL THEN
    RAISE EXCEPTION 'Module not found';
  END IF;

  IF v_module_center_id != v_student_center_id THEN
    RAISE EXCEPTION 'Access denied: Module does not belong to student center';
  END IF;

  -- Step 4: Verify the module is associated with the paper in the attempt
  IF NOT EXISTS (
    SELECT 1 FROM papers p
    WHERE p.id = v_paper_id
      AND (
        p.reading_module_id = p_module_id 
        OR p.listening_module_id = p_module_id
        OR p.writing_module_id = p_module_id
        OR p.speaking_module_id = p_module_id
      )
  ) THEN
    RAISE EXCEPTION 'Access denied: Module is not part of the attempt paper';
  END IF;

  -- Step 5: Fetch module with all nested data
  SELECT jsonb_build_object(
    'id', m.id,
    'module_type', m.module_type,
    'heading', m.heading,
    'subheading', m.subheading,
    'instruction', m.instruction,
    'created_at', m.created_at,
    'updated_at', m.updated_at,
    'sections', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'section_index', s.section_index,
          'content_type', s.content_type,
          'resource_url', s.resource_url,
          'content_text', s.content_text,
          'instruction', s.instruction,
          'subtext', s.subtext,
          'params', s.params,
          'sub_sections', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', ss.id,
                'boundary_text', ss.boundary_text,
                'sub_type', ss.sub_type,
                'content_template', ss.content_template,
                'resource_url', ss.resource_url,
                'sub_section_index', ss.sub_section_index,
                'questions', (
                  SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                      'id', qa.id,
                      'question_ref', qa.question_ref,
                      'correct_answers', qa.correct_answers,
                      'options', qa.options,
                      'explanation', qa.explanation,
                      'marks', qa.marks
                    ) ORDER BY qa.question_ref
                  ), '[]'::jsonb)
                  FROM question_answers qa
                  WHERE qa.sub_section_id = ss.id
                )
              ) ORDER BY ss.sub_section_index
            ), '[]'::jsonb)
            FROM sub_sections ss
            WHERE ss.section_id = s.id
          )
        ) ORDER BY s.section_index
      ), '[]'::jsonb)
      FROM sections s
      WHERE s.module_id = m.id
    )
  )
  INTO v_result
  FROM modules m
  WHERE m.id = p_module_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fetching module data: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_module_data_for_attempt(UUID, UUID, UUID) TO authenticated;

-- Grant execute permission to anon users (for public access scenarios)
GRANT EXECUTE ON FUNCTION public.get_module_data_for_attempt(UUID, UUID, UUID) TO anon;

-- Function to get all modules for a mock attempt
CREATE OR REPLACE FUNCTION public.get_all_modules_for_attempt(
  p_mock_attempt_id UUID,
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_student_id UUID;
  v_student_center_id UUID;
  v_paper_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Verify the student exists and get their center
  SELECT center_id
  INTO v_student_center_id
  FROM student_profiles
  WHERE student_id = p_student_id
    AND status = 'active';

  IF v_student_center_id IS NULL THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  -- Step 2: Verify the mock attempt and get paper info
  SELECT 
    ma.student_id,
    ma.paper_id
  INTO 
    v_attempt_student_id,
    v_paper_id
  FROM mock_attempts ma
  WHERE ma.id = p_mock_attempt_id;

  IF v_attempt_student_id IS NULL THEN
    RAISE EXCEPTION 'Mock attempt not found';
  END IF;

  -- Verify the attempt belongs to the provided student
  IF v_attempt_student_id != p_student_id THEN
    RAISE EXCEPTION 'Access denied: Mock attempt does not belong to this student';
  END IF;

  IF v_paper_id IS NULL THEN
    RAISE EXCEPTION 'No paper associated with this mock attempt';
  END IF;

  -- Step 3: Fetch paper with all associated modules
  SELECT jsonb_build_object(
    'paper_id', p.id,
    'title', p.title,
    'paper_type', p.paper_type,
    'instruction', p.instruction,
    'modules', jsonb_build_object(
      'reading', CASE 
        WHEN p.reading_module_id IS NOT NULL 
        THEN public.get_module_data_for_attempt(p_mock_attempt_id, p.reading_module_id, p_student_id)
        ELSE NULL 
      END,
      'listening', CASE 
        WHEN p.listening_module_id IS NOT NULL 
        THEN public.get_module_data_for_attempt(p_mock_attempt_id, p.listening_module_id, p_student_id)
        ELSE NULL 
      END,
      'writing', CASE 
        WHEN p.writing_module_id IS NOT NULL 
        THEN public.get_module_data_for_attempt(p_mock_attempt_id, p.writing_module_id, p_student_id)
        ELSE NULL 
      END,
      'speaking', CASE 
        WHEN p.speaking_module_id IS NOT NULL 
        THEN public.get_module_data_for_attempt(p_mock_attempt_id, p.speaking_module_id, p_student_id)
        ELSE NULL 
      END
    )
  )
  INTO v_result
  FROM papers p
  WHERE p.id = v_paper_id
    AND p.center_id = v_student_center_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fetching modules: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_modules_for_attempt(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_modules_for_attempt(UUID, UUID) TO anon;

-- Helper function to verify student access (optional, for additional validation)
CREATE OR REPLACE FUNCTION public.verify_student_attempt_access(
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
    INNER JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE ma.id = p_mock_attempt_id
      AND ma.student_id = p_student_id
      AND sp.status = 'active'
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_attempt_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_attempt_access(UUID, UUID) TO anon;
