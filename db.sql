-- ============================================================================
-- SuperMock Complete Database Schema
-- Generated from production database
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.module_view_enum AS ENUM ('public', 'private');
CREATE TYPE public.scheduled_test_status AS ENUM ('scheduled', 'upcoming', 'live', 'ended');
CREATE TYPE public.student_type_enum AS ENUM ('regular', 'visitor', 'mock_only');
CREATE TYPE public.user_role_enum AS ENUM ('admin', 'owner', 'examiner');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Composite type for grading result items
CREATE TYPE public.grading_result_item AS (
  answer_id uuid,
  is_correct boolean,
  marks_awarded numeric
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (for staff: admin, owner, examiner)
CREATE TABLE public.users (
  user_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  role public.user_role_enum NOT NULL,
  full_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

-- Centers table
CREATE TABLE public.centers (
  center_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subscription_tier text DEFAULT 'basic'::text,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  user_id uuid DEFAULT auth.uid(),
  status public.verification_status DEFAULT 'pending'::verification_status,
  verified_at timestamp without time zone,
  CONSTRAINT centers_pkey PRIMARY KEY (center_id),
  CONSTRAINT centers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- Student profiles table
CREATE TABLE public.student_profiles (
  student_id uuid NOT NULL,
  center_id uuid,
  email text,
  name text,
  phone text,
  guardian text,
  guardian_phone text,
  date_of_birth date,
  address text,
  grade text,
  status text NOT NULL DEFAULT 'active'::text,
  enrollment_type public.student_type_enum NOT NULL DEFAULT 'regular'::student_type_enum,
  visitor_exam_date date,
  tests_taken integer DEFAULT 0,
  enrolled_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'::text),
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT student_profiles_pkey PRIMARY KEY (student_id),
  CONSTRAINT student_profiles_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT check_regular_student_data CHECK (
    (enrollment_type = 'mock_only'::student_type_enum) OR 
    ((enrollment_type = 'regular'::student_type_enum) AND (guardian IS NOT NULL))
  ),
  CONSTRAINT student_profiles_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'cancelled'::text, 'archived'::text, 'passed'::text])
  )
);

-- Center members table
CREATE TABLE public.center_members (
  membership_id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL,
  user_id uuid NOT NULL,
  invited_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  code_hash text NOT NULL,
  CONSTRAINT center_members_pkey PRIMARY KEY (membership_id),
  CONSTRAINT center_members_unq UNIQUE (center_id, user_id),
  CONSTRAINT center_members_center_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT center_members_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- Exchange codes table
CREATE TABLE public.exchange_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL,
  passcode_hash text NOT NULL,
  center_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
  CONSTRAINT exchange_codes_pkey PRIMARY KEY (id),
  CONSTRAINT exchange_codes_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id)
);

-- Modules table
CREATE TABLE public.modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid,
  module_type text,
  heading text,
  subheading text,
  instruction text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  center_id uuid NOT NULL,
  view_option public.module_view_enum NOT NULL DEFAULT 'private'::module_view_enum,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id),
  CONSTRAINT modules_module_type_check CHECK (
    module_type = ANY (ARRAY['reading'::text, 'listening'::text, 'writing'::text, 'speaking'::text])
  )
);

-- Papers table
CREATE TABLE public.papers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL,
  title text NOT NULL,
  paper_type text,
  instruction text,
  tests_conducted integer DEFAULT 0,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reading_module_id uuid,
  listening_module_id uuid,
  writing_module_id uuid,
  speaking_module_id uuid,
  CONSTRAINT papers_pkey PRIMARY KEY (id),
  CONSTRAINT papers_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT papers_reading_fk FOREIGN KEY (reading_module_id) REFERENCES public.modules(id),
  CONSTRAINT papers_listening_fk FOREIGN KEY (listening_module_id) REFERENCES public.modules(id),
  CONSTRAINT papers_writing_fk FOREIGN KEY (writing_module_id) REFERENCES public.modules(id),
  CONSTRAINT papers_speaking_fk FOREIGN KEY (speaking_module_id) REFERENCES public.modules(id),
  CONSTRAINT papers_paper_type_check CHECK (
    paper_type = ANY (ARRAY['IELTS'::text, 'OIETC'::text, 'GRE'::text])
  )
);

-- Scheduled tests table
CREATE TABLE public.scheduled_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL,
  paper_id uuid,
  title text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 180,
  status text NOT NULL DEFAULT 'scheduled'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  otp integer,
  attendee integer DEFAULT 0,
  ended_at timestamp with time zone,
  CONSTRAINT scheduled_tests_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_tests_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT scheduled_tests_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE SET NULL,
  CONSTRAINT scheduled_tests_status_check CHECK (
    status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])
  )
);

-- Mock attempts table
CREATE TABLE public.mock_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  paper_id uuid,
  attempt_type text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'::text,
  overall_band_score numeric(3,1),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  scheduled_test_id uuid,
  CONSTRAINT mock_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT mock_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.student_profiles(student_id) ON DELETE CASCADE,
  CONSTRAINT mock_attempts_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE SET NULL,
  CONSTRAINT mock_attempts_scheduled_test_id_fkey FOREIGN KEY (scheduled_test_id) REFERENCES public.scheduled_tests(id) ON DELETE SET NULL,
  CONSTRAINT mock_attempts_attempt_type_check CHECK (
    attempt_type = ANY (ARRAY['full_mock'::text, 'practice_sprint'::text, 'single_module'::text])
  ),
  CONSTRAINT mock_attempts_status_check CHECK (
    status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'evaluated'::text, 'abandoned'::text])
  )
);

