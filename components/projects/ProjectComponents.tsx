'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Download, Save, Loader2, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import type { Project, Profile, ComponentBatch, ComponentItem, ComponentFile } from '@/lib/types'
import Link from 'next/link'

interface ProjectComponentsProps {
  project: Project
  currentUser: Profile
}

// Format number với dấu chấm mỗi 3 chữ số: 72000 -> 72.000
function formatVND(value: number): string {
  if (!value && value !== 0) return ''
  return value.toLocaleString('vi-VN')
}

// Parse chuỗi có dấu chấm về number: "72.000" -> 72000
function parseVND(str: string): number {
  const cleaned = str.replace(/\./g, '').replace(/[^0-9]/g, '')
  return cleaned === '' ? 0 : parseInt(cleaned, 10)
}

export function ProjectComponents({ project, currentUser }: ProjectComponentsProps) {
  const supabase = createClient()
  const [batches, setBatches] = useState<ComponentBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [items, setItems] = useState<ComponentItem[]>([
    { id: crypto.randomUUID(), name: '', price: 0, quantity: 1, shop: '', notes: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [fetchingBatches, setFetchingBatches] = useState(true)
  const [batchTotal, setBatchTotal] = useState<number | null>(null)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstLoad = useRef(true)
  const currentFileIdRef = useRef<string | null>(null)

  // Tổng tiền của danh sách hiện tại
  const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)

  // Fetch batches, latest saved components, và tổng tiền phiên
  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch active batches
        const { data: batchesData, error: batchesError } = await supabase
          .from('component_batches')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (batchesError) throw batchesError
        setBatches(batchesData || [])
        const firstBatch = batchesData && batchesData.length > 0 ? batchesData[0] : null
        if (firstBatch) {
          setSelectedBatchId(firstBatch.id)
        }

        // 2. Fetch latest saved components for this project to pre-fill the form
        const { data: latestFile } = await supabase
          .from('component_files')
          .select('id, content')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestFile && Array.isArray(latestFile.content) && latestFile.content.length > 0) {
          currentFileIdRef.current = latestFile.id
          const loadedItems = latestFile.content.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            name: item.name || '',
            price: item.price || 0,
            quantity: item.quantity || 1,
            shop: item.shop || '',
            notes: item.notes || ''
          }))
          setItems(loadedItems)
        }

        // 3. Tính tổng tiền của phiên được chọn
        if (firstBatch) {
          await fetchBatchTotal(firstBatch.id)
        }
      } catch (err: any) {
        toast.error('Lỗi tải dữ liệu: ' + err.message)
      } finally {
        setFetchingBatches(false)
        isFirstLoad.current = false
      }
    }
    fetchData()
  }, [supabase, project.id])

  // Tính tổng tiền phiên gom hàng đang chọn
  const fetchBatchTotal = useCallback(async (batchId: string) => {
    if (!batchId) { setBatchTotal(null); return }
    try {
      const { data: files } = await supabase
        .from('component_files')
        .select('content')
        .eq('batch_id', batchId)
      
      if (!files) { setBatchTotal(0); return }
      
      let total = 0
      files.forEach((file: any) => {
        if (Array.isArray(file.content)) {
          file.content.forEach((item: any) => {
            total += (item.price || 0) * (item.quantity || 1)
          })
        }
      })
      setBatchTotal(total)
    } catch {
      setBatchTotal(null)
    }
  }, [supabase])

  // Khi thay đổi phiên, tính lại tổng
  const handleBatchChange = (id: string) => {
    setSelectedBatchId(id)
    fetchBatchTotal(id)
  }

  // Hàm lưu thực sự
  const doSave = useCallback(async (itemsToSave: ComponentItem[], batchId: string) => {
    const validItems = itemsToSave.filter(i => i.name.trim() !== '')
    if (validItems.length === 0) return

    setSaveStatus('saving')
    try {
      // Lưu vào component_files (ngoài phiên - chỉ lưu draft)
      const { data: existing } = await supabase
        .from('component_files')
        .select('id')
        .eq('project_id', project.id)
        .is('batch_id', null)
        .maybeSingle()

      if (existing) {
        await supabase.from('component_files').update({
          content: validItems,
          created_at: new Date().toISOString()
        }).eq('id', existing.id)
        currentFileIdRef.current = existing.id
      } else {
        const { data: inserted } = await supabase.from('component_files').insert({
          project_id: project.id,
          batch_id: null,
          created_by: currentUser.id,
          content: validItems,
        }).select('id').maybeSingle()
        if (inserted) currentFileIdRef.current = inserted.id
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [supabase, project.id, currentUser.id])

  // Auto-save khi items thay đổi (debounce 1.5s như Canva)
  useEffect(() => {
    if (isFirstLoad.current) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setSaveStatus('saving')

    autoSaveTimerRef.current = setTimeout(() => {
      doSave(items, selectedBatchId)
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [items, doSave, selectedBatchId])

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', price: 0, quantity: 1, shop: '', notes: '' }
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: crypto.randomUUID(), name: '', price: 0, quantity: 1, shop: '', notes: '' }])
      return
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleItemChange = (id: string, field: keyof ComponentItem, value: string | number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleExportSingle = () => {
    const validItems = items.filter(i => i.name.trim() !== '')
    if (validItems.length === 0) {
      toast.error('Vui lòng nhập ít nhất một linh kiện có tên')
      return
    }

    const exportData = validItems.map((item, index) => ({
      'STT': index + 1,
      'Tên linh kiện': item.name,
      'Số lượng': item.quantity || 1,
      'Đơn giá (VND)': item.price,
      'Thành tiền (VND)': (item.price || 0) * (item.quantity || 1),
      'Shop/Link': item.shop,
      'Ghi chú': item.notes
    }))

    // Thêm dòng tổng cộng
    exportData.push({
      'STT': 0,
      'Tên linh kiện': 'TỔNG CỘNG',
      'Số lượng': validItems.reduce((s, i) => s + (i.quantity || 1), 0),
      'Đơn giá (VND)': 0,
      'Thành tiền (VND)': totalAmount,
      'Shop/Link': '',
      'Ghi chú': ''
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Linh Kien')

    ws['!cols'] = [
      { wch: 5 },
      { wch: 40 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 },
      { wch: 40 }
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
      await fetchBatchTotal(selectedBatchId)

    } catch (err: any) {
      toast.error('Lỗi khi đưa vào hàng chờ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Danh sách linh kiện</h3>
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock size={12} className="animate-spin" />
                Đang lưu...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={12} />
                Đã lưu
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tổng tiền hiện tại */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/70 border border-white/10">
            <span className="text-xs text-slate-400 whitespace-nowrap">Tổng tiền:</span>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">
              {formatVND(totalAmount)} ₫
            </span>
          </div>
          <button
            onClick={handleExportSingle}
            className="btn-secondary py-2"
          >
            <Download size={16} />
            <span>Xuất Excel luôn</span>
          </button>
        </div>
      </div>

      {/* Bảng linh kiện */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-white/10">
                <th className="p-3 text-sm font-semibold text-slate-300 w-12 text-center">STT</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[200px]">Tên linh kiện</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-[110px]">SL</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-[160px]">Đơn giá (VND)</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-[160px] text-right pr-4">Thành tiền</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[150px]">Shop / Link</th>
                <th className="p-3 text-sm font-semibold text-slate-300 min-w-[180px]">Ghi chú thêm</th>
                <th className="p-3 text-sm font-semibold text-slate-300 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const lineTotal = (item.price || 0) * (item.quantity || 1)
                return (
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
                        min="1"
                        className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50 text-center"
                        placeholder="1"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-dark w-full py-2 bg-transparent border-transparent hover:border-white/10 focus:bg-slate-900/50 tabular-nums"
                        placeholder="0"
                        value={item.price ? formatVND(item.price) : ''}
                        onChange={(e) => handleItemChange(item.id, 'price', parseVND(e.target.value))}
                      />
                    </td>
                    <td className="p-3 text-right pr-4">
                      <span className={`text-sm tabular-nums font-medium ${lineTotal > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                        {lineTotal > 0 ? formatVND(lineTotal) + ' ₫' : '—'}
                      </span>
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
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Dòng tổng cộng */}
            <tfoot>
              <tr className="bg-slate-800/60 border-t-2 border-white/10">
                <td colSpan={4} className="p-3 text-right text-sm font-bold text-slate-300">
                  Tổng cộng
                </td>
                <td className="p-3 text-right pr-4">
                  <span className="text-base font-bold text-cyan-400 tabular-nums">
                    {formatVND(totalAmount)} ₫
                  </span>
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
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

      {/* Phần gom hàng */}
      <div className="glass-card p-6 border-cyan-500/20 bg-cyan-950/10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-cyan-300">Gửi linh kiện vào đợt gom hàng chung</h4>
          {batchTotal !== null && selectedBatchId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-xs text-cyan-400/70">Tổng phiên:</span>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">{formatVND(batchTotal)} ₫</span>
            </div>
          )}
        </div>
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
                onChange={(e) => handleBatchChange(e.target.value)}
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
