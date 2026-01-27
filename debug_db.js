const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRaffles() {
    console.log('Checking raffles in:', supabaseUrl);
    const { data, error } = await supabase
        .from('raffles')
        .select('*');

    if (error) {
        console.error('Error fetching raffles:', error);
    } else {
        console.log('Found', data.length, 'raffles:');
        data.forEach(r => {
            console.log(`- [${r.status}] ${r.title} (ID: ${r.id}, Host: ${r.host_user_id})`);
        });
    }

    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);

    if (pError) {
        console.error('Error fetching profiles:', pError);
    } else {
        console.log('\nSample profiles:');
        profiles.forEach(p => {
            console.log(`- ${p.display_name || p.email} (ID: ${p.id}, Admin: ${p.is_admin}, Host: ${p.is_host_eligible})`);
        });

        const { data: entries, error: eError } = await supabase
            .from('entries')
            .select('*');

        if (eError) {
            console.error('Error fetching entries:', eError);
        } else {
            console.log('\nFound', entries.length, 'entries total.');
            entries.slice(0, 10).forEach(e => {
                console.log(`- Entry by ${e.user_id} for raffle ${e.raffle_id}`);
            });
        }
    }
}

checkRaffles();
