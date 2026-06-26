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
  MoreVertical, CornerUpLeft, Trash2, Download, Copy, Quote
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  content: string | null
  image_url: string | null
  reply_to_id: string | null
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

  // Quản lý dropdown menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
          .select('*, sender:profiles(id, full_name, avatar_url, role), reply_to:messages(id, content, image_url, sender_id, sender:profiles(id, full_name))')
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

  // Thiết lập realtime subscription lắng nghe tin nhắn mới & tin nhắn bị xóa/thu hồi
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
          let replyToData: any = null
          if (payload.new.reply_to_id) {
            const { data: originalMsg }: any = await supabase
              .from('messages')
              .select('id, content, image_url, sender_id, sender:profiles(id, full_name)')
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
                sender: senderObj ? {
                  id: senderObj.id,
                  full_name: senderObj.full_name
                } : null
              }
            }
          }

          const newMessage: ChatMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            content: payload.new.content,
            image_url: payload.new.image_url,
            reply_to_id: payload.new.reply_to_id,
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
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Khi tin nhắn bị xóa khỏi DB, cập nhật state cục bộ ngay lập tức để biến mất realtime
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
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
      toast.error(err.message || 'Gửi tin nhắn thất bại!')
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------
  // XỬ LÝ MENU CHỨC NĂNG TIN NHẮN
  // ---------------------------------------------------------
  
  // 1. Thu hồi / Xóa tin nhắn
  const handleRecallMessage = async (msg: ChatMessage) => {
    setActiveMenuId(null)
    try {
      // Xóa file ảnh khỏi Storage nếu tin nhắn có đính kèm ảnh
      if (msg.image_url) {
        const parts = msg.image_url.split('/chat-attachments/')
        if (parts.length > 1) {
          const filePath = parts[1]
          await supabase.storage.from('chat-attachments').remove([filePath])
        }
      }

      // Xóa bản ghi trong database
      const { error } = await supabase.from('messages').delete().eq('id', msg.id)
      if (error) throw error
      toast.success('Đã thu hồi tin nhắn')
    } catch (err: any) {
      toast.error('Không thể thu hồi: ' + err.message)
    }
  }

  // 2. Copy nội dung text / link ảnh
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

  // 3. Tải hình ảnh về máy
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
      // Fallback nếu bị CORS
      window.open(url, '_blank')
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
      <div className="glass-card flex flex-col h-[calc(100vh-210px)] max-h-[700px] overflow-hidden animate-fade-in relative">
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
                    'flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%] group/row relative',
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
                      {/* Menu 3 chấm xuất hiện khi hover */}
                      <div className={cn(
                        'opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0',
                        isOwnMessage ? 'flex-row-reverse' : ''
                      )}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                          title="Lựa chọn"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Dropdown Options Menu */}
                      {activeMenuId === msg.id && (
                        <div
                          ref={menuRef}
                          className={cn(
                            'absolute z-50 bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-2xl min-w-[120px] text-xs text-slate-200 animate-fade-in',
                            isOwnMessage ? 'right-6 bottom-0' : 'left-6 bottom-0'
                          )}
                        >
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
                          {msg.content && (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy chữ
                            </button>
                          )}
                          {msg.image_url && (
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
                          {isOwnMessage && (
                            <button
                              type="button"
                              onClick={() => handleRecallMessage(msg)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors flex items-center gap-1.5 border-t border-slate-800/60 mt-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Thu hồi
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bubble content */}
                      <div
                        className={cn(
                          'p-3 rounded-2xl shadow-sm text-sm break-words flex flex-col',
                          isOwnMessage
                            ? 'bg-cyan-500/10 border border-cyan-500/20 text-white rounded-tr-none'
                            : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                        )}
                      >
                        {/* Hiển thị Tin nhắn trích dẫn (Replied Message Block) */}
                        {msg.reply_to && (
                          <div className="mb-2 p-2 rounded-lg bg-black/30 border-l-2 border-cyan-500 text-slate-400 text-xs flex flex-col gap-0.5 select-none opacity-85">
                            <span className="font-semibold text-cyan-400 text-[10px]">
                              {msg.reply_to.sender?.full_name || 'Thành viên'}
                            </span>
                            {msg.reply_to.content && (
                              <p className="truncate italic">
                                &quot;{msg.reply_to.content}&quot;
                              </p>
                            )}
                            {msg.reply_to.image_url && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <ImageIcon className="w-3 h-3" /> [Hình ảnh]
                              </span>
                            )}
                          </div>
                        )}

                        {/* Nội dung Text */}
                        {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                        {/* Hình ảnh */}
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

        {/* Khung trích dẫn đang trả lời (Replying Preview) */}
        {replyingTo && (
          <div className="px-5 py-2.5 border-t border-white/5 bg-slate-900 flex items-center justify-between animate-fade-in relative z-20">
            <div className="flex items-start gap-2.5 border-l-2 border-cyan-400 pl-3">
              <div className="text-xs">
                <p className="font-semibold text-cyan-400">
                  Trả lời {replyingTo.sender?.full_name || 'Thành viên'}
                </p>
                {replyingTo.content && (
                  <p className="text-slate-400 truncate max-w-lg mt-0.5 italic">
                    &quot;{replyingTo.content}&quot;
                  </p>
                )}
                {replyingTo.image_url && (
                  <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
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
    </DashboardShell>
  )
}
