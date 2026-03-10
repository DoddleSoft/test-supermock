-- ============================================================================
-- SuperMock Complete Database Schema
-- Generated from production database (Supabase)
-- Last updated: 2025-06-01
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.company_size AS ENUM ('solo', 'small_2_10', 'medium_11_50', 'large_51_200', 'enterprise_200_plus');
CREATE TYPE public.module_view_enum AS ENUM ('public', 'private');
CREATE TYPE public.scheduled_test_status AS ENUM ('scheduled', 'upcoming', 'live', 'ended');
CREATE TYPE public.student_type_enum AS ENUM ('regular', 'visitor', 'mock_only');
CREATE TYPE public.tier_enum AS ENUM ('free', 'basic', 'pro', 'extended');
CREATE TYPE public.user_role_enum AS ENUM ('admin', 'owner', 'examiner');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Composite type for grading result items
CREATE TYPE public.grading_result_item AS (
  answer_id uuid,
  is_correct boolean,
  marks_awarded numeric
);

-- ============================================================================
-- AGGREGATE FUNCTIONS
-- ============================================================================

CREATE AGGREGATE public.jsonb_merge_agg(jsonb) (
  SFUNC = jsonb_concat,
  STYPE = jsonb
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (for staff: admin, owner, examiner)
CREATE TABLE public.users (
  user_id uuid NOT NULL,
  email text NOT NULL,
  role public.user_role_enum NOT NULL,
  full_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- Centers table
CREATE TABLE public.centers (
  center_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  subscription_tier text DEFAULT 'basic'::text,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  user_id uuid DEFAULT auth.uid(),
  status public.verification_status DEFAULT 'pending'::verification_status,
  verified_at timestamp without time zone,
  CONSTRAINT centers_pkey PRIMARY KEY (center_id),
  CONSTRAINT centers_slug_key UNIQUE (slug),
  CONSTRAINT centers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- Student profiles table
CREATE TABLE public.student_profiles (
  phone text,
  guardian text,
  guardian_phone text,
  date_of_birth date,
  address text,
  enrolled_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'::text),
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  student_id uuid NOT NULL,
  center_id uuid,
  email text,
  name text,
  grade text,
  status text NOT NULL DEFAULT 'active'::text,
  enrollment_type public.student_type_enum NOT NULL DEFAULT 'regular'::student_type_enum,
  visitor_exam_date date,
  tests_taken integer DEFAULT 0,
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

-- Tiers table
CREATE TABLE public.tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_limit_gb integer NOT NULL,
  price_monthly integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tiers_pkey PRIMARY KEY (id),
  CONSTRAINT tiers_name_key UNIQUE (name)
);

-- Center members table
CREATE TABLE public.center_members (
  membership_id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL,
  user_id uuid NOT NULL,
  invited_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT center_members_pkey PRIMARY KEY (membership_id),
  CONSTRAINT center_members_unq UNIQUE (center_id, user_id),
  CONSTRAINT center_members_center_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT center_members_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- Center usage table
CREATE TABLE public.center_usage (
  center_id uuid NOT NULL,
  student_count integer DEFAULT 0,
  module_count integer DEFAULT 0,
  mock_attempt_count integer DEFAULT 0,
  last_calculated_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tier_id uuid,
  tier public.tier_enum,
  CONSTRAINT center_usage_pkey PRIMARY KEY (center_id),
  CONSTRAINT center_usage_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT center_usage_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.tiers(id) ON DELETE SET NULL
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
  CONSTRAINT exchange_codes_email_key UNIQUE (email),
  CONSTRAINT exchange_codes_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE SET NULL
);

-- Modules table
CREATE TABLE public.modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid,
  module_type text,
  heading text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  center_id uuid,
  view_option public.module_view_enum NOT NULL DEFAULT 'private'::module_view_enum,
  subheading text DEFAULT '""'::text,
  instruction text DEFAULT '""'::text,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE SET NULL,
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
  CONSTRAINT support_requests_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(center_id) ON DELETE CASCADE,
  CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
  CONSTRAINT support_requests_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])
  )
);

-- Waitlist table
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  phone varchar(20),
  email varchar(100) NOT NULL,
  centre_name varchar(200),
  location varchar(50),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);

-- Auth user table (synced from auth.users)
CREATE TABLE public.auth_user_table (
  uid uuid NOT NULL,
  display_name text,
  email text,
  CONSTRAINT auth_user_table_pkey PRIMARY KEY (uid)
);

-- Agent waitlist table
CREATE TABLE public.agent_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  company text,
  role text,
  company_size text,
  interest text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ip_address inet,
  user_agent text,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamp with time zone,
  demo_access_granted boolean NOT NULL DEFAULT false,
  demo_access_granted_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT agent_waitlist_email_unique UNIQUE (email),
  CONSTRAINT agent_waitlist_company_size_check CHECK (
    (company_size IS NULL) OR (company_size = ANY (ARRAY['1-10'::text, '11-50'::text, '51-200'::text, '201-1000'::text, '1000+'::text]))
  ),
  CONSTRAINT agent_waitlist_interest_check CHECK (
    (interest IS NULL) OR (interest = ANY (ARRAY['sales'::text, 'support'::text, 'automation'::text, 'custom'::text]))
  )
);

-- Waitlist users table
CREATE TABLE public.waitlist_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  full_name text,
  company_name text,
  company_size public.company_size,
  interest_area text,
  referral_source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email_sent boolean DEFAULT false,
  email_sent_at timestamp with time zone,
  demo_access_granted boolean DEFAULT false,
  demo_access_granted_at timestamp with time zone,
  CONSTRAINT waitlist_users_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_users_email_key UNIQUE (email)
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.available_tests_view AS
SELECT
  st.id,
  st.center_id,
  c.name AS center_name,
  c.slug AS center_slug,
  st.paper_id,
  st.title,
  st.scheduled_at,
  st.duration_minutes,
  st.status,
  st.created_at
FROM scheduled_tests st
JOIN centers c ON st.center_id = c.center_id
WHERE st.status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text]);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Agent waitlist indexes
CREATE INDEX IF NOT EXISTS idx_agent_waitlist_created_at ON public.agent_waitlist USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_waitlist_demo_access ON public.agent_waitlist USING btree (demo_access_granted);
CREATE INDEX IF NOT EXISTS idx_agent_waitlist_email ON public.agent_waitlist USING btree (email);
CREATE INDEX IF NOT EXISTS idx_agent_waitlist_interest ON public.agent_waitlist USING btree (interest);

