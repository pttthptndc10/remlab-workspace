'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data as Profile | null
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }, [supabase, router])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && mounted) {
        const profile = await fetchProfile(session.user.id)
        if (mounted) {
          if (profile && profile.status === 'inactive') {
            await supabase.auth.signOut()
            setUser(null)
            router.push('/login?error=blocked')
          } else {
            setUser(profile)
          }
        }
      }
      if (mounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (profile && profile.status === 'inactive') {
            await supabase.auth.signOut()
            setUser(null)
            router.push('/login?error=blocked')
          } else {
            setUser(profile)
          }
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile, router])

  const isAdmin = user?.role === 'admin'
  const isLeader = user?.role === 'leader'
  const isAdminOrLeader = isAdmin || isLeader

  return { user, loading, signOut, isAdmin, isLeader, isAdminOrLeader }
}
