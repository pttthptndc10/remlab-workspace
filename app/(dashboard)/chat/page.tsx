'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { getInitials, ROLE_COLORS, ROLE_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Send, Image as ImageIcon, X, Loader2, MessageSquare, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
  sender?: {
    id: string
    full_name: string
    avatar_url: string | null
    role: string
  }
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Tải danh sách tin nhắn cũ
  useEffect(() => {
    if (!user) return

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:profiles(id, full_name, avatar_url, role)')
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

  // Thiết lập realtime subscription lắng nghe tin nhắn mới
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

          const newMessage: ChatMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            content: payload.new.content,
            image_url: payload.new.image_url,
            created_at: payload.new.created_at,
            sender: profileData || {
              id: payload.new.sender_id,
              full_name: 'Thành viên',
              avatar_url: null,
              role: 'member',
            },
          }

          setMessages((prev) => {
            // Tránh nhận trùng tin nhắn
            if (prev.some((msg) => msg.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
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
      // Giới hạn dung lượng ảnh tải lên (Max 5MB)
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
    setSelectedImage(null);
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
      // 1. Tải ảnh lên Supabase Storage nếu có chọn ảnh
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const filePath = `chat-images/${fileName}`

        // Thực hiện upload ảnh
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, selectedImage)

        if (uploadError) throw new Error('Tải ảnh lên thất bại: ' + uploadError.message)

        // Lấy link public của ảnh vừa tải lên
        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
      }

      // 2. Insert tin nhắn vào bảng database
      const { error: insertError } = await supabase.from('messages').insert({
        sender_id: user.id,
        content: inputText.trim() || null,
        image_url: imageUrl || null,
      })

      if (insertError) throw insertError

      // 3. Reset form nhập liệu sau khi gửi thành công
      setInputText('')
      handleRemoveImage()
    } catch (err: any) {
      console.error('Lỗi khi gửi tin nhắn:', err)
      toast.error(err.message || 'Gửi tin nhắn thất bại!')
    } finally {
      setSending(false)
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
      <div className="glass-card flex flex-col h-[calc(100vh-210px)] max-h-[700px] overflow-hidden animate-fade-in">
        {/* Header phòng chat */}
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
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 min-h-0 bg-slate-950/20 scrollbar-thin">
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
                    'flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]',
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

                  {/* Bubble */}
                  <div className="space-y-1">
                    {/* Tên người gửi & Chức vụ & Thời gian */}
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

                    <div
                      className={cn(
                        'p-3 rounded-2xl shadow-sm text-sm break-words relative group',
                        isOwnMessage
                          ? 'bg-cyan-500/10 border border-cyan-500/20 text-white rounded-tr-none'
                          : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                      )}
                    >
                      {/* Nội dung Text */}
                      {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                      {/* Hình ảnh đính kèm */}
                      {msg.image_url && (
                        <div className={cn('mt-2 overflow-hidden rounded-lg max-w-full border border-white/5', msg.content ? '' : 'mt-0')}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.image_url}
                            alt="Ảnh đính kèm"
                            className="max-h-72 object-contain hover:scale-[1.01] transition-transform duration-300 cursor-zoom-in"
                            onClick={() => window.open(msg.image_url!, '_blank')}
                          />
                        </div>
                      )}

                      {/* Thời gian gửi tin nhắn nhỏ bên góc */}
                      <span className="block text-[9px] text-slate-500 text-right mt-1.5 select-none">
                        {formattedTime}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

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

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-white/[0.01] flex items-end gap-2">
          {/* Nút chọn ảnh */}
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

          {/* Ô nhập tin nhắn */}
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
              placeholder={selectedImage ? "Nhập chú thích ảnh (tùy chọn)..." : "Nhập nội dung trò chuyện..."}
              rows={1}
              disabled={sending}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all resize-none max-h-24 leading-relaxed disabled:opacity-60"
            />
          </div>

          {/* Nút gửi */}
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
    </DashboardShell>
  )
}