-- Attempt modules indexes
CREATE INDEX IF NOT EXISTS idx_attempt_modules_module_id ON public.attempt_modules USING btree (module_id);

-- Center members indexes
CREATE INDEX IF NOT EXISTS idx_center_members_user_id ON public.center_members USING btree (user_id);

-- Center usage indexes
CREATE INDEX IF NOT EXISTS idx_center_usage_last_calculated ON public.center_usage USING btree (last_calculated_at);
CREATE INDEX IF NOT EXISTS idx_center_usage_tier_id ON public.center_usage USING btree (tier_id);

-- Centers indexes
CREATE INDEX IF NOT EXISTS idx_centers_user_id ON public.centers USING btree (user_id);

-- Exchange codes indexes
CREATE INDEX IF NOT EXISTS idx_exchange_codes_center_id ON public.exchange_codes USING btree (center_id);
CREATE INDEX IF NOT EXISTS idx_exchange_codes_email ON public.exchange_codes USING btree (email);

-- Mock attempts indexes
CREATE INDEX IF NOT EXISTS idx_attempts_student_type ON public.mock_attempts USING btree (student_id, attempt_type);
CREATE INDEX IF NOT EXISTS idx_mock_attempts_paper_id ON public.mock_attempts USING btree (paper_id);
CREATE INDEX IF NOT EXISTS idx_mock_attempts_scheduled_test_id ON public.mock_attempts USING btree (scheduled_test_id);
CREATE INDEX IF NOT EXISTS idx_mock_attempts_student_id ON public.mock_attempts USING btree (student_id);

-- Modules indexes
CREATE INDEX IF NOT EXISTS idx_modules_center_id ON public.modules USING btree (center_id);
CREATE INDEX IF NOT EXISTS idx_modules_paper_id ON public.modules USING btree (paper_id);

-- Papers indexes
CREATE INDEX IF NOT EXISTS idx_papers_center_id ON public.papers USING btree (center_id);
CREATE INDEX IF NOT EXISTS idx_papers_listening_module_id ON public.papers USING btree (listening_module_id);
CREATE INDEX IF NOT EXISTS idx_papers_reading_module_id ON public.papers USING btree (reading_module_id);
CREATE INDEX IF NOT EXISTS idx_papers_speaking_module_id ON public.papers USING btree (speaking_module_id);
CREATE INDEX IF NOT EXISTS idx_papers_writing_module_id ON public.papers USING btree (writing_module_id);

-- Question answers indexes
CREATE INDEX IF NOT EXISTS idx_question_answers_sub_section_id ON public.question_answers USING btree (sub_section_id);

