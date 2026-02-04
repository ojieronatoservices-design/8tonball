const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('Checking database schema...');

    // 1. Check for Payout Requests
    console.log('\n--- Checking Payout Requests Table ---');
    const { error: payoutError } = await supabase
        .from('payout_requests')
        .select('*')
        .limit(1);

    if (payoutError) {
        console.error('MISSING: payout_requests table is missing or inaccessible.', payoutError.message);
    } else {
        console.log('OK: payout_requests table exists.');
    }

    // 2. Check for ticket_number in Entries
    console.log('\n--- Checking Ticket Number Data ---');
    const { data: entries, error: entryError } = await supabase
        .from('entries')
        .select('ticket_number')
        .limit(10);

    if (entryError) {
        console.error('Error fetching entries:', entryError.message);
    } else {
        const nullCount = entries.filter(e => !e.ticket_number).length;
        console.log(`Checked ${entries.length} entries.`);
        console.log(`Entries with NULL ticket_number: ${nullCount}`);
        console.log('Sample ticket numbers:', entries.map(e => e.ticket_number));
    }

    // 4. Debug Admin View Data (Winning Entry)
    console.log('\n--- Checking for BROKEN Raffles (Drawn but missing Winning Ticket) ---');
    const { data: brokenRaffles, error: aError } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            status,
            winner_user_id,
            winning_entry_id
        `)
        .eq('status', 'drawn')
        .is('winning_entry_id', null);

    if (aError) {
        console.error('Error fetching broken raffles:', aError.message);
    } else if (brokenRaffles && brokenRaffles.length > 0) {
        console.log(`FOUND ${brokenRaffles.length} BROKEN RAFFLES:`);
        brokenRaffles.forEach(r => {
            console.log(`- ID: ${r.id} | Title: ${r.title} | WinnerUserID: ${r.winner_user_id} | WinningEntryID: ${r.winning_entry_id}`);
        });
    } else {
        console.log('No broken raffles found. Data seems consistent.');
    }

    // 5. Debug Profile View (Entry + Raffle Join)
    console.log('\n--- Checking Profile View (Entry + Raffle Join) ---');
    // Fetch an entry that belongs to a drawn raffle to see the join structure and if didWin would work
    const { data: profileEntries, error: pError } = await supabase
        .from('entries')
        .select(`
            id,
            raffle_id,
            ticket_number,
            raffles:raffles!entries_raffle_id_fkey(
                id,
                status,
                winning_entry_id
            )
        `)
        .not('raffles', 'is', null) // Only where raffle join worked
        .limit(1);

    if (pError) {
        console.error('Error fetching profile entries:', pError.message);
    } else if (profileEntries && profileEntries.length > 0) {
        console.log('Sample Profile Entry:', JSON.stringify(profileEntries[0], null, 2));

        const entry = profileEntries[0];
        // Simulate didWin logic
        const isWinner = entry.raffles && entry.raffles.winning_entry_id === entry.id;
        console.log(`Simulating didWin: Entry ID (${entry.id}) === Winning Entry ID (${entry.raffles?.winning_entry_id}) ? ${isWinner}`);
    } else {
        console.log('No suitable profile entries found.');
    }
}

checkSchema();
