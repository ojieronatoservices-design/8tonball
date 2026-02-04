const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTIzOTIsImV4cCI6MjA4Mzk4ODM5Mn0.H4GRQDvy8wWHGFyTqGzhktSqh-g-OPNoxtrxuKsbW3o'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables')
    if (error) {
        // If RPC doesn't exist, try a raw query if possible or just check a known table
        console.log('RPC get_tables failed, trying direct select from pg_catalog if possible (usually not)')
        const { data: tables, error: err2 } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public')
        if (err2) {
            console.error('Error listing tables:', err2)
            return
        }
        console.log('Tables:', tables.map(t => t.table_name))
    } else {
        console.log('Tables from RPC:', data)
    }
}

listTables()
