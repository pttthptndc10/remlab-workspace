'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, UserPlus, Loader2, Zap, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Token verification states
  const [checkingToken, setCheckingToken] = useState(!!token)
  const [tokenError, setTokenError] = useState('')
  const [emailDisabled, setEmailDisabled] = useState(false)

  useEffect(() => {
    if (!token) return

    const verifyToken = async () => {
      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .eq('used', false)
          .single()

        if (error || !data) {
          setTokenError('Đường link lời mời không hợp lệ hoặc đã được sử dụng.')
          setCheckingToken(false)
          return
        }

        // Kiểm tra hết hạn
        const expiresAt = new Date(data.expires_at)
        if (expiresAt < new Date()) {
          setTokenError('Đường link lời mời đã hết hạn (giới hạn 7 ngày).')
          setCheckingToken(false)
          return
        }

        // Hợp lệ -> điền email và khóa
        setEmail(data.email)
        setEmailDisabled(true)
      } catch (err) {
        setTokenError('Lỗi xác thực lời mời.')
      } finally {
        setCheckingToken(false)
      }
    }

    verifyToken()
  }, [token, supabase])

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
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { 
          full_name: fullName,
        },
      },
    })

    if (error) {
      let msg = error.message
      if (error.message.includes('already registered')) {
        msg = 'Email này đã được đăng ký tài khoản.'
      } else if (error.message.includes('không được phép đăng ký')) {
        msg = 'Email này không nằm trong danh sách được duyệt của RemLab.'
      } else if (error.message.includes('đã bị vô hiệu hóa')) {
        msg = 'Tài khoản của bạn đã bị vô hiệu hóa trên hệ thống.'
      }
      toast.error(msg)
      setLoading(false)
      return
    }

    toast.success('Tạo tài khoản thành công! Đang chuyển hướng...')
    router.push('/dashboard')
    router.refresh()
  }

  if (checkingToken) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 size={36} className="animate-spin text-cyan-400 mb-4" />
        <p className="text-slate-400 text-sm">Đang xác thực đường link lời mời...</p>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="glass-card p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-rose-400" size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Liên kết không hợp lệ</h2>
        <p className="text-slate-400 text-sm mb-6">{tokenError}</p>
        <Link href="/login" className="btn-primary inline-flex justify-center w-full py-2">
          Quay lại Đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md relative animate-fade-in mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}>
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">RemLab</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">
          {token ? 'Hoàn tất tài khoản lời mời' : 'Đăng ký tài khoản'}
        </h1>
        <p className="text-slate-500 text-sm">
          {token ? 'Bạn đã được mời tham gia RemLab Workspace' : 'Tham gia RemLab Workspace'}
        </p>
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
              disabled={emailDisabled}
              className={`input-dark ${emailDisabled ? 'opacity-60 cursor-not-allowed bg-slate-900/50' : ''}`}
              placeholder="name@remlab.dev"
              autoComplete="email"
            />
            {emailDisabled && (
              <p className="text-[11px] text-slate-500 mt-1">
                * Email này đã được cố định theo lời mời của Admin.
              </p>
            )}
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

      {!token && (
        <p className="mt-4 text-center text-xs text-slate-600">
          * Đăng ký trực tiếp chỉ khả dụng nếu email của bạn đã được Admin duyệt whitelist từ trước.
        </p>
      )}
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(129,140,248,0.08) 0%, #050b1f 60%)' }}>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-cyan-400" />
          <span className="text-sm text-slate-400">Đang tải...</span>
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
