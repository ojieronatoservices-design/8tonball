const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFKs() {
    console.log('--- Checking Foreign Keys ---');

    // We can't run raw SQL. 
    // But I'll try to use a "Probabilistic fetch"
    // I will try to select using different relationship names and see which one doesn't error.

    const possibleNames = ['winning_entry_id', 'winning_entry', 'entries_winning_entry_id_fkey', 'raffles_winning_entry_id_fkey'];

    for (const name of possibleNames) {
        const { error } = await supabase
            .from('raffles')
            .select(`id, entries!${name}(ticket_number)`)
            .limit(1);

        if (error) {
            console.log(`- Relationship "${name}": FAILED (${error.message})`);
        } else {
            console.log(`- Relationship "${name}": SUCCESS!`);
        }
    }
}

checkFKs();
