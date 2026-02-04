const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSignatures() {
    console.log('--- Checking Function Signatures ---');

    // We can't run raw SQL easily. 
    // But I can try to find if there's any table I can query.
    // Actually, I'll try to use the `rpc` tool to intentionally fail and see errors.

    // Let's try to call them with wrong types.
    const names = ['draw_winner', 'draw_winner_and_payout', 'draw_raffle_winner', 'draw_raffle_winner_v3'];

    for (const name of names) {
        console.log(`\nChecking ${name}...`);
        const { error } = await supabase.rpc(name, { dummy: 'test' });
        console.log(`- Result: ${error?.message}`);
    }
}

checkSignatures();
