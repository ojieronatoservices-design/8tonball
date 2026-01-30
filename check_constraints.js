const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
    console.log('--- Probing Constraints ---');

    // We can try to update a raffle's winning_entry_id to a non-existent entry ID
    // and see the foreign key error to confirm it's actually constrained.
    const { error: err1 } = await supabase
        .from('raffles')
        .update({ winning_entry_id: '00000000-0000-0000-0000-000000000000' })
        .eq('id', '9c048edb-1fe6-46e4-afed-86b7706b8d1d'); // The test raffle ID

    console.log('Constraint test error (Expected):', err1?.message);
}

checkConstraints();
