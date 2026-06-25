import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'RemLab Workspace',
  description: 'Hệ thống quản lý nội bộ của RemLab - Nền tảng quản lý dự án và công việc cho đội kỹ thuật.',
  keywords: ['remlab', 'quản lý dự án', 'kanban', 'team management'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #1e293b',
            },
            success: {
              iconTheme: { primary: '#06b6d4', secondary: '#0f172a' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#0f172a' },
            },
          }}
        />
      </body>
    </html>
  )
}