-- Scheduled tests indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_center_id ON public.scheduled_tests USING btree (center_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_paper_id ON public.scheduled_tests USING btree (paper_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_status ON public.scheduled_tests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_scheduled_at ON public.scheduled_tests USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_active_expiration ON public.scheduled_tests USING btree (ended_at) WHERE status = 'in_progress'::text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_otp ON public.scheduled_tests USING btree (otp) WHERE status = ANY (ARRAY['scheduled'::text, 'in_progress'::text]);

-- Sections indexes
CREATE INDEX IF NOT EXISTS idx_sections_module_id ON public.sections USING btree (module_id);

-- Student answers indexes
CREATE INDEX IF NOT EXISTS idx_answers_module ON public.student_answers USING btree (attempt_module_id);

-- Student profiles indexes
CREATE INDEX IF NOT EXISTS idx_student_profiles_center_id ON public.student_profiles USING btree (center_id);

-- Sub sections indexes
CREATE INDEX IF NOT EXISTS idx_sub_sections_section_id ON public.sub_sections USING btree (section_id);
CREATE INDEX IF NOT EXISTS idx_sub_sections_section_idx ON public.sub_sections USING btree (section_id, sub_section_index);

-- Support requests indexes
CREATE INDEX IF NOT EXISTS idx_support_requests_center_id ON public.support_requests USING btree (center_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON public.support_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON public.support_requests USING btree (user_id);

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique ON public.waitlist USING btree (email);
CREATE INDEX IF NOT EXISTS waitlist_location_idx ON public.waitlist USING btree (location);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_phone_unique ON public.waitlist USING btree (phone) WHERE phone IS NOT NULL;

-- Waitlist users indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist_users USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_demo_access ON public.waitlist_users USING btree (demo_access_granted) WHERE demo_access_granted = true;
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist_users USING btree (email);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Admin get auth user by email
CREATE OR REPLACE FUNCTION public.admin_get_auth_user_by_email(p_email text)
RETURNS TABLE(id uuid, email text, email_confirmed_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
  SELECT id, email, email_confirmed_at
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;
$function$;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Function: Update student profiles updated_at (Asia/Dhaka timezone)
CREATE OR REPLACE FUNCTION public.update_student_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';
  RETURN NEW;
END;
$function$;

-- Function: Update agent waitlist updated_at
CREATE OR REPLACE FUNCTION public.update_agent_waitlist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Function: Handle new user registration (trigger on auth.users)
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

-- Function: Sync auth user table (trigger on auth.users)
CREATE OR REPLACE FUNCTION public.fn_sync_auth_user_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.auth_user_table (uid, display_name, email)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
    ON CONFLICT (uid) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email = EXCLUDED.email;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$function$;

-- Function: Delete storage object
CREATE OR REPLACE FUNCTION public.delete_storage_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    file_path text;
    bucket_name text := 'media_files';
BEGIN
    IF OLD.resource_url IS NOT NULL AND OLD.resource_url <> '' THEN
        file_path := split_part(OLD.resource_url, '/' || bucket_name || '/', 2);
        IF file_path IS NOT NULL AND file_path <> '' THEN
            DELETE FROM storage.objects
            WHERE bucket_id = bucket_name
            AND name = file_path;
        END IF;
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
SECURITY DEFINER
AS $function$
begin
  if new.scheduled_test_id is not null then
    update scheduled_tests
    set attendee = attendee + 1,
        updated_at = now()
    where id = new.scheduled_test_id;
  end if;
  return new;
end;
$function$;

-- Function: Sync student test statistics
CREATE OR REPLACE FUNCTION public.sync_student_test_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    target_student_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_student_id := OLD.student_id;
    ELSE
        target_student_id := NEW.student_id;
    END IF;

    UPDATE public.student_profiles
    SET
        tests_taken = (
            SELECT COUNT(*)
            FROM public.mock_attempts
            WHERE student_id = target_student_id
            AND status != 'abandoned'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE student_id = target_student_id;

    RETURN NULL;
END;
$function$;

-- Function: Update center usage statistics
CREATE OR REPLACE FUNCTION public.fn_update_center_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_center_id uuid;
    v_delta integer;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_delta := 1;
    ELSIF (TG_OP = 'DELETE') THEN
        v_delta := -1;
    ELSE
        RETURN NULL;
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'student_profiles' THEN v_center_id := COALESCE(NEW.center_id, OLD.center_id);
        WHEN 'modules' THEN v_center_id := COALESCE(NEW.center_id, OLD.center_id);
        WHEN 'mock_attempts' THEN
            SELECT center_id INTO v_center_id
            FROM public.student_profiles
            WHERE student_id = COALESCE(NEW.student_id, OLD.student_id);
    END CASE;

    INSERT INTO public.center_usage (center_id, student_count, module_count, mock_attempt_count, updated_at)
    VALUES (
        v_center_id,
        CASE WHEN TG_TABLE_NAME = 'student_profiles' THEN GREATEST(0, v_delta) ELSE 0 END,
        CASE WHEN TG_TABLE_NAME = 'modules' THEN GREATEST(0, v_delta) ELSE 0 END,
        CASE WHEN TG_TABLE_NAME = 'mock_attempts' THEN GREATEST(0, v_delta) ELSE 0 END,
        now()
    )
    ON CONFLICT (center_id) DO UPDATE SET
        student_count = CASE WHEN TG_TABLE_NAME = 'student_profiles'
                        THEN GREATEST(0, public.center_usage.student_count + v_delta)
                        ELSE public.center_usage.student_count END,
        module_count = CASE WHEN TG_TABLE_NAME = 'modules'
                       THEN GREATEST(0, public.center_usage.module_count + v_delta)
                       ELSE public.center_usage.module_count END,
        mock_attempt_count = CASE WHEN TG_TABLE_NAME = 'mock_attempts'
                             THEN GREATEST(0, public.center_usage.mock_attempt_count + v_delta)
                             ELSE public.center_usage.mock_attempt_count END,
        updated_at = now();

    RETURN NULL;
END;
$function$;

-- Function: Check paper module types
CREATE OR REPLACE FUNCTION public.check_paper_module_types()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.reading_module_id IS NOT NULL THEN
    IF (SELECT module_type FROM public.modules WHERE id = NEW.reading_module_id) != 'reading' THEN
      RAISE EXCEPTION 'Invalid Module: The assigned ID is not a READING module.';
    END IF;
  END IF;

  IF NEW.listening_module_id IS NOT NULL THEN
    IF (SELECT module_type FROM public.modules WHERE id = NEW.listening_module_id) != 'listening' THEN
      RAISE EXCEPTION 'Invalid Module: The assigned ID is not a LISTENING module.';
    END IF;
  END IF;

  IF NEW.writing_module_id IS NOT NULL THEN
    IF (SELECT module_type FROM public.modules WHERE id = NEW.writing_module_id) != 'writing' THEN
      RAISE EXCEPTION 'Invalid Module: The assigned ID is not a WRITING module.';
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
    SELECT m.module_type
    INTO NEW.module_type
    FROM public.modules m
    WHERE m.id = NEW.module_id;

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

-- Function: Save grades (with IELTS writing weighted band calculation)
CREATE OR REPLACE FUNCTION public.save_grades(p_module_id uuid, p_answers jsonb, p_feedback text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_answer JSONB;
  v_total_score NUMERIC := 0;
  v_band_score NUMERIC(3,1);
  v_module_type TEXT;
  v_total_questions INTEGER := 0;
  v_task1_score NUMERIC := 0;
  v_task2_score NUMERIC := 0;
  v_raw_band NUMERIC;
BEGIN
  SELECT am.module_type INTO v_module_type
  FROM attempt_modules am WHERE am.id = p_module_id;

  IF v_module_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Module not found');
  END IF;

  -- Batch update all answers in one go
  UPDATE student_answers sa
  SET
    is_correct = (ans->>'is_correct')::boolean,
    marks_awarded = (ans->>'marks_awarded')::numeric
  FROM jsonb_array_elements(p_answers) AS ans
  WHERE sa.id = (ans->>'id')::uuid;

  IF v_module_type = 'writing' THEN
    -- Writing: weighted band = (task1 * 1 + task2 * 2) / 3
    SELECT
      COALESCE(MIN(CASE WHEN rn = 1 THEN marks_awarded END), 0),
      COALESCE(MIN(CASE WHEN rn = 2 THEN marks_awarded END), 0)
    INTO v_task1_score, v_task2_score
    FROM (
      SELECT marks_awarded,
        ROW_NUMBER() OVER (ORDER BY question_ref) as rn
      FROM student_answers
      WHERE attempt_module_id = p_module_id
    ) ranked;

    v_raw_band := (v_task1_score * 1 + v_task2_score * 2) / 3.0;
    v_band_score := ROUND(v_raw_band * 2) / 2.0;

    UPDATE attempt_modules SET
      band_score = v_band_score,
      score_obtained = v_band_score,
      feedback = COALESCE(p_feedback, feedback),
      status = 'completed'
    WHERE id = p_module_id;

    RETURN jsonb_build_object(
      'success', true,
      'module_type', v_module_type,
      'task1_score', v_task1_score,
      'task2_score', v_task2_score,
      'band_score', v_band_score,
      'total_score', v_band_score,
      'updated_count', jsonb_array_length(p_answers)
    );
  ELSE
    -- Reading/Listening: sum scores, compute IELTS band
    SELECT COALESCE(SUM(marks_awarded), 0), COUNT(*)
    INTO v_total_score, v_total_questions
    FROM student_answers WHERE attempt_module_id = p_module_id;

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

    UPDATE attempt_modules SET
      score_obtained = v_total_score,
      band_score = v_band_score,
      feedback = COALESCE(p_feedback, feedback),
      status = 'completed',
      completed_at = NOW()
    WHERE id = p_module_id;

    RETURN jsonb_build_object(
      'success', true,
      'module_type', v_module_type,
      'total_score', v_total_score,
      'band_score', v_band_score,
      'updated_count', jsonb_array_length(p_answers)
    );
  END IF;
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

-- Function: Get attempt preview
CREATE OR REPLACE FUNCTION public.get_attempt_preview(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'attemptId', ma.id,
    'studentId', ma.student_id,
    'studentName', COALESCE(sp.name, 'Unknown Student'),
    'studentEmail', COALESCE(sp.email, ''),
    'paperTitle', COALESCE(p.title, 'Untitled Paper'),
    'status', ma.status,
    'createdAt', ma.created_at,
    'modules', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'attemptModuleId', am.id,
          'moduleType', COALESCE(am.module_type, m.module_type, 'unknown'),
          'heading', m.heading,
          'status', am.status,
          'score_obtained', am.score_obtained,
          'band_score', am.band_score,
          'time_spent_seconds', am.time_spent_seconds,
          'completed_at', am.completed_at,
          'answers', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', sa.id,
                'question_ref', sa.question_ref,
                'student_response', sa.student_response,
                'marks_awarded', sa.marks_awarded,
                'is_correct', sa.is_correct,
                'reference_id', sa.reference_id
              )
              ORDER BY sa.question_ref
            )
            FROM student_answers sa WHERE sa.attempt_module_id = am.id
          ), '[]'::jsonb)
        )
      )
      FROM attempt_modules am
      JOIN modules m ON am.module_id = m.id
      WHERE am.attempt_id = ma.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM mock_attempts ma
  JOIN student_profiles sp ON ma.student_id = sp.student_id
  LEFT JOIN (
    SELECT DISTINCT ON (am2.attempt_id) am2.attempt_id, pp.title
    FROM attempt_modules am2
    JOIN modules mm ON am2.module_id = mm.id
    JOIN papers pp ON mm.paper_id = pp.id
    WHERE am2.attempt_id = p_attempt_id
  ) p ON p.attempt_id = ma.id
  WHERE ma.id = p_attempt_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Not found'));
END;
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
  -- SECURITY CHECK: allow the center owner OR any member of the center
  IF NOT EXISTS (
    SELECT 1 FROM public.centers
    WHERE center_id = p_center_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.center_members
    WHERE center_id = p_center_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not authorized to access this center.';
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
CREATE OR REPLACE FUNCTION public.get_center_reviews(p_center_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(attempt_row ORDER BY attempt_row->>'createdAt' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'attemptId', ma.id,
      'studentId', ma.student_id,
      'studentName', COALESCE(sp.name, 'Student'),
      'studentEmail', COALESCE(sp.email, ''),
      'status', ma.status,
      'createdAt', ma.created_at,
      'modules', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'attemptModuleId', am.id,
            'moduleType', COALESCE(am.module_type, m.module_type, 'unknown'),
            'heading', m.heading,
            'status', am.status,
            'score', am.score_obtained,
            'band', am.band_score,
            'timeSpentSeconds', am.time_spent_seconds,
            'completedAt', am.completed_at,
            'answerCount', (SELECT count(*) FROM student_answers sa WHERE sa.attempt_module_id = am.id)
          )
        )
        FROM attempt_modules am
        JOIN modules m ON am.module_id = m.id
        WHERE am.attempt_id = ma.id
        AND m.center_id = p_center_id
      )
    ) AS attempt_row
    FROM mock_attempts ma
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE sp.center_id = p_center_id
    AND EXISTS (
      SELECT 1 FROM attempt_modules am2
      JOIN modules m2 ON am2.module_id = m2.id
      WHERE am2.attempt_id = ma.id AND m2.center_id = p_center_id
    )
  ) sub
  WHERE sub.attempt_row->'modules' IS NOT NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- Function: Get grading data
