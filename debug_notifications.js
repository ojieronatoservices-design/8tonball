const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQxMjM5MiwiZXhwIjoyMDgzOTg4MzkyfQ.YKoWV60VBLQlXqXRjZwHUM2yrgrjnnH6_2xkpN633eA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugNotifications() {
    console.log('======== NOTIFICATION DEBUG ========\n');

    // 1. Check if notifications table has data
    const { data: allNotifs, error: err1 } = await supabase
        .from('notifications')
        .select('id, user_id, message, type, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('Recent notifications in DB:');
    if (err1) {
        console.log('Error fetching notifications:', err1.message);
    } else if (allNotifs.length === 0) {
        console.log('  -> NO NOTIFICATIONS FOUND AT ALL');
    } else {
        allNotifs.forEach(n => {
            console.log(`  [${n.type}] ${n.message.substring(0, 50)}... -> User: ${n.user_id}`);
        });
    }

    // 2. Check if realtime publication includes notifications
    console.log('\n\nChecking realtime publication:');
    const { data: pubData, error: pubErr } = await supabase
        .rpc('get_realtime_tables');

    if (pubErr) {
        console.log('  Could not query publication (try manually in SQL Editor):');
        console.log('  SELECT * FROM pg_publication_tables WHERE pubname = \'supabase_realtime\';');
    } else {
        console.log('  Tables in supabase_realtime:', pubData);
    }

    // 3. Check RLS policy on notifications
    console.log('\n\nRLS Policy on notifications:');
    const { data: policies } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'notifications');

    if (policies && policies.length > 0) {
        policies.forEach(p => console.log(`  Policy: ${p.policyname}`));
    } else {
        console.log('  Could not fetch policies (check manually in Dashboard)');
    }

    // 4. Test inserting a notification
    console.log('\n\nCreating test notification...');
    const testUserId = 'user_38JQMyLuYb6FHzqsTZkiltFURrT'; // Oje's test account

    const { data: testNotif, error: insertErr } = await supabase
        .from('notifications')
        .insert([{
            user_id: testUserId,
            message: '🧪 TEST: Debug notification at ' + new Date().toISOString(),
            type: 'info'
        }])
        .select()
        .single();

    if (insertErr) {
        console.log('❌ Failed to insert test notification:', insertErr.message);
    } else {
        console.log('✅ Test notification inserted:', testNotif.id);
    }

    // 5. Count unread for user
    const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId)
        .eq('is_read', false);

    console.log(`\nUnread notification count for ${testUserId}: ${count}`);

    console.log('\n======== END DEBUG ========');
}

debugNotifications();
