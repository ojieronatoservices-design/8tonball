const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pwoigsbmyzeedayolhvx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3b2lnc2JteXplZWRheW9saHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTIzOTIsImV4cCI6MjA4Mzk4ODM5Mn0.H4GRQDvy8wWHGFyTqGzhktSqh-g-OPNoxtrxuKsbW3o'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRaffles() {
    const { data, error } = await supabase
        .from('raffles')
        .select('id, title, ends_at, status')
        .eq('status', 'open')

    if (error) {
        console.error('Error fetching raffles:', error)
        return
    }

    console.log('Raffles Data:')
    data.forEach(raffle => {
        console.log(`ID: ${raffle.id} | Title: ${raffle.title} | EndsAt: ${raffle.ends_at}`)
    })
}

checkRaffles()
