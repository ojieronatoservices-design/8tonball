-- Data Cleanup Script: Fix existing drawn raffles where goal was unmet

DO $$
DECLARE
    r RECORD;
    v_pot_tibs BIGINT;
BEGIN
    FOR r IN (
        SELECT id, goal_tibs, winner_user_id
        FROM raffles 
        WHERE status = 'drawn' AND goal_tibs > 0
    ) LOOP
        -- check if goal was met
        SELECT COALESCE(SUM(raf.entry_cost_tibs), 0) INTO v_pot_tibs
        FROM entries e JOIN raffles raf ON e.raffle_id = raf.id WHERE e.raffle_id = r.id;
        
        IF v_pot_tibs < r.goal_tibs THEN
            -- Unmet goal, but currently drawn. Fix it.
            UPDATE raffles SET 
                status = 'closed',
                winner_user_id = NULL,
                winning_entry_id = NULL
            WHERE id = r.id;
            
            -- Refund participants
            UPDATE profiles
            SET tibs_balance = tibs_balance + refund.total_refund
            FROM (
                SELECT e.user_id, SUM(raf.entry_cost_tibs) as total_refund
                FROM entries e
                JOIN raffles raf ON e.raffle_id = raf.id
                WHERE e.raffle_id = r.id
                GROUP BY e.user_id
            ) AS refund
            WHERE profiles.id = refund.user_id;
            
            -- Note: Payout reversal to host is omitted intentionally, 
            -- preserving historical balance but reverting drawn state and refunding users.
        END IF;
    END LOOP;
END $$;
