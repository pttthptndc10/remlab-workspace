'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  LayoutDashboard, FolderKanban, CheckSquare,
  Users, Activity, BarChart2, Settings,
  Zap, LogOut, ChevronRight, X, Shield, MessageSquare
} from 'lucide-react'
import { getInitials, ROLE_LABELS, ROLE_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Dự án', icon: FolderKanban },
  { href: '/members', label: 'Thành viên', icon: Users },
  { href: '/chat', label: 'Trò chuyện', icon: MessageSquare },
  { href: '/activity', label: 'Hoạt động', icon: Activity },
  { href: '/reports', label: 'Báo cáo', icon: BarChart2 },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const visibleNavItems = [
    ...navItems,
    ...(user?.role === 'admin' ? [{ href: '/admin/members', label: 'Quản trị', icon: Shield }] : [])
  ]

  return (
    <div className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #050b1f 0%, #0a1628 100%)', borderRight: '1px solid #1e293b' }}>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: '1px solid #1e293b' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="RemLab Logo" className="w-8 h-8 object-contain rounded-lg flex-shrink-0" />
          <div>
            <span className="text-base font-bold gradient-text">RemLab</span>
            <p className="text-xs text-slate-600 -mt-0.5">Workspace</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-3">Menu chính</p>
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn('sidebar-link', isActive && 'active')}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={14} className="opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-1" style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
        <Link href="/settings" onClick={onClose} className={cn('sidebar-link', pathname === '/settings' && 'active')}>
          <Settings size={16} />
          <span>Cài đặt</span>
        </Link>

        {/* User info */}
        {user && (
          <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(30,41,59,0.4)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #0891b2)' }}>
                {getInitials(user.full_name || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{user.full_name}</p>
                <span className={cn('badge text-xs', ROLE_COLORS[user.role])}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition-colors py-1"
            >
              <LogOut size={13} />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
