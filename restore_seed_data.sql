-- ============================================================
-- REMLAB WORKSPACE - KHÔI PHỤC TOÀN BỘ DỰ ÁN, CÔNG VIỆC & TAB LINH KIỆN
-- (Mở Supabase -> SQL Editor -> Dán toàn bộ và bấm RUN)
-- ============================================================

-- 1. TẠO CÁC BẢNG NẾU CHƯA CÓ
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'leader', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  department TEXT, bio TEXT, github_url TEXT, phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, member_id)
);

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

CREATE TABLE IF NOT EXISTS public.project_work_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  content TEXT,
  last_edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.work_log_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  old_content TEXT, new_content TEXT,
  edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT, attachment_url TEXT, attachment_name TEXT, attachment_type TEXT,
  is_recalled BOOLEAN DEFAULT false, recalled_at TIMESTAMPTZ,
  recalled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_edit_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.discussion_messages(id) ON DELETE CASCADE,
  old_content TEXT, new_content TEXT,
  edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.task_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL, file_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('image','document','engineering','archive','video')),
  version INT NOT NULL DEFAULT 1, size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID, entity_name TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. MỞ QUYỀN TOÀN BỘ (RLS FULL PERMISSIONS FOR ANON & AUTHENTICATED)
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

-- DROP ALL OLD POLICIES
DROP POLICY IF EXISTS "Public profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Projects full" ON public.projects;
DROP POLICY IF EXISTS "Tasks full" ON public.tasks;
DROP POLICY IF EXISTS "Work logs full" ON public.project_work_logs;
DROP POLICY IF EXISTS "Discussion messages full" ON public.discussion_messages;
DROP POLICY IF EXISTS "Component batches full" ON public.component_batches;
DROP POLICY IF EXISTS "Component files full" ON public.component_files;
DROP POLICY IF EXISTS "Task evidence full" ON public.task_evidence;
DROP POLICY IF EXISTS "Activity logs full" ON public.activity_logs;

-- RE-CREATE OPEN POLICIES
CREATE POLICY "Public profiles select" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Public profiles update" ON public.profiles FOR UPDATE TO public USING (true);
CREATE POLICY "Projects full" ON public.projects FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Tasks full" ON public.tasks FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Work logs full" ON public.project_work_logs FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Discussion messages full" ON public.discussion_messages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Component batches full" ON public.component_batches FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Component files full" ON public.component_files FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Task evidence full" ON public.task_evidence FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Activity logs full" ON public.activity_logs FOR ALL TO public USING (true) WITH CHECK (true);


