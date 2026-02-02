import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient, supabase } from '@/lib/supabase'
import { useMemo } from 'react'

export function useSupabase() {
    const { getToken } = useAuth()

    return useMemo(() => {
        return {
            getClient: async () => {
                try {
                    // Safety timeout for getToken to prevent hangs on mobile/slow networks
                    const tokenPromise = getToken({ template: 'supabase' })
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Token timeout')), 8000)
                    )

                    const token = await Promise.race([tokenPromise, timeoutPromise]) as string | null
                    if (token) return createClerkSupabaseClient(token)
                } catch (error) {
                    console.error('[useSupabase] getToken failed or timed out:', error)
                    // Fallback to anon client if auth fails
                }
                return supabase
            }
        }
    }, [getToken])
}
