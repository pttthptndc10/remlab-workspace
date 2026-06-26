'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { getInitials, ROLE_COLORS, ROLE_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { 
  Send, Image as ImageIcon, X, Loader2, MessageSquare, ShieldAlert,
  MoreVertical, CornerUpLeft, Trash2, Download, Copy, Quote, ArrowLeft, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  content: string | null
  image_url: string | null
  reply_to_id: string | null
  is_recalled: boolean
  recalled_at: string | null
  created_at: string
  sender?: {
    id: string
    full_name: string
    avatar_url: string | null
    role: string
  }
  reply_to?: {
    id: string
    content: string | null
    image_url: string | null
    sender_id: string
    is_recalled: boolean
    sender?: {
      id: string
      full_name: string
    }
  } | null
}

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [sending, setSending] = useState(false)

  // Quản lý upload ảnh
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Trích dẫn trả lời (Reply)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

  // Trình xem ảnh Lightbox
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null)

  // Quản lý dropdown menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Quản lý long press trên điện thoại
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Đóng dropdown menu khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Tải danh sách tin nhắn cũ kèm tin nhắn gốc (reply_to)
  useEffect(() => {
    if (!user) return

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:profiles(id, full_name, avatar_url, role), reply_to:messages(id, content, image_url, sender_id, is_recalled, sender:profiles(id, full_name))')
          .order('created_at', { ascending: true })
          .limit(100)

        if (error) throw error
        setMessages(data as ChatMessage[])
      } catch (err: any) {
        console.error('Lỗi tải tin nhắn:', err)
        toast.error('Không thể tải lịch sử trò chuyện: ' + err.message)
      } finally {
        setLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [user, supabase])

  // Thiết lập realtime subscription lắng nghe tin nhắn mới & tin nhắn bị cập nhật (thu hồi / khôi phục)
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('remlab-group-chat-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // Lấy thêm profile của người gửi tin nhắn này
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', payload.new.sender_id)
            .single()

          // Lấy tin nhắn trích dẫn nếu có reply_to_id
          let replyToData = null
          if (payload.new.reply_to_id) {
            const { data: originalMsg }: any = await supabase
              .from('messages')
              .select('id, content, image_url, sender_id, is_recalled, sender:profiles(id, full_name)')
              .eq('id', payload.new.reply_to_id)
              .single()
            
            if (originalMsg) {
              const rawSender = originalMsg.sender
              const senderObj = Array.isArray(rawSender) ? rawSender[0] : rawSender
              replyToData = {
                id: originalMsg.id,
                content: originalMsg.content,
                image_url: originalMsg.image_url,
                sender_id: originalMsg.sender_id,
                is_recalled: originalMsg.is_recalled,
                sender: senderObj ? {
                  id: senderObj.id,
                  full_name: senderObj.full_name
                } : undefined
              }
            }
          }

          const newMessage: ChatMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            content: payload.new.content,
            image_url: payload.new.image_url,
            reply_to_id: payload.new.reply_to_id,
            is_recalled: payload.new.is_recalled,
            recalled_at: payload.new.recalled_at,
            created_at: payload.new.created_at,
            sender: profileData || {
              id: payload.new.sender_id,
              full_name: 'Thành viên',
              avatar_url: null,
              role: 'member',
            },
            reply_to: replyToData
          }

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // Khi tin nhắn bị UPDATE (thu hồi hoặc khôi phục), cập nhật cục bộ ngay
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === payload.new.id) {
                return {
                  ...msg,
                  content: payload.new.content,
                  image_url: payload.new.image_url,
                  is_recalled: payload.new.is_recalled,
                  recalled_at: payload.new.recalled_at,
                }
              }
              // Đồng thời cập nhật nếu tin nhắn bị update này đang được trích dẫn ở tin khác
              if (msg.reply_to && msg.reply_to.id === payload.new.id) {
                return {
                  ...msg,
                  reply_to: {
                    ...msg.reply_to,
                    content: payload.new.content,
                    image_url: payload.new.image_url,
                    is_recalled: payload.new.is_recalled,
                  }
                }
              }
              return msg
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  // Tự động cuộn xuống cuối cùng khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loadingMessages])

  // Xử lý chọn ảnh
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Dung lượng ảnh tối đa là 5MB!')
        return
      }
      setSelectedImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  // Hủy chọn ảnh
  const handleRemoveImage = () => {
    setSelectedImage(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Gửi tin nhắn
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!inputText.trim() && !selectedImage) return

    setSending(true)
    let imageUrl = null

    try {
      // 1. Tải ảnh lên Storage
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const filePath = `chat-images/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, selectedImage)

        if (uploadError) throw new Error('Tải ảnh lên thất bại: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
      }

      // 2. Insert tin nhắn
      const { error: insertError } = await supabase.from('messages').insert({
        sender_id: user.id,
        content: inputText.trim() || null,
        image_url: imageUrl || null,
        reply_to_id: replyingTo ? replyingTo.id : null
      })

      if (insertError) throw insertError

      setInputText('')
      setReplyingTo(null)
      handleRemoveImage()
    } catch (err: any) {
      console.error('Lỗi khi gửi tin nhắn:', err)
      const { data: { session } } = await supabase.auth.getSession()
      const debugInfo = `(User: ${user?.email || 'null'}, Auth Session: ${session?.user?.email || 'Chưa đăng nhập'})`
      toast.error(`${err.message || 'Gửi tin nhắn thất bại!'} ${debugInfo}`)
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------
  // XỬ LÝ MENU CHỨC NĂNG TIN NHẮN
  // ---------------------------------------------------------
  
  // 1. Thu hồi tin nhắn
  const handleRecallMessage = async (msg: ChatMessage) => {
    setActiveMenuId(null)
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          is_recalled: true,
          recalled_at: new Date().toISOString()
        })
        .eq('id', msg.id)

      if (error) throw error
      toast.success('Đã thu hồi tin nhắn')
    } catch (err: any) {
      toast.error('Không thể thu hồi: ' + err.message)
    }
  }

  // 2. Khôi phục tin nhắn đã thu hồi (trong vòng 24h)
  const handleRecoverMessage = async (msg: ChatMessage) => {
    setActiveMenuId(null)
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          is_recalled: false,
          recalled_at: null
        })
        .eq('id', msg.id)

      if (error) throw error
      toast.success('Đã khôi phục tin nhắn')
    } catch (err: any) {
      toast.error('Không thể khôi phục: ' + err.message)
    }
  }

  // Kiểm tra điều kiện khôi phục (của chính mình, đã thu hồi, chưa quá 24h)
  const canRecover = (msg: ChatMessage) => {
    if (msg.sender_id !== user?.id) return false
    if (!msg.is_recalled || !msg.recalled_at) return false
    const recalledTime = new Date(msg.recalled_at).getTime()
    const now = new Date().getTime()
    return now - recalledTime < 24 * 60 * 60 * 1000 // < 24 giờ
  }

  // 3. Copy nội dung text / link ảnh
  const handleCopy = (msg: ChatMessage) => {
    setActiveMenuId(null)
    if (msg.content) {
      navigator.clipboard.writeText(msg.content)
      toast.success('Đã copy nội dung tin nhắn')
    } else if (msg.image_url) {
      navigator.clipboard.writeText(msg.image_url)
      toast.success('Đã copy đường dẫn hình ảnh')
    }
  }

  // 4. Tải hình ảnh về máy
  const handleDownloadImage = async (url: string) => {
    setActiveMenuId(null)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `remlab-chat-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      toast.success('Đang tải hình ảnh xuống...')
    } catch (err) {
      window.open(url, '_blank')
    }
  }

  // 5. Cuộn mượt mà đến tin nhắn gốc khi click trích dẫn
  const scrollToOriginalMessage = (replyToId: string) => {
    const targetElement = document.getElementById(`chat-message-${replyToId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Tạo hiệu ứng nhấp nháy highlight tin nhắn gốc trong 2 giây
      targetElement.classList.add('glow-highlight')
      setTimeout(() => {
        targetElement.classList.remove('glow-highlight')
      }, 2000)
    } else {
      toast.error('Không tìm thấy tin nhắn gốc (có thể đã bị thu hồi hoặc quá cũ!)')
    }
  }

  // 6. Nhấn đè trên di động (Long Press) để mở menu tùy chọn
  const handleTouchStart = (msg: ChatMessage) => {
    longPressTimer.current = setTimeout(() => {
      setActiveMenuId(msg.id)
    }, 500) // Đè giữ trong 500ms
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  if (authLoading) {
    return (
      <DashboardShell title="Trò chuyện" subtitle="Đang tải dữ liệu...">
        <div className="glass-card p-8 flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </DashboardShell>
    )
  }

  if (!user) {
    return (
      <DashboardShell title="Trò chuyện" subtitle="Lỗi truy cập">
        <div className="glass-card p-6 border-red-500/20 bg-red-500/5 text-red-400 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 flex-shrink-0" />
          <p className="text-sm font-medium">Bạn cần đăng nhập để truy cập tính năng trò chuyện này.</p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Trò chuyện nhóm" subtitle="Kênh thảo luận chung realtime của RemLab">
      <div className="glass-card flex flex-col h-[calc(100vh-170px)] lg:h-[calc(100vh-185px)] overflow-hidden animate-fade-in relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">RemLab Workspace Chat</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Realtime trực tuyến · Tất cả chức vụ
            </p>
          </div>
        </div>

        {/* Danh sách tin nhắn */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 min-h-0 bg-slate-950/20 scrollbar-thin">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-10">
              <MessageSquare className="w-8 h-8 opacity-40 text-cyan-400" />
              <p className="text-xs italic">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === user.id
              const senderName = msg.sender?.full_name || 'Thành viên'
              const senderRole = msg.sender?.role || 'member'
              const formattedTime = new Date(msg.created_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={msg.id}
                  id={`chat-message-${msg.id}`}
                  className={cn(
                    'flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%] group/row relative transition-all duration-300 rounded-xl p-1',
                    isOwnMessage ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 select-none shadow-sm',
                      isOwnMessage ? 'bg-cyan-600' : 'bg-slate-800 border border-slate-700'
                    )}
                  >
                    {getInitials(senderName)}
                  </div>

                  {/* Message Bubble Block */}
                  <div className="space-y-1 relative">
                    {/* Tên người gửi & Chức vụ */}
                    {!isOwnMessage && (
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-xs font-semibold text-slate-300">{senderName}</span>
                        <span className={cn('text-[9px] px-1 py-0.2 rounded border uppercase font-bold tracking-wider select-none scale-90 origin-left', 
                          senderRole === 'admin' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 
                          senderRole === 'leader' ? 'border-purple-500/30 bg-purple-500/10 text-purple-400' :
                          'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                        )}>
                          {ROLE_LABELS[senderRole as keyof typeof ROLE_LABELS] || 'Member'}
                        </span>
                      </div>
                    )}

                    <div className="relative flex items-center gap-2">
                      
                      {/* 1. NÚT CHỨC NĂNG HIỆN NHANH KHI HOVER (DESKTOP) */}
                      {!msg.is_recalled && (
                        <div className={cn(
                          'opacity-0 group-hover/row:opacity-100 transition-opacity hidden md:flex items-center gap-1 flex-shrink-0 absolute top-1/2 -translate-y-1/2',
                          isOwnMessage ? 'right-[calc(100%+8px)] flex-row' : 'left-[calc(100%+8px)] flex-row-reverse'
                        )}>
                          {/* Nút 3 chấm */}
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-white/5 bg-slate-950/20"
                            title="Lựa chọn khác"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Trả lời nhanh */}
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-white/5 bg-slate-950/20"
                            title="Trả lời"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Dropdown Options Menu */}
                      {activeMenuId === msg.id && (
                        <div
                          ref={menuRef}
                          className={cn(
                            'absolute z-50 bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-2xl min-w-[120px] text-xs text-slate-200 animate-fade-in',
                            isOwnMessage ? 'right-6 bottom-0' : 'left-6 bottom-0'
                          )}
                        >
                          {!msg.is_recalled && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingTo(msg)
                                setActiveMenuId(null)
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                              Trả lời
                            </button>
                          )}
                          {!msg.is_recalled && msg.content && (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy chữ
                            </button>
                          )}
                          {!msg.is_recalled && msg.image_url && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDownloadImage(msg.image_url!)}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Tải ảnh về
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(msg)}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy link ảnh
                              </button>
                            </>
                          )}
                          {isOwnMessage && !msg.is_recalled && (
                            <button
                              type="button"
                              onClick={() => handleRecallMessage(msg)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors flex items-center gap-1.5 border-t border-slate-800/60 mt-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Thu hồi
                            </button>
                          )}
                          {canRecover(msg) && (
                            <button
                              type="button"
                              onClick={() => handleRecoverMessage(msg)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer border-t border-slate-800/60 mt-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Khôi phục
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bubble content (Nhận diện sự kiện Long Press trên mobile) */}
                      <div
                        onTouchStart={() => handleTouchStart(msg)}
                        onTouchEnd={handleTouchEnd}
                        className={cn(
                          'p-3 rounded-2xl shadow-sm text-sm break-words flex flex-col transition-all relative',
                          msg.is_recalled 
                            ? 'bg-slate-900/40 border border-slate-900/60 text-slate-500 italic rounded-2xl'
                            : isOwnMessage
                              ? 'bg-cyan-500/10 border border-cyan-500/20 text-white rounded-tr-none'
                              : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                        )}
                      >
                        {msg.is_recalled ? (
                          <div className="flex items-center gap-2">
                            <span>Tin nhắn đã được thu hồi</span>
                            {/* Nút khôi phục bên mép nếu chưa quá 24h */}
                            {canRecover(msg) && (
                              <button
                                type="button"
                                onClick={() => handleRecoverMessage(msg)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 ml-2 select-none"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                Khôi phục
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* 2. HIỂN THỊ TIN NHẮN TRÍCH DẪN (TRẢ LỜI) */}
                            {msg.reply_to && (
                              <div 
                                onClick={() => scrollToOriginalMessage(msg.reply_to!.id)}
                                className="mb-2 p-2 rounded-lg bg-black/40 border-l-2 border-cyan-500 text-slate-400 text-xs flex items-center gap-2.5 select-none opacity-85 hover:bg-black/60 transition-colors cursor-pointer"
                                title="Bấm để cuộn đến tin nhắn gốc"
                              >
                                {/* Thumbnail ảnh nếu tin nhắn gốc có hình ảnh */}
                                {msg.reply_to.image_url && !msg.reply_to.is_recalled && (
                                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-white/10 bg-black flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={msg.reply_to.image_url}
                                      alt="Trích dẫn ảnh"
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-cyan-400 text-[10px] block">
                                    {msg.reply_to.sender?.full_name || 'Thành viên'}
                                  </span>
                                  {msg.reply_to.is_recalled ? (
                                    <p className="truncate italic text-[10px] text-slate-500">
                                      [Tin nhắn đã được thu hồi]
                                    </p>
                                  ) : msg.reply_to.content ? (
                                    <p className="truncate italic text-[10px] text-slate-300">
                                      &quot;{msg.reply_to.content}&quot;
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-500 italic">
                                      [Hình ảnh]
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Nội dung Text */}
                            {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                            {/* Hình ảnh (Click mở Lightbox trực tiếp trên web) */}
                            {msg.image_url && (
                              <div className={cn('mt-2 overflow-hidden rounded-lg max-w-full border border-white/5', msg.content ? '' : 'mt-0')}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.image_url}
                                  alt="Ảnh đính kèm"
                                  className="max-h-72 object-contain hover:scale-[1.01] transition-transform duration-300 cursor-zoom-in"
                                  onClick={() => setActiveImageUrl(msg.image_url)}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Mốc thời gian */}
                        <span className="block text-[9px] text-slate-500 text-right mt-1.5 select-none">
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Khung trích dẫn đang trả lời ở khu vực nhập chat (Replying Preview) */}
        {replyingTo && (
          <div className="px-5 py-2.5 border-t border-white/5 bg-slate-900 flex items-center justify-between animate-fade-in relative z-20">
            <div className="flex items-center gap-3 border-l-2 border-cyan-400 pl-3">
              {/* Thumbnail ảnh ở phần preview trích dẫn */}
              {replyingTo.image_url && (
                <div className="w-9 h-9 rounded overflow-hidden border border-white/10 bg-black flex items-center justify-center flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={replyingTo.image_url} alt="Xem trước trả lời ảnh" className="object-cover w-full h-full" />
                </div>
              )}
              <div className="text-xs">
                <p className="font-semibold text-cyan-400">
                  Trả lời {replyingTo.sender?.full_name || 'Thành viên'}
                </p>
                {replyingTo.content && (
                  <p className="text-slate-400 truncate max-w-lg mt-0.5 italic">
                    &quot;{replyingTo.content}&quot;
                  </p>
                )}
                {replyingTo.image_url && !replyingTo.content && (
                  <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5 font-medium">
                    <ImageIcon className="w-3.5 h-3.5" /> [Hình ảnh]
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Hủy trả lời"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Preview ảnh trước khi gửi */}
        {imagePreview && (
          <div className="px-5 py-3 border-t border-white/5 bg-slate-950/40 flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-cyan-500/30 bg-black flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Xem trước ảnh" className="object-cover w-full h-full" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors"
                title="Bỏ ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 font-medium truncate">{selectedImage?.name}</p>
              <p className="text-[10px] text-slate-500">{(selectedImage!.size / 1024).toFixed(1)} KB · Sẵn sàng gửi</p>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-white/[0.01] flex items-end gap-2 relative z-10">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
            id="chat-image-uploader"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-2.5 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 active:scale-95 transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Tải ảnh lên"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
              placeholder={replyingTo ? "Nhập tin nhắn trả lời..." : selectedImage ? "Nhập chú thích ảnh (tùy chọn)..." : "Nhập nội dung trò chuyện..."}
              rows={1}
              disabled={sending}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all resize-none max-h-24 leading-relaxed disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImage) || sending}
            className={cn(
              'p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 active:scale-95 disabled:scale-100',
              (inputText.trim() || selectedImage) && !sending
                ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/10 cursor-pointer'
                : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
            )}
            title="Gửi tin nhắn"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      {/* 3. LIGHTBOX MODAL XEM ẢNH TRỰC TIẾP TRÊN NỀN WEB */}
      {activeImageUrl && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] animate-fade-in">
          {/* Nút quay lại nằm ở góc trên bên trái */}
          <button
            type="button"
            onClick={() => setActiveImageUrl(null)}
            className="absolute top-5 left-5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 cursor-pointer transition-all active:scale-95 hover:text-cyan-400 border border-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold">Quay lại</span>
          </button>
          
          {/* Ảnh phóng to */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImageUrl}
            alt="Xem ảnh lớn"
            className="max-w-[90vw] max-h-[80vh] object-contain select-none rounded-lg border border-white/10 shadow-2xl animate-fade-in"
          />
        </div>
      )}
    </DashboardShell>
  )
}
