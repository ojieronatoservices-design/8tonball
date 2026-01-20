import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import { useMemo } from 'react'

export function useSupabase() {
    const { getToken } = useAuth()

    return useMemo(() => {
        return {
            getClient: async () => {
                const token = await getToken({ template: 'supabase' }) // Assumes 'supabase' template is set up in Clerk
                if (!token) return null
                return createClerkSupabaseClient(token)
            }
        }
    }, [getToken])
}
