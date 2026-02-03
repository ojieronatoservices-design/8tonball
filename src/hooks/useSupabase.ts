import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient, supabase } from '@/lib/supabase'
import { useMemo, useRef } from 'react'

export function useSupabase() {
    const { getToken } = useAuth()

    const cachedClient = useRef<any>(null)
    const lastToken = useRef<string | null>(null)

    return useMemo(() => {
        return {
            getClient: async () => {
                try {
                    // Check if we already have a valid client for the current user
                    const tokenPromise = getToken({ template: 'supabase' })
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Token timeout')), 8000)
                    )

                    const token = await Promise.race([tokenPromise, timeoutPromise]) as string | null

                    // Return cached client if token hasn't changed
                    if (token === lastToken.current && cachedClient.current) {
                        return cachedClient.current
                    }

                    if (token) {
                        lastToken.current = token
                        cachedClient.current = createClerkSupabaseClient(token)
                        return cachedClient.current
                    }
                } catch (error) {
                    console.error('[useSupabase] getToken failed or timed out:', error)
                }

                // Fallback to anon client
                return supabase
            }
        }
    }, [getToken])
}
