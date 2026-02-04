const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deepTest() {
    const adminId = 'user_38XR8BLq0TnKL4nIsETQ8n445Mw';
    const testUserId = 'user_38JQMyLuYb6FHzqsTZkiltFURrT';

    console.log('--- Deep Test: Winner Selection Logic ---');

    // 1. Create a Test Raffle
    const { data: raffle, error: rError } = await supabase
        .from('raffles')
        .insert([{
            title: 'DEEP TEST RAFFLE',
            description: 'Checking if specific tickets win',
            entry_cost_tibs: 10,
            status: 'open',
            host_user_id: adminId,
            ends_at: new Date(Date.now() + 3600000).toISOString()
        }])
        .select()
        .single();

    if (rError) {
        console.error('Error creating raffle:', rError.message);
        return;
    }
    console.log('Created Raffle:', raffle.id);

    // 2. Create multiple entries for the same user
    console.log('Creating 3 entries for user X...');
    for (let i = 1; i <= 3; i++) {
        await supabase.from('entries').insert({
            raffle_id: raffle.id,
            user_id: testUserId,
            ticket_number: `TEST00${i}`
        });
    }

    // 3. Draw Winner
    console.log('Calling draw_winner_and_payout...');
    const { data: drawData, error: dError } = await supabase.rpc('draw_winner_and_payout', {
        p_raffle_id: raffle.id,
        p_admin_id: adminId
    });

    if (dError) {
        console.error('RPC Error:', dError.message);
    } else {
        console.log('RPC Success:', JSON.stringify(drawData, null, 2));

        // 4. Verify Final State
        const { data: finalRaffle } = await supabase
            .from('raffles')
            .select('winner_user_id, winning_entry_id')
            .eq('id', raffle.id)
            .single();

        console.log('Final Raffle Record:', finalRaffle);

        if (finalRaffle.winning_entry_id) {
            const { data: entry } = await supabase
                .from('entries')
                .select('ticket_number')
                .eq('id', finalRaffle.winning_entry_id)
                .single();
            console.log('LINKED TICKET NUMBER:', entry?.ticket_number);
        } else {
            console.error('FAILURE: winning_entry_id is STILL NULL!');
        }
    }

    // Cleanup - optional, keeping for history if it works
}

deepTest();
