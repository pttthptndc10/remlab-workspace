# RemLab Workspace

Hệ thống quản lý nội bộ cho đội kỹ thuật RemLab. Xây dựng với Next.js 14, TypeScript, TailwindCSS, và Supabase.

```
 ____                _          _     
|  _ \ ___ _ __ ___ | |    __ _| |__  
| |_) / _ \ '_ ` _ \| |   / _` | '_ \ 
|  _ <  __/ | | | | | |__| (_| | |_) |
|_| \_\___|_| |_| |_|_____\__,_|_.__/ 
                                        Workspace
```

## Tính năng

- 🔐 **Authentication**: Đăng nhập/đăng ký qua Supabase Auth, phân quyền Admin/Leader/Member
- 📊 **Dashboard**: Tổng quan team, thống kê dự án và công việc
- 📁 **Quản lý dự án**: CRUD dự án, phân công thành viên, theo dõi tiến độ
- 🎯 **Kanban Board**: Drag & drop task giữa các cột (Todo/Doing/Review/Done/Blocked)
- 👥 **Member Profiles**: Trang cá nhân với biểu đồ tiến độ
- ⚡ **Realtime**: Cập nhật hoạt động nhóm theo thời gian thực
- 📈 **Báo cáo**: Thống kê tuần, export CSV

## Tech Stack

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Next.js | 14 (App Router) | Framework |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 4.x | Styling |
| Supabase | latest | DB + Auth + Realtime |
| dnd-kit | latest | Drag & Drop |
| Recharts | latest | Charts |
| lucide-react | latest | Icons |

## Cài đặt và Chạy

### Yêu cầu
- Node.js v20+ (đã có tại `D:\nodejs\node`)
- Tài khoản Supabase (miễn phí)

---

### Bước 1: Tạo Supabase Project

1. Truy cập [https://supabase.com](https://supabase.com) → **Sign up** (miễn phí)
2. Click **New Project** → Chọn tên project: `remlab-workspace`
3. Chọn mật khẩu database và region (Singapore gần nhất)
4. Đợi project khởi tạo (~1-2 phút)

**Lấy API Keys:**
- Vào **Project Settings** → **API**
- Copy **Project URL** → đây là `SUPABASE_URL`
- Copy **anon public** key → đây là `SUPABASE_ANON_KEY`

```
Project URL:  https://xxxxxxxxxxxx.supabase.co
anon key:     eyJhbGci...  (rất dài)
```

---

### Bước 2: Cấu hình Database

1. Vào **SQL Editor** trong Supabase Dashboard
2. Click **New Query**
3. Copy toàn bộ nội dung file `supabase/schema.sql` → Paste vào → **Run**
4. Đợi thông báo thành công

---

### Bước 3: Tạo tài khoản demo

1. Vào **Authentication** → **Users** → **Add User**
2. Tạo lần lượt 5 tài khoản:

| Email | Password | Role (sau khi tạo) |
|-------|----------|-----|
| admin@remlab.dev | remlab2024 | admin |
| leader1@remlab.dev | remlab2024 | leader |
| member1@remlab.dev | remlab2024 | member |
| member2@remlab.dev | remlab2024 | member |
| member3@remlab.dev | remlab2024 | member |

3. Sau khi tạo xong, vào **SQL Editor** → chạy file `supabase/seed.sql`

---

### Bước 4: Cài đặt project

```powershell
# Di chuyển vào thư mục project
cd D:\QUAN_LY_REMLAB\remlab-workspace

# Tạo file .env.local
cp .env.local.example .env.local
```

Mở file `.env.local` và điền thông tin:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Cài dependencies (nếu chưa):
```powershell
$env:PATH = "D:\nodejs\node;$env:PATH"
npm install
```

---

### Bước 5: Chạy locally

```powershell
$env:PATH = "D:\nodejs\node;$env:PATH"
npm run dev
```

Mở trình duyệt: **http://localhost:3000**

Đăng nhập với: `admin@remlab.dev` / `remlab2024`

---

## Deploy lên Vercel

### Bước 1: Push code lên GitHub
```powershell
cd D:\QUAN_LY_REMLAB\remlab-workspace
git init
git add .
git commit -m "feat: RemLab Workspace MVP"
# Tạo repo trên GitHub rồi:
git remote add origin https://github.com/username/remlab-workspace.git
git push -u origin main
```

### Bước 2: Deploy trên Vercel
1. Vào [https://vercel.com](https://vercel.com) → **New Project**
2. Import từ GitHub repo
3. Thêm Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** → Đợi ~2 phút

---

## Cấu trúc thư mục

```
remlab-workspace/
├── app/
│   ├── (auth)/         # Login, Register
│   ├── (dashboard)/    # Các trang sau login
│   │   ├── dashboard/  # Trang chủ
│   │   ├── projects/   # Dự án + Kanban
│   │   ├── tasks/      # Tất cả tasks
│   │   ├── members/    # Thành viên
│   │   ├── activity/   # Nhật ký hoạt động
│   │   ├── reports/    # Báo cáo
│   │   └── settings/   # Cài đặt
│   └── api/            # API routes (nếu cần)
├── components/
│   ├── ui/             # Badge, Modal, ProgressBar
│   ├── layout/         # Sidebar, Header, DashboardShell
│   ├── dashboard/      # StatCard, MissionBlock
│   ├── projects/       # ProjectCard, ProjectForm
│   ├── kanban/         # KanbanBoard, Column, TaskCard
│   ├── tasks/          # TaskModal, TaskForm
│   └── members/        # ProgressChart
├── lib/
│   ├── supabase/       # Client, Server, Middleware
│   ├── hooks/          # useAuth, useTasks, useRealtimeActivity
│   ├── types/          # TypeScript interfaces
│   └── utils/          # Helpers, formatters, CSV
└── supabase/
    ├── schema.sql      # Database schema
    └── seed.sql        # Dữ liệu mẫu
```

## Phân quyền

| Chức năng | Admin | Leader | Member |
|-----------|-------|--------|--------|
| Xem tất cả | ✅ | ✅ | ✅ |
| Tạo/sửa project | ✅ | ✅ | ❌ |
| Xóa project | ✅ | ❌ | ❌ |
| Tạo/sửa task | ✅ | ✅ | Chỉ task mình |
| Quản lý users | ✅ | ❌ | ❌ |
| Xem báo cáo | ✅ | ✅ | ✅ |

## Liên hệ

**RemLab Team** — Xây dựng tương lai bằng code 🚀
