const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTextSignatures() {
    console.log('--- Checking TEXT, TEXT Signatures ---');

    const names = ['draw_winner', 'draw_winner_and_payout', 'draw_raffle_winner', 'draw_raffle_winner_v3'];

    for (const name of names) {
        console.log(`\nChecking ${name}(TEXT, TEXT)...`);
        // Using two strings
        const { error } = await supabase.rpc(name, {
            p_raffle_id: '00000000-0000-0000-0000-000000000000',
            p_admin_id: 'test'
        });

        if (error && error.message.includes('Could not find the function')) {
            console.log(`- NOT FOUND`);
        } else {
            console.log(`- FOUND (or errored with data issue): ${error?.message}`);
            // If it found it but error is "invalid input syntax for type uuid", then it's likely (UUID, TEXT)
        }
    }
}

checkTextSignatures();
