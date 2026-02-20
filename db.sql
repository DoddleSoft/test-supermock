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
  IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
    NEW.verified_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
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