CREATE OR REPLACE FUNCTION public.get_grading_data(p_attempt_module_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
  v_module_id uuid;
  v_attempt_id uuid;
BEGIN
  SELECT am.module_id, am.attempt_id INTO v_module_id, v_attempt_id
  FROM attempt_modules am WHERE am.id = p_attempt_module_id;

  IF v_module_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Module not found');
  END IF;

  SELECT jsonb_build_object(
    'attemptModuleId', am.id,
    'moduleType', COALESCE(m.module_type, am.module_type, 'unknown'),
    'heading', m.heading,
    'status', am.status,
    'feedback', am.feedback,
    'band_score', am.band_score,
    'score_obtained', am.score_obtained,
    'studentName', COALESCE(sp.name, 'Unknown Student'),
    'studentEmail', COALESCE(sp.email, ''),
    'paperTitle', COALESCE(p.title, 'Untitled Paper'),
    'answers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sa.id,
          'question_ref', sa.question_ref,
          'student_response', sa.student_response,
          'marks_awarded', sa.marks_awarded,
          'is_correct', sa.is_correct,
          'reference_id', sa.reference_id,
          'correct_answer', COALESCE(
            CASE
              WHEN jsonb_typeof(qa.correct_answers) = 'string' THEN qa.correct_answers #>> '{}'
              WHEN qa.correct_answers ? 'answer' THEN qa.correct_answers->>'answer'
              WHEN jsonb_typeof(qa.correct_answers) = 'array' THEN (
                SELECT string_agg(elem::text, ', ')
                FROM jsonb_array_elements_text(qa.correct_answers) elem
              )
              ELSE qa.correct_answers::text
            END,
            'N/A'
          )
        )
        ORDER BY sa.question_ref
      )
      FROM student_answers sa
      LEFT JOIN question_answers qa ON qa.question_ref = sa.question_ref
        AND qa.sub_section_id IN (
          SELECT ss.id FROM sub_sections ss
          JOIN sections s ON ss.section_id = s.id
          WHERE s.module_id = v_module_id
        )
      WHERE sa.attempt_module_id = p_attempt_module_id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM attempt_modules am
  JOIN modules m ON am.module_id = m.id
  JOIN mock_attempts ma ON am.attempt_id = ma.id
  JOIN student_profiles sp ON ma.student_id = sp.student_id
  LEFT JOIN papers p ON m.paper_id = p.id
  WHERE am.id = p_attempt_module_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Not found'));
END;
$function$;

