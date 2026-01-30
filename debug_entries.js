
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars
try {
    const envPath = path.resolve(__dirname, '.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
} catch (e) {
    console.log('Could not load .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Using service role key to bypass RLS for debugging to see raw data first
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function checkEntries() {
    console.log('Checking entries...');

    // 1. Check if ANY entries exist
    const { data: entries, error } = await supabase
        .from('entries')
        .select(`
        id, 
        raffle_id, 
        created_at, 
        ticket_number, 
        raffles (
            id,
            title,
            status
        )
    `)
        .limit(5);

    if (error) {
        console.error('Error fetching entries:', error);
    } else {
        console.log('Entries found:', entries.length);
        if (entries.length > 0) {
            console.log('Sample Entry:', JSON.stringify(entries[0], null, 2));
        } else {
            console.log('No entries found in DB.');
        }
    }
}

checkEntries();
