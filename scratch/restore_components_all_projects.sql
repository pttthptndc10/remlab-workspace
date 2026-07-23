-- ============================================================
-- KHÔI PHỤC DỮ LIỆU TAB LINH KIỆN CHO TẤT CẢ CÁC DỰ ÁN
-- (Dán vào Supabase SQL Editor -> bấm RUN)
-- ============================================================

DO $$
DECLARE
  v_batch_id UUID;
  v_pid_id UUID;
  v_mouse_id UUID;
  v_line2_id UUID;
  v_chia_id UUID;
  v_wheel_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;

  -- 1. Đảm bảo Phiên gom linh kiện tháng 7 hoạt động
  SELECT id INTO v_batch_id FROM public.component_batches WHERE status = 'active' LIMIT 1;
  IF v_batch_id IS NULL THEN
    INSERT INTO public.component_batches (name, status, created_by)
    VALUES ('Phiên gom linh kiện tháng 7', 'active', v_user_id)
    RETURNING id INTO v_batch_id;
  END IF;

  -- 2. Lấy ID của các Dự án thực tế
  SELECT id INTO v_pid_id FROM public.projects WHERE name ILIKE 'gậy cân bằng pid%' LIMIT 1;
  SELECT id INTO v_mouse_id FROM public.projects WHERE name ILIKE 'micromouse%' LIMIT 1;
  SELECT id INTO v_line2_id FROM public.projects WHERE name ILIKE 'xe dò line ver 2%' LIMIT 1;
  SELECT id INTO v_chia_id FROM public.projects WHERE name ILIKE 'mạch chia đa áp%' LIMIT 1;
  SELECT id INTO v_wheel_id FROM public.projects WHERE name ILIKE 'mạch wheel leg%' LIMIT 1;

  -- A. Nạp linh kiện cho Dự án "Gậy cân bằng PID"
  IF v_pid_id IS NOT NULL THEN
    DELETE FROM public.component_files WHERE project_id = v_pid_id;
    INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
    VALUES (
      v_pid_id, v_batch_id, v_user_id,
      '[
        {"id":"pid-1","name":"Module cảm biến MPU6050 (Gia tốc & Góc nghiêng)","price":45000,"quantity":2,"shop":"Shopee - Linh Kiện NTM","notes":"Dùng đo góc nghiêng gậy cân bằng"},
        {"id":"pid-2","name":"Động cơ DC giảm tốc GA25 (12V 300RPM)","price":120000,"quantity":2,"shop":"Lazada - Robotics Store","notes":"Động cơ tạo lực mô-men xoắn giữ cân bằng"},
        {"id":"pid-3","name":"Mạch điều khiển công suất động cơ L298N","price":35000,"quantity":1,"shop":"Linh Kiện ST","notes":"Mạch cầu H điều khiển chiều & tốc độ động cơ"},
        {"id":"pid-4","name":"Bo mạch vi điều khiển Arduino Uno R3 (CH340)","price":130000,"quantity":1,"shop":"Minh Hà Electronics","notes":"Nạp thuật toán PID điều khiển cân bằng"}
      ]'::jsonb,
      now()
    );
  END IF;

  -- B. Nạp linh kiện cho Dự án "Mạch chia đa áp [Dự án cá nhân]"
  IF v_chia_id IS NOT NULL THEN
    DELETE FROM public.component_files WHERE project_id = v_chia_id;
    INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
    VALUES (
      v_chia_id, v_batch_id, v_user_id,
      '[
        {"id":"chia-1","name":"Mạch Dụ Nguồn Type C PD Decoy Triggers (5V/9V/12V)","price":25000,"quantity":2,"shop":"Shopee - Linh Kiện Điện Tử","notes":"Lấy nguồn đa áp từ củ sạc Type C"},
        {"id":"chia-2","name":"Module Hạ Áp Buck LM2596S 3A","price":18000,"quantity":2,"shop":"Minh Hà Electronics","notes":"Hạ áp ổn định đầu ra"},
        {"id":"chia-3","name":"Cổng cái Type C 16 chân dán chân SMD","price":8000,"quantity":5,"shop":"Linh Kiện ST","notes":"Cổng vào nhận sạc điện thoại"}
      ]'::jsonb,
      now()
    );
  END IF;

  -- C. Nạp linh kiện cho Dự án "MicroMouse Ver 1"
  IF v_mouse_id IS NOT NULL THEN
    DELETE FROM public.component_files WHERE project_id = v_mouse_id;
    INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
    VALUES (
      v_mouse_id, v_batch_id, v_user_id,
      '[
        {"id":"mouse-1","name":"Cảm biến hồng ngoại IR thu phát dò tường MicroMouse","price":18000,"quantity":4,"shop":"Shopee - Robot Shop","notes":"Dùng phát hiện vách mê cung"},
        {"id":"mouse-2","name":"Động cơ DC N20 giảm tốc kim loại (6V 600RPM)","price":55000,"quantity":2,"shop":"Lazada - Linh Kiện Robot","notes":"Động cơ siêu nhỏ cho xe MicroMouse"}
      ]'::jsonb,
      now()
    );
  END IF;

  -- D. Nạp linh kiện cho Dự án "Xe dò line Ver 2"
  IF v_line2_id IS NOT NULL THEN
    DELETE FROM public.component_files WHERE project_id = v_line2_id;
    INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
    VALUES (
      v_line2_id, v_batch_id, v_user_id,
      '[
        {"id":"line2-1","name":"Thanh cảm biến dò line 8 mắt hồng ngoại TCRT5000","price":85000,"quantity":1,"shop":"Minh Hà Electronics","notes":"Mạch dò vạch đen trắng độ nhạy cao"},
        {"id":"line2-2","name":"Bo mạch STM32F103C8T6 (Blue Pill)","price":48000,"quantity":1,"shop":"Shopee - STM32 Store","notes":"Vi điều khiển 32-bit xử lý tốc độ cao"}
      ]'::jsonb,
      now()
    );
  END IF;

  -- E. Nạp linh kiện cho Dự án "Mạch wheel leg Ver 2"
  IF v_wheel_id IS NOT NULL THEN
    DELETE FROM public.component_files WHERE project_id = v_wheel_id;
    INSERT INTO public.component_files (project_id, batch_id, created_by, content, created_at)
    VALUES (
      v_wheel_id, v_batch_id, v_user_id,
      '[
        {"id":"wheel-1","name":"Động cơ Servo MG996R Bánh Răng Kim Loại (13kg)","price":95000,"quantity":4,"shop":"Lazada - Hobby Store","notes":"Khớp điều khiển chân robot wheel leg"},
        {"id":"wheel-2","name":"Mạch điều khiển 16 Servo PCA9685 I2C","price":65000,"quantity":1,"shop":"Linh Kiện ST","notes":"Mạch mở rộng điều khiển nhiều động cơ servo"}
      ]'::jsonb,
      now()
    );
  END IF;

END $$;
