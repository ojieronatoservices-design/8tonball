const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPayouts() {
    console.log('--- Checking Payout Requests ---')
    const { data: payouts, count, error } = await supabase
        .from('payout_requests')
        .select('*, profiles!payout_requests_user_id_fkey(email, display_name)', { count: 'exact' })

    if (error) {
        console.error('Error fetching payouts:', error)
        return
    }

    console.log(`Count from head/exact select: ${count}`)
    console.log('Payouts Data:')
    payouts.forEach(p => {
        console.log(`ID: ${p.id} | UserID: ${p.user_id} | Email: ${p.profiles?.email || 'MISSING PROFILE'} | Amount: ${p.amount_tibs}`)
    })

    console.log('\n--- Checking Transactions ---')
    const { count: transCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

    console.log(`Pending Transactions Count: ${transCount}`)
}

checkPayouts()
