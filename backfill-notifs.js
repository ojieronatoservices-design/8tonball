
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillNotifications() {
    console.log('Starting backfill analysis...');

    // 1. Get broken notifications (recent)
    const { data: brokenNotifs, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .is('comment_id', null)
        .in('type', ['comment', 'reply'])
        .order('created_at', { ascending: false })
        .limit(50);

    if (notifError) {
        console.error('Error fetching broken notifications:', notifError);
        return;
    }

    console.log(`Found ${brokenNotifs.length} broken notifications.`);

    let fixCount = 0;

    for (const notif of brokenNotifs) {
        // 2. Find matching comment (same user, same raffle, close timestamp)
        // Timestamp logic: Created around same time (+/- 5 seconds)
        const notifTime = new Date(notif.created_at).getTime();

        // We can't query by time range easily in JS client without exact constraints, 
        // so we get recent comments by this user and filter in JS
        const { data: comments, error: commentError } = await supabase
            .from('comments')
            .select('id, created_at, content')
            .eq('user_id', notif.actor_id || notif.user_id) // Actor usually, but sometimes just user_id depending on how it was logged
            .eq('raffle_id', notif.raffle_id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (comments) {
            const match = comments.find(c => {
                const cTime = new Date(c.created_at).getTime();
                return Math.abs(cTime - notifTime) < 5000; // 5 seconds diff
            });

            if (match) {
                console.log(`Match found for Notif ${notif.id}: Comment ${match.id} ("${match.content.substring(0, 20)}...")`);

                // 3. Update the notification
                const { error: updateError } = await supabase
                    .from('notifications')
                    .update({ comment_id: match.id })
                    .eq('id', notif.id);

                if (!updateError) {
                    fixCount++;
                } else {
                    console.error('Update failed:', updateError);
                }
            }
        }
    }

    console.log(`Backfill complete. Fixed ${fixCount} notifications.`);
}

backfillNotifications();
