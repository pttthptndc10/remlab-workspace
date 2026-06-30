import { Users, FolderKanban, Zap } from 'lucide-react'

interface MissionBlockProps {
  memberCount: number
  projectCount: number
  missionText?: string
}

export function MissionBlock({
  memberCount,
  projectCount,
  missionText = 'Xây dựng hệ thống quản lý nội bộ hiệu quả, thúc đẩy sự hợp tác và nâng cao năng suất cho toàn đội RemLab.',
}: MissionBlockProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 md:p-8"
      style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(5,11,31,0.9) 60%)',
        border: '1px solid rgba(6,182,212,0.3)',
        boxShadow: '0 0 40px rgba(6,182,212,0.08)',
      }}
    >
      {/* Animated border glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-40"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)',
          animation: 'shimmer 3s infinite linear',
          backgroundSize: '200% 100%',
        }}
      />

      {/* Decorative background circles */}
      <div
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }}
      />
      <div
        className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
        {/* Left: Logo + Mission */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="RemLab Logo" className="w-12 h-12 object-contain rounded-xl flex-shrink-0" />
            <div>
              <h1
                className="text-2xl md:text-3xl font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #67e8f9 50%, #a5f3fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                RemLab
              </h1>
              <p className="text-xs text-cyan-400/70 font-medium tracking-widest uppercase">
                Xây dựng tương lai bằng code
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed mt-3 max-w-xl">
            <span className="text-cyan-400 font-semibold">Mission: </span>
            {missionText}
          </p>
        </div>

        {/* Right: Team stats */}
        <div className="flex gap-4 flex-shrink-0">
          <div
            className="text-center px-5 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-2xl font-bold text-white">{memberCount}</span>
            </div>
            <span className="text-xs text-slate-400">Thành viên</span>
          </div>
          <div
            className="text-center px-5 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <FolderKanban className="w-4 h-4 text-cyan-400" />
              <span className="text-2xl font-bold text-white">{projectCount}</span>
            </div>
            <span className="text-xs text-slate-400">Dự án</span>
          </div>
        </div>
      </div>

    </div>
  )
}
