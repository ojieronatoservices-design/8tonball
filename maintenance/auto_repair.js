const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function autoRepair() {
    console.log('--- Scanning for BROKEN Raffles (Drawn but missing Winning Ticket) ---');

    // 1. Find broken raffles
    const { data: brokenRaffles, error: fetchError } = await supabase
        .from('raffles')
        .select('id, title, winner_user_id, winning_entry_id')
        .eq('status', 'drawn')
        .is('winning_entry_id', null)
        .not('winner_user_id', 'is', null);

    if (fetchError) {
        console.error('Error scanning raffles:', fetchError.message);
        return;
    }

    console.log(`Found ${brokenRaffles.length} broken raffles.`);

    // 2. Fix each one
    for (const raffle of brokenRaffles) {
        console.log(`\nRepairing Raffle: "${raffle.title}" (${raffle.id})...`);

        // Find ANY entry for the winner in this raffle
        const { data: entries, error: entryError } = await supabase
            .from('entries')
            .select('id, ticket_number')
            .eq('raffle_id', raffle.id)
            .eq('user_id', raffle.winner_user_id)
            .limit(1);

        if (entryError || !entries || entries.length === 0) {
            console.error(`  - Failed: Could not find any entries for user ${raffle.winner_user_id}`);
            continue;
        }

        const winningEntry = entries[0];
        console.log(`  - Found winning ticket: ${winningEntry.ticket_number} (${winningEntry.id})`);

        // Update the raffle
        const { error: updateError } = await supabase
            .from('raffles')
            .update({ winning_entry_id: winningEntry.id })
            .eq('id', raffle.id);

        if (updateError) {
            console.error(`  - Failed to update raffle: ${updateError.message}`);
        } else {
            console.log(`  - SUCCESS: Raffle repaired!`);
        }
    }
}

autoRepair();
