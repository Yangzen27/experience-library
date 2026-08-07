-- Supabase Auth 多租户隔离：auth.users 是唯一身份来源。
-- 执行位置：Supabase Dashboard > SQL Editor。请按顺序先执行 0000~0003，再执行本文件。
-- 旧本地数据保留为 user_id = 'local-user'，不会自动暴露给任何 Supabase 用户。

-- 1) 删除历史单用户默认值，杜绝漏传 user_id 时回落到共享账户。
ALTER TABLE library_state ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE files ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE experiences ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE education_records ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE resume_profiles ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE resume_projects ALTER COLUMN user_id DROP DEFAULT;

-- 2) 为关联记录写入直属归属者，便于每张业务表独立实施 RLS。
ALTER TABLE source_chunks ADD COLUMN IF NOT EXISTS user_id text;
UPDATE source_chunks chunk SET user_id = file.user_id
FROM files file WHERE chunk.file_id = file.id AND chunk.user_id IS NULL;
ALTER TABLE source_chunks ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE evidence_points ADD COLUMN IF NOT EXISTS user_id text;
UPDATE evidence_points point SET user_id = experience.user_id
FROM experiences experience WHERE point.experience_id = experience.id AND point.user_id IS NULL;
ALTER TABLE evidence_points ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE merge_decisions ADD COLUMN IF NOT EXISTS user_id text;
UPDATE merge_decisions decision SET user_id = file.user_id
FROM files file WHERE decision.file_id = file.id AND decision.user_id IS NULL;
ALTER TABLE merge_decisions ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS user_id text;
UPDATE job_descriptions jd SET user_id = project.user_id
FROM resume_projects project WHERE jd.project_id = project.id AND jd.user_id IS NULL;
ALTER TABLE job_descriptions ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE resume_selections ADD COLUMN IF NOT EXISTS user_id text;
UPDATE resume_selections selection SET user_id = project.user_id
FROM resume_projects project WHERE selection.project_id = project.id AND selection.user_id IS NULL;
ALTER TABLE resume_selections ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS user_id text;
UPDATE resume_versions version SET user_id = project.user_id
FROM resume_projects project WHERE version.project_id = project.id AND version.user_id IS NULL;
ALTER TABLE resume_versions ALTER COLUMN user_id SET NOT NULL;

-- 3) 加索引。应用层每次查询均以当前登录用户的 UUID 过滤。
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
CREATE INDEX IF NOT EXISTS source_chunks_user_id_idx ON source_chunks(user_id);
CREATE INDEX IF NOT EXISTS experiences_user_id_idx ON experiences(user_id);
CREATE INDEX IF NOT EXISTS evidence_points_user_id_idx ON evidence_points(user_id);
CREATE INDEX IF NOT EXISTS merge_decisions_user_id_idx ON merge_decisions(user_id);
CREATE INDEX IF NOT EXISTS education_records_user_id_idx ON education_records(user_id);
CREATE INDEX IF NOT EXISTS resume_projects_user_id_idx ON resume_projects(user_id);
CREATE INDEX IF NOT EXISTS job_descriptions_user_id_idx ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS resume_selections_user_id_idx ON resume_selections(user_id);
CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx ON resume_versions(user_id);

-- 4) 行级安全：任何使用 Supabase API / 用户 JWT 的访问都只能命中自己的行。
ALTER TABLE library_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

-- 重复执行迁移时安全重建策略。
DROP POLICY IF EXISTS own_library_state ON library_state;
DROP POLICY IF EXISTS own_files ON files;
DROP POLICY IF EXISTS own_source_chunks ON source_chunks;
DROP POLICY IF EXISTS own_experiences ON experiences;
DROP POLICY IF EXISTS own_evidence_points ON evidence_points;
DROP POLICY IF EXISTS own_merge_decisions ON merge_decisions;
DROP POLICY IF EXISTS own_education_records ON education_records;
DROP POLICY IF EXISTS own_resume_profiles ON resume_profiles;
DROP POLICY IF EXISTS own_resume_projects ON resume_projects;
DROP POLICY IF EXISTS own_job_descriptions ON job_descriptions;
DROP POLICY IF EXISTS own_resume_selections ON resume_selections;
DROP POLICY IF EXISTS own_resume_versions ON resume_versions;

CREATE POLICY own_library_state ON library_state FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_files ON files FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_source_chunks ON source_chunks FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_experiences ON experiences FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_evidence_points ON evidence_points FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_merge_decisions ON merge_decisions FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_education_records ON education_records FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_resume_profiles ON resume_profiles FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_resume_projects ON resume_projects FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_job_descriptions ON job_descriptions FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_resume_selections ON resume_selections FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY own_resume_versions ON resume_versions FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- 5) 原始材料只放在私有 Storage bucket；对象路径固定为 <auth.uid()>/<uuid>.<ext>。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'experience-materials',
  'experience-materials',
  false,
  20971520,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS own_experience_materials ON storage.objects;
CREATE POLICY own_experience_materials ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'experience-materials' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'experience-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
