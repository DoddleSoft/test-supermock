create table public.attempt_modules (
  id uuid not null default gen_random_uuid (),
  attempt_id uuid not null,
  module_id uuid not null,
  status text not null default 'pending'::text,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  time_spent_seconds integer null default 0,
  score_obtained double precision null default 0,
  band_score numeric(3, 1) null,
  feedback text null,
  created_at timestamp with time zone null default now(),
  time_remaining_seconds integer null default 0,
  module_type text null,
  constraint attempt_modules_pkey primary key (id),
  constraint unique_module_per_attempt unique (attempt_id, module_id),
  constraint attempt_modules_attempt_id_fkey foreign KEY (attempt_id) references mock_attempts (id) on delete CASCADE,
  constraint attempt_modules_module_id_fkey foreign KEY (module_id) references modules (id) on delete CASCADE,
  constraint attempt_modules_status_check check (
    (
      status = any (
        array[
          'locked'::text,
          'pending'::text,
          'in_progress'::text,
          'completed'::text,
          'timeout'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger trg_set_module_type BEFORE INSERT
or
update on attempt_modules for EACH row
execute FUNCTION set_attempt_module_type ();

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
  constraint mock_attempts_scheduled_test_id_fkey foreign KEY (scheduled_test_id) references scheduled_tests (id) on delete set null,
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

create trigger trg_mock_attempts_increment_attendee
after INSERT on mock_attempts for EACH row
execute FUNCTION trg_increment_scheduled_test_attendee ();

create trigger trg_mock_attempts_sync_profiles
after INSERT
or DELETE
or
update OF status,
student_id on mock_attempts for EACH row
execute FUNCTION sync_student_test_stats ();

