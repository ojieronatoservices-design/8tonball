const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forensicTest() {
    console.log('======== FORENSIC TEST ========');
    console.log('Testing which RPC version is actually running in the database...\n');

    // Test 1: Check which function names exist
    const funcNames = [
        'draw_winner_and_payout',
        'draw_raffle_winner_v3',
        'draw_raffle_winner_v4'
    ];

    for (const name of funcNames) {
        console.log(`Testing: ${name}`);
        const { data, error } = await supabase.rpc(name, {
            p_raffle_id: '00000000-0000-0000-0000-000000000000',
            p_admin_id: 'test'
        });

        if (error?.message?.includes('Could not find')) {
            console.log(`  -> DOES NOT EXIST\n`);
        } else if (error?.message?.includes('p_event_id')) {
            console.log(`  -> EXISTS (uses p_event_id param, not p_raffle_id)\n`);
        } else {
            console.log(`  -> EXISTS (Error: ${error?.message || 'None'})\n`);
        }
    }

    // Test 2: Create a test raffle and draw it to see what happens
    console.log('Creating test raffle to trace actual behavior...');

    const adminId = 'user_38XR8BLq0TnKL4nIsETQ8n445Mw';
    const testUserId = 'user_38JQMyLuYb6FHzqsTZkiltFURrT';

    const { data: raffle } = await supabase
        .from('raffles')
        .insert([{
            title: 'FORENSIC TEST',
            description: 'Testing actual DB function behavior',
            entry_cost_tibs: 1,
            status: 'open',
            host_user_id: adminId,
            ends_at: new Date(Date.now() + 3600000).toISOString()
        }])
        .select()
        .single();

    console.log(`Created raffle: ${raffle.id}`);

    // Add entries
    for (let i = 0; i < 3; i++) {
        await supabase.from('entries').insert({
            raffle_id: raffle.id,
            user_id: testUserId,
            ticket_number: `FORENSIC${i}`
        });
    }
    console.log('Added 3 test entries');

    // Try drawing with draw_winner_and_payout (what admin page calls)
    console.log('\nCalling draw_winner_and_payout...');
    const { data: drawResult, error: drawError } = await supabase.rpc('draw_winner_and_payout', {
        p_raffle_id: raffle.id,
        p_admin_id: adminId
    });

    console.log('RPC Response:', JSON.stringify(drawResult, null, 2));
    if (drawError) console.log('RPC Error:', drawError.message);

    // Check the actual DB state
    const { data: finalState } = await supabase
        .from('raffles')
        .select('status, winner_user_id, winning_entry_id')
        .eq('id', raffle.id)
        .single();

    console.log('\nFinal DB State:', JSON.stringify(finalState, null, 2));

    if (finalState.winning_entry_id) {
        console.log('✅ SUCCESS: winning_entry_id was set correctly');
    } else {
        console.log('❌ FAILURE: winning_entry_id is still NULL!');
        console.log('   This proves the old/broken function is still active in the database.');
    }

    // Cleanup
    await supabase.from('raffles').delete().eq('id', raffle.id);
    console.log('\nTest raffle cleaned up.');
}

forensicTest();
