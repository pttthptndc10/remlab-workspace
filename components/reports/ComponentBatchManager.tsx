'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Download, Loader2, Package, FolderOpen, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import type { ComponentBatch, ComponentFile } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface ComponentBatchManagerProps {
  initialBatches: ComponentBatch[]
  isAdmin: boolean
}

export function ComponentBatchManager({ initialBatches, isAdmin }: ComponentBatchManagerProps) {
  const supabase = createClient()
  const [batches, setBatches] = useState<ComponentBatch[]>(initialBatches)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBatchName, setNewBatchName] = useState('')

  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [batchFiles, setBatchFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBatchName.trim()) return

    setCreating(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('component_batches')
        .insert({
          name: newBatchName,
          status: 'active',
          created_by: userData.user.id
        })
        .select('*, creator:profiles!component_batches_created_by_fkey(id, full_name)')
        .single()

      if (error) throw error
      
      setBatches([data, ...batches])
      setNewBatchName('')
      toast.success('Đã tạo phiên gom hàng mới')
    } catch (err: any) {
      toast.error('Lỗi khi tạo phiên gom hàng: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleToggleExpand = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null)
      return
    }
    
    setExpandedBatch(batchId)
    setLoadingFiles(true)
    try {
      const { data, error } = await supabase
        .from('component_files')
        .select('*, project:projects(id, name), creator:profiles!component_files_created_by_fkey(id, full_name)')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      setBatchFiles(data || [])
    } catch (err: any) {
      toast.error('Lỗi tải danh sách file: ' + err.message)
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleExportBatch = async (batchId: string, batchName: string) => {
    setLoading(true)
    try {
      // Fetch all files in this batch
      const { data: files, error } = await supabase
        .from('component_files')
        .select('*, project:projects(id, name), creator:profiles!component_files_created_by_fkey(id, full_name)')
        .eq('batch_id', batchId)

      if (error) throw error

      if (!files || files.length === 0) {
        toast.error('Phiên gom hàng này chưa có file linh kiện nào')
        return
      }

      // Flatten the content from all files
      const allItems: any[] = []
      let rowIndex = 1
      
      files.forEach((file: any) => {
        const projectName = file.project?.name || 'Không rõ dự án'
        const creatorName = file.creator?.full_name || 'Không rõ người tạo'
        
        const contents = Array.isArray(file.content) ? file.content : []
        contents.forEach((item: any) => {
          allItems.push({
            'STT': rowIndex++,
            'Dự án': projectName,
            'Người nhập': creatorName,
            'Tên linh kiện': item.name,
            'Giá (VND)': item.price || 0,
            'Shop/Link': item.shop || '',
            'Ghi chú': item.notes || '',
            'Ngày nhập': formatDate(file.created_at)
          })
        })
      })

      if (allItems.length === 0) {
        toast.error('Không có dữ liệu linh kiện hợp lệ trong các file')
        return
      }

      // Generate Excel
      const ws = XLSX.utils.json_to_sheet(allItems)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Gom Linh Kien')
      
      // Format columns
      ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 20 }, // Dự án
        { wch: 20 }, // Người nhập
        { wch: 40 }, // Tên
        { wch: 15 }, // Giá
        { wch: 30 }, // Shop
        { wch: 30 }, // Ghi chú
        { wch: 15 }  // Ngày nhập
      ]

      const filename = `GomLinhKien_${batchName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
      toast.success('Đã xuất Excel thành công!')

    } catch (err: any) {
      toast.error('Lỗi khi xuất file Excel: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (batchId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active'
    try {
      const { error } = await supabase
        .from('component_batches')
        .update({ status: newStatus })
        .eq('id', batchId)

      if (error) throw error
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: newStatus } : b))
      toast.success(`Đã đổi trạng thái thành ${newStatus === 'active' ? 'Đang mở' : 'Đã đóng'}`)
    } catch (err: any) {
      toast.error('Lỗi cập nhật trạng thái: ' + err.message)
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm("BẠN CÓ CHẮC CHẮN MUỐN XÓA PHIÊN GOM HÀNG NÀY?\n\nLưu ý: Mọi file linh kiện đã nộp trong phiên này cũng sẽ bị xóa vĩnh viễn và không thể khôi phục!")) {
      return
    }
    
    try {
      const { error } = await supabase.from('component_batches').delete().eq('id', batchId)
      if (error) throw error
      
      setBatches(prev => prev.filter(b => b.id !== batchId))
      toast.success('Đã xóa phiên gom hàng!')
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + err.message)
    }
  }

  if (!isAdmin && batches.length === 0) return null

  return (
    <div className="glass-card overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold text-white">Quản lý Gom Linh Kiện</h3>
        </div>
      </div>

      <div className="p-5">
        {isAdmin && (
          <form onSubmit={handleCreateBatch} className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-800/30 p-4 rounded-xl border border-white/5">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Tạo phiên gom hàng mới</label>
              <input
                type="text"
                placeholder="Vd: Gom đơn hàng tháng 7..."
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                className="input-dark w-full py-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary mt-auto py-2 shrink-0"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Tạo phiên mới
            </button>
          </form>
        )}

        <div className="space-y-3">
          {batches.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <FolderOpen className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
              Chưa có phiên gom hàng nào
            </div>
          ) : (
            batches.map(batch => (
              <div key={batch.id} className="flex flex-col border border-white/10 rounded-xl bg-slate-800/40 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-800/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-200">{batch.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${batch.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                        {batch.status === 'active' ? 'Đang mở' : 'Đã đóng'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Tạo bởi {batch.creator?.full_name || 'Admin'} • {formatDate(batch.created_at)}
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleExpand(batch.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
                      >
                        {expandedBatch === batch.id ? 'Thu gọn' : 'Xem chi tiết'}
                      </button>
                      <button
                        onClick={() => handleToggleStatus(batch.id, batch.status)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
                      >
                        {batch.status === 'active' ? 'Đóng phiên' : 'Mở lại'}
                      </button>
                      <button
                        onClick={() => handleExportBatch(batch.id, batch.name)}
                        disabled={loading}
                        className="btn-secondary py-1.5 px-3 text-sm"
                      >
                        <Download size={14} />
                        Gộp & Xuất Excel
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition-colors border border-transparent hover:border-rose-500/30 ml-2"
                        title="Xóa phiên gom hàng"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {expandedBatch === batch.id && (
                  <div className="p-4 bg-slate-900/50 border-t border-white/5">
                    <h5 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Danh sách file đã nộp</h5>
                    {loadingFiles ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
                      </div>
                    ) : batchFiles.length === 0 ? (
                      <div className="text-sm text-slate-500 italic">Chưa có ai nộp file linh kiện vào phiên này.</div>
                    ) : (
                      <div className="space-y-2">
                        {batchFiles.map((file, idx) => (
                          <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-200">
                                  Dự án: {' '}
                                  {file.project?.id ? (
                                    <Link 
                                      href={`/projects/${file.project.id}?tab=components`}
                                      className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                                    >
                                      {file.project.name}
                                    </Link>
                                  ) : (
                                    'Không rõ'
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Người nộp: {file.creator?.full_name || 'Không rõ'} • {formatDate(file.created_at)}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs font-medium text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                              {Array.isArray(file.content) ? file.content.length : 0} linh kiện
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
