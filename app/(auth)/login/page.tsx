'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, LogIn, Loader2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email hoặc mật khẩu không đúng'
        : error.message
      )
      setLoading(false)
      return
    }

    toast.success('Đăng nhập thành công!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(6,182,212,0.08) 0%, #050b1f 60%)' }}>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent)', filter: 'blur(60px)' }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}>
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">RemLab</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">Chào mừng trở lại</h1>
          <p className="text-slate-500 text-sm">Đăng nhập vào RemLab Workspace</p>
        </div>

        {/* Form card */}
        <div className="glass-card p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input-dark"
                placeholder="name@remlab.dev"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input-dark pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</>
              ) : (
                <><LogIn size={18} /> Đăng nhập</>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-4 glass-card p-4 border border-cyan-500/10">
          <p className="text-xs text-slate-500 text-center">
            💡 Demo: <span className="text-slate-400">admin@remlab.dev</span> / <span className="text-slate-400">remlab2024</span>
          </p>
        </div>
      </div>
    </div>
  )
}
