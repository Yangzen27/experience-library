CREATE TABLE resume_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'local-user',
  target_company text,
  target_role text NOT NULL,
  job_type text NOT NULL,
  language text NOT NULL DEFAULT 'zh',
  page_count text NOT NULL DEFAULT '1',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES resume_projects(id) ON DELETE CASCADE,
  source_role text NOT NULL CHECK (source_role IN ('main', 'reference')),
  content text NOT NULL,
  sort_order text NOT NULL DEFAULT '0',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resume_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES resume_projects(id) ON DELETE CASCADE,
  experience_ref text NOT NULL,
  is_required text NOT NULL DEFAULT 'false',
  sort_order text NOT NULL DEFAULT '0',
  selected_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES resume_projects(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('zh', 'en')),
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_edits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE education_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'local-user',
  school_name text NOT NULL,
  degree text,
  major text,
  start_date text,
  end_date text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX resume_projects_user_updated_idx ON resume_projects(user_id, updated_at DESC);
CREATE INDEX job_descriptions_project_idx ON job_descriptions(project_id);
CREATE INDEX resume_selections_project_idx ON resume_selections(project_id);
CREATE INDEX resume_versions_project_idx ON resume_versions(project_id);
