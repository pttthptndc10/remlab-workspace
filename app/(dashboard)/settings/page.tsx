'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Save, User, GitBranch, Phone, Building2, FileText } from 'lucide-react'

interface ProfileFormState {
  full_name: string
  department: string
  bio: string
  github_url: string
  phone: string
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading } = useAuth()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<ProfileFormState>({
    full_name: '',
    department: '',
    bio: '',
    github_url: '',
    phone: '',
  })

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name ?? '',
        department: user.department ?? '',
        bio: user.bio ?? '',
        github_url: user.github_url ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!form.full_name.trim()) {
      toast.error('Họ và tên không được để trống')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          department: form.department.trim() || null,
          bio: form.bio.trim() || null,
          github_url: form.github_url.trim() || null,
          phone: form.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Cập nhật thông tin thành công!')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell title="Cài đặt" subtitle="Quản lý thông tin cá nhân">
        <div className="glass-card p-8 animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 skeleton rounded-xl" />
          ))}
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Cài đặt" subtitle="Quản lý thông tin cá nhân">
      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Profile Info */}
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            Thông tin cá nhân
          </h3>

          <form id="settings-profile-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="settings-full-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Họ và tên <span className="text-rose-400">*</span>
              </label>
              <input
                id="settings-full-name"
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Nhập họ và tên..."
                className="input-dark w-full"
                required
              />
            </div>

            {/* Department */}
            <div>
              <label htmlFor="settings-department" className="block text-sm font-medium text-slate-300 mb-1.5">
                <Building2 className="inline w-3.5 h-3.5 mr-1" />
                Phòng ban / Bộ phận
              </label>
              <input
                id="settings-department"
                type="text"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="Ví dụ: Frontend, Backend, Design..."
                className="input-dark w-full"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="settings-bio" className="block text-sm font-medium text-slate-300 mb-1.5">
                <FileText className="inline w-3.5 h-3.5 mr-1" />
                Giới thiệu bản thân
              </label>
              <textarea
                id="settings-bio"
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Mô tả ngắn về bản thân..."
                rows={3}
                className="input-dark w-full resize-none"
              />
            </div>

            {/* GitHub URL */}
            <div>
              <label htmlFor="settings-github" className="block text-sm font-medium text-slate-300 mb-1.5">
                <GitBranch className="inline w-3.5 h-3.5 mr-1" />
                GitHub URL
              </label>
              <input
                id="settings-github"
                type="url"
                value={form.github_url}
                onChange={(e) => setForm((p) => ({ ...p, github_url: e.target.value }))}
                placeholder="https://github.com/username"
                className="input-dark w-full"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-300 mb-1.5">
                <Phone className="inline w-3.5 h-3.5 mr-1" />
                Số điện thoại
              </label>
              <input
                id="settings-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="0xxxxxxxxx"
                className="input-dark w-full"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                id="settings-save-btn"
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={saving}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>

        {/* Account info (read-only) */}
        {user && (
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-white mb-4">Thông tin tài khoản</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-slate-400">ID</span>
                <span className="text-xs text-slate-500 font-mono truncate max-w-xs">{user.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-slate-400">Vai trò</span>
                <span className="text-sm text-white capitalize">{user.role}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-400">Tham gia</span>
                <span className="text-sm text-white">{new Date(user.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
