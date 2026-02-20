const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function discover() {
    const tables = ['messages', 'posts', 'replies', 'rounds', 'top_up_requests', 'media']

    for (const table of tables) {
        console.log(`\n--- Checking ${table} ---`)
        // Try to select 1 row to see what columns come back
        const { data, error } = await supabase.from(table).select('*').limit(1)
        if (error) {
            console.log(`Error on ${table}: ${error.message}`)
        } else if (data && data.length > 0) {
            console.log(`Columns found: ${Object.keys(data[0]).join(', ')}`)
        } else if (data) {
            console.log(`Table exists but is empty. Cannot determine columns via select * empty result logic easily without more complex queries.`)
        }
    }
}

discover()