-- Function: Get module answers with correct answers
CREATE OR REPLACE FUNCTION public.get_module_answers_with_correct(p_module_id uuid)
RETURNS TABLE(id uuid, question_ref text, student_response text, marks_awarded numeric, is_correct boolean, reference_id uuid, correct_answer jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.question_ref,
    sa.student_response,
    sa.marks_awarded,
    sa.is_correct,
    sa.reference_id,
    q.correct_answers as correct_answer
  FROM student_answers sa
  INNER JOIN questions q ON q.id = sa.reference_id
  WHERE sa.attempt_module_id = p_module_id
  ORDER BY sa.question_ref;
END;
$function$;

-- Function: Get module answers with questions
CREATE OR REPLACE FUNCTION public.get_module_answers_with_questions(p_module_id uuid)
RETURNS TABLE(answer_id uuid, question_ref text, student_response text, marks_awarded numeric, is_correct boolean, reference_id uuid, correct_answer jsonb, question_type text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sa.id AS answer_id,
    sa.question_ref,
    sa.student_response,
    sa.marks_awarded,
    sa.is_correct,
    sa.reference_id,
    q.correct_answers AS correct_answer,
    q.question_type
  FROM student_answers sa
  INNER JOIN questions q ON q.id = sa.reference_id
  WHERE sa.attempt_module_id = p_module_id
  ORDER BY sa.question_ref;
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

-- Function: Get module questions for view
CREATE OR REPLACE FUNCTION public.get_module_questions_for_view(p_attempt_id uuid, p_module_id uuid)
RETURNS SETOF jsonb
LANGUAGE plpgsql
AS $function$
declare
    v_exists boolean;
begin
    select exists (
        select 1
        from attempt_modules
        where attempt_id = p_attempt_id
          and module_id = p_module_id
    ) into v_exists;

    if not v_exists then
        return;
    end if;

    return query
    with limited_questions as (
        select qa.id, qa.sub_section_id, qa.question_ref,
               qa.options, qa.correct_answers, qa.explanation, qa.marks
        from question_answers qa
        join sub_sections ss on ss.id = qa.sub_section_id
        where ss.section_id in (
            select id from sections where module_id = p_module_id
        )
        order by qa.created_at
        limit 40
    )
    select jsonb_build_object(
        'question_id', id,
        'sub_section_id', sub_section_id,
        'question_ref', question_ref,
        'options', options,
        'correct_answers', correct_answers,
        'explanation', explanation,
        'marks', marks
    )
    from limited_questions;
end;
$function$;

-- Function: Get my center ID
CREATE OR REPLACE FUNCTION public.get_my_center_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT center_id FROM users WHERE user_id = auth.uid()::text
$function$;

-- Function: Get student module feedback
CREATE OR REPLACE FUNCTION public.get_student_module_feedback(p_student_email text)
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
      'success', true,
      'student_id', NULL,
      'modules', '[]'::json
    );
  END IF;

  WITH completed_modules AS (
    SELECT
      ma.id AS attempt_id,
      st.title AS test_title,
      ma.completed_at AS test_completed_at,
      am.id AS module_id,
      am.module_type,
      am.band_score,
      am.score_obtained,
      am.time_spent_seconds,
      am.feedback,
      am.completed_at AS module_completed_at,
      CASE am.module_type
        WHEN 'listening' THEN 30
        WHEN 'reading' THEN 60
        WHEN 'writing' THEN 60
        WHEN 'speaking' THEN 15
        ELSE 0
      END AS module_duration,
      ROW_NUMBER() OVER (PARTITION BY ma.id ORDER BY
        CASE am.module_type
          WHEN 'listening' THEN 1
          WHEN 'reading' THEN 2
          WHEN 'writing' THEN 3
          WHEN 'speaking' THEN 4
          ELSE 5
        END
      ) AS module_order
    FROM mock_attempts ma
    INNER JOIN attempt_modules am ON am.attempt_id = ma.id
    LEFT JOIN scheduled_tests st ON st.id = ma.scheduled_test_id
    WHERE ma.student_id = v_student_id
      AND ma.status = 'completed'
      AND am.status = 'completed'
    ORDER BY ma.completed_at DESC NULLS LAST, module_order
  )
  SELECT json_build_object(
    'success', true,
    'student_id', v_student_id,
    'modules', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'attempt_id', cm.attempt_id,
            'test_title', COALESCE(cm.test_title, 'IELTS Mock Test'),
            'test_completed_at', cm.test_completed_at,
            'module_type', cm.module_type,
            'band_score', COALESCE(cm.band_score, 0),
            'score_obtained', COALESCE(cm.score_obtained, 0),
            'time_spent_seconds', COALESCE(cm.time_spent_seconds, 0),
            'module_duration_minutes', COALESCE(cm.module_duration, 0),
            'feedback', cm.feedback,
            'module_completed_at', cm.module_completed_at
          ) ORDER BY cm.test_completed_at DESC NULLS LAST, cm.module_order
        )
        FROM completed_modules cm
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Function: Get student registered tests
CREATE OR REPLACE FUNCTION public.get_student_registered_tests(p_student_email text)
RETURNS TABLE(attempt_id uuid, attempt_status text, attempt_type text, scheduled_test_id uuid, test_title text, scheduled_at timestamp with time zone, duration_minutes integer, test_status text, paper_id uuid, paper_title text, paper_type text, center_id uuid, center_name text, center_slug text, started_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ma.id AS attempt_id,
    ma.status AS attempt_status,
    ma.attempt_type,
    ma.scheduled_test_id,
    st.title AS test_title,
    st.scheduled_at,
    st.duration_minutes,
    st.status AS test_status,
    ma.paper_id,
    p.title AS paper_title,
    p.paper_type,
    st.center_id,
    c.name AS center_name,
    c.slug AS center_slug,
    ma.started_at
  FROM mock_attempts ma
  JOIN student_profiles sp ON sp.student_id = ma.student_id
  JOIN papers p ON p.id = ma.paper_id
  LEFT JOIN scheduled_tests st ON st.id = ma.scheduled_test_id
  LEFT JOIN centers c ON c.center_id = st.center_id
  WHERE sp.email = p_student_email
    AND ma.status NOT IN ('completed', 'evaluated')
  ORDER BY st.scheduled_at DESC NULLS LAST;
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

-- Function: Get writing reviews
CREATE OR REPLACE FUNCTION public.get_writing_reviews(p_center_id uuid)
RETURNS TABLE(answer_id uuid, attempt_module_id uuid, reference_id uuid, question_ref text, student_response text, marks_awarded double precision, answer_created_at timestamp with time zone, am_id uuid, am_attempt_id uuid, am_status text, am_score_obtained double precision, am_band_score numeric, am_feedback text, module_heading text, module_paper_id uuid, attempt_student_id uuid, attempt_status text)
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
    sa.marks_awarded,
    sa.created_at AS answer_created_at,

    am.id AS am_id,
    am.attempt_id AS am_attempt_id,
    am.status AS am_status,
    am.score_obtained AS am_score_obtained,
    am.band_score AS am_band_score,
    am.feedback AS am_feedback,

    m.heading AS module_heading,
    m.paper_id AS module_paper_id,

    ma.student_id AS attempt_student_id,
    ma.status AS attempt_status

  FROM student_answers sa
  INNER JOIN attempt_modules am ON sa.attempt_module_id = am.id
  INNER JOIN modules m ON am.module_id = m.id
  INNER JOIN mock_attempts ma ON am.attempt_id = ma.id
  WHERE
    m.center_id = p_center_id
    AND m.module_type = 'writing'
  ORDER BY sa.created_at DESC;
END;
$function$;

-- Function: Join mock test (email-based, returns table)
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
  v_has_modules BOOLEAN;
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

  -- Check if student already has modules (already joined before)
  SELECT EXISTS(
    SELECT 1 FROM attempt_modules existing
    WHERE existing.attempt_id = v_attempt_id
  ) INTO v_has_modules;

  -- Only enforce the 30-minute entry window for FIRST-TIME joins.
  -- If student already has modules, they are re-entering.
  IF NOT v_has_modules THEN
    IF now() > (v_scheduled_at + interval '30 minutes') THEN
      RAISE EXCEPTION 'Entry denied: The 30-minute entry window has closed.';
    END IF;
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
    CASE WHEN v_has_modules THEN 'rejoined' ELSE 'joined' END,
    COALESCE(v_modules_json, '[]'::jsonb);
END;
$function$;

-- Function: Join mock test (legacy, student_id-based, returns boolean)
CREATE OR REPLACE FUNCTION public.join_mock_test(p_student_id uuid, p_center_id uuid, p_test_id uuid, p_otp integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_paper_id UUID;
  v_scheduled_at TIMESTAMPTZ;
  v_actual_otp INTEGER;
  v_test_status TEXT;
  v_attempt_id UUID;
BEGIN
  SELECT
    paper_id,
    scheduled_at,
    otp,
    status
  INTO
    v_paper_id,
    v_scheduled_at,
    v_actual_otp,
    v_test_status
  FROM scheduled_tests
  WHERE id = p_test_id
    AND center_id = p_center_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test not found or does not belong to this center.';
  END IF;

  IF v_test_status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'Test is not currently active.';
  END IF;

  IF now() > (v_scheduled_at + interval '30 minutes') THEN
    RAISE EXCEPTION 'Entry denied: The 30-minute entry window has closed.';
  END IF;

  IF v_actual_otp IS DISTINCT FROM p_otp THEN
    RAISE EXCEPTION 'Invalid OTP provided.';
  END IF;

  SELECT id INTO v_attempt_id
  FROM mock_attempts
  WHERE student_id = p_student_id
    AND scheduled_test_id = p_test_id;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Student is not registered for this test.';
  END IF;

  INSERT INTO attempt_modules (attempt_id, module_id, module_type, status)
  SELECT
    v_attempt_id,
    m.id,
    m.module_type,
    'pending'
  FROM papers p
  JOIN modules m ON m.id IN (p.listening_module_id, p.reading_module_id, p.writing_module_id)
  WHERE p.id = v_paper_id
  ON CONFLICT (attempt_id, module_id) DO NOTHING;

  RETURN TRUE;
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
RETURNS TABLE(id uuid, reference_id uuid, question_ref text, student_response text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
#variable_conflict use_column
begin
  -- Single INSERT with ON CONFLICT for atomic upsert
  INSERT INTO student_answers (
    attempt_module_id,
    reference_id,
    question_ref,
    student_response
  )
  SELECT
    p_attempt_module_id,
    (ans->>'reference_id')::uuid,
    ans->>'question_ref',
    ans->>'student_response'
  FROM jsonb_array_elements(p_answers) AS ans
  ON CONFLICT (attempt_module_id, reference_id, question_ref)
  DO UPDATE SET
    student_response = EXCLUDED.student_response;

  -- Return ALL answer rows for this attempt module (submitted + previously saved)
  RETURN QUERY
  SELECT sa.id, sa.reference_id, sa.question_ref, sa.student_response
  FROM student_answers sa
  WHERE sa.attempt_module_id = p_attempt_module_id;
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

  -- Block access to modules that have expired (started + zero time remaining)
  -- This catches the case where auto-submit failed but the timer ran out
  IF v_attempt_module.status = 'in_progress'
     AND v_attempt_module.started_at IS NOT NULL
     AND COALESCE(v_attempt_module.time_remaining_seconds, 0) <= 0
     AND COALESCE(v_attempt_module.time_spent_seconds, 0) > 0
  THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'This module has expired. Time ran out.',
      'error_code', 'MODULE_EXPIRED',
      'module_status', v_attempt_module.status,
      'started_at', v_attempt_module.started_at
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

-- Function: Validate student attempt access
CREATE OR REPLACE FUNCTION public.validate_student_attempt_access(p_student_id uuid, p_mock_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM mock_attempts
    WHERE id = p_mock_attempt_id
    AND student_id = p_student_id
  ) INTO v_exists;

  RETURN v_exists;
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

  INSERT INTO center_members (center_id, user_id)
  VALUES (v_code.center_id, v_user_id)
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

CREATE TRIGGER trg_sync_auth_user_table
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_auth_user_table();

-- Triggers on public tables
CREATE TRIGGER trg_agent_waitlist_updated_at
  BEFORE UPDATE ON public.agent_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_waitlist_updated_at();

CREATE TRIGGER trg_set_module_type
  BEFORE INSERT OR UPDATE ON public.attempt_modules
  FOR EACH ROW
  EXECUTE FUNCTION set_attempt_module_type();

CREATE TRIGGER tr_update_verification_time
  BEFORE UPDATE ON public.centers
  FOR EACH ROW
  EXECUTE FUNCTION handle_verification_timestamp();

CREATE TRIGGER update_centers_updated_at
  BEFORE UPDATE ON public.centers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_mock_attempts_increment_attendee
  AFTER INSERT ON public.mock_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trg_increment_scheduled_test_attendee();

CREATE TRIGGER trg_mock_attempts_sync_profiles
  AFTER INSERT OR DELETE OR UPDATE OF student_id, status ON public.mock_attempts
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

CREATE TRIGGER validate_paper_modules
  BEFORE INSERT OR UPDATE ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION check_paper_module_types();

CREATE TRIGGER trg_calculate_ended_at
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes ON public.scheduled_tests
  FOR EACH ROW
  EXECUTE FUNCTION handle_test_end_time();

CREATE TRIGGER trg_delete_section_file
  AFTER DELETE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_object();

CREATE TRIGGER trg_usage_students
  AFTER INSERT OR DELETE ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_center_usage();

CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_student_profiles_updated_at();

CREATE TRIGGER trg_delete_subsection_file
  AFTER DELETE ON public.sub_sections
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_object();

CREATE TRIGGER update_support_requests_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waitlist_users_updated_at
  BEFORE UPDATE ON public.waitlist_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.agent_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
-- Note: waitlist_users has RLS DISABLED

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Agent waitlist policies
CREATE POLICY "anon_insert_agent_waitlist" ON public.agent_waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "service_select_agent_waitlist" ON public.agent_waitlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_update_agent_waitlist" ON public.agent_waitlist FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Attempt modules policies
CREATE POLICY "Center Owners can manage attempt modules" ON public.attempt_modules FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM mock_attempts ma
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    JOIN centers c ON sp.center_id = c.center_id
    WHERE ma.id = attempt_modules.attempt_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Students can insert modules" ON public.attempt_modules FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM mock_attempts ma
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE ma.id = attempt_modules.attempt_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can update own modules" ON public.attempt_modules FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM mock_attempts ma
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE ma.id = attempt_modules.attempt_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view own modules" ON public.attempt_modules FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM mock_attempts ma
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE ma.id = attempt_modules.attempt_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

-- Auth user table policies
CREATE POLICY "Allow auth users to select" ON public.auth_user_table FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Center members policies
CREATE POLICY "Center owners can add members" ON public.center_members FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = center_members.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Center owners can update members" ON public.center_members FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = center_members.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Owners can remove members, members can leave" ON public.center_members FOR DELETE TO public
  USING (
    EXISTS (SELECT 1 FROM centers c WHERE c.center_id = center_members.center_id AND c.user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners see all members, members see self" ON public.center_members FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM centers c WHERE c.center_id = center_members.center_id AND c.user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Center usage policies
CREATE POLICY "center_usage_read_own" ON public.center_usage FOR SELECT TO authenticated
  USING (center_id IN (
    SELECT centers.center_id FROM centers WHERE centers.user_id = auth.uid()
    UNION
    SELECT center_members.center_id FROM center_members WHERE center_members.user_id = auth.uid()
  ));

-- Centers policies
CREATE POLICY "public read centers" ON public.centers FOR SELECT TO public USING (true);
CREATE POLICY "Users can view own centers" ON public.centers FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "Users can create centers" ON public.centers FOR INSERT TO public WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own centers" ON public.centers FOR UPDATE TO public USING (user_id = auth.uid());
CREATE POLICY "Users can delete own centers" ON public.centers FOR DELETE TO public USING (user_id = auth.uid());

-- Exchange codes policies
CREATE POLICY "Center admins can create exchange codes" ON public.exchange_codes FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM center_members cm
    JOIN centers c ON c.center_id = cm.center_id
    WHERE cm.user_id = auth.uid() AND (c.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users u WHERE u.user_id = auth.uid() AND u.role = 'admin'::user_role_enum
    ))
  ));

CREATE POLICY "Owners can manage exchange codes" ON public.exchange_codes FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = exchange_codes.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Invited user can read own code" ON public.exchange_codes FOR SELECT TO public
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

CREATE POLICY "Invited user can delete own code" ON public.exchange_codes FOR DELETE TO public
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

-- Mock attempts policies
CREATE POLICY "Center Owners can manage student attempts" ON public.mock_attempts FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM student_profiles sp
    JOIN centers c ON sp.center_id = c.center_id
    WHERE sp.student_id = mock_attempts.student_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Students can start attempts" ON public.mock_attempts FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.student_id = mock_attempts.student_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can update own attempts" ON public.mock_attempts FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.student_id = mock_attempts.student_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view own attempts" ON public.mock_attempts FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.student_id = mock_attempts.student_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

-- Modules policies
CREATE POLICY "Owners can view modules" ON public.modules FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = modules.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Owners can insert modules" ON public.modules FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = modules.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Owners can update modules" ON public.modules FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = modules.center_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = modules.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Owners can delete private modules" ON public.modules FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = modules.center_id AND c.user_id = auth.uid())
    AND view_option <> 'public'::module_view_enum);

CREATE POLICY "Students can view modules" ON public.modules FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM papers p
    JOIN student_profiles sp ON p.center_id = sp.center_id
    WHERE p.id = modules.paper_id AND p.is_active = true AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view modules from their center" ON public.modules FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.center_id = modules.center_id)
    OR view_option = 'public'::module_view_enum
  );

