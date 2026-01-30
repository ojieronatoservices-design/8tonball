const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyFix() {
    const adminId = 'user_38XR8BLq0TnKL4nIsETQ8n445Mw';
    const testUserId = 'user_38JQMyLuYb6FHzqsTZkiltFURrT';

    console.log('--- Verification: Nuclear Fix ---');

    // 1. Enter a raffle multiple times and check tickets
    // We'll use the raffle created in the previous test if possible, or a new one
    const { data: raffle } = await supabase
        .from('raffles')
        .insert([{
            title: 'NUCLEAR VERIFICATION RAFFLE',
            description: 'Checking if specific tickets win',
            entry_cost_tibs: 1,
            status: 'open',
            host_user_id: adminId,
            ends_at: new Date(Date.now() + 3600000).toISOString()
        }])
        .select().single();

    console.log(`Raffle Created: ${raffle.id}`);

    // 2. Call enter_raffle RPC directly to check ticket generation
    console.log('Entering raffle 5 times...');
    for (let i = 0; i < 5; i++) {
        const { data } = await supabase.rpc('enter_raffle', {
            p_raffle_id: raffle.id,
            p_user_id: testUserId
        });
        console.log(`  - Ticket Received: ${data.ticket_number}`);
    }

    // 3. Draw Winner using v3
    console.log('Calling draw_raffle_winner_v3...');
    const { data: drawData, error: dError } = await supabase.rpc('draw_raffle_winner_v3', {
        p_raffle_id: raffle.id,
        p_admin_id: adminId
    });

    if (dError) {
        console.error('RPC Error:', dError.message);
    } else {
        console.log('Result:', drawData);

        // Final verify
        const { data: verifyRaffle } = await supabase
            .from('raffles')
            .select('winning_entry_id')
            .eq('id', raffle.id)
            .single();

        if (verifyRaffle.winning_entry_id) {
            const { data: entry } = await supabase.from('entries').select('ticket_number').eq('id', verifyRaffle.winning_entry_id).single();
            console.log(`VERIFIED: Winning Ticket is ${entry.ticket_number}`);
        } else {
            console.error('FAILURE: winning_entry_id is NULL');
        }
    }
}

verifyFix();
