const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllFunctions() {
    console.log('--- Listing All Functions (Public Schema) ---');

    // We can use a trick: try to call a non-existent function or use the "inspect" RPC if provided.
    // Since we don't have an inspect RPC, we'll try to find any RPC that might return it.

    // Actually, I'll just try to guess common names and see if they exist.
    const names = ['draw_winner', 'draw_winner_and_payout', 'draw_raffle_winner', 'draw_raffle_winner_v3'];

    for (const name of names) {
        const { error } = await supabase.rpc(name, { dummy: 1 });
        if (error && error.message.includes('does not exist')) {
            console.log(`- ${name}: Does NOT exist`);
        } else {
            console.log(`- ${name}: EXISTS (or errored with param mismatch)`);
        }
    }
}

listAllFunctions();
