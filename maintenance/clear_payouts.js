const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearPayouts() {
    console.log('--- Clearing Ghost Payout Request ---')
    const { error } = await supabase
        .from('payout_requests')
        .delete()
        .eq('status', 'pending')

    if (error) {
        console.error('Error deleting payout:', error)
    } else {
        console.log('Successfully cleared all pending payout requests.')
    }
}

clearPayouts()
