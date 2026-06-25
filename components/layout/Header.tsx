'use client'

import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { getInitials } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
  actions?: React.ReactNode
}

export function Header({ title, subtitle, onMenuClick, actions }: HeaderProps) {
  const { user } = useAuth()
  const [showNotif, setShowNotif] = useState(false)

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 flex-shrink-0"
      style={{ borderBottom: '1px solid #1e293b', background: 'rgba(5,11,31,0.95)', backdropFilter: 'blur(12px)' }}>

      {/* Left: Menu + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Mở menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-100 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Right: actions + bell + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}

        <button
          onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          aria-label="Thông báo"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-500 animate-pulse-cyan" />
        </button>

        {user && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #0891b2)' }}>
            {getInitials(user.full_name || 'U')}
          </div>
        )}
      </div>
    </header>
  )
}
