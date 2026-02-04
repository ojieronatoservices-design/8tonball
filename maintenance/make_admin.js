
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function makeAdmin() {
    console.log('Promoting jrronato@gmail.com to admin...');

    const { data, error } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('email', 'jrronato@gmail.com')
        .select();

    if (error) {
        console.error('Error:', error);
    } else if (data.length === 0) {
        console.log('No user found with that email! Have you signed in yet?');
    } else {
        console.log('Success! User promoted:', data);
    }
}

makeAdmin();
