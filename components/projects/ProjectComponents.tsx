'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Download, Save, Loader2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import type { Project, Profile, ComponentBatch, ComponentItem, ComponentFile } from '@/lib/types'
import Link from 'next/link'

interface ProjectComponentsProps {
  project: Project
  currentUser: Profile
}

export function ProjectComponents({ project, currentUser }: ProjectComponentsProps) {
  const supabase = createClient()
  const [batches, setBatches] = useState<ComponentBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [items, setItems] = useState<ComponentItem[]>([
    { id: crypto.randomUUID(), name: '', price: 0, shop: '', notes: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [fetchingBatches, setFetchingBatches] = useState(true)

  useEffect(() => {
    async function fetchBatches() {
      try {
        const { data, error } = await supabase
          .from('component_batches')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (error) throw error
        setBatches(data || [])
        if (data && data.length > 0) {
          setSelectedBatchId(data[0].id)
        }
      } catch (err: any) {
        toast.error('Lỗi tải danh sách phiên gom hàng: ' + err.message)
      } finally {
        setFetchingBatches(false)
      }
    }
    fetchBatches()
  }, [supabase])

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', price: 0, shop: '', notes: '' }
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleItemChange = (id: string, field: keyof ComponentItem, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleExportSingle = () => {
    // Validate empty
    const validItems = items.filter(i => i.name.trim() !== '')
    if (validItems.length === 0) {
      toast.error('Vui lòng nhập ít nhất một linh kiện có tên')
      return
    }

    const exportData = validItems.map((item, index) => ({
      'STT': index + 1,
      'Tên linh kiện': item.name,
      'Giá': item.price,
      'Shop/Link': item.shop,
      'Ghi chú': item.notes
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Linh Kien')
    
    // Auto-size columns
    ws['!cols'] = [
      { wch: 5 },  // STT
      { wch: 40 }, // Tên
      { wch: 15 }, // Giá
      { wch: 30 }, // Shop
      { wch: 40 }  // Ghi chú
    ]

    const filename = `LinhKien_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success('Đã xuất Excel!')
  }

  const handleQueueBatch = async () => {
    if (!selectedBatchId) {
      toast.error('Vui lòng chọn một phiên gom hàng')
      return
    }

    const validItems = items.filter(i => i.name.trim() !== '')
    if (validItems.length === 0) {
      toast.error('Vui lòng nhập ít nhất một linh kiện có tên')
      return
    }

    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('component_files')
        .select('id')
        .eq('project_id', project.id)
        .eq('batch_id', selectedBatchId)
        .maybeSingle()
        
      let saveError;
      
      if (existing) {
        const { error } = await supabase.from('component_files').update({
          content: validItems,
          created_at: new Date().toISOString()
        }).eq('id', existing.id)
        saveError = error
      } else {
        const { error } = await supabase.from('component_files').insert({
          project_id: project.id,
          batch_id: selectedBatchId,
          created_by: currentUser.id,
          content: validItems,
        })
        saveError = error
      }

      if (saveError) throw saveError
      toast.success(existing ? 'Đã cập nhật file trong hàng chờ!' : 'Đã đưa vào hàng chờ gom hàng!')
      
      // Reset form
      setItems([{ id: crypto.randomUUID(), name: '', price: 0, shop: '', notes: '' }])
    } catch (err: any) {
      toast.error('Lỗi khi đưa vào hàng chờ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Danh sách linh kiện</h3>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportSingle}
            className="btn-secondary py-2"
          >
            <Download size={16} />
            <span>Xuất Excel luôn</span>
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-white/10">
                <th className="p-3 text-sm font-semibold text-slate-300 w-12 text-center">STT</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[200px]">Tên linh kiện</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-[150px]">Giá (VND)</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[150px]">Shop / Link</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[200px]">Ghi chú thêm</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3 text-center text-slate-400 font-medium">
                    {index + 1}
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50"
                      placeholder="Nhập tên..."
                      value={item.name}
                      onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50"
                      placeholder="0"
                      value={item.price || ''}
                      onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50"
                      placeholder="Tên shop / URL"
                      value={item.shop}
                      onChange={(e) => handleItemChange(item.id, 'shop', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50"
                      placeholder="Ghi chú..."
                      value={item.notes}
                      onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length === 1}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 border-t border-white/5 bg-slate-800/20">
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors px-2 py-1 rounded hover:bg-cyan-400/10"
          >
            <Plus size={16} />
            Thêm dòng mới
          </button>
        </div>
      </div>

      <div className="glass-card p-6 border-cyan-500/20 bg-cyan-950/10">
        <h4 className="text-sm font-semibold text-cyan-300 mb-4">Gửi linh kiện vào đợt gom hàng chung</h4>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Chọn phiên gom hàng đang mở
            </label>
            {fetchingBatches ? (
              <div className="h-10 input-dark flex items-center text-slate-400 text-sm">Đang tải...</div>
            ) : batches.length === 0 ? (
              <div className="h-10 input-dark flex items-center text-slate-400 text-sm italic">
                Chưa có phiên gom hàng nào đang mở
              </div>
            ) : (
              <select
                className="input-dark w-full"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
          
          <button
            onClick={handleQueueBatch}
            disabled={loading || batches.length === 0}
            className="btn-primary w-full sm:w-auto shrink-0 py-2.5"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>Đưa vào hàng chờ gộp</span>
          </button>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/5">
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            Đến tab Báo cáo để xem các phiên gom hàng <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
