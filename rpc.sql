CREATE OR REPLACE FUNCTION public.grade_attempt_module(
  p_attempt_module_id UUID,
  p_student_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_id UUID;
  v_attempt_id UUID;
  v_module_type TEXT;
  v_status TEXT;
  v_total_questions INT := 0;
  v_correct INT := 0;
  v_score DOUBLE PRECISION := 0;
  v_band NUMERIC(3,1);
  v_now TIMESTAMPTZ := now();
  v_answer JSONB;
  v_existing RECORD;
  v_correct_answer TEXT;
BEGIN

  --------------------------------------------------
  -- 1. LOCK MODULE (Concurrency Safe)
  --------------------------------------------------
  SELECT am.module_id, am.attempt_id, am.status, m.module_type
  INTO v_module_id, v_attempt_id, v_status, v_module_type
  FROM attempt_modules am
  JOIN modules m ON m.id = am.module_id
  JOIN mock_attempts ma ON ma.id = am.attempt_id
  WHERE am.id = p_attempt_module_id
    AND ma.student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid attempt_module or permission denied';
  END IF;

  --------------------------------------------------
  -- 2. IDEMPOTENT CHECK (Prevent Double Grading)
  --------------------------------------------------
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'already_graded'
    );
  END IF;

  --------------------------------------------------
  -- 3. WRITING MODULE (Submission Only)
  --------------------------------------------------
  IF v_module_type = 'writing' THEN
    FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
      INSERT INTO student_answers(
        attempt_module_id,
        reference_id,
        question_ref,
        student_response,
        is_correct,
        marks_awarded
      )
      VALUES(
        p_attempt_module_id,
        (v_answer->>'reference_id')::UUID,
        v_answer->>'question_ref',
        trim(v_answer->>'student_response'),
        NULL,
        0
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    UPDATE attempt_modules
    SET status = 'completed',
        completed_at = v_now
    WHERE id = p_attempt_module_id;

    RETURN jsonb_build_object(
      'status', 'submitted_writing'
    );
  END IF;

  --------------------------------------------------
  -- 4. AUTO GRADING (Listening / Reading)
  --------------------------------------------------
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_total_questions := v_total_questions + 1;

    -- Get correct answer from your question table
    SELECT correct_answer
    INTO v_correct_answer
    FROM question_answers
    WHERE id = (v_answer->>'reference_id')::UUID;

    IF v_correct_answer IS NULL THEN
      CONTINUE;
    END IF;

    -- Normalize answers (basic)
    IF lower(trim(v_answer->>'student_response')) =
       lower(trim(v_correct_answer))
    THEN
      v_correct := v_correct + 1;

      INSERT INTO student_answers(
        attempt_module_id,
        reference_id,
        question_ref,
        student_response,
        is_correct,
        marks_awarded
      )
      VALUES(
        p_attempt_module_id,
        (v_answer->>'reference_id')::UUID,
        v_answer->>'question_ref',
        trim(v_answer->>'student_response'),
        TRUE,
        1
      )
      ON CONFLICT DO NOTHING;

    ELSE
      INSERT INTO student_answers(
        attempt_module_id,
        reference_id,
        question_ref,
        student_response,
        is_correct,
        marks_awarded
      )
      VALUES(
        p_attempt_module_id,
        (v_answer->>'reference_id')::UUID,
        v_answer->>'question_ref',
        trim(v_answer->>'student_response'),
        FALSE,
        0
      )
      ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;

  --------------------------------------------------
  -- 5. SCORE CALCULATION
  --------------------------------------------------
  IF v_total_questions > 0 THEN
    v_score := v_correct;
  END IF;

  --------------------------------------------------
  -- 6. BAND CONVERSION (IELTS TABLE)
  --------------------------------------------------
  v_band :=
    CASE
      WHEN v_score >= 39 THEN 9
      WHEN v_score >= 37 THEN 8.5
      WHEN v_score >= 35 THEN 8
      WHEN v_score >= 33 THEN 7.5
      WHEN v_score >= 30 THEN 7
      WHEN v_score >= 27 THEN 6.5
      WHEN v_score >= 23 THEN 6
      WHEN v_score >= 19 THEN 5.5
      WHEN v_score >= 15 THEN 5
      WHEN v_score >= 13 THEN 4.5
      ELSE 4
    END;

  --------------------------------------------------
  -- 7. UPDATE MODULE RESULT
  --------------------------------------------------
  UPDATE attempt_modules
  SET
    status = 'completed',
    completed_at = v_now,
    score_obtained = v_score,
    band_score = v_band
  WHERE id = p_attempt_module_id;

  --------------------------------------------------
  -- 8. CHECK FULL ATTEMPT COMPLETION
  --------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM attempt_modules
    WHERE attempt_id = v_attempt_id
      AND status != 'completed'
  ) THEN
    UPDATE mock_attempts
    SET status = 'completed',
        completed_at = v_now
    WHERE id = v_attempt_id;
  END IF;

  --------------------------------------------------
  -- 9. RETURN RESULT
  --------------------------------------------------
  RETURN jsonb_build_object(
    'status', 'graded',
    'correct', v_correct,
    'total', v_total_questions,
    'score', v_score,
    'band', v_band
  );

END;
$$;
