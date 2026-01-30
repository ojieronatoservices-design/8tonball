const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyRealtime() {
    console.log('======== REALTIME CONFIGURATION CHECK ========\n');

    const requiredTables = ['profiles', 'raffles', 'entries', 'notifications'];

    // Call the helper function created by the SQL script
    const { data, error } = await supabase.rpc('get_realtime_setup');

    if (error) {
        console.log('❌ Error check failed. Did you run "fix-realtime-publication.sql" in Supabase?');
        console.log('Error details:', error.message);
        return;
    }

    console.log('Current Realtime Tables:', data.tables);

    const missing = requiredTables.filter(t => !data.tables?.includes(t));

    if (missing.length > 0) {
        console.log('\n❌ MISSING TABLES:', missing);
        console.log('Please run "fix-realtime-publication.sql" again!');
    } else {
        console.log('\n✅ Publcation looks CORRECT. All required tables are enabled.');
    }
}

verifyRealtime();
