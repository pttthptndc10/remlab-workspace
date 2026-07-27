'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [success, setSuccess] = useState(false)

  // Subcribe to auth state changes and handle code/hash recovery
  useEffect(() => {
    let isMounted = true

    async function checkRecoverySession() {
      try {
        // 1. If code parameter exists, exchange code for session
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            console.error('Exchange code error:', exchangeErr.message)
          }
        }

        // 2. Check current session
        const { data: { session } } = await supabase.auth.getSession()
        if (session && isMounted) {
          setHasValidSession(true)
          setSessionChecking(false)
          return
        }

        // 3. Listen for PASSWORD_RECOVERY or SIGNED_IN event (for hash fragments #access_token=...)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (!isMounted) return
          if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            setHasValidSession(true)
            setSessionChecking(false)
          }
        })

        // Timeout fallback if no session is detected after 2 seconds
        const timer = setTimeout(() => {
          if (isMounted) {
            setSessionChecking(false)
          }
        }, 2000)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timer)
        }
      } catch (err) {
        console.error('Session check error:', err)
        if (isMounted) setSessionChecking(false)
      }
    }

    checkRecoverySession()

    return () => {
      isMounted = false
    }
  }, [code, supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        if (error.message.includes('session missing') || error.message.includes('Auth session missing')) {
          toast.error('Phiên làm việc đã hết hạn. Vui lòng gửi lại yêu cầu khôi phục mật khẩu mới.')
          setHasValidSession(false)
        } else {
          toast.error('Lỗi đặt lại mật khẩu: ' + error.message)
        }
      } else {
        setSuccess(true)
        toast.success('Đặt lại mật khẩu thành công!')
      }
    } catch (err: any) {
      toast.error('Có lỗi xảy ra: ' + (err.message || 'Không thể cập nhật mật khẩu'))
    } finally {
      setLoading(false)
    }
  }

  if (sessionChecking) {
    return (
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="glass-card p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
          <Loader2 size={32} className="animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-slate-300 font-medium">Đang kiểm tra liên kết khôi phục...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md relative animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <img src="/logo.png" alt="RemLab Logo" className="w-12 h-12 object-contain rounded-xl" />
          <span className="text-2xl font-bold gradient-text">RemLab</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Tạo mật khẩu mới</h1>
        <p className="text-slate-500 text-sm">Nhập mật khẩu mới cho tài khoản của bạn</p>
      </div>

      {/* Form Card */}
      <div className="glass-card p-8">
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-bold text-slate-100">Đổi mật khẩu thành công!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mật khẩu của bạn đã được cập nhật thành công. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
            </p>
            <Link
              href="/login"
              className="btn-primary w-full justify-center py-3 text-sm mt-4 inline-flex"
            >
              Quay lại Đăng nhập
            </Link>
          </div>
        ) : !hasValidSession ? (
          <div className="text-center space-y-4 py-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-base font-bold text-slate-100">Chưa có phiên khôi phục hợp lệ</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Liên kết khôi phục mật khẩu đã hết hạn hoặc bạn đã mở trực tiếp trang này mà không qua liên kết email. 
              Vui lòng yêu cầu lại liên kết mới từ trang đăng nhập.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="btn-primary w-full justify-center py-2.5 text-xs inline-flex items-center gap-1.5"
              >
                <RefreshCw size={14} /> Yêu cầu gửi lại email khôi phục
              </Link>
              <Link
                href="/login"
                className="text-xs text-slate-400 hover:text-cyan-400 py-1 transition-colors"
              >
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="input-dark pr-10"
                  placeholder="Nhập ít nhất 6 ký tự"
                  minLength={6}
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="input-dark pr-10"
                  placeholder="Nhập lại mật khẩu mới"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="reset-password-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Đang cập nhật...</>
              ) : (
                <><KeyRound size={18} /> Đặt lại mật khẩu</>
              )}
            </button>

            {/* Back to Login */}
            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs text-slate-400 hover:text-cyan-400 inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={14} /> Quay lại trang đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(6,182,212,0.08) 0%, #050b1f 60%)' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent)', filter: 'blur(60px)' }}
      />

      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-cyan-400" />
            <span className="text-sm text-slate-400">Đang tải...</span>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
