create table public.student_profiles (
  phone text null,
  guardian text null,
  guardian_phone text null,
  date_of_birth date null,
  address text null,
  enrolled_at timestamp without time zone null default (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'::text),
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  student_id uuid not null default gen_random_uuid (),
  center_id uuid not null,
  email text null,
  name text null,
  grade text null,
  status text not null default 'active'::text,
  enrollment_type public.student_type_enum not null default 'regular'::student_type_enum,
  visitor_exam_date date null,
  tests_taken integer null default 0,
  constraint student_profiles_pkey primary key (student_id),
  constraint student_profiles_center_id_fkey foreign KEY (center_id) references centers (center_id) on delete CASCADE,
  constraint check_regular_student_data check (
    (
      (enrollment_type = 'mock_only'::student_type_enum)
      or (
        (enrollment_type = 'regular'::student_type_enum)
        and (guardian is not null)
      )
    )
  ),
  constraint student_profiles_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'cancelled'::text,
          'archived'::text,
          'passed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger update_student_profiles_updated_at BEFORE
update on student_profiles for EACH row
execute FUNCTION update_student_profiles_updated_at ();


create table public.mock_attempts (
  id uuid not null default gen_random_uuid (),
  student_id uuid not null,
  paper_id uuid null,
  attempt_type text not null,
  status text not null default 'in_progress'::text,
  overall_band_score numeric(3, 1) null,
  started_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  scheduled_test_id uuid null,
  constraint mock_attempts_pkey primary key (id),
  constraint mock_attempts_paper_id_fkey foreign KEY (paper_id) references papers (id) on delete set null,
  constraint mock_attempts_scheduled_test_id_fkey foreign KEY (scheduled_test_id) references scheduled_tests (id),
  constraint mock_attempts_student_id_fkey foreign KEY (student_id) references student_profiles (student_id) on delete CASCADE,
  constraint mock_attempts_attempt_type_check check (
    (
      attempt_type = any (
        array[
          'full_mock'::text,
          'practice_sprint'::text,
          'single_module'::text
        ]
      )
    )
  ),
  constraint mock_attempts_status_check check (
    (
      status = any (
        array[
          'in_progress'::text,
          'completed'::text,
          'evaluated'::text,
          'abandoned'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_attempts_student_type on public.mock_attempts using btree (student_id, attempt_type) TABLESPACE pg_default;

create trigger trg_mock_attempts_sync_profiles
after INSERT
or DELETE
or
update OF status,
student_id on mock_attempts for EACH row
execute FUNCTION sync_student_test_stats ();


create table public.papers (
  id uuid not null default gen_random_uuid (),
  center_id uuid not null,
  title text not null,
  paper_type text null,
  instruction text null,
  tests_conducted integer null default 0,
  is_active boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  reading_module_id uuid null,
  listening_module_id uuid null,
  writing_module_id uuid null,
  speaking_module_id uuid null,
  constraint papers_pkey primary key (id),
  constraint papers_listening_fk foreign KEY (listening_module_id) references modules (id),
  constraint papers_center_id_fkey foreign KEY (center_id) references centers (center_id) on delete CASCADE,
  constraint papers_reading_fk foreign KEY (reading_module_id) references modules (id),
  constraint papers_speaking_fk foreign KEY (speaking_module_id) references modules (id),
  constraint papers_writing_fk foreign KEY (writing_module_id) references modules (id),
  constraint papers_paper_type_check check (
    (
      paper_type = any (array['IELTS'::text, 'OIETC'::text, 'GRE'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_papers_center_id on public.papers using btree (center_id) TABLESPACE pg_default;

create trigger validate_paper_modules BEFORE INSERT
or
update on papers for EACH row
execute FUNCTION check_paper_module_types ();


create table public.modules (
  id uuid not null default gen_random_uuid (),
  paper_id uuid null,
  module_type text null,
  heading text null,
  subheading text null,
  instruction text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  center_id uuid not null,
  view_option public.module_view_enum not null default 'private'::module_view_enum,
  constraint modules_pkey primary key (id),
  constraint modules_center_id_fkey foreign KEY (center_id) references centers (center_id),
  constraint modules_module_type_check check (
    (
      module_type = any (
        array[
          'reading'::text,
          'listening'::text,
          'writing'::text,
          'speaking'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_modules_paper_id on public.modules using btree (paper_id) TABLESPACE pg_default;


create table public.sections (
  id uuid not null default gen_random_uuid (),
  module_id uuid null,
  title text null,
  section_index integer null,
  content_type text null,
  resource_url text null,
  content_text text null,
  instruction text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  params jsonb null default '{}'::jsonb,
  subtext text null,
  constraint sections_pkey primary key (id),
  constraint sections_module_id_fkey foreign KEY (module_id) references modules (id) on delete CASCADE,
  constraint sections_content_type_check check (
    (
      content_type = any (array['text'::text, 'audio'::text, 'image'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sections_module_id on public.sections using btree (module_id) TABLESPACE pg_default;


create table public.sub_sections (
  id uuid not null default gen_random_uuid (),
  section_id uuid null,
  boundary_text text null,
  sub_type text null,
  content_template text not null,
  resource_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  sub_section_index integer not null default 0,
  constraint sub_sections_pkey primary key (id),
  constraint sub_sections_section_id_fkey foreign KEY (section_id) references sections (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_sub_sections_section_id on public.sub_sections using btree (section_id) TABLESPACE pg_default;


create table public.question_answers (
  id uuid not null default gen_random_uuid (),
  sub_section_id uuid null,
  question_ref text not null,
  correct_answers jsonb null,
  options jsonb null,
  explanation text null,
  marks double precision null default 1.0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint question_answers_pkey primary key (id),
  constraint question_answers_sub_section_id_fkey foreign KEY (sub_section_id) references sub_sections (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_qa_options on public.question_answers using gin (options) TABLESPACE pg_default;

create index IF not exists idx_qa_sub_section_id on public.question_answers using btree (sub_section_id) TABLESPACE pg_default;

