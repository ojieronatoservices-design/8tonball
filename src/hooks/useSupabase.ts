import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient, supabase } from '@/lib/supabase'
import { useMemo, useRef } from 'react'

export function useSupabase() {
    const { getToken } = useAuth()

    const cachedClient = useRef<any>(null)
    const lastToken = useRef<string | null>(null)
    const lastFetchTime = useRef<number>(0)

    return useMemo(() => {
        return {
            getClient: async () => {
                // Return cached client immediately if we fetched recently (within 30s)
                const now = Date.now()
                if (cachedClient.current && (now - lastFetchTime.current) < 30000) {
                    return cachedClient.current
                }

                try {
                    // Reduced timeout for faster mobile experience (3s instead of 8s)
                    const tokenPromise = getToken({ template: 'supabase' })
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Token timeout')), 3000)
                    )

                    const token = await Promise.race([tokenPromise, timeoutPromise]) as string | null

                    // Return cached client if token hasn't changed
                    if (token === lastToken.current && cachedClient.current) {
                        lastFetchTime.current = now
                        return cachedClient.current
                    }

                    if (token) {
                        lastToken.current = token
                        lastFetchTime.current = now
                        cachedClient.current = createClerkSupabaseClient(token)
                        return cachedClient.current
                    }
                } catch (error) {
                    console.error('[useSupabase] getToken failed or timed out:', error)
                    // Return cached client if available, even if token refresh failed
                    if (cachedClient.current) {
                        return cachedClient.current
                    }
                }

                // Fallback to anon client
                return supabase
            }
        }
    }, [getToken])
}
