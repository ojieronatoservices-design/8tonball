const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function scanAllBroken() {
    console.log('--- Scanning for ALL Broken Raffles ---');

    const { data: broken, error } = await supabase
        .from('raffles')
        .select('id, title, winner_user_id, winning_entry_id, drawn_at')
        .eq('status', 'drawn')
        .is('winning_entry_id', null);

    if (error) {
        console.error('Scan Error:', error.message);
        return;
    }

    if (broken && broken.length > 0) {
        console.log(`FOUND ${broken.length} BROKEN RAFFLES:`);
        broken.forEach(r => {
            console.log(`- ID: ${r.id} | Title: ${r.title} | Winner: ${r.winner_user_id} | Drawn at: ${r.drawn_at}`);
        });
    } else {
        console.log('No broken raffles found. Data is consistent.');
    }
}

scanAllBroken();
