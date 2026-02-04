-- Repair drawn raffles with missing winning_entry_id
DO $$
DECLARE
    r_raffle RECORD;
    v_entry_id UUID;
BEGIN
    -- Loop through drawn raffles with missing winning_entry_id but having a winner_user_id
    FOR r_raffle IN 
        SELECT id, winner_user_id 
        FROM raffles 
        WHERE status = 'drawn' 
        AND winning_entry_id IS NULL 
        AND winner_user_id IS NOT NULL 
    LOOP
        -- Find ANY entry for this user in this raffle
        SELECT id INTO v_entry_id
        FROM entries 
        WHERE raffle_id = r_raffle.id 
        AND user_id = r_raffle.winner_user_id
        LIMIT 1;

        -- If entry found, update the raffle
        IF v_entry_id IS NOT NULL THEN
            UPDATE raffles 
            SET winning_entry_id = v_entry_id 
            WHERE id = r_raffle.id;
            
            RAISE NOTICE 'Repaired Raffle %: Set winning entry to %', r_raffle.id, v_entry_id;
        END IF;
    END LOOP;
END $$;
