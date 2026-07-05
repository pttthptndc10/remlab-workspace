'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskEvidence, EvidenceCategory, Profile } from '@/lib/types'
import toast from 'react-hot-toast'
import {
  Paperclip, ChevronDown, ChevronRight, Upload, X, Download,
  Image as ImageIcon, FileText, Cpu, Archive, Video, Loader2,
  Clock, User, Layers, Eye, ZoomIn, ChevronLeft, ChevronRight as ChevronRightIcon,
  Trash2
} from 'lucide-react'

// ======================================================
// HELPERS
// ======================================================

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const DOCUMENT_EXTS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md']
const ENGINEERING_EXTS = ['pcbdoc', 'schdoc', 'step', 'stp', 'stl', 'dxf', 'drawio', 'gerber', 'zip', 'gbr']
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz']
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'avi', 'mkv']

function getCategory(fileName: string): EvidenceCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (ENGINEERING_EXTS.includes(ext) && !ARCHIVE_EXTS.includes(ext)) return 'engineering'
  if (ARCHIVE_EXTS.includes(ext)) return 'archive'
  if (DOCUMENT_EXTS.includes(ext)) return 'document'
  return 'document'
}

function getFileExt(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ACCEPT_ALL = [
  ...IMAGE_EXTS.map(e => `.${e}`),
  ...DOCUMENT_EXTS.map(e => `.${e}`),
  ...ENGINEERING_EXTS.map(e => `.${e}`),
  ...ARCHIVE_EXTS.map(e => `.${e}`),
  ...VIDEO_EXTS.map(e => `.${e}`),
].join(',')

// ======================================================
// CATEGORY CONFIG
// ======================================================
const CATEGORY_CONFIG: Record<EvidenceCategory, { label: string; icon: React.ReactNode; color: string }> = {
  image: {
    label: 'Ảnh',
    icon: <ImageIcon className="w-3.5 h-3.5" />,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  document: {
    label: 'Tài liệu',
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  engineering: {
    label: 'Kỹ thuật',
    icon: <Cpu className="w-3.5 h-3.5" />,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  archive: {
    label: 'Lưu trữ',
    icon: <Archive className="w-3.5 h-3.5" />,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  video: {
    label: 'Video',
    icon: <Video className="w-3.5 h-3.5" />,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
}

// ======================================================
// LIGHTBOX COMPONENT
// ======================================================
interface LightboxProps {
  items: TaskEvidence[]
  initialIndex: number
  getUrl: (path: string) => string
  onClose: () => void
}

function Lightbox({ items, initialIndex, getUrl, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex)
  const current = items[idx]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(items.length - 1, i + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length, onClose])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer z-10"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium bg-black/40 px-3 py-1 rounded-full">
        {idx + 1} / {items.length}
      </div>

      {/* Nav buttons */}
      {idx > 0 && (
        <button
          type="button"
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer z-10"
          onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1) }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {idx < items.length - 1 && (
        <button
          type="button"
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer z-10"
          onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1) }}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      )}

      {/* Image */}
      <img
        src={getUrl(current.storage_path)}
        alt={current.file_name}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Caption */}
      <div className="absolute bottom-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-white/80 text-sm font-medium">{current.file_name}</p>
        {current.version > 1 && (
          <span className="text-white/40 text-xs">v{current.version}</span>
        )}
        <p className="text-white/40 text-xs mt-0.5">
          {current.uploader?.full_name || 'Không rõ'} · {formatDateTime(current.created_at)}
        </p>
      </div>

      {/* Thumbnails strip */}
      {items.length > 1 && (
        <div
          className="absolute bottom-16 flex gap-2 overflow-x-auto max-w-[80vw] px-2 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                i === idx ? 'border-cyan-400 opacity-100' : 'border-white/10 opacity-50 hover:opacity-80'
              }`}
            >
              <img
                src={getUrl(item.storage_path)}
                alt={item.file_name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ======================================================
// MAIN COMPONENT
// ======================================================
interface TaskEvidenceSectionProps {
  taskId: string
  projectId: string
  currentUser: Profile
  taskAssigneeId: string | null
  isTaskCancelled?: boolean
}

export function TaskEvidenceSection({
  taskId,
  projectId,
  currentUser,
  taskAssigneeId,
  isTaskCancelled = false,
}: TaskEvidenceSectionProps) {
  const supabase = createClient()

  const [expanded, setExpanded] = useState(false)
  const [evidences, setEvidences] = useState<TaskEvidence[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxItems, setLightboxItems] = useState<TaskEvidence[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Permission check
  const isAdmin = currentUser.role === 'admin'
  const isLeader = currentUser.role === 'leader'
  const isAssignee = taskAssigneeId === currentUser.id
  const canUpload = !isTaskCancelled && (isAdmin || isLeader || isAssignee)

  // Get public URL from Supabase storage
  const getPublicUrl = useCallback((storagePath: string) => {
    const { data } = supabase.storage.from('task-evidence').getPublicUrl(storagePath)
    return data.publicUrl
  }, [supabase])

  // Load evidences
  const loadEvidences = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('task_evidence')
        .select('*, uploader:uploaded_by(id, full_name, avatar_url, role)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvidences((data || []) as TaskEvidence[])
    } catch (err: any) {
      toast.error('Lỗi tải minh chứng: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [taskId, supabase])

  useEffect(() => {
    if (expanded && evidences.length === 0) {
      loadEvidences()
    }
  }, [expanded])

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)

    const fileArray = Array.from(files)
    let successCount = 0
    let imageCount = 0

    try {
      for (const file of fileArray) {
        const ext = getFileExt(file.name)
        const category = getCategory(file.name)

        // Determine version: find max version for same filename
        const sameNameFiles = evidences.filter(ev => ev.file_name === file.name)
        const nextVersion = sameNameFiles.length > 0
          ? Math.max(...sameNameFiles.map(ev => ev.version)) + 1
          : 1

        // Build storage path
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${projectId}/${taskId}/${timestamp}_v${nextVersion}_${safeName}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('task-evidence')
          .upload(storagePath, file, { upsert: false })

        if (uploadError) throw new Error(`Upload "${file.name}": ${uploadError.message}`)

        // Insert DB record
        const { error: dbError } = await supabase.from('task_evidence').insert({
          project_id: projectId,
          task_id: taskId,
          uploaded_by: currentUser.id,
          file_name: file.name,
          file_type: ext,
          category,
          version: nextVersion,
          size: file.size,
          storage_path: storagePath,
        })

        if (dbError) {
          // rollback storage
          await supabase.storage.from('task-evidence').remove([storagePath])
          throw new Error(`Ghi DB "${file.name}": ${dbError.message}`)
        }

        // Activity log
        const actionIcon = category === 'image' ? '📷' : category === 'video' ? '🎬' : '📎'
        await supabase.from('activity_logs').insert({
          actor_id: currentUser.id,
          action: 'uploaded_evidence',
          entity_type: 'task',
          entity_id: taskId,
          entity_name: file.name,
          project_id: projectId,
          metadata: {
            file_name: file.name,
            category,
            version: nextVersion,
            size: file.size,
            icon: actionIcon,
          },
        })

        successCount++
        if (category === 'image') imageCount++
      }

      if (successCount > 1) {
        toast.success(`Đã tải lên ${successCount} minh chứng thành công!`)
      } else if (successCount === 1) {
        toast.success(`Đã tải lên "${fileArray[0].name}" thành công!`)
      }

      await loadEvidences()
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra khi tải lên')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Delete handler
  const handleDelete = async (evidence: TaskEvidence) => {
    const canDelete = isAdmin || evidence.uploaded_by === currentUser.id
    if (!canDelete) return
    if (!window.confirm(`Xóa minh chứng "${evidence.file_name}"?`)) return

    setDeletingId(evidence.id)
    try {
      // Remove from storage
      await supabase.storage.from('task-evidence').remove([evidence.storage_path])
      // Remove from DB
      const { error } = await supabase.from('task_evidence').delete().eq('id', evidence.id)
      if (error) throw error
      toast.success('Đã xóa minh chứng')
      setEvidences(prev => prev.filter(e => e.id !== evidence.id))
    } catch (err: any) {
      toast.error('Lỗi xóa: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Group by category
  const grouped = evidences.reduce<Record<EvidenceCategory, TaskEvidence[]>>(
    (acc, ev) => {
      if (!acc[ev.category]) acc[ev.category] = []
      acc[ev.category].push(ev)
      return acc
    },
    {} as Record<EvidenceCategory, TaskEvidence[]>
  )

  const totalCount = evidences.length
  const categoryOrder: EvidenceCategory[] = ['image', 'document', 'engineering', 'archive', 'video']

  return (
    <div className="border-t border-white/5 mt-3 pt-3">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-200 transition-colors">
          <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Minh chứng thực hiện
          </span>
          {totalCount > 0 && (
            <span className="text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-full font-bold tabular-nums">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-white/5" />
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform" />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Upload zone */}
          {canUpload && (
            <div>
              <input
                type="file"
                id={`evidence-upload-${taskId}`}
                className="hidden"
                multiple
                accept={ACCEPT_ALL}
                onChange={handleUpload}
                disabled={uploading}
              />
              <label
                htmlFor={`evidence-upload-${taskId}`}
                className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-dashed transition-all cursor-pointer text-xs font-semibold ${
                  uploading
                    ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                    : 'border-cyan-500/25 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/[0.03]'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang tải lên...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Tải lên minh chứng (nhiều file)
                  </>
                )}
              </label>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải minh chứng...
            </div>
          ) : evidences.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs">
              <Paperclip className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
              Chưa có minh chứng nào được tải lên
            </div>
          ) : (
            <div className="space-y-4">
              {categoryOrder.map(cat => {
                const items = grouped[cat]
                if (!items || items.length === 0) return null
                const config = CATEGORY_CONFIG[cat]
                const imageItems = cat === 'image' ? items : []

                return (
                  <div key={cat}>
                    {/* Category header */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${config.color} w-fit mb-2`}>
                      {config.icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {config.label} ({items.length})
                      </span>
                    </div>

                    {/* Image grid */}
                    {cat === 'image' ? (
                      <div className="flex flex-wrap gap-2">
                        {items.map((ev, imgIdx) => (
                          <div key={ev.id} className="relative group">
                            <button
                              type="button"
                              onClick={() => {
                                setLightboxItems(imageItems)
                                setLightboxIndex(imgIdx)
                              }}
                              className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/40 transition-all cursor-zoom-in block relative"
                            >
                              <img
                                src={getPublicUrl(ev.storage_path)}
                                alt={ev.file_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn className="w-5 h-5 text-white drop-shadow-lg" />
                              </div>
                            </button>
                            {/* Version badge */}
                            {ev.version > 1 && (
                              <span className="absolute top-1 left-1 text-[8px] font-bold bg-black/70 text-cyan-400 px-1 rounded">
                                v{ev.version}
                              </span>
                            )}
                            {/* Delete button */}
                            {(isAdmin || ev.uploaded_by === currentUser.id) && (
                              <button
                                type="button"
                                onClick={() => handleDelete(ev)}
                                disabled={deletingId === ev.id}
                                className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 text-rose-400 hover:text-white hover:bg-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                {deletingId === ev.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <X className="w-3 h-3" />
                                }
                              </button>
                            )}
                            {/* Tooltip */}
                            <p className="text-[9px] text-slate-500 mt-0.5 max-w-[96px] truncate" title={ev.file_name}>
                              {ev.file_name}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Document / Engineering / Archive / Video cards */
                      <div className="space-y-1.5">
                        {items.map(ev => {
                          const ext = getFileExt(ev.file_name).toUpperCase()
                          const canDelete = isAdmin || ev.uploaded_by === currentUser.id

                          return (
                            <div
                              key={ev.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 hover:bg-slate-900/70 transition-all group"
                            >
                              {/* Icon */}
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${config.color}`}>
                                <span className="text-[9px] font-black">{ext.slice(0, 4)}</span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-medium text-slate-200 truncate">
                                    {ev.file_name}
                                  </p>
                                  {ev.version > 1 && (
                                    <span className="text-[9px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1 rounded">
                                      v{ev.version}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-500">{formatBytes(ev.size)}</span>
                                  <span className="text-slate-700">·</span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                    <User className="w-2.5 h-2.5" />
                                    {(ev as any).uploader?.full_name || 'Không rõ'}
                                  </span>
                                  <span className="text-slate-700">·</span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatDateTime(ev.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                  href={getPublicUrl(ev.storage_path)}
                                  download={ev.file_name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/20 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-all cursor-pointer"
                                  title="Tải xuống"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(ev)}
                                    disabled={deletingId === ev.id}
                                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/5 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer"
                                    title="Xóa"
                                  >
                                    {deletingId === ev.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Version info note */}
          {evidences.some(e => e.version > 1) && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mt-1">
              <Layers className="w-3 h-3" />
              <span>File có nhiều phiên bản — phiên bản mới nhất được hiển thị trước</span>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          initialIndex={lightboxIndex}
          getUrl={getPublicUrl}
          onClose={() => setLightboxItems([])}
        />
      )}
    </div>
  )
}
