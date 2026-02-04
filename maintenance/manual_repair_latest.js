const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function manualRepair() {
    const raffleId = 'c800133f-7f5e-46be-9350-815deb1de5e1';
    const winnerUserId = 'user_38nhQ4gnW7EZuLtzHURYkqo817j';

    console.log(`--- Manually repairing raffle ${raffleId} ---`);

    // 1. Find the first entry for this user
    const { data: entries, error: eError } = await supabase
        .from('entries')
        .select('id, ticket_number')
        .eq('raffle_id', raffleId)
        .eq('user_id', winnerUserId)
        .limit(1);

    if (eError || !entries || entries.length === 0) {
        console.error('Could not find entry for winner.');
        return;
    }

    const winningEntryId = entries[0].id;
    console.log(`Found entry ${winningEntryId} (${entries[0].ticket_number})`);

    // 2. Update the raffle
    const { error: uError } = await supabase
        .from('raffles')
        .update({
            winning_entry_id: winningEntryId
        })
        .eq('id', raffleId);

    if (uError) {
        console.error('Update failed:', uError.message);
    } else {
        console.log('SUCCESS: Raffle updated manually.');
    }
}

manualRepair();
