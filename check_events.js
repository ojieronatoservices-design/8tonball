const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTIzOTIsImV4cCI6MjA4Mzk4ODM5Mn0.H4GRQDvy8wWHGFyTqGzhktSqh-g-OPNoxtrxuKsbW3o'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('id, title, ends_at')

    if (error) {
        console.error('Error fetching events:', error)
        return
    }

    console.log('Events Data:')
    data.forEach(event => {
        console.log(`ID: ${event.id} | Title: ${event.title} | EndsAt: ${event.ends_at}`)
    })
}

checkEvents()
