'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn, formatDateTime, ROLE_LABELS } from '@/lib/utils'
import {
  Shield, Users, Mail, History, Plus, Search, Trash2,
  RefreshCw, XCircle, Copy, Check, AlertCircle, KeyRound, Loader2, UserCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AllowedMember {
  id: string
  email: string
  role: 'admin' | 'leader' | 'member'
  status: 'active' | 'inactive'
  invited_by: string | null
  created_at: string
}

interface Invitation {
  id: string
  email: string
  role: 'admin' | 'leader' | 'member'
  token: string
  invited_by: string | null
  expires_at: string
  used: boolean
  created_at: string
}

interface AuditLog {
  id: string
  admin_user_id: string | null
  target_user_id: string | null
  target_email: string
  action: string
  old_role: string | null
  new_role: string | null
  old_status: string | null
  new_status: string | null
  created_at: string
  admin_email?: string
}

interface DBProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: 'admin' | 'leader' | 'member'
  status: 'active' | 'inactive'
}

type TabType = 'members' | 'invites' | 'transfer' | 'logs'

export default function AdminMembersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user: currentUser, loading: authLoading, isAdmin } = useAuth()

  // Tabs & Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [loadingData, setLoadingData] = useState(true)

  // DB Data States
  const [allowedMembers, setAllowedMembers] = useState<AllowedMember[]>([])
  const [profiles, setProfiles] = useState<DBProfile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Modal States
  const [isAddWhitelistOpen, setIsAddWhitelistOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'leader' | 'member'>('member')
  const [submittingAdd, setSubmittingAdd] = useState(false)

  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'leader' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [generatedInviteLink, setGeneratedInviteLink] = useState('')

  // Ownership Transfer Form
  const [transferTargetId, setTransferTargetId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [transferring, setTransferring] = useState(false)

  // Fetch Data Function
  const fetchData = async () => {
    setLoadingData(true)
    try {
      // Fetch allowed members
      const { data: allowed, error: allowedErr } = await supabase
        .from('allowed_members')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch profiles
      const { data: profs, error: profsErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, role, status')

      // Fetch invitations
      const { data: invites, error: invitesErr } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch audit logs
      const { data: logs, error: logsErr } = await supabase
        .from('member_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (allowedErr) throw allowedErr
      if (profsErr) throw profsErr
      if (invitesErr) throw invitesErr
      if (logsErr) throw logsErr

      setAllowedMembers(allowed || [])
      setProfiles(profs || [])
      setInvitations(invites || [])
      
      // Map admin email to audit logs for display
      const mappedLogs = (logs || []).map(log => {
        const adminProfile = (profs || []).find(p => p.id === log.admin_user_id)
        return {
          ...log,
          admin_email: adminProfile?.email || log.admin_user_id || 'Hệ thống'
        }
      })
      setAuditLogs(mappedLogs)
    } catch (err: any) {
      console.error(err)
      toast.error('Lỗi tải dữ liệu: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!authLoading && currentUser && isAdmin) {
      fetchData()
    }
  }, [authLoading, currentUser, isAdmin])

  // Combine Whitelist entries with actual Profile info
  const combinedMembers = useMemo(() => {
    return allowedMembers.map(allowed => {
      const profile = profiles.find(p => p.email?.toLowerCase() === allowed.email.toLowerCase())
      return {
        id: allowed.id,
        email: allowed.email,
        role: allowed.role,
        status: allowed.status,
        profileId: profile?.id,
        fullName: profile?.full_name || 'Chờ đăng ký',
        hasRegistered: !!profile,
        created_at: allowed.created_at
      }
    })
  }, [allowedMembers, profiles])

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return combinedMembers.filter(m => {
      const matchesSearch = m.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === 'all' || m.role === roleFilter
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'active' && m.status === 'active') ||
                            (statusFilter === 'inactive' && m.status === 'inactive') ||
                            (statusFilter === 'pending' && !m.hasRegistered)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [combinedMembers, searchQuery, roleFilter, statusFilter])

  // Check if a member is the last active Admin
  const isLastActiveAdmin = (email: string) => {
    const activeAdmins = combinedMembers.filter(
      m => m.role === 'admin' && m.status === 'active' && m.hasRegistered
    )
    return activeAdmins.length <= 1 && activeAdmins.some(a => a.email.toLowerCase() === email.toLowerCase())
  }

  // Add Email to Whitelist
  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    setSubmittingAdd(true)
    try {
      const emailFormatted = newEmail.trim().toLowerCase()
      const { error } = await supabase
        .from('allowed_members')
        .insert({
          email: emailFormatted,
          role: newRole,
          status: 'active'
        })

      if (error) throw error

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_email: emailFormatted,
        action: 'add_whitelist',
        new_role: newRole,
        new_status: 'active'
      })

      toast.success(`Đã thêm ${emailFormatted} vào whitelist với quyền ${ROLE_LABELS[newRole]}`)
      setNewEmail('')
      setIsAddWhitelistOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error('Không thể thêm whitelist: ' + (err.message.includes('duplicate key') ? 'Email đã tồn tại' : err.message))
    } finally {
      setSubmittingAdd(false)
    }
  }

  // Update Member Role
  const handleUpdateRole = async (email: string, targetProfileId: string | undefined, currentRole: string, targetRole: 'admin' | 'leader' | 'member') => {
    if (currentRole === targetRole) return

    // Critical protection rule
    if (currentRole === 'admin' && isLastActiveAdmin(email)) {
      toast.error('Hệ thống phải luôn có ít nhất một Admin.')
      return
    }

    try {
      const { error } = await supabase
        .from('allowed_members')
        .update({ role: targetRole })
        .eq('email', email)

      if (error) throw error

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_user_id: targetProfileId,
        target_email: email,
        action: 'change_role',
        old_role: currentRole,
        new_role: targetRole
      })

      toast.success(`Đã đổi vai trò của ${email} thành ${ROLE_LABELS[targetRole]}`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi cập nhật vai trò: ' + err.message)
    }
  }

  // Update Member Status
  const handleToggleStatus = async (email: string, targetProfileId: string | undefined, currentStatus: 'active' | 'inactive') => {
    const targetStatus = currentStatus === 'active' ? 'inactive' : 'active'

    // Critical protection rule
    if (currentStatus === 'active' && isLastActiveAdmin(email)) {
      toast.error('Hệ thống phải luôn có ít nhất một Admin.')
      return
    }

    try {
      const { error } = await supabase
        .from('allowed_members')
        .update({ status: targetStatus })
        .eq('email', email)

      if (error) throw error

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_user_id: targetProfileId,
        target_email: email,
        action: targetStatus === 'active' ? 'activate_member' : 'deactivate_member',
        old_status: currentStatus,
        new_status: targetStatus
      })

      toast.success(`Đã ${targetStatus === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản ${email}`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi cập nhật trạng thái: ' + err.message)
    }
  }

  // Delete/Remove Member
  const handleRemoveMember = async (email: string, targetProfileId: string | undefined, currentRole: string) => {
    if (currentRole === 'admin' && isLastActiveAdmin(email)) {
      toast.error('Hệ thống phải luôn có ít nhất một Admin.')
      return
    }

    if (!confirm(`Bạn có chắc muốn xóa thành viên ${email} khỏi hệ thống? Họ sẽ mất toàn bộ quyền truy cập.`)) {
      return
    }

    try {
      // 1. Delete from allowed_members whitelist
      const { error: whitelistErr } = await supabase
        .from('allowed_members')
        .delete()
        .eq('email', email)

      if (whitelistErr) throw whitelistErr

      // 2. Delete from profiles (Cascade trigger inside DB will handle other links if configured, otherwise we just delete profile)
      if (targetProfileId) {
        await supabase.from('profiles').delete().eq('id', targetProfileId)
      }

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_user_id: targetProfileId,
        target_email: email,
        action: 'remove_member'
      })

      toast.success(`Đã xóa thành viên ${email} khỏi hệ thống`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi khi xóa thành viên: ' + err.message)
    }
  }

  // Generate Invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setGeneratedInviteLink('')

    try {
      const emailFormatted = inviteEmail.trim().toLowerCase()
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

      // 1. Create invitation
      const { error: inviteErr } = await supabase
        .from('invitations')
        .insert({
          email: emailFormatted,
          role: inviteRole,
          token: token,
          invited_by: currentUser?.id,
          expires_at: expiresAt.toISOString(),
          used: false
        })

      if (inviteErr) throw inviteErr

      // 2. Add to whitelist (allowed_members)
      const { error: whitelistErr } = await supabase
        .from('allowed_members')
        .insert({
          email: emailFormatted,
          role: inviteRole,
          status: 'active',
          invited_by: currentUser?.id
        })

      if (whitelistErr && !whitelistErr.message.includes('duplicate key')) {
        throw whitelistErr
      }

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_email: emailFormatted,
        action: 'invite_member',
        new_role: inviteRole
      })

      const inviteLink = `${window.location.origin}/register?token=${token}`
      setGeneratedInviteLink(inviteLink)
      setInviteEmail('')
      toast.success(`Đã tạo liên kết lời mời cho ${emailFormatted}`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi khi tạo lời mời: ' + err.message)
    } finally {
      setInviting(false)
    }
  }

  // Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Bạn có chắc muốn thu hồi lời mời cho ${email}? Liên kết đăng ký sẽ không còn hoạt động.`)) {
      return
    }

    try {
      // 1. Delete invitation
      const { error: inviteErr } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId)

      if (inviteErr) throw inviteErr

      // 2. Remove from whitelist if they haven't registered yet
      const profile = profiles.find(p => p.email?.toLowerCase() === email.toLowerCase())
      if (!profile) {
        await supabase.from('allowed_members').delete().eq('email', email)
      }

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_email: email,
        action: 'revoke_invitation'
      })

      toast.success(`Đã thu hồi lời mời của ${email}`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi khi thu hồi lời mời: ' + err.message)
    }
  }

  // Resend/Renew Invitation
  const handleResendInvitation = async (invitationId: string, email: string, role: 'admin' | 'leader' | 'member') => {
    try {
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const newExpiresAt = new Date()
      newExpiresAt.setDate(newExpiresAt.getDate() + 7)

      const { error } = await supabase
        .from('invitations')
        .update({
          token: newToken,
          expires_at: newExpiresAt.toISOString(),
          used: false
        })
        .eq('id', invitationId)

      if (error) throw error

      // Write Audit Log
      await supabase.from('member_audit_logs').insert({
        admin_user_id: currentUser?.id,
        target_email: email,
        action: 'resend_invitation',
        new_role: role
      })

      const inviteLink = `${window.location.origin}/register?token=${newToken}`
      setGeneratedInviteLink(inviteLink)
      toast.success(`Đã gia hạn lời mời cho ${email} thêm 7 ngày. Xem liên kết mới bên dưới.`)
      fetchData()
    } catch (err: any) {
      toast.error('Lỗi khi gia hạn lời mời: ' + err.message)
    }
  }

  // Copy to Clipboard Utility
  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedTokenId(id)
    toast.success('Đã sao chép liên kết vào bộ nhớ tạm!')
    setTimeout(() => setCopiedTokenId(null), 2000)
  }

  // Execute Admin Privilege Transfer
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferTargetId) {
      toast.error('Vui lòng chọn người nhận quyền Admin.')
      return
    }
    if (!adminPassword) {
      toast.error('Vui lòng nhập mật khẩu xác nhận.')
      return
    }

    const targetUser = profiles.find(p => p.id === transferTargetId)
    if (!targetUser) return

    if (!confirm(`CẢNH BÁO CỰC KỲ QUAN TRỌNG: Bạn sắp chuyển quyền Admin tối cao cho ${targetUser.full_name} (${targetUser.email}).\n\nSau khi chuyển, tài khoản của bạn sẽ ngay lập tức bị hạ quyền xuống Member và bạn sẽ KHÔNG CÒN quyền truy cập vào trang Quản trị này nữa.\n\nBạn có chắc chắn muốn thực hiện?`)) {
      return
    }

    setTransferring(true)
    try {
      // 1. Re-authenticate admin with password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: currentUser?.email || '',
        password: adminPassword
      })

      if (authErr) {
        throw new Error('Mật khẩu xác nhận không đúng. Vui lòng thử lại.')
      }

      // 2. Call Postgres Atomic RPC function
      const { error: rpcErr } = await supabase.rpc('transfer_admin_ownership', {
        target_id: transferTargetId,
        current_admin_id: currentUser?.id
      })

      if (rpcErr) throw rpcErr

      toast.success('Bạn đã chuyển quyền Admin thành công. Tài khoản của bạn hiện là Member.')
      setAdminPassword('')
      
      // Redirect to dashboard and refresh state
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setTransferring(false)
    }
  }

  // User list for transfer recipient selection
  const eligibleTransferUsers = useMemo(() => {
    return profiles.filter(p => p.id !== currentUser?.id && p.role !== 'admin' && p.status === 'active')
  }, [profiles, currentUser])

  // Access check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050b1f]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-cyan-400" />
          <span className="text-sm text-slate-400">Đang kiểm tra quyền truy cập...</span>
        </div>
      </div>
    )
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050b1f] p-4 text-center">
        <div className="glass-card max-w-md p-8 border border-rose-500/20">
          <AlertCircle size={48} className="text-rose-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-100 mb-2">Truy cập bị từ chối</h1>
          <p className="text-slate-400 text-sm mb-6">Bạn không có quyền truy cập vào trang quản trị hệ thống.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary py-2 px-6">
            Quay lại Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <DashboardShell
      title="Quản trị hệ thống"
      subtitle="Quản lý whitelist thành viên, gửi lời mời và nhật ký kiểm toán."
      actions={
        <button
          onClick={() => setIsAddWhitelistOpen(true)}
          className="btn-primary gap-1.5 text-sm"
        >
          <Plus size={16} /> Thêm Whitelist
        </button>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-4">
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'pb-3 text-sm font-medium transition-colors relative flex items-center gap-2',
              activeTab === 'members' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Users size={16} /> Thành viên ({combinedMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={cn(
              'pb-3 text-sm font-medium transition-colors relative flex items-center gap-2',
              activeTab === 'invites' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Mail size={16} /> Gửi lời mời
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={cn(
              'pb-3 text-sm font-medium transition-colors relative flex items-center gap-2',
              activeTab === 'transfer' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <KeyRound size={16} /> Chuyển quyền Admin
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              'pb-3 text-sm font-medium transition-colors relative flex items-center gap-2',
              activeTab === 'logs' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <History size={16} /> Nhật ký kiểm toán ({auditLogs.length})
          </button>
        </div>

        {/* Tab Content 1: Members List */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm email hoặc họ tên..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-dark pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              </div>
              <div>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="input-dark select-dark"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                  <option value="leader">Trưởng nhóm (Leader)</option>
                  <option value="member">Thành viên (Member)</option>
                </select>
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="input-dark select-dark"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Bị khóa</option>
                  <option value="pending">Chờ đăng ký tài khoản</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
              {loadingData ? (
                <div className="p-12 flex justify-center">
                  <Loader2 size={32} className="animate-spin text-cyan-400" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Không tìm thấy thành viên phù hợp với bộ lọc.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-4">Họ và tên</th>
                        <th className="p-4">Email Whitelist</th>
                        <th className="p-4">Vai trò</th>
                        <th className="p-4">Hoạt động</th>
                        <th className="p-4">Đăng ký</th>
                        <th className="p-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 text-sm">
                      {filteredMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 font-medium text-slate-100">{m.fullName}</td>
                          <td className="p-4 text-slate-400">{m.email}</td>
                          <td className="p-4">
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.email, m.profileId, m.role, e.target.value as any)}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                            >
                              <option value="member">Thành viên</option>
                              <option value="leader">Trưởng nhóm</option>
                              <option value="admin">Quản trị viên</option>
                            </select>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleStatus(m.email, m.profileId, m.status)}
                              className={cn(
                                'px-2 py-0.5 rounded text-xs border transition-colors',
                                m.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              )}
                            >
                              {m.status === 'active' ? 'Active' : 'Locked'}
                            </button>
                          </td>
                          <td className="p-4">
                            {m.hasRegistered ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                <UserCheck size={12} /> Đã kích hoạt
                              </span>
                            ) : (
                              <span className="text-xs text-amber-400 animate-pulse">Chờ đăng ký...</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleRemoveMember(m.email, m.profileId, m.role)}
                              disabled={m.role === 'admin' && isLastActiveAdmin(m.email)}
                              className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-500"
                              title="Xóa thành viên"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Invitation System */}
        {activeTab === 'invites' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invite Form */}
            <div className="lg:col-span-1 glass-card p-6 h-fit space-y-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <UserCheck size={18} className="text-cyan-400" /> Tạo lời mời thành viên
              </h3>
              <p className="text-xs text-slate-400">
                Nhập email của thành viên bạn muốn thêm. Hệ thống sẽ tự động duyệt whitelist cho email này và tạo mã đăng ký có hạn 7 ngày.
              </p>

              <form onSubmit={handleCreateInvitation} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Email người nhận</label>
                  <input
                    type="email"
                    required
                    placeholder="name@remlab.dev"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Vai trò gán sẵn</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="input-dark select-dark"
                  >
                    <option value="member">Thành viên (Member)</option>
                    <option value="leader">Trưởng nhóm (Leader)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="btn-primary w-full justify-center py-2 text-sm"
                >
                  {inviting ? (
                    <><Loader2 size={16} className="animate-spin" /> Đang tạo...</>
                  ) : (
                    'Tạo liên kết lời mời'
                  )}
                </button>
              </form>

              {generatedInviteLink && (
                <div className="mt-4 p-4 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-2 animate-fade-in">
                  <p className="text-xs font-semibold text-cyan-400">Liên kết lời mời đã sẵn sàng:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-full focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopyLink(generatedInviteLink, 'new-link')}
                      className="p-1.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">* Hãy gửi liên kết này cho người nhận. Liên kết có hiệu lực 7 ngày.</p>
                </div>
              )}
            </div>

            {/* Invitations List */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Lời mời đang chờ đăng ký
              </h3>

              <div className="glass-card overflow-hidden">
                {loadingData ? (
                  <div className="p-12 flex justify-center">
                    <Loader2 size={32} className="animate-spin text-cyan-400" />
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    Chưa có lời mời nào được gửi.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <th className="p-4">Email</th>
                          <th className="p-4">Vai trò</th>
                          <th className="p-4">Trạng thái</th>
                          <th className="p-4">Hạn liên kết</th>
                          <th className="p-4 text-right">Liên kết / Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300 text-sm">
                        {invitations.map((inv) => {
                          const isExpired = new Date(inv.expires_at) < new Date()
                          const inviteLink = `${window.location.origin}/register?token=${inv.token}`
                          return (
                            <tr key={inv.id} className="hover:bg-slate-900/20 transition-colors">
                              <td className="p-4 font-medium text-slate-200">{inv.email}</td>
                              <td className="p-4">
                                <Badge role={inv.role} size="sm" />
                              </td>
                              <td className="p-4">
                                {inv.used ? (
                                  <span className="text-xs text-emerald-400 font-medium">Đã đăng ký</span>
                                ) : isExpired ? (
                                  <span className="text-xs text-rose-400 font-medium">Đã hết hạn</span>
                                ) : (
                                  <span className="text-xs text-cyan-400 font-medium">Đang chờ</span>
                                )}
                              </td>
                              <td className="p-4 text-xs text-slate-400">
                                {formatDateTime(inv.expires_at)}
                              </td>
                              <td className="p-4 text-right flex items-center justify-end gap-2 pt-3">
                                {!inv.used && (
                                  <>
                                    <button
                                      onClick={() => handleCopyLink(inviteLink, inv.id)}
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
                                      title="Sao chép liên kết lời mời"
                                    >
                                      {copiedTokenId === inv.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    </button>
                                    <button
                                      onClick={() => handleResendInvitation(inv.id, inv.email, inv.role)}
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
                                      title="Gửi lại/Gia hạn lời mời"
                                    >
                                      <RefreshCw size={14} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700/50"
                                  title="Thu hồi lời mời"
                                >
                                  <XCircle size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Admin Ownership Transfer */}
        {activeTab === 'transfer' && (
          <div className="max-w-2xl mx-auto glass-card p-8 border border-cyan-500/10 space-y-6">
            <div className="flex items-center gap-3 text-amber-400 mb-2">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold text-slate-100">Chuyển nhượng quyền quản trị (Admin)</h3>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-sm leading-relaxed space-y-2">
              <p className="font-semibold">⚠️ LƯU Ý QUAN TRỌNG:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                <li>Bạn sẽ chuyển quyền **Admin tối cao** của RemLab Workspace cho thành viên được chọn.</li>
                <li>Ngay sau khi quá trình chuyển nhượng hoàn tất, tài khoản của bạn sẽ tự động hạ cấp xuống quyền **Member (Thành viên)**.</li>
                <li>Bạn sẽ **mất toàn bộ quyền truy cập** vào trang cấu hình quản trị này và không thể phục hồi trừ khi Admin mới cấp lại quyền cho bạn.</li>
                <li>Người nhận quyền chuyển nhượng phải đang ở trạng thái hoạt động (Active) và đã kích hoạt tài khoản.</li>
              </ul>
            </div>

            <form onSubmit={handleTransferOwnership} className="space-y-5 pt-2">
              {/* Target Select */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Chọn thành viên nhận quyền Admin
                </label>
                <select
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                  className="input-dark select-dark"
                  required
                >
                  <option value="">-- Chọn thành viên --</option>
                  {eligibleTransferUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}) - {ROLE_LABELS[u.role]}
                    </option>
                  ))}
                </select>
                {eligibleTransferUsers.length === 0 && (
                  <p className="text-xs text-rose-400 mt-1.5">
                    * Không có thành viên nào khác đủ điều kiện (phải có tài khoản đã kích hoạt và đang hoạt động).
                  </p>
                )}
              </div>

              {/* Password Re-auth */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nhập mật khẩu hiện tại của bạn để xác nhận danh tính
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Nhập mật khẩu Admin của bạn"
                  className="input-dark"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={transferring || !transferTargetId || eligibleTransferUsers.length === 0}
                className="btn-danger w-full justify-center py-3 font-semibold text-base"
              >
                {transferring ? (
                  <><Loader2 size={18} className="animate-spin" /> Đang chuyển nhượng...</>
                ) : (
                  'Xác nhận Chuyển nhượng quyền Admin'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab Content 4: Audit Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Lịch sử hoạt động của Admin ({auditLogs.length})
              </h3>
              <button
                onClick={fetchData}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Làm mới lịch sử"
              >
                <RefreshCw size={14} className={cn(loadingData && 'animate-spin')} />
              </button>
            </div>

            <div className="glass-card overflow-hidden">
              {loadingData ? (
                <div className="p-12 flex justify-center">
                  <Loader2 size={32} className="animate-spin text-cyan-400" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Chưa ghi nhận hoạt động kiểm toán nào.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-4">Admin thực hiện</th>
                        <th className="p-4">Hành động</th>
                        <th className="p-4">Đối tượng tác động</th>
                        <th className="p-4">Thay đổi vai trò</th>
                        <th className="p-4">Thay đổi trạng thái</th>
                        <th className="p-4">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 text-xs">
                      {auditLogs.map((log) => {
                        // Describe action in simple Vietnamese
                        let actionDesc = log.action
                        let actionColor = 'text-slate-300'
                        
                        if (log.action === 'add_whitelist') {
                          actionDesc = 'Thêm Whitelist'
                          actionColor = 'text-cyan-400'
                        } else if (log.action === 'change_role') {
                          actionDesc = 'Thay đổi Vai trò'
                          actionColor = 'text-purple-400'
                        } else if (log.action === 'activate_member') {
                          actionDesc = 'Mở khóa Tài khoản'
                          actionColor = 'text-emerald-400'
                        } else if (log.action === 'deactivate_member') {
                          actionDesc = 'Khóa Tài khoản'
                          actionColor = 'text-rose-400'
                        } else if (log.action === 'remove_member') {
                          actionDesc = 'Xóa thành viên'
                          actionColor = 'text-rose-500'
                        } else if (log.action === 'invite_member') {
                          actionDesc = 'Gửi lời mời mới'
                          actionColor = 'text-blue-400'
                        } else if (log.action === 'revoke_invitation') {
                          actionDesc = 'Thu hồi lời mời'
                          actionColor = 'text-orange-400'
                        } else if (log.action === 'resend_invitation') {
                          actionDesc = 'Gia hạn lời mời'
                          actionColor = 'text-yellow-400'
                        } else if (log.action === 'transfer_admin_ownership') {
                          actionDesc = 'Chuyển nhượng Admin'
                          actionColor = 'text-amber-400 font-semibold'
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 font-medium text-slate-200">{log.admin_email}</td>
                            <td className="p-4">
                              <span className={cn('font-medium', actionColor)}>{actionDesc}</span>
                            </td>
                            <td className="p-4 text-slate-400">{log.target_email}</td>
                            <td className="p-4">
                              {log.old_role || log.new_role ? (
                                <div className="flex items-center gap-1.5">
                                  {log.old_role ? <Badge role={log.old_role as any} size="sm" /> : <span className="text-slate-600">-</span>}
                                  <span className="text-slate-600">→</span>
                                  {log.new_role ? <Badge role={log.new_role as any} size="sm" /> : <span className="text-slate-600">-</span>}
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {log.old_status || log.new_status ? (
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <span className={cn(log.old_status === 'active' ? 'text-emerald-400' : 'text-rose-400')}>
                                    {log.old_status || '-'}
                                  </span>
                                  <span className="text-slate-600">→</span>
                                  <span className={cn(log.new_status === 'active' ? 'text-emerald-400' : 'text-rose-400')}>
                                    {log.new_status || '-'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="p-4 text-slate-500">{formatDateTime(log.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Whitelist Member */}
      <Modal
        isOpen={isAddWhitelistOpen}
        onClose={() => setIsAddWhitelistOpen(false)}
        title="Thêm email vào danh sách duyệt Whitelist"
        size="sm"
      >
        <form onSubmit={handleAddWhitelist} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email đăng ký được duyệt
            </label>
            <input
              type="email"
              required
              placeholder="member@remlab.dev"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="input-dark"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              * Thành viên sở hữu email này sẽ tự đăng ký tài khoản trực tiếp được.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Vai trò chỉ định
            </label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as any)}
              className="input-dark select-dark"
            >
              <option value="member">Thành viên (Member)</option>
              <option value="leader">Trưởng nhóm (Leader)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddWhitelistOpen(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submittingAdd || !newEmail.trim()}
              className="btn-primary py-2 px-4 text-sm"
            >
              {submittingAdd ? 'Đang thêm...' : 'Xác nhận Thêm'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  )
}
