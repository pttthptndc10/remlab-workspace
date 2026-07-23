-- ============================================================
-- REMLAB WORKSPACE - KHÔI PHỤC TOÀN BỘ CƠ SỞ DỮ LIỆU & DỮ LIỆU TAB LINH KIỆN
-- (Chạy file này trong Supabase Dashboard -> SQL Editor)
-- ============================================================

-- 1. BẢNG PROFILES (Hồ sơ người dùng)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'leader', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  department TEXT,
  bio TEXT,
  github_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger tự động tạo Profile khi User Đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'member',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. BẢNG PROJECTS (Dự án)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'review', 'completed', 'paused')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. BẢNG PROJECT_MEMBERS
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, member_id)
);

-- 4. BẢNG TASKS (Công việc / Checklist)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'review', 'done', 'blocked', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  progress INT DEFAULT 0,
  checklist JSONB,
  notes TEXT,
  attachment_url TEXT,
  column_order INT DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. BẢNG PROJECT_WORK_LOGS
CREATE TABLE IF NOT EXISTS public.project_work_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  content TEXT,
  last_edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. BẢNG WORK_LOG_HISTORY
CREATE TABLE IF NOT EXISTS public.work_log_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  old_content TEXT,
  new_content TEXT,
  edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. BẢNG DISCUSSION_MESSAGES
CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  is_recalled BOOLEAN DEFAULT false,
  recalled_at TIMESTAMPTZ,
  recalled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. BẢNG MESSAGE_EDIT_HISTORY
CREATE TABLE IF NOT EXISTS public.message_edit_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.discussion_messages(id) ON DELETE CASCADE,
  old_content TEXT,
  new_content TEXT,
  edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. BẢNG COMPONENT_BATCHES & COMPONENT_FILES
CREATE TABLE IF NOT EXISTS public.component_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.component_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.component_batches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. BẢNG TASK_EVIDENCE
CREATE TABLE IF NOT EXISTS public.task_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('image','document','engineering','archive','video')),
  version INT NOT NULL DEFAULT 1,
  size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. BẢNG ACTIVITY_LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_log_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- DROP OLD POLICIES IF THEY EXIST TO PREVENT CONFLICTS
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read for projects" ON public.projects;
DROP POLICY IF EXISTS "Enable insert/update for projects" ON public.projects;
DROP POLICY IF EXISTS "Enable read for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert/update/delete for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable read for project_work_logs" ON public.project_work_logs;
DROP POLICY IF EXISTS "Enable write for project_work_logs" ON public.project_work_logs;
DROP POLICY IF EXISTS "Enable read for discussion_messages" ON public.discussion_messages;
DROP POLICY IF EXISTS "Enable insert for discussion_messages" ON public.discussion_messages;
DROP POLICY IF EXISTS "Enable update for discussion_messages" ON public.discussion_messages;
DROP POLICY IF EXISTS "Enable read for component_batches" ON public.component_batches;
DROP POLICY IF EXISTS "Enable write for component_batches" ON public.component_batches;
DROP POLICY IF EXISTS "Enable read for component_files" ON public.component_files;
DROP POLICY IF EXISTS "Enable write for component_files" ON public.component_files;
DROP POLICY IF EXISTS "Enable read for task_evidence" ON public.task_evidence;
DROP POLICY IF EXISTS "Enable insert for task_evidence" ON public.task_evidence;
DROP POLICY IF EXISTS "Enable delete for task_evidence" ON public.task_evidence;
DROP POLICY IF EXISTS "Enable read for activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Enable insert for activity_logs" ON public.activity_logs;

-- CREATE POLICIES
CREATE POLICY "Public profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Enable read for projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update for projects" ON public.projects FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for tasks" ON public.tasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for project_work_logs" ON public.project_work_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write for project_work_logs" ON public.project_work_logs FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for discussion_messages" ON public.discussion_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for discussion_messages" ON public.discussion_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Enable update for discussion_messages" ON public.discussion_messages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable read for component_batches" ON public.component_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write for component_batches" ON public.component_batches FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for component_files" ON public.component_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write for component_files" ON public.component_files FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for task_evidence" ON public.task_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for task_evidence" ON public.task_evidence FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Enable delete for task_evidence" ON public.task_evidence FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read for activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- TỰ ĐỘNG KHÔI PHỤC DỰ ÁN, TASKS VÀ TAB LINH KIỆN
-- ============================================================

DO $$
DECLARE
  v_project_id UUID;
  v_batch_id UUID;
  v_user_id UUID;