-- Attempt modules table
CREATE TABLE public.attempt_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  module_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  time_spent_seconds integer DEFAULT 0,
  score_obtained double precision DEFAULT 0,
  band_score numeric(3,1),
  feedback text,
  created_at timestamp with time zone DEFAULT now(),
  time_remaining_seconds integer DEFAULT 0,
  module_type text,
  CONSTRAINT attempt_modules_pkey PRIMARY KEY (id),
  CONSTRAINT unique_module_per_attempt UNIQUE (attempt_id, module_id),
  CONSTRAINT attempt_modules_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.mock_attempts(id) ON DELETE CASCADE,
  CONSTRAINT attempt_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE,
  CONSTRAINT attempt_modules_status_check CHECK (
    status = ANY (ARRAY['locked'::text, 'pending'::text, 'in_progress'::text, 'completed'::text, 'timeout'::text])
  )
);

-- Sections table
CREATE TABLE public.sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid,
  title text,
  section_index integer,
  content_type text,
  resource_url text,
  content_text text,
  instruction text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  params jsonb DEFAULT '{}'::jsonb,
  subtext text,
  CONSTRAINT sections_pkey PRIMARY KEY (id),
  CONSTRAINT sections_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE,
  CONSTRAINT sections_content_type_check CHECK (
    content_type = ANY (ARRAY['text'::text, 'audio'::text, 'image'::text])
  )
);

-- Sub sections table
CREATE TABLE public.sub_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid,
  boundary_text text,
  sub_type text,
  content_template text NOT NULL,
  resource_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sub_section_index integer NOT NULL DEFAULT 0,
  instruction text,
  CONSTRAINT sub_sections_pkey PRIMARY KEY (id),
  CONSTRAINT sub_sections_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE
);

-- Question answers table
CREATE TABLE public.question_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sub_section_id uuid,
  question_ref text NOT NULL,
  correct_answers jsonb,
  options jsonb,
  explanation text,
  marks double precision DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_answers_pkey PRIMARY KEY (id),
  CONSTRAINT question_answers_sub_section_id_fkey FOREIGN KEY (sub_section_id) REFERENCES public.sub_sections(id) ON DELETE CASCADE
);

-- Student answers table
CREATE TABLE public.student_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_module_id uuid NOT NULL,
  reference_id uuid NOT NULL,
  question_ref text NOT NULL,
  student_response text,
  is_correct boolean,
  marks_awarded double precision DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_answers_pkey PRIMARY KEY (id),
  CONSTRAINT unique_answer_per_module_attempt UNIQUE (attempt_module_id, reference_id, question_ref),
  CONSTRAINT student_answers_attempt_module_id_fkey FOREIGN KEY (attempt_module_id) REFERENCES public.attempt_modules(id) ON DELETE CASCADE
);

-- Center usage table
CREATE TABLE public.center_usage (
  center_id uuid NOT NULL,
  student_count integer DEFAULT 0,
  module_count integer DEFAULT 0,
  mock_attempt_count integer DEFAULT 0,
  last_calculated_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT center_usage_pkey PRIMARY KEY (center_id),
  CONSTRAINT center_usage_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE
);

-- Support requests table
CREATE TABLE public.support_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  center_id uuid NOT NULL,
  center_name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_requests_pkey PRIMARY KEY (id),
  CONSTRAINT support_requests_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id),
  CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- Waitlist table
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  phone varchar,
  email varchar NOT NULL,
  centre_name varchar,
  location varchar,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_papers_center_id ON public.papers(center_id);