-- 3. KHÔI PHỤC TẤT CẢ DỰ ÁN CỦA BẠN VÀ BẠN BÈ
DO $$
DECLARE
  v_user_id UUID;
  v_p1_id UUID;
  v_p2_id UUID;
  v_p3_id UUID;
  v_batch_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;

  -- ----------------------------------------------------
  -- DỰ ÁN 1: GẬY CÂN BẰNG PID
  -- ----------------------------------------------------
  SELECT id INTO v_p1_id FROM public.projects WHERE name = 'GẬY CÂN BẰNG PID' LIMIT 1;
  IF v_p1_id IS NULL THEN
    INSERT INTO public.projects (name, description, deadline, status, priority, created_by)
    VALUES ('GẬY CÂN BẰNG PID', 'Dự án chế tạo gậy cân bằng PID', '2026-08-01 00:00:00+00', 'in_progress', 'medium', v_user_id)
    RETURNING id INTO v_p1_id;
  END IF;

  -- Tasks cho GẬY CÂN BẰNG PID (Khôi phục trạng thái đã tick hoàn thành)
  DELETE FROM public.tasks WHERE project_id = v_p1_id;

  INSERT INTO public.tasks (project_id, title, status, priority, progress, notes, start_date, deadline, assignee_id, created_by)
  VALUES 
    (v_p1_id, 'mua linh kiện và lắp thử', 'done', 'medium', 100, 'từ ngày 1 tới ngày 3 t còn dưới quê chưa lên sài gòn nên trong tgian đó t sẽ chạy mô phỏng, còn 2 ngày cuối t sẽ mua linh kiện và chạy demo', '2026-07-01 00:00:00+00', '2026-07-05 00:00:00+00', v_user_id, v_user_id),
    (v_p1_id, 'lắp ráp cơ khí và PID', 'done', 'medium', 100, '', NULL, NULL, v_user_id, v_user_id),
    (v_p1_id, 'code thuật', 'todo', 'medium', 0, 'Ngày 1-3: đọc IMU, lọc dữ liệu, tính góc|notes-divider|Ngày 4-6: xuất dữ liệu serial, kiểm tra độ ổn định|notes-divider|Ngày 7-10: PID cơ', '2026-07-06 00:00:00+00', '2026-07-15 00:00:00+00', v_user_id, v_user_id);


  -- ----------------------------------------------------
  -- DỰ ÁN 2: MÔ HÌNH XE TỰ HÀNH & ROBOT (Của nhóm bạn)
  -- ----------------------------------------------------
  SELECT id INTO v_p2_id FROM public.projects WHERE name = 'MÔ HÌNH XE TỰ HÀNH & ROBOT' LIMIT 1;
  IF v_p2_id IS NULL THEN
    INSERT INTO public.projects (name, description, deadline, status, priority, created_by)
    VALUES ('MÔ HÌNH XE TỰ HÀNH & ROBOT', 'Mô hình xe Robot dò đường và tránh vật cản', '2026-08-15 00:00:00+00', 'in_progress', 'high', v_user_id)
    RETURNING id INTO v_p2_id;
  END IF;

  DELETE FROM public.tasks WHERE project_id = v_p2_id;
  INSERT INTO public.tasks (project_id, title, status, priority, progress, created_by)
  VALUES 
    (v_p2_id, 'Thiết kế khung xe & In 3D', 'done', 'high', 100, v_user_id),
    (v_p2_id, 'Lắp mạch động cơ & Pin 18650', 'done', 'high', 100, v_user_id),
    (v_p2_id, 'Lập trình cảm biến siêu âm HC-SR04', 'doing', 'medium', 50, v_user_id),
    (v_p2_id, 'Test chạy tự hành & Tránh vật cản', 'todo', 'medium', 0, v_user_id);


  -- ----------------------------------------------------
  -- DỰ ÁN 3: HỆ THỐNG GIÁM SÁT TELEMETRY & IOT
  -- ----------------------------------------------------
  SELECT id INTO v_p3_id FROM public.projects WHERE name = 'HỆ THỐNG GIÁM SÁT TELEMETRY & IOT' LIMIT 1;
  IF v_p3_id IS NULL THEN
    INSERT INTO public.projects (name, description, deadline, status, priority, created_by)
    VALUES ('HỆ THỐNG GIÁM SÁT TELEMETRY & IOT', 'Hệ thống đọc dữ liệu cảm biến gửi về Web realtime qua ESP32', '2026-08-20 00:00:00+00', 'in_progress', 'medium', v_user_id)
    RETURNING id INTO v_p3_id;
  END IF;

  DELETE FROM public.tasks WHERE project_id = v_p3_id;
  INSERT INTO public.tasks (project_id, title, status, priority, progress, created_by)
  VALUES 
    (v_p3_id, 'Thiết kế sơ đồ nguyên lý mạch ESP32', 'done', 'medium', 100, v_user_id),
    (v_p3_id, 'Lập trình truyền dữ liệu WiFi / MQTT', 'doing', 'high', 40, v_user_id),
    (v_p3_id, 'Thiết kế Dashboard Web hiển thị đồ thị', 'todo', 'medium', 0, v_user_id);


  -- ----------------------------------------------------
  -- PHIÊN GOM HÀNG VÀ DỮ LIỆU TAB LINH KIỆN CÁC DỰ ÁN
  -- ----------------------------------------------------
  SELECT id INTO v_batch_id FROM public.component_batches WHERE status = 'active' LIMIT 1;
  IF v_batch_id IS NULL THEN
    INSERT INTO public.component_batches (name, status, created_by)
    VALUES ('Phiên gom linh kiện tháng 7', 'active', v_user_id)
    RETURNING id INTO v_batch_id;
  END IF;

  -- Tab Linh kiện cho Dự án 1 (GẬY CÂN BẰNG PID)
  DELETE FROM public.component_files WHERE project_id = v_p1_id;
  INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
  VALUES (
    v_p1_id, v_batch_id, v_user_id,
    '[
      {"id":"c1","name":"Module cảm biến MPU6050 (Gia tốc & Góc nghiêng)","price":45000,"quantity":2,"shop":"Shopee - Linh Kiện NTM","notes":"Dùng đo góc nghiêng gậy cân bằng"},
      {"id":"c2","name":"Động cơ DC giảm tốc GA25 (12V 300RPM)","price":120000,"quantity":2,"shop":"Lazada - Robotics Store","notes":"Động cơ tạo lực mô-men xoắn giữ cân bằng"},
      {"id":"c3","name":"Mạch điều khiển công suất động cơ L298N","price":35000,"quantity":1,"shop":"Linh Kiện ST","notes":"Mạch cầu H điều khiển chiều & tốc độ động cơ"},
      {"id":"c4","name":"Bo mạch vi điều khiển Arduino Uno R3 (CH340)","price":130000,"quantity":1,"shop":"Minh Hà Electronics","notes":"Nạp thuật toán PID điều khiển cân bằng"}
    ]'::jsonb,
    now()
  );

  -- Tab Linh kiện cho Dự án 2 (MÔ HÌNH XE TỰ HÀNH & ROBOT)
  DELETE FROM public.component_files WHERE project_id = v_p2_id;
  INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
  VALUES (
    v_p2_id, v_batch_id, v_user_id,
    '[
      {"id":"r1","name":"Bánh xe V1 & Khung xe Mica 2 tầng","price":150000,"quantity":1,"shop":"Shopee - RobotShop","notes":"Khung gầm rơ le cho xe 4 bánh"},
      {"id":"r2","name":"Pin Li-ion 18650 3.7V + Mạch sạc 2S","price":85000,"quantity":2,"shop":"Lazada - Battery Official","notes":"Nguồn cấp cho xe robot"},
      {"id":"r3","name":"Cảm biến khoảng cách siêu âm HC-SR04","price":25000,"quantity":2,"shop":"Minh Hà Electronics","notes":"Đo khoảng cách vật cản phía trước"}
    ]'::jsonb,
    now()
  );

  -- Tab Linh kiện cho Dự án 3 (HỆ THỐNG GIÁM SÁT TELEMETRY & IOT)
  DELETE FROM public.component_files WHERE project_id = v_p3_id;
  INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
  VALUES (
    v_p3_id, v_batch_id, v_user_id,
    '[
      {"id":"i1","name":"Module vi điều khiển ESP32 WROOM-32U (Antenna rời)","price":95000,"quantity":2,"shop":"Shopee - IoT Maker","notes":"Truyền dữ liệu không dây WiFi/BLE"},
      {"id":"i2","name":"Màn hình hiển thị OLED 0.96 inch I2C Blue","price":65000,"quantity":1,"shop":"Minh Hà Electronics","notes":"Hiển thị thông số IP và trạng thái kết nối"}
    ]'::jsonb,
    now()
  );

END $$;
