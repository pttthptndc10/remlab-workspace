'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Loader2 } from 'lucide-react'

export default function ChatDebugPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error: dbError } = await supabase
          .from('messages')
          .select('*, sender:profiles(id, full_name)')
          .order('created_at', { ascending: false })

        if (dbError) throw dbError
        setMessages(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [supabase])

  return (
    <DashboardShell title="Chat Debugger" subtitle="Danh sách tất cả tin nhắn trong Database">
      <div className="glass-card p-6 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-400 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            Lỗi: {error}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">ID tin nhắn</th>
                <th className="py-2.5 px-3">Người gửi (ID)</th>
                <th className="py-2.5 px-3">Nội dung</th>
                <th className="py-2.5 px-3">Link ảnh</th>
                <th className="py-2.5 px-3">Đã thu hồi</th>
                <th className="py-2.5 px-3">ID trả lời (reply_to)</th>
                <th className="py-2.5 px-3">Thời gian tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {messages.map((msg) => (
                <tr key={msg.id} className="hover:bg-white/5">
                  <td className="py-2.5 px-3 font-mono text-[10px] text-cyan-400">{msg.id}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold block">{msg.sender?.full_name || 'Không rõ'}</span>
                    <span className="font-mono text-[9px] text-slate-500">{msg.sender_id}</span>
                  </td>
                  <td className="py-2.5 px-3 truncate max-w-[150px]" title={msg.content}>{msg.content || <span className="text-slate-600 italic">null</span>}</td>
                  <td className="py-2.5 px-3 truncate max-w-[150px]" title={msg.image_url}>
                    {msg.image_url ? (
                      <a href={msg.image_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                        Có ảnh (Xem)
                      </a>
                    ) : (
                      <span className="text-slate-600 italic">null</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={msg.is_recalled ? 'text-rose-400 font-semibold' : 'text-slate-500'}>
                      {msg.is_recalled ? 'True' : 'False'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                    {msg.reply_to_id || <span className="text-slate-600 italic">null</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(msg.created_at).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  )
}
