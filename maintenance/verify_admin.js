
const { createClient } = require('@supabase/supabase-js');

// Config from your .env.local
const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyAndPromote() {
    const email = 'jrronato@gmail.com';
    console.log(`Checking status for ${email}...`);

    try {
        // 1. Check if user exists
        const { data: users, error: searchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email);

        if (searchError) throw searchError;

        if (users.length === 0) {
            console.error('❌ User not found in profiles table!');
            console.log('have you logged in with this email yet? The profile is created on first login.');
            return;
        }

        const user = users[0];
        console.log('Found user:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin,
            is_host_eligible: user.is_host_eligible
        });

        // 2. Promote if needed
        if (!user.is_admin) {
            console.log('User is NOT admin. Promoting now...');
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ is_admin: true })
                .eq('id', user.id);

            if (updateError) throw updateError;
            console.log('✅ Success! User is now an admin.');
        } else {
            console.log('✅ User is already an admin.');
        }

        // 3. Verify
        const { data: verifyData } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        console.log('Final verification (is_admin):', verifyData.is_admin);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

verifyAndPromote();