CREATE POLICY "Users can view modules for their own centers" ON public.modules FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = modules.center_id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can insert modules for their own centers" ON public.modules FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = modules.center_id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can update modules for their own centers" ON public.modules FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = modules.center_id AND centers.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = modules.center_id AND centers.user_id = auth.uid()));

-- Papers policies
CREATE POLICY "Center owners can create papers" ON public.papers FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = papers.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Owners can manage own papers" ON public.papers FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = papers.center_id AND centers.user_id = auth.uid()));

CREATE POLICY "Students can view active papers" ON public.papers FOR SELECT TO public
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.center_id = papers.center_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

-- Question answers policies
CREATE POLICY "Enable read access for authenticated users" ON public.question_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.question_answers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.question_answers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON public.question_answers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Students can view questions from accessible sub_sections" ON public.question_answers FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM sub_sections ss
    JOIN sections s ON ss.section_id = s.id
    JOIN modules m ON s.module_id = m.id
    WHERE ss.id = question_answers.sub_section_id
    AND (EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.center_id = m.center_id)
         OR m.view_option = 'public'::module_view_enum)
  ));

-- Scheduled tests policies
CREATE POLICY "Public View Active Tests" ON public.scheduled_tests FOR SELECT TO anon, authenticated
  USING (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text]));

