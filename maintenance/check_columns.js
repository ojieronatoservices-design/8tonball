const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
    console.log('--- Checking Raffles Table Columns ---');

    // We can't query information_schema, but we can try to select * and see keys
    const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching raffle:', error.message);
    } else if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        // If no data, we can try to insert a dummy one or use another way.
        // Let's try to get the error by selecting a non-existent column.
        console.log('No raffles found. Trying to probe column names...');

        const { error: err1 } = await supabase.from('raffles').select('winner_user_id').limit(1);
        console.log('winner_user_id exists?', !err1);

        const { error: err2 } = await supabase.from('raffles').select('winning_user_id').limit(1);
        console.log('winning_user_id exists?', !err2);
    }
}

checkColumns();
