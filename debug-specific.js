
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Searching for comment: "Parang di naman par"');

    // 1. Find the comment
    const { data: comments, error: commentError } = await supabase
        .from('comments')
        .select('id, content, raffle_id, user_id, created_at')
        .ilike('content', '%Parang di naman par%')
        .limit(1);

    if (commentError) {
        console.error('Error finding comment:', commentError);
        return;
    }

    if (!comments || comments.length === 0) {
        console.log('Comment not found');
        return;
    }

    const comment = comments[0];
    console.log('Found Comment:', comment);

    // 2. Find notifications related to this comment or raffle around that time
    console.log('Searching for notifications related to this comment...');
    const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('comment_id', comment.id); // Check by explicit comment_id

    console.log('Notifications with explicit comment_id:', notifications);

    if (!notifications || notifications.length === 0) {
        console.log('No notification found with this comment_id. Checking generally by raffle_id...');
        const { data: raffleNotifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('raffle_id', comment.raffle_id)
            .order('created_at', { ascending: false })
            .limit(5);

        console.log('Recent notifications for this raffle:', raffleNotifs);
    }
}

checkData();