CREATE POLICY "Users can view tests in their centers" ON public.scheduled_tests FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = scheduled_tests.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can create tests in their centers" ON public.scheduled_tests FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = scheduled_tests.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can update tests in their centers" ON public.scheduled_tests FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = scheduled_tests.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete tests in their centers" ON public.scheduled_tests FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = scheduled_tests.center_id AND c.user_id = auth.uid()));

-- Sections policies
CREATE POLICY "Owners can manage sections" ON public.sections FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM modules m
    JOIN papers p ON m.paper_id = p.id
    JOIN centers c ON p.center_id = c.center_id
    WHERE m.id = sections.module_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Students can view sections" ON public.sections FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM modules m
    JOIN papers p ON m.paper_id = p.id
    JOIN student_profiles sp ON p.center_id = sp.center_id
    WHERE m.id = sections.module_id AND p.is_active = true AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view sections from accessible modules" ON public.sections FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM modules m
    WHERE m.id = sections.module_id
    AND (EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.center_id = m.center_id)
         OR m.view_option = 'public'::module_view_enum)
  ));

CREATE POLICY "Users can view sections for their modules" ON public.sections FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM modules JOIN centers ON modules.center_id = centers.center_id WHERE sections.module_id = modules.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can insert sections for their modules" ON public.sections FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM modules JOIN centers ON modules.center_id = centers.center_id WHERE sections.module_id = modules.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can update sections for their modules" ON public.sections FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM modules JOIN centers ON modules.center_id = centers.center_id WHERE sections.module_id = modules.id AND centers.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM modules JOIN centers ON modules.center_id = centers.center_id WHERE sections.module_id = modules.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can delete sections for their modules" ON public.sections FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM modules JOIN centers ON modules.center_id = centers.center_id WHERE sections.module_id = modules.id AND centers.user_id = auth.uid()));

