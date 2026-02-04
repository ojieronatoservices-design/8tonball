const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function surgicalDebug() {
    console.log('--- Surgical Debug: Latest Raffle State ---');

    // 1. Get the most recently drawn raffle
    const { data: raffles, error: rError } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            status,
            winner_user_id,
            winning_entry_id,
            drawn_at
        `)
        .eq('status', 'drawn')
        .order('drawn_at', { ascending: false })
        .limit(3);

    if (rError) {
        console.error('Error fetching raffles:', rError.message);
        return;
    }

    if (!raffles || raffles.length === 0) {
        console.log('No drawn raffles found.');
        return;
    }

    for (const r of raffles) {
        console.log(`\nRAFFLE: "${r.title}" (${r.id})`);
        console.log(`  - WinnerUserID: ${r.winner_user_id}`);
        console.log(`  - WinningEntryID: ${r.winning_entry_id}`);
        console.log(`  - Drawn At: ${r.drawn_at}`);

        if (r.winning_entry_id) {
            const { data: entry, error: eError } = await supabase
                .from('entries')
                .select('id, ticket_number, user_id')
                .eq('id', r.winning_entry_id)
                .single();

            if (eError) {
                console.error(`  - ERROR fetching entry: ${eError.message}`);
            } else {
                console.log(`  - ENTRY TICKET: ${entry.ticket_number}`);
                console.log(`  - ENTRY USER: ${entry.user_id}`);
            }
        } else {
            console.log('  - ATTENTION: WinningEntryID is NULL');

            // Look for any entries for this user in this raffle
            const { data: userEntries } = await supabase
                .from('entries')
                .select('id, ticket_number')
                .eq('raffle_id', r.id)
                .eq('user_id', r.winner_user_id);

            console.log(`  - User has ${userEntries?.length || 0} entries in this raffle.`);
            userEntries?.forEach(ue => console.log(`    * EntryID: ${ue.id} | Ticket: ${ue.ticket_number}`));
        }
    }
}

surgicalDebug();
