'use client'

import { exportToCSV } from '@/lib/utils'
import type { Task } from '@/lib/types'
import { Download } from 'lucide-react'

interface ExportButtonProps {
  tasks: Task[]
}

export function ExportButton({ tasks }: ExportButtonProps) {
  const handleExport = () => {
    const data = tasks.map((t) => ({
      'Tiêu đề': t.title,
      'Trạng thái': t.status,
      'Độ ưu tiên': t.priority,
      'Tiến độ (%)': t.progress,
      'Hạn chót': t.deadline ?? '',
      'Ngày tạo': t.created_at,
    }))
    exportToCSV(data, 'remlab_tasks_report')
  }

  return (
    <button
      id="export-csv-btn"
      onClick={handleExport}
      className="btn-secondary flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Xuất CSV
    </button>
  )
}
