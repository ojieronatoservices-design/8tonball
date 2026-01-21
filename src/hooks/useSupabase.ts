import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import { useMemo } from 'react'

export function useSupabase() {
    const { getToken } = useAuth()

    return useMemo(() => {
        return {
            getClient: async () => {
                try {
                    const token = await getToken({ template: 'supabase' })
                    if (token) return createClerkSupabaseClient(token)
                } catch (error) {
                    // Fallback to anon client if auth fails
                }
                return supabase
            }
        }
    }, [getToken])
}
