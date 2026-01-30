const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminQuery() {
    console.log('--- Testing Admin Dashboard Query ---');

    const { data, error } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            status,
            winning_entry_id,
            entries:entries!entries_raffle_id_fkey(count),
            winner:profiles!winner_user_id(display_name, email),
            winning_entry:entries!winning_entry_id(ticket_number)
        `)
        .eq('status', 'drawn')
        .limit(1);

    if (error) {
        console.error('Query Error:', error.message);
    } else {
        console.log('Query Result:', JSON.stringify(data?.[0], null, 2));
    }
}

testAdminQuery();
