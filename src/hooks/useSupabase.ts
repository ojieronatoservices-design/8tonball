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

                // Retry logic for flaky mobile networks
                let attempts = 0
                const maxAttempts = 2

                while (attempts < maxAttempts) {
                    try {
                        attempts++
                        // Relaxed timeout for mobile (6s)
                        const tokenPromise = getToken({ template: 'supabase' })
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Token timeout')), 6000)
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
                        console.error(`[useSupabase] Attempt ${attempts} failed:`, error)
                        // If this was the last attempt, break and fallback
                        if (attempts === maxAttempts) break

                        // Wait a bit before retrying
                        await new Promise(r => setTimeout(r, 1000))
                    }
                }

                console.warn('[useSupabase] All attempts failed, using fallback')

                // Return cached client if available, even if refresh failed
                if (cachedClient.current) {
                    return cachedClient.current
                }

                // Fallback to anon client
                return supabase
            }
        }
    }, [getToken])
}
