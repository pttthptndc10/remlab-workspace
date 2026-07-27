'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, LogIn, Loader2, KeyRound, Mail, ArrowLeft, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  // State cho Quên mật khẩu
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      let errorMessage = error.message
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'Email hoặc mật khẩu không đúng'
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Email của bạn chưa được xác nhận'
      }
      toast.error(errorMessage)
      setLoading(false)
      return
    }

    toast.success('Đăng nhập thành công!')
    router.push('/dashboard')
    router.refresh()
  }

  // Xử lý gửi email đặt lại mật khẩu
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      toast.error('Vui lòng nhập địa chỉ email')
      return
    }

    setForgotLoading(true)
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: redirectUrl,
      })

      if (error) {
        toast.error('Không thể gửi yêu cầu: ' + error.message)
      } else {
        setForgotSent(true)
        toast.success('Đã gửi email khôi phục mật khẩu!')
      }
    } catch (err: any) {
      toast.error('Có lỗi xảy ra: ' + (err.message || 'Không thể gửi email'))
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotModal = () => {
    setShowForgotModal(false)
    setForgotSent(false)
    setForgotEmail('')
  }

  return (
    <div className="w-full max-w-md relative">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <img src="/logo.png" alt="RemLab Logo" className="w-12 h-12 object-contain rounded-xl" />
          <span className="text-2xl font-bold gradient-text">RemLab</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Chào mừng trở lại</h1>
        <p className="text-slate-500 text-sm">Đăng nhập vào RemLab Workspace</p>
      </div>

      {/* Error message */}
      {errorParam === 'blocked' && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm text-center font-medium animate-fade-in">
          Tài khoản của bạn hiện không còn quyền truy cập RemLab Workspace.
        </div>
      )}

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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Mật khẩu
              </label>
              <button
                type="button"
                id="login-forgot-password-btn"
                onClick={() => {
                  setForgotEmail(email)
                  setShowForgotModal(true)
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>
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

      {/* Modal Quên Mật Khẩu */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 relative border-slate-800 shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={closeForgotModal}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 rounded-lg p-1 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {forgotSent ? (
              <div className="text-center space-y-4 py-3">
                <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Kiểm tra Email của bạn</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chúng tôi đã gửi liên kết khôi phục mật khẩu đến <strong className="text-slate-200">{forgotEmail}</strong>. 
                  Vui lòng kiểm tra hộp thư đến (và cả mục Thư rác/Spam).
                </p>
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="btn-primary w-full justify-center py-2.5 text-sm mt-2"
                >
                  Đã hiểu, quay lại Đăng nhập
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Quên mật khẩu?</h3>
                    <p className="text-xs text-slate-400">Nhập email để nhận liên kết khôi phục</p>
                  </div>
                </div>

                <form onSubmit={handleSendResetLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Email đăng ký tài khoản
                    </label>
                    <div className="relative">
                      <input
                        id="forgot-email-input"
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        className="input-dark pl-9"
                        placeholder="name@remlab.dev"
                      />
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="btn-secondary flex-1 justify-center py-2.5 text-xs"
                    >
                      Hủy
                    </button>
                    <button
                      id="forgot-submit-btn"
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-primary flex-1 justify-center py-2.5 text-xs"
                    >
                      {forgotLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang gửi...</>
                      ) : (
                        <><Mail size={16} /> Gửi yêu cầu</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
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
        <LoginForm />
      </Suspense>
    </div>
  )
}