-- Student answers policies
CREATE POLICY "Center Owners can manage answers" ON public.student_answers FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM attempt_modules am
    JOIN mock_attempts ma ON am.attempt_id = ma.id
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    JOIN centers c ON sp.center_id = c.center_id
    WHERE am.id = student_answers.attempt_module_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Students can insert answers" ON public.student_answers FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM attempt_modules am
    JOIN mock_attempts ma ON am.attempt_id = ma.id
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE am.id = student_answers.attempt_module_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can update answers" ON public.student_answers FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM attempt_modules am
    JOIN mock_attempts ma ON am.attempt_id = ma.id
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE am.id = student_answers.attempt_module_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view own answers" ON public.student_answers FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM attempt_modules am
    JOIN mock_attempts ma ON am.attempt_id = ma.id
    JOIN student_profiles sp ON ma.student_id = sp.student_id
    WHERE am.id = student_answers.attempt_module_id AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

-- Student profiles policies
CREATE POLICY "public read student profiles" ON public.student_profiles FOR SELECT TO public USING (true);

CREATE POLICY "Owners can view their students" ON public.student_profiles FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = student_profiles.center_id AND centers.user_id = auth.uid()));

CREATE POLICY "Owners can delete their students" ON public.student_profiles FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.center_id = student_profiles.center_id AND centers.user_id = auth.uid()));

CREATE POLICY "student_profiles_insert_policy" ON public.student_profiles FOR INSERT TO public
  WITH CHECK (
    auth.uid() IS NULL
    OR center_id IS NULL
    OR EXISTS (SELECT 1 FROM centers WHERE centers.center_id = student_profiles.center_id AND centers.user_id = auth.uid())
  );

CREATE POLICY "student_profiles_update_policy" ON public.student_profiles FOR UPDATE TO public
  USING (
    auth.uid() IS NULL
    OR center_id IS NULL
    OR EXISTS (SELECT 1 FROM centers WHERE centers.center_id = student_profiles.center_id AND centers.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NULL
    OR center_id IS NULL
    OR EXISTS (SELECT 1 FROM centers WHERE centers.center_id = student_profiles.center_id AND centers.user_id = auth.uid())
  );

-- Sub sections policies
CREATE POLICY "Owners can manage sub_sections" ON public.sub_sections FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM sections s
    JOIN modules m ON s.module_id = m.id
    JOIN papers p ON m.paper_id = p.id
    JOIN centers c ON p.center_id = c.center_id
    WHERE s.id = sub_sections.section_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Students can view sub_sections" ON public.sub_sections FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM sections s
    JOIN modules m ON s.module_id = m.id
    JOIN papers p ON m.paper_id = p.id
    JOIN student_profiles sp ON p.center_id = sp.center_id
    WHERE s.id = sub_sections.section_id AND p.is_active = true AND sp.email = (auth.jwt() ->> 'email'::text)
  ));

CREATE POLICY "Students can view sub_sections from accessible sections" ON public.sub_sections FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM sections s
    JOIN modules m ON s.module_id = m.id
    WHERE s.id = sub_sections.section_id
    AND (EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.center_id = m.center_id)
         OR m.view_option = 'public'::module_view_enum)
  ));

CREATE POLICY "Users can view sub_sections for their sections" ON public.sub_sections FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM sections JOIN modules ON sections.module_id = modules.id JOIN centers ON modules.center_id = centers.center_id WHERE sub_sections.section_id = sections.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can insert sub_sections for their sections" ON public.sub_sections FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM sections JOIN modules ON sections.module_id = modules.id JOIN centers ON modules.center_id = centers.center_id WHERE sub_sections.section_id = sections.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can update sub_sections for their sections" ON public.sub_sections FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM sections JOIN modules ON sections.module_id = modules.id JOIN centers ON modules.center_id = centers.center_id WHERE sub_sections.section_id = sections.id AND centers.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sections JOIN modules ON sections.module_id = modules.id JOIN centers ON modules.center_id = centers.center_id WHERE sub_sections.section_id = sections.id AND centers.user_id = auth.uid()));

CREATE POLICY "Users can delete sub_sections for their sections" ON public.sub_sections FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM sections JOIN modules ON sections.module_id = modules.id JOIN centers ON modules.center_id = centers.center_id WHERE sub_sections.section_id = sections.id AND centers.user_id = auth.uid()));

-- Support requests policies
CREATE POLICY "Users can view their own support requests" ON public.support_requests FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = support_requests.center_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert their own support requests" ON public.support_requests FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM centers c WHERE c.center_id = support_requests.center_id AND c.user_id = auth.uid()));

-- Tiers policies
CREATE POLICY "tiers_read_authenticated" ON public.tiers FOR SELECT TO authenticated USING (true);

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "users_select_self" ON public.users FOR SELECT TO public USING (user_id = auth.uid());
CREATE POLICY "users_select_for_owner" ON public.users FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM center_members cm
    WHERE cm.user_id = users.user_id
    AND cm.center_id IN (SELECT centers.center_id FROM centers WHERE centers.user_id = auth.uid())
  ));

CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT TO public WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_insert_owner" ON public.users FOR INSERT TO public WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO public USING (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE TO public USING (user_id = auth.uid());
CREATE POLICY "users_update_owner_or_self" ON public.users FOR UPDATE TO public USING (user_id = auth.uid());

-- Waitlist policies
CREATE POLICY "allow_insert_only" ON public.waitlist FOR INSERT TO public WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon;
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
