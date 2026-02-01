CREATE OR REPLACE FUNCTION public.load_paper_with_modules(
  p_paper_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_paper RECORD;
  v_modules JSONB := '{}'::jsonb;
BEGIN
  -- Get paper details with module IDs
  SELECT 
    p.id,
    p.center_id,
    p.title,
    p.paper_type,
    p.instruction,
    p.tests_conducted,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.reading_module_id,
    p.listening_module_id,
    p.writing_module_id,
    p.speaking_module_id
  INTO v_paper
  FROM papers p
  WHERE p.id = p_paper_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Build modules object by checking each module type
  -- Reading Module
  IF v_paper.reading_module_id IS NOT NULL THEN
    v_modules := v_modules || jsonb_build_object(
      'reading',
      (
        SELECT jsonb_build_object(
          'id', m.id,
          'paper_id', p_paper_id,
          'module_type', m.module_type,
          'heading', m.heading,
          'subheading', m.subheading,
          'instruction', m.instruction,
          'center_id', m.center_id,
          'view_option', m.view_option,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'sections', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'module_id', s.module_id,
                'title', s.title,
                'section_index', s.section_index,
                'content_type', s.content_type,
                'resource_url', s.resource_url,
                'content_text', s.content_text,
                'instruction', s.instruction,
                'subtext', s.subtext,
                'params', s.params,
                'created_at', s.created_at,
                'updated_at', s.updated_at,
                'sub_sections', (
                  SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                      'id', ss.id,
                      'section_id', ss.section_id,
                      'boundary_text', ss.boundary_text,
                      'sub_type', ss.sub_type,
                      'content_template', ss.content_template,
                      'resource_url', ss.resource_url,
                      'instruction', ss.instruction,
                      'sub_section_index', ss.sub_section_index,
                      'created_at', ss.created_at,
                      'updated_at', ss.updated_at,
                      'questions', (
                        SELECT COALESCE(jsonb_agg(
                          jsonb_build_object(
                            'id', qa.id,
                            'question_ref', qa.question_ref,
                            'correct_answers', qa.correct_answers,
                            'options', qa.options,
                            'explanation', qa.explanation,
                            'marks', qa.marks,
                            'created_at', qa.created_at,
                            'updated_at', qa.updated_at
                          )
                          ORDER BY qa.question_ref
                        ), '[]'::jsonb)
                        FROM question_answers qa
                        WHERE qa.sub_section_id = ss.id
                      )
                    )
                    ORDER BY ss.sub_section_index
                  ), '[]'::jsonb)
                  FROM sub_sections ss
                  WHERE ss.section_id = s.id
                )
              )
              ORDER BY s.section_index
            ), '[]'::jsonb)
            FROM sections s
            WHERE s.module_id = m.id
          )
        )
        FROM modules m
        WHERE m.id = v_paper.reading_module_id
      )
    );
  END IF;

  -- Listening Module
  IF v_paper.listening_module_id IS NOT NULL THEN
    v_modules := v_modules || jsonb_build_object(
      'listening',
      (
        SELECT jsonb_build_object(
          'id', m.id,
          'paper_id', p_paper_id,
          'module_type', m.module_type,
          'heading', m.heading,
          'subheading', m.subheading,
          'instruction', m.instruction,
          'center_id', m.center_id,
          'view_option', m.view_option,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'sections', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'module_id', s.module_id,
                'title', s.title,
                'section_index', s.section_index,
                'content_type', s.content_type,
                'resource_url', s.resource_url,
                'content_text', s.content_text,
                'instruction', s.instruction,
                'subtext', s.subtext,
                'params', s.params,
                'created_at', s.created_at,
                'updated_at', s.updated_at,
                'sub_sections', (
                  SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                      'id', ss.id,
                      'section_id', ss.section_id,
                      'boundary_text', ss.boundary_text,
                      'sub_type', ss.sub_type,
                      'content_template', ss.content_template,
                      'resource_url', ss.resource_url,
                      'instruction', ss.instruction,
                      'sub_section_index', ss.sub_section_index,
                      'created_at', ss.created_at,
                      'updated_at', ss.updated_at,
                      'questions', (
                        SELECT COALESCE(jsonb_agg(
                          jsonb_build_object(
                            'id', qa.id,
                            'question_ref', qa.question_ref,
                            'correct_answers', qa.correct_answers,
                            'options', qa.options,
                            'explanation', qa.explanation,
                            'marks', qa.marks,
                            'created_at', qa.created_at,
                            'updated_at', qa.updated_at
                          )
                          ORDER BY qa.question_ref
                        ), '[]'::jsonb)
                        FROM question_answers qa
                        WHERE qa.sub_section_id = ss.id
                      )
                    )
                    ORDER BY ss.sub_section_index
                  ), '[]'::jsonb)
                  FROM sub_sections ss
                  WHERE ss.section_id = s.id
                )
              )
              ORDER BY s.section_index
            ), '[]'::jsonb)
            FROM sections s
            WHERE s.module_id = m.id
          )
        )
        FROM modules m
        WHERE m.id = v_paper.listening_module_id
      )
    );
  END IF;

  -- Writing Module
  IF v_paper.writing_module_id IS NOT NULL THEN
    v_modules := v_modules || jsonb_build_object(
      'writing',
      (
        SELECT jsonb_build_object(
          'id', m.id,
          'paper_id', p_paper_id,
          'module_type', m.module_type,
          'heading', m.heading,
          'subheading', m.subheading,
          'instruction', m.instruction,
          'center_id', m.center_id,
          'view_option', m.view_option,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'sections', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'module_id', s.module_id,
                'title', s.title,
                'section_index', s.section_index,
                'content_type', s.content_type,
                'resource_url', s.resource_url,
                'content_text', s.content_text,
                'instruction', s.instruction,
                'subtext', s.subtext,
                'params', s.params,
                'created_at', s.created_at,
                'updated_at', s.updated_at,
                'sub_sections', '[]'::jsonb  -- Writing modules don't have sub_sections
              )
              ORDER BY s.section_index
            ), '[]'::jsonb)
            FROM sections s
            WHERE s.module_id = m.id
          )
        )
        FROM modules m
        WHERE m.id = v_paper.writing_module_id
      )
    );
  END IF;

  -- Speaking Module
  IF v_paper.speaking_module_id IS NOT NULL THEN
    v_modules := v_modules || jsonb_build_object(
      'speaking',
      (
        SELECT jsonb_build_object(
          'id', m.id,
          'paper_id', p_paper_id,
          'module_type', m.module_type,
          'heading', m.heading,
          'subheading', m.subheading,
          'instruction', m.instruction,
          'center_id', m.center_id,
          'view_option', m.view_option,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'sections', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'module_id', s.module_id,
                'title', s.title,
                'section_index', s.section_index,
                'content_type', s.content_type,
                'resource_url', s.resource_url,
                'content_text', s.content_text,
                'instruction', s.instruction,
                'subtext', s.subtext,
                'params', s.params,
                'created_at', s.created_at,
                'updated_at', s.updated_at,
                'sub_sections', '[]'::jsonb  -- Speaking modules don't have sub_sections
              )
              ORDER BY s.section_index
            ), '[]'::jsonb)
            FROM sections s
            WHERE s.module_id = m.id
          )
        )
        FROM modules m
        WHERE m.id = v_paper.speaking_module_id
      )
    );
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'paper', jsonb_build_object(
      'id', v_paper.id,
      'center_id', v_paper.center_id,
      'title', v_paper.title,
      'paper_type', v_paper.paper_type,
      'instruction', v_paper.instruction,
      'tests_conducted', v_paper.tests_conducted,
      'is_active', v_paper.is_active,
      'created_at', v_paper.created_at,
      'updated_at', v_paper.updated_at
    ),
    'modules', v_modules
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.load_paper_with_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_paper_with_modules(UUID) TO anon;