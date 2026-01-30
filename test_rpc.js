const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDraw() {
    console.log('--- Testing draw_winner_and_payout RPC ---');

    // 1. Find an open raffle with entries
    const { data: raffles, error: rError } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            status,
            entries:entries(count)
        `)
        .eq('status', 'open');

    const targetRaffle = raffles?.find(r => r.entries?.[0]?.count > 0);

    if (!targetRaffle) {
        console.log('No open raffles with entries found to test draw.');
        return;
    }

    console.log(`Testing with Raffle: "${targetRaffle.title}" (${targetRaffle.id})`);

    // 2. Call RPC
    const { data, error } = await supabase.rpc('draw_winner_and_payout', {
        p_raffle_id: targetRaffle.id,
        p_admin_id: 'user_38XR8BLq0TnKL4nIsETQ8n445Mw' // Using the admin ID from previous logs
    });

    if (error) {
        console.error('RPC Error:', error.message);
    } else {
        console.log('RPC Result:', JSON.stringify(data, null, 2));

        // 3. Verify raffle record
        const { data: updatedRaffle } = await supabase
            .from('raffles')
            .select('winner_user_id, winning_entry_id')
            .eq('id', targetRaffle.id)
            .single();

        console.log('Verified Raffle Record:', updatedRaffle);
    }
}

testDraw();
