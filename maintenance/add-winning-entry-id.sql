-- Add winning_entry_id to raffles to track the specific winning ticket
ALTER TABLE raffles 
ADD COLUMN winning_entry_id UUID REFERENCES entries(id);
