'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, UserPlus, Loader2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'member' },
      },
    })

    if (error) {
      toast.error(error.message.includes('already registered')
        ? 'Email này đã được đăng ký'
        : error.message
      )
      setLoading(false)
      return
    }

    toast.success('Đăng ký thành công! Đang chuyển hướng...')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(129,140,248,0.08) 0%, #050b1f 60%)' }}>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

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
          <h1 className="text-2xl font-bold text-slate-100 mb-1">Tạo tài khoản mới</h1>
          <p className="text-slate-500 text-sm">Tham gia RemLab Workspace</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Họ và tên
              </label>
              <input
                id="register-fullname"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="input-dark"
                placeholder="Nguyễn Văn A"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                id="register-email"
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
                  id="register-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-dark pr-10"
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
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

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                id="register-confirm-password"
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="input-dark"
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Đang đăng ký...</>
              ) : (
                <><UserPlus size={18} /> Tạo tài khoản</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          Tài khoản mới sẽ có quyền <span className="text-slate-400">Member</span>. Admin có thể nâng quyền sau.
        </p>
      </div>
    </div>
  )
}