BEGIN
  -- Lấy user ID nếu đã có profile nào đó trong database
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;

  -- 1. Tạo lại Dự án "GẬY CÂN BẰNG PID" (nếu chưa có)
  SELECT id INTO v_project_id FROM public.projects WHERE name = 'GẬY CÂN BẰNG PID' LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO public.projects (name, description, deadline, status, priority, created_by)
    VALUES (
      'GẬY CÂN BẰNG PID',
      'Dự án chế tạo gậy cân bằng PID',
      '2026-08-01 00:00:00+00',
      'in_progress',
      'medium',
      v_user_id
    )
    RETURNING id INTO v_project_id;
  END IF;

  -- 2. Tạo lại các Công việc trong Checklist (nếu chưa có)
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE project_id = v_project_id AND title = 'code thuật') THEN
    INSERT INTO public.tasks (
      project_id, title, status, priority, progress, notes, start_date, deadline, assignee_id, created_by
    ) VALUES (
      v_project_id,
      'code thuật',
      'todo',
      'medium',
      0,
      'Ngày 1-3: đọc IMU, lọc dữ liệu, tính góc|notes-divider|Ngày 4-6: xuất dữ liệu serial, kiểm tra độ ổn định|notes-divider|Ngày 7-10: PID cơ',
      '2026-07-06 00:00:00+00',
      '2026-07-15 00:00:00+00',
      v_user_id,
      v_user_id
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE project_id = v_project_id AND title = 'lắp ráp cơ khí và PID') THEN
    INSERT INTO public.tasks (
      project_id, title, status, priority, progress, notes, assignee_id, created_by
    ) VALUES (
      v_project_id,
      'lắp ráp cơ khí và PID',
      'todo',
      'medium',
      0,
      '',
      v_user_id,
      v_user_id
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE project_id = v_project_id AND title = 'mua linh kiện và lắp thử') THEN
    INSERT INTO public.tasks (
      project_id, title, status, priority, progress, notes, start_date, deadline, assignee_id, created_by
    ) VALUES (
      v_project_id,
      'mua linh kiện và lắp thử',
      'todo',
      'medium',
      0,
      'từ ngày 1 tới ngày 3 t còn dưới quê chưa lên sài gòn nên trong tgian đó t sẽ chạy mô phỏng, còn 2 ngày cuối t sẽ mua linh kiện và chạy demo',
      '2026-07-01 00:00:00+00',
      '2026-07-05 00:00:00+00',
      v_user_id,
      v_user_id
    );
  END IF;

  -- 3. Tạo lại Phiên gom hàng (Component Batch)
  SELECT id INTO v_batch_id FROM public.component_batches WHERE status = 'active' LIMIT 1;

  IF v_batch_id IS NULL THEN
    INSERT INTO public.component_batches (name, status, created_by)
    VALUES ('Phiên gom linh kiện tháng 7', 'active', v_user_id)
    RETURNING id INTO v_batch_id;
  END IF;

  -- 4. KHÔI PHỤC DỮ LIỆU TAB LINH KIỆN (Component File)
  IF NOT EXISTS (SELECT 1 FROM public.component_files WHERE project_id = v_project_id) THEN
    INSERT INTO public.component_files (project_id, batch_id, created_by, content)
    VALUES (
      v_project_id,
      v_batch_id,
      v_user_id,
      '[
        {
          "id": "comp-1",
          "name": "Module cảm biến MPU6050 (Gia tốc & Góc nghiêng)",
          "price": 45000,
          "quantity": 2,
          "shop": "Shopee - Linh Kiện NTM",
          "notes": "Dùng đo góc nghiêng gậy cân bằng"
        },
        {
          "id": "comp-2",
          "name": "Động cơ DC giảm tốc GA25 (12V 300RPM)",
          "price": 120000,
          "quantity": 2,
          "shop": "Lazada - Robotics Store",
          "notes": "Động cơ tạo lực mô-men xoắn giữ cân bằng"
        },
        {
          "id": "comp-3",
          "name": "Mạch điều khiển công suất động cơ L298N",
          "price": 35000,
          "quantity": 1,
          "shop": "Linh Kiện ST",
          "notes": "Mạch cầu H điều khiển chiều & tốc độ động cơ"
        },
        {
          "id": "comp-4",
          "name": "Bo mạch vi điều khiển Arduino Uno R3 (CH340)",
          "price": 130000,
          "quantity": 1,
          "shop": "Minh Hà Electronics",
          "notes": "Nạp thuật toán PID điều khiển cân bằng"
        }
      ]'::jsonb
    );
  END IF;

END $$;