CREATE INDEX IF NOT EXISTS idx_modules_paper_id ON public.modules(paper_id);
CREATE INDEX IF NOT EXISTS idx_sections_module_id ON public.sections(module_id);
CREATE INDEX IF NOT EXISTS idx_sub_sections_section_id ON public.sub_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_sub_sections_section_idx ON public.sub_sections(section_id, sub_section_index);
CREATE INDEX IF NOT EXISTS idx_question_answers_sub_section_id ON public.question_answers(sub_section_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_center_id ON public.scheduled_tests(center_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_paper_id ON public.scheduled_tests(paper_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_status ON public.scheduled_tests(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_scheduled_at ON public.scheduled_tests(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_active_expiration ON public.scheduled_tests(ended_at) WHERE status = 'in_progress'::text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_otp ON public.scheduled_tests(otp) WHERE status = ANY (ARRAY['scheduled'::text, 'in_progress'::text]);
CREATE INDEX IF NOT EXISTS idx_attempts_student_type ON public.mock_attempts(student_id, attempt_type);
CREATE INDEX IF NOT EXISTS idx_answers_module ON public.student_answers(attempt_module_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- Function: Update student profiles updated_at
CREATE OR REPLACE FUNCTION public.update_student_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- Function: Handle new user registration (trigger on auth.users)
-- CRITICAL: Creates profiles during auth registration, executes with auth.uid() = NULL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  declared_role text;
  v_name text;
BEGIN
  -- Extract metadata
  declared_role := new.raw_user_meta_data->>'role';
  v_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- STAFF LOGIC: If role matches staff types
  IF declared_role IN ('admin', 'owner', 'examiner') THEN
    INSERT INTO public.users (
      user_id, email, full_name, role, is_active
    ) VALUES (
      new.id, new.email, v_name, declared_role::public.user_role_enum, true
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      is_active = true;

  -- STUDENT LOGIC: Default for everyone else
  ELSE
    INSERT INTO public.student_profiles (
      student_id, email, name, center_id, guardian, enrollment_type, status
    ) VALUES (
      new.id, new.email, v_name, NULL, 'PENDING', 'regular', 'active'
    )
    ON CONFLICT (student_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name;
  END IF;

  RETURN new;

EXCEPTION 
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error for user %: % %', new.email, SQLERRM, SQLSTATE;
    RETURN new;
END;
$function$;

-- Function: Delete storage object
CREATE OR REPLACE FUNCTION public.delete_storage_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  bucket_name text;
  file_path text;
BEGIN
  IF OLD.resource_url IS NOT NULL AND OLD.resource_url ~ '^https://[^/]+/storage/v1/object/public/([^/]+)/(.+)$' THEN
    bucket_name := (regexp_matches(OLD.resource_url, '^https://[^/]+/storage/v1/object/public/([^/]+)/(.+)$'))[1];
    file_path := (regexp_matches(OLD.resource_url, '^https://[^/]+/storage/v1/object/public/([^/]+)/(.+)$'))[2];
    
    PERFORM storage.delete_object(bucket_name, file_path);
  END IF;
  
  RETURN OLD;
END;
$function$;

-- Function: Handle test end time calculation
CREATE OR REPLACE FUNCTION public.handle_test_end_time()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.ended_at := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval;
  RETURN NEW;
END;
$function$;

-- Function: Increment scheduled test attendee count
CREATE OR REPLACE FUNCTION public.trg_increment_scheduled_test_attendee()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.scheduled_test_id IS NOT NULL THEN
    UPDATE public.scheduled_tests
    SET attendee = attendee + 1
    WHERE id = NEW.scheduled_test_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Function: Sync student test statistics
CREATE OR REPLACE FUNCTION public.sync_student_test_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.student_profiles
    SET tests_taken = tests_taken + 1
    WHERE student_id = NEW.student_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.student_profiles
    SET tests_taken = GREATEST(tests_taken - 1, 0)
    WHERE student_id = OLD.student_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.student_id IS DISTINCT FROM NEW.student_id THEN
    UPDATE public.student_profiles
    SET tests_taken = GREATEST(tests_taken - 1, 0)
    WHERE student_id = OLD.student_id;
    
    UPDATE public.student_profiles
    SET tests_taken = tests_taken + 1
    WHERE student_id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function: Update center usage statistics
CREATE OR REPLACE FUNCTION public.fn_update_center_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_center_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'student_profiles' THEN
    target_center_id := COALESCE(NEW.center_id, OLD.center_id);
  ELSIF TG_TABLE_NAME = 'modules' THEN
    target_center_id := COALESCE(NEW.center_id, OLD.center_id);
  ELSIF TG_TABLE_NAME = 'mock_attempts' THEN
    SELECT center_id INTO target_center_id
    FROM student_profiles
    WHERE student_id = COALESCE(NEW.student_id, OLD.student_id);
  END IF;

  IF target_center_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO center_usage (center_id, student_count, module_count, mock_attempt_count)
  VALUES (target_center_id, 0, 0, 0)
  ON CONFLICT (center_id) DO NOTHING;

  IF TG_TABLE_NAME = 'student_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE center_usage SET student_count = student_count + 1 WHERE center_id = target_center_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE center_usage SET student_count = GREATEST(student_count - 1, 0) WHERE center_id = target_center_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'modules' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE center_usage SET module_count = module_count + 1 WHERE center_id = target_center_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE center_usage SET module_count = GREATEST(module_count - 1, 0) WHERE center_id = target_center_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'mock_attempts' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE center_usage SET mock_attempt_count = mock_attempt_count + 1 WHERE center_id = target_center_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE center_usage SET mock_attempt_count = GREATEST(mock_attempt_count - 1, 0) WHERE center_id = target_center_id;
    END IF;
  END IF;

  UPDATE center_usage SET updated_at = now(), last_calculated_at = now() WHERE center_id = target_center_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Function: Check paper module types
CREATE OR REPLACE FUNCTION public.check_paper_module_types()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.reading_module_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM modules WHERE id = NEW.reading_module_id AND module_type = 'reading') THEN
      RAISE EXCEPTION 'reading_module_id must reference a module with type reading';
    END IF;
  END IF;

  IF NEW.listening_module_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM modules WHERE id = NEW.listening_module_id AND module_type = 'listening') THEN
      RAISE EXCEPTION 'listening_module_id must reference a module with type listening';
    END IF;
  END IF;

  IF NEW.writing_module_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM modules WHERE id = NEW.writing_module_id AND module_type = 'writing') THEN
      RAISE EXCEPTION 'writing_module_id must reference a module with type writing';
    END IF;
  END IF;

  IF NEW.speaking_module_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM modules WHERE id = NEW.speaking_module_id AND module_type = 'speaking') THEN
      RAISE EXCEPTION 'speaking_module_id must reference a module with type speaking';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Function: Set attempt module type
CREATE OR REPLACE FUNCTION public.set_attempt_module_type()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  SELECT module_type INTO NEW.module_type
  FROM modules
  WHERE id = NEW.module_id;
  
  RETURN NEW;
END;
$function$;

-- Function: Handle verification timestamp
CREATE OR REPLACE FUNCTION public.handle_verification_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM NEW.status)) THEN
    NEW.verified_at = CURRENT_TIMESTAMP;
  ELSIF (NEW.status != 'verified') THEN
    NEW.verified_at = NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Function: Auto complete scheduled tests
CREATE OR REPLACE FUNCTION public.auto_complete_scheduled_tests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.scheduled_tests
  SET 
    status = 'completed',
    updated_at = now()
  WHERE status = 'in_progress'
    AND ended_at <= now();
END;
$function$;

-- Function: Batch update grades
CREATE OR REPLACE FUNCTION public.batch_update_grades(p_module_id uuid, p_answers jsonb, p_feedback text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_answer JSONB;
  v_total_score NUMERIC := 0;
  v_band_score NUMERIC(3,1);
  v_module_type TEXT;
  v_total_questions INTEGER := 0;
BEGIN
  SELECT am.module_type, COUNT(sa.id)
  INTO v_module_type, v_total_questions
  FROM attempt_modules am
  LEFT JOIN student_answers sa ON sa.attempt_module_id = am.id
  WHERE am.id = p_module_id
  GROUP BY am.module_type;

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    UPDATE student_answers
    SET 
      is_correct = (v_answer->>'is_correct')::boolean,
      marks_awarded = (v_answer->>'marks_awarded')::numeric
    WHERE id = (v_answer->>'id')::uuid;
  END LOOP;

  SELECT COALESCE(SUM(marks_awarded), 0)
  INTO v_total_score
  FROM student_answers
  WHERE attempt_module_id = p_module_id;

  IF v_module_type = 'listening' OR v_module_type = 'reading' THEN
    v_band_score := CASE
      WHEN v_total_score >= 39 THEN 9.0
      WHEN v_total_score >= 37 THEN 8.5
      WHEN v_total_score >= 35 THEN 8.0
      WHEN v_total_score >= 32 THEN 7.5
      WHEN v_total_score >= 30 THEN 7.0
      WHEN v_total_score >= 26 THEN 6.5
      WHEN v_total_score >= 23 THEN 6.0
      WHEN v_total_score >= 18 THEN 5.5
      WHEN v_total_score >= 16 THEN 5.0
      WHEN v_total_score >= 13 THEN 4.5
      WHEN v_total_score >= 10 THEN 4.0
      ELSE 3.5
    END;
  ELSIF v_module_type = 'writing' THEN
    v_band_score := ROUND((v_total_score / v_total_questions)::numeric, 1);
    IF v_band_score > 9.0 THEN v_band_score := 9.0; END IF;
  ELSE
    v_band_score := ROUND((v_total_score / v_total_questions * 9.0)::numeric, 1);
  END IF;

  UPDATE attempt_modules
  SET 
    score_obtained = v_total_score,
    band_score = v_band_score,
    feedback = COALESCE(p_feedback, feedback),
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_module_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_score', v_total_score,
    'band_score', v_band_score,
    'updated_count', jsonb_array_length(p_answers)
  );
END;
$function$;

-- Function: Commit grading results (atomic transaction)
CREATE OR REPLACE FUNCTION public.commit_grading_results(p_attempt_module_id uuid, p_total_score numeric, p_band_score numeric, p_time_spent integer, p_time_remaining integer, p_status text, p_answers grading_result_item[], p_previous_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_rows_affected int;
  v_attempt_id uuid;
  v_module_type text;
begin
  select attempt_id, modules.module_type
  into v_attempt_id, v_module_type
  from attempt_modules
  join modules on modules.id = attempt_modules.module_id
  where attempt_modules.id = p_attempt_module_id
    and attempt_modules.status = p_previous_status;
  
  if not found then
    raise exception 'CONCURRENT_MODIFICATION: Module status changed or not found';
  end if;

  update student_answers as sa
  set 
    is_correct = ar.is_correct,
    marks_awarded = ar.marks_awarded
  from unnest(p_answers) as ar(answer_id, is_correct, marks_awarded)
  where sa.id = ar.answer_id
    and sa.attempt_module_id = p_attempt_module_id;
  
  get diagnostics v_rows_affected = row_count;

  update attempt_modules
  set 
    score_obtained = p_total_score,
    band_score = p_band_score,
    time_spent_seconds = p_time_spent,
    time_remaining_seconds = p_time_remaining,
    status = p_status,
    completed_at = now()
  where id = p_attempt_module_id
    and status = p_previous_status;
  
  if not found then
    raise exception 'CONCURRENT_MODIFICATION: Module already graded by another request';
  end if;

  return jsonb_build_object(
    'success', true,
    'answers_updated', v_rows_affected,
    'attempt_id', v_attempt_id,
    'module_type', v_module_type
  );

exception
  when others then
    raise exception 'GRADING_FAILED: %', sqlerrm;
end;
$function$;

-- Function: Generate unique test OTP
CREATE OR REPLACE FUNCTION public.generate_unique_test_otp(target_test_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_otp integer;
  result_otp integer;
BEGIN
  LOOP
    new_otp := floor(100000 + random() * 900000)::integer;

    BEGIN
      UPDATE public.scheduled_tests
      SET otp = new_otp
      WHERE id = target_test_id
      RETURNING otp INTO result_otp;

      IF FOUND THEN
        RETURN json_build_object('success', true, 'otp', result_otp);
      ELSE
        RETURN json_build_object('success', false, 'error', 'Test ID not found');
      END IF;
      
      EXIT; 
      
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
END;
$function$;

-- Function: Get attempt flow status
CREATE OR REPLACE FUNCTION public.get_attempt_flow_status(p_attempt_id uuid, p_current_module_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_total_modules int;
  v_completed_modules int;
  v_next_module_type text;
  v_attempt_completed boolean;
  v_overall_band numeric;
begin
  select 
    count(*),
    count(*) filter (where status = 'completed')
  into v_total_modules, v_completed_modules
  from attempt_modules
  where attempt_id = p_attempt_id;

  v_attempt_completed := (v_total_modules = v_completed_modules);

  if p_current_module_type = 'listening' then
    v_next_module_type := 'reading';
  elsif p_current_module_type = 'reading' then
    v_next_module_type := 'writing';
  else
    v_next_module_type := null;
  end if;

  if v_next_module_type is not null then
    perform 1
    from attempt_modules am
    join modules m on m.id = am.module_id
    where am.attempt_id = p_attempt_id
      and m.module_type = v_next_module_type
      and am.status != 'completed';
    
    if not found then
      v_next_module_type := null;
    end if;
  end if;

  if v_attempt_completed then
    select round(avg(band_score), 1)
    into v_overall_band
    from attempt_modules
    where attempt_id = p_attempt_id
      and band_score is not null;

    update mock_attempts
    set 
      status = 'completed',
      completed_at = now(),
      overall_band_score = v_overall_band
    where id = p_attempt_id
      and status != 'completed';
  end if;

  return jsonb_build_object(
    'attempt_completed', v_attempt_completed,
    'next_module_type', v_next_module_type,
    'overall_band_score', v_overall_band,
    'completed_modules', v_completed_modules,
    'total_modules', v_total_modules
  );
end;
$function$;

-- Function: Get center modules v2 (deep nested query)
CREATE OR REPLACE FUNCTION public.get_center_modules_v2(p_center_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_data jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM public.centers 
    WHERE center_id = p_center_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this center.';
  END IF;

  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'module_id', m.id,
          'module_type', m.module_type,
          'title', m.heading,
          'paper_id', m.paper_id,
          'created_at', m.created_at,
          'sections', COALESCE(
            (
              SELECT jsonb_agg(
                to_jsonb(s) || jsonb_build_object(
                  'sub_sections', COALESCE(
                    (
                      SELECT jsonb_agg(
                        to_jsonb(ss) || jsonb_build_object(
                          'questions', COALESCE(
                            (
                              SELECT jsonb_agg(to_jsonb(qa) ORDER BY qa.created_at)
                              FROM public.question_answers qa
                              WHERE qa.sub_section_id = ss.id
                            ), 
                            '[]'::jsonb
                          )
                        ) ORDER BY ss.sub_section_index ASC
                      )
                      FROM public.sub_sections ss
                      WHERE ss.section_id = s.id
                    ), 
                    '[]'::jsonb
                  )
                ) ORDER BY s.section_index ASC
              )
              FROM public.sections s
              WHERE s.module_id = m.id
            ), 
            '[]'::jsonb
          )
        ) ORDER BY m.created_at DESC
      ),
      '[]'::jsonb
    )
  INTO result_data
  FROM public.modules m
  WHERE m.center_id = p_center_id;

  RETURN result_data;
END;
$function$;

-- Function: Get center reviews
CREATE OR REPLACE FUNCTION public.get_center_reviews(p_center_id uuid, p_module_type text DEFAULT NULL::text)
RETURNS TABLE(answer_id uuid, attempt_module_id uuid, reference_id uuid, question_ref text, student_response text, is_correct boolean, marks_awarded double precision, answer_created_at timestamp with time zone, am_id uuid, am_attempt_id uuid, am_module_id uuid, am_status text, am_score_obtained double precision, am_band_score numeric, am_time_spent_seconds integer, am_completed_at timestamp with time zone, am_feedback text, am_module_type text, module_id uuid, module_type text, module_heading text, module_paper_id uuid, attempt_id uuid, attempt_student_id uuid, attempt_status text, attempt_created_at timestamp with time zone, attempt_completed_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sa.id AS answer_id,
    sa.attempt_module_id,
    sa.reference_id,
    sa.question_ref,
    sa.student_response,
    sa.is_correct,
    sa.marks_awarded,
    sa.created_at AS answer_created_at,
    
    am.id AS am_id,
    am.attempt_id AS am_attempt_id,
    am.module_id AS am_module_id,
    am.status AS am_status,
    am.score_obtained AS am_score_obtained,
    am.band_score AS am_band_score,
    am.time_spent_seconds AS am_time_spent_seconds,
    am.completed_at AS am_completed_at,
    am.feedback AS am_feedback,
    am.module_type AS am_module_type,
    
    m.id AS module_id,
    m.module_type,
    m.heading AS module_heading,
    m.paper_id AS module_paper_id,
    
    ma.id AS attempt_id,
    ma.student_id AS attempt_student_id,
    ma.status AS attempt_status,
    ma.created_at AS attempt_created_at,
    ma.completed_at AS attempt_completed_at
    
  FROM student_answers sa
  INNER JOIN attempt_modules am ON sa.attempt_module_id = am.id
  INNER JOIN modules m ON am.module_id = m.id
  INNER JOIN mock_attempts ma ON am.attempt_id = ma.id
  WHERE 
    m.center_id = p_center_id
    AND (p_module_type IS NULL OR m.module_type = p_module_type)
  ORDER BY sa.created_at DESC;
END;
$function$;

-- Function: Get module hierarchy
CREATE OR REPLACE FUNCTION public.get_module_hierarchy(target_module_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_center_id uuid;
  result_data jsonb;
BEGIN
  SELECT m.center_id INTO v_center_id
  FROM public.modules m
  JOIN public.centers c ON m.center_id = c.center_id
  WHERE m.id = target_module_id
  AND c.user_id = auth.uid();

  IF v_center_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Module not found or you do not have permission to view it.';
  END IF;

  SELECT 
    to_jsonb(m) || jsonb_build_object(
      'sections', COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(s) || jsonb_build_object(
              'sub_sections', COALESCE(
                (
                  SELECT jsonb_agg(
                    to_jsonb(ss) || jsonb_build_object(
                      'questions', COALESCE(
                        (
                          SELECT jsonb_agg(to_jsonb(qa) ORDER BY qa.created_at)
                          FROM public.question_answers qa
                          WHERE qa.sub_section_id = ss.id
                        ), 
                        '[]'::jsonb
                      )
                    ) ORDER BY ss.sub_section_index ASC
                  )
                  FROM public.sub_sections ss
                  WHERE ss.section_id = s.id
                ), 
                '[]'::jsonb
              )
            ) ORDER BY s.section_index ASC
          )
          FROM public.sections s
          WHERE s.module_id = m.id
        ), 
        '[]'::jsonb
      )
    )
  INTO result_data
  FROM public.modules m
  WHERE m.id = target_module_id;

  RETURN result_data;
END;
$function$;

-- Function: Get student test scores
CREATE OR REPLACE FUNCTION public.get_student_test_scores(p_student_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_student_id UUID;
  v_result JSON;
BEGIN
  SELECT student_id INTO v_student_id
  FROM student_profiles
  WHERE email = p_student_email AND status = 'active';
  
  IF v_student_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Student profile not found'
    );
  END IF;
  
  WITH recent_attempts AS (
    SELECT 
      ma.id AS attempt_id,
      ma.overall_band_score,
      ma.completed_at,
      ma.started_at,
      st.title AS test_title,
      ROW_NUMBER() OVER (ORDER BY ma.completed_at DESC NULLS LAST, ma.started_at DESC) AS rank
    FROM mock_attempts ma
    LEFT JOIN scheduled_tests st ON st.id = ma.scheduled_test_id
    WHERE ma.student_id = v_student_id
      AND ma.status = 'completed'
    ORDER BY ma.completed_at DESC NULLS LAST, ma.started_at DESC
    LIMIT 10
  ),
  module_scores AS (
    SELECT 
      ra.attempt_id,
      ra.overall_band_score,
      ra.completed_at,
      ra.started_at,
      ra.test_title,
      ra.rank,
      MAX(CASE WHEN am.module_type = 'listening' THEN am.band_score END) AS listening_score,
      MAX(CASE WHEN am.module_type = 'reading' THEN am.band_score END) AS reading_score,
      MAX(CASE WHEN am.module_type = 'writing' THEN am.band_score END) AS writing_score,
      MAX(CASE WHEN am.module_type = 'speaking' THEN am.band_score END) AS speaking_score
    FROM recent_attempts ra
    LEFT JOIN attempt_modules am ON am.attempt_id = ra.attempt_id 
      AND am.status = 'completed'
    GROUP BY ra.attempt_id, ra.overall_band_score, ra.completed_at, ra.started_at, ra.test_title, ra.rank
  )
  SELECT json_build_object(
    'success', true,
    'student_id', v_student_id,
    'tests', (
      SELECT json_agg(
        json_build_object(
          'attempt_id', ms.attempt_id,
          'test_number', ms.rank,
          'test_title', COALESCE(ms.test_title, 'IELTS Mock Test'),
          'overall_score', COALESCE(ms.overall_band_score, 0),
          'completed_at', ms.completed_at,
          'started_at', ms.started_at,
          'modules', json_build_object(
            'listening', COALESCE(ms.listening_score, 0),
            'reading', COALESCE(ms.reading_score, 0),
            'writing', COALESCE(ms.writing_score, 0),
            'speaking', COALESCE(ms.speaking_score, 0)
          )
        ) ORDER BY ms.rank
      )
      FROM module_scores ms
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Function: Join mock test
CREATE OR REPLACE FUNCTION public.join_mock_test(p_otp integer, p_scheduled_test_id uuid, p_user_email text)
RETURNS TABLE(attempt_id uuid, paper_id uuid, join_status text, module_ids jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
#variable_conflict use_variable
DECLARE
  v_student_id UUID;
  v_center_id UUID;
  v_paper_id UUID;
  v_scheduled_at TIMESTAMPTZ;
  v_actual_otp INTEGER;
  v_test_status TEXT;
  v_attempt_id UUID;
  v_modules_json JSONB;
BEGIN
  SELECT t.paper_id, t.scheduled_at, t.otp, t.status, t.center_id
  INTO v_paper_id, v_scheduled_at, v_actual_otp, v_test_status, v_center_id
  FROM scheduled_tests t
  WHERE t.id = p_scheduled_test_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Test not found.'; END IF;

  IF v_test_status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'Test is not currently active (Status: %).', v_test_status;
  END IF;

  IF v_actual_otp IS DISTINCT FROM p_otp THEN
    RAISE EXCEPTION 'Invalid OTP provided.';
  END IF;

  IF now() > (v_scheduled_at + interval '30 minutes') THEN
    RAISE EXCEPTION 'Entry denied: The 30-minute entry window has closed.';
  END IF;

  SELECT sp.student_id INTO v_student_id
  FROM student_profiles sp
  WHERE sp.email = p_user_email 
    AND sp.center_id = v_center_id
    AND sp.status = 'active';

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Student email not found in this center.';
  END IF;

  SELECT ma.id INTO v_attempt_id
  FROM mock_attempts ma
  WHERE ma.student_id = v_student_id 
    AND ma.scheduled_test_id = p_scheduled_test_id;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: You are not registered for this test.';
  END IF;

  INSERT INTO attempt_modules (attempt_id, module_id, status)
  SELECT 
    v_attempt_id,
    m.id,
    'pending'
  FROM papers p
  CROSS JOIN LATERAL (
    SELECT p.listening_module_id AS id WHERE p.listening_module_id IS NOT NULL
    UNION ALL
    SELECT p.reading_module_id WHERE p.reading_module_id IS NOT NULL
    UNION ALL
    SELECT p.writing_module_id WHERE p.writing_module_id IS NOT NULL
    UNION ALL
    SELECT p.speaking_module_id WHERE p.speaking_module_id IS NOT NULL
  ) AS m
  WHERE p.id = v_paper_id
    AND NOT EXISTS (
      SELECT 1 FROM attempt_modules existing
      WHERE existing.attempt_id = v_attempt_id
        AND existing.module_id = m.id
    );

  SELECT jsonb_agg(
    jsonb_build_object(
      'module_id', am.module_id,
      'module_type', am.module_type,
      'status', am.status
    ) ORDER BY
      CASE am.module_type
        WHEN 'listening' THEN 1
        WHEN 'reading' THEN 2
        WHEN 'writing' THEN 3
        WHEN 'speaking' THEN 4
      END
  ) INTO v_modules_json
  FROM attempt_modules am
  WHERE am.attempt_id = v_attempt_id;

  RETURN QUERY SELECT 
    v_attempt_id, 
    v_paper_id, 
    'joined'::TEXT, 
    COALESCE(v_modules_json, '[]'::jsonb);

END;
$function$;

-- Function: Load paper with modules
CREATE OR REPLACE FUNCTION public.load_paper_with_modules(p_paper_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_paper RECORD;
  v_modules JSON;
  v_result JSON;
BEGIN
  SELECT * INTO v_paper
  FROM papers
  WHERE id = p_paper_id;
  
  IF v_paper IS NULL THEN
    RAISE EXCEPTION 'Paper not found';
  END IF;
  
  WITH module_data AS (
    SELECT 
      m.id as module_id,
      m.module_type,
      m.heading,
      m.subheading,
      m.instruction,
      m.center_id,
      m.view_option,
      m.created_at,
      m.updated_at,
      m.paper_id,
      (
        SELECT json_agg(
          json_build_object(
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
              SELECT json_agg(
                json_build_object(
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
                    SELECT json_agg(
                      json_build_object(
                        'id', qa.id,
                        'question_ref', qa.question_ref,
                        'correct_answers', qa.correct_answers,
                        'options', qa.options,
                        'explanation', qa.explanation,
                        'marks', qa.marks,
                        'created_at', qa.created_at,
                        'updated_at', qa.updated_at
                      ) ORDER BY qa.question_ref
                    )
                    FROM question_answers qa
                    WHERE qa.sub_section_id = ss.id
                  )
                ) ORDER BY ss.sub_section_index
              )
              FROM sub_sections ss
              WHERE ss.section_id = s.id
            )
          ) ORDER BY s.section_index
        )
        FROM sections s
        WHERE s.module_id = m.id
      ) as sections
    FROM modules m
    WHERE m.id IN (v_paper.listening_module_id, v_paper.reading_module_id, v_paper.writing_module_id, v_paper.speaking_module_id)
  )
  SELECT json_object_agg(
    md.module_type,
    json_build_object(
      'id', md.module_id,
      'paper_id', md.paper_id,
      'module_type', md.module_type,
      'heading', md.heading,
      'subheading', md.subheading,
      'instruction', md.instruction,
      'center_id', md.center_id,
      'view_option', md.view_option,
      'created_at', md.created_at,
      'updated_at', md.updated_at,
      'sections', md.sections
    )
  ) INTO v_modules
  FROM module_data md;
  
  SELECT json_build_object(
    'paper', json_build_object(
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
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Function: Upsert student answers
CREATE OR REPLACE FUNCTION public.upsert_student_answers(p_attempt_module_id uuid, p_answers jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_inserted int := 0;
begin
  insert into student_answers (
    attempt_module_id,
    reference_id,
    question_ref,
    student_response
  )
  select 
    p_attempt_module_id,
    (ans->>'reference_id')::uuid,
    ans->>'question_ref',
    ans->>'student_response'
  from jsonb_array_elements(p_answers) as ans
  on conflict (attempt_module_id, reference_id, question_ref)
  do update set
    student_response = excluded.student_response;
  
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;

-- Function: Validate per module access
CREATE OR REPLACE FUNCTION public.validate_per_module_access(p_attempt_id uuid, p_module_type text, p_student_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_student_id UUID;
  v_attempt_module RECORD;
  v_result JSON;
BEGIN
  SELECT student_id INTO v_student_id
  FROM student_profiles
  WHERE email = p_student_email AND status = 'active';
  
  IF v_student_id IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Student profile not found',
      'error_code', 'STUDENT_NOT_FOUND'
    );
  END IF;
  
  IF NOT EXISTS(
    SELECT 1 FROM mock_attempts 
    WHERE id = p_attempt_id AND student_id = v_student_id
  ) THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Access denied to this attempt',
      'error_code', 'UNAUTHORIZED'
    );
  END IF;
  
  SELECT 
    am.id,
    am.module_id,
    am.status,
    am.started_at,
    am.completed_at,
    am.time_remaining_seconds
  INTO v_attempt_module
  FROM attempt_modules am
  WHERE am.attempt_id = p_attempt_id 
  AND am.module_type = p_module_type;
  
  IF v_attempt_module IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Module not found for this attempt',
      'error_code', 'MODULE_NOT_FOUND'
    );
  END IF;
  
  IF v_attempt_module.status = 'completed' THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'This module has already been completed',
      'error_code', 'MODULE_COMPLETED',
      'module_status', v_attempt_module.status,
      'completed_at', v_attempt_module.completed_at
    );
  END IF;
  
  RETURN json_build_object(
    'allowed', true,
    'attempt_module_id', v_attempt_module.id,
    'module_status', v_attempt_module.status,
    'started_at', v_attempt_module.started_at,
    'time_remaining_seconds', COALESCE(v_attempt_module.time_remaining_seconds, 0)
  );
END;
$function$;

-- Function: Validate test access
CREATE OR REPLACE FUNCTION public.validate_test_access(p_user_email text, p_scheduled_test_id uuid)
RETURNS TABLE(has_access boolean, center_name text, test_title text, scheduled_at timestamp with time zone, duration_minutes integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (EXISTS (
        SELECT 1 
        FROM student_profiles sp 
        WHERE sp.email = p_user_email 
        AND sp.center_id = st.center_id
    )) as has_access,
    c.name as center_name,
    st.title as test_title,
    st.scheduled_at,
    st.duration_minutes,
    st.status
  FROM scheduled_tests st
  JOIN centers c ON c.center_id = st.center_id
  WHERE st.id = p_scheduled_test_id;
END;
$function$;

-- Function: Verify and join center
CREATE OR REPLACE FUNCTION public.verify_and_join_center(p_passcode_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_email    text;
  v_code     exchange_codes%ROWTYPE;
  v_slug     text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_code
  FROM exchange_codes
  WHERE email        = v_email
    AND passcode_hash = p_passcode_hash
    AND expires_at   > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired passcode');
  END IF;

  INSERT INTO public.users (user_id, email, full_name, role, is_active)
  VALUES (
    v_user_id,
    v_email,
    coalesce((SELECT full_name FROM public.users WHERE user_id = v_user_id), split_part(v_email, '@', 1)),
    v_code.role::public.user_role_enum,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role      = EXCLUDED.role,
    is_active = true;

  INSERT INTO center_members (center_id, user_id, code_hash)
  VALUES (v_code.center_id, v_user_id, p_passcode_hash)
  ON CONFLICT (center_id, user_id) DO NOTHING;

  DELETE FROM exchange_codes WHERE id = v_code.id;

  SELECT slug INTO v_slug FROM centers WHERE center_id = v_code.center_id;

  RETURN json_build_object('success', true, 'center_slug', v_slug);
END;
$function$;

-- Function: Verify student attempt access
CREATE OR REPLACE FUNCTION public.verify_student_attempt_access(p_student_id uuid, p_mock_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Triggers on auth.users (from auth schema)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Triggers on public tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at
  BEFORE UPDATE ON public.centers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_update_verification_time
  BEFORE UPDATE ON public.centers
  FOR EACH ROW
  EXECUTE FUNCTION handle_verification_timestamp();

CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_student_profiles_updated_at();

CREATE TRIGGER trg_usage_students
  AFTER INSERT OR DELETE ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_center_usage();

CREATE TRIGGER validate_paper_modules
  BEFORE INSERT OR UPDATE ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION check_paper_module_types();

CREATE TRIGGER trg_calculate_ended_at
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes ON public.scheduled_tests
  FOR EACH ROW
  EXECUTE FUNCTION handle_test_end_time();

CREATE TRIGGER trg_mock_attempts_increment_attendee
  AFTER INSERT ON public.mock_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trg_increment_scheduled_test_attendee();

CREATE TRIGGER trg_mock_attempts_sync_profiles
  AFTER INSERT OR DELETE OR UPDATE OF status, student_id ON public.mock_attempts
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_test_stats();

CREATE TRIGGER trg_usage_attempts
  AFTER INSERT OR DELETE ON public.mock_attempts
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_center_usage();

CREATE TRIGGER trg_usage_modules
  AFTER INSERT OR DELETE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_center_usage();

CREATE TRIGGER trg_set_module_type
  BEFORE INSERT OR UPDATE ON public.attempt_modules
  FOR EACH ROW
  EXECUTE FUNCTION set_attempt_module_type();

CREATE TRIGGER trg_delete_section_file
  AFTER DELETE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_object();

CREATE TRIGGER trg_delete_subsection_file
  AFTER DELETE ON public.sub_sections
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_object();

CREATE TRIGGER update_support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Student profiles policies (CRITICAL: Allow trigger inserts with auth.uid() IS NULL)
CREATE POLICY "student_profiles_insert_policy"  
ON public.student_profiles
FOR INSERT
WITH CHECK (
    auth.uid() IS NULL  -- Allow trigger to create profiles during registration
    OR center_id IS NULL  -- Allow registration without center
    OR EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = student_profiles.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "student_profiles_update_policy"
ON public.student_profiles
FOR UPDATE
USING (
    auth.uid() IS NULL  -- Allow trigger updates
    OR center_id IS NULL
    OR EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = student_profiles.center_id
        AND centers.user_id = auth.uid()
    )
)
WITH CHECK (
    auth.uid() IS NULL
    OR center_id IS NULL
    OR EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = student_profiles.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "public read student profiles"
ON public.student_profiles
FOR SELECT
TO public
USING (true);

CREATE POLICY "Owners can view their students"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = student_profiles.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "Owners can delete their students"
ON public.student_profiles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = student_profiles.center_id
        AND centers.user_id = auth.uid()
    )
);

-- Centers policies
CREATE POLICY "Centers are viewable by everyone"
ON public.centers
FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can create centers"
ON public.centers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own centers"
ON public.centers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own centers"
ON public.centers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Users policies  
CREATE POLICY "Users are viewable by everyone"
ON public.users
FOR SELECT
TO public
USING (true);

-- Papers policies
CREATE POLICY "Papers are viewable by center owners"
ON public.papers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = papers.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "Center owners can create papers"
ON public.papers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = papers.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "Center owners can update their papers"
ON public.papers
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = papers.center_id
        AND centers.user_id = auth.uid()
    )
);

CREATE POLICY "Center owners can delete their papers"
ON public.papers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM centers
        WHERE centers.center_id = papers.center_id
        AND centers.user_id = auth.uid()
    )
);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon;
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
