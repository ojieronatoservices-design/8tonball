-- Backfill missing ticket numbers for existing entries
DO $$
DECLARE
    r_entry RECORD;
    v_ticket TEXT;
    v_exists BOOLEAN;
    v_letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_numbers TEXT := '0123456789';
    v_char_count INTEGER := 3;
    v_num_count INTEGER := 3;
BEGIN
    -- Loop through all entries with NULL ticket_number
    FOR r_entry IN SELECT id, raffle_id FROM entries WHERE ticket_number IS NULL LOOP
        
        -- Generate unique ticket for this raffle
        LOOP
            v_ticket := '';
            
            -- Add Letters
            FOR i IN 1..v_char_count LOOP
                v_ticket := v_ticket || substr(v_letters, floor(random() * 26)::int + 1, 1);
            END LOOP;
            
            -- Add Numbers
            FOR i IN 1..v_num_count LOOP
                v_ticket := v_ticket || substr(v_numbers, floor(random() * 10)::int + 1, 1);
            END LOOP;

            -- Check uniqueness within the raffle
            SELECT EXISTS(SELECT 1 FROM entries WHERE raffle_id = r_entry.raffle_id AND ticket_number = v_ticket) INTO v_exists;
            
            EXIT WHEN NOT v_exists;
        END LOOP;

        -- Update the entry
        UPDATE entries SET ticket_number = v_ticket WHERE id = r_entry.id;
        
    END LOOP;
END $$;
