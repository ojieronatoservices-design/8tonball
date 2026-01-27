const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function giftTibs() {
    console.log('Fetching all users...');
    const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, display_name, email, tibs_balance');

    if (fetchError) {
        console.error('Error fetching profiles:', fetchError);
        return;
    }

    console.log(`Giving 500 Tibs to ${profiles.length} users...`);

    for (const profile of profiles) {
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ tibs_balance: (profile.tibs_balance || 0) + 500 })
            .eq('id', profile.id);

        if (updateError) {
            console.error(`Error updating user ${profile.id}:`, updateError);
        } else {
            console.log(`- Success: ${profile.display_name || profile.email} (New Balance: ${(profile.tibs_balance || 0) + 500})`);
        }
    }

    console.log('\nDistribution complete!');
}

giftTibs();
