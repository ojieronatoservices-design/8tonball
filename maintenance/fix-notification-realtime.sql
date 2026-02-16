-- Enable full replica identity for notifications
-- This ensures that when a notification is updated (e.g., collective notification), 
-- the full payload including the new message is sent via Realtime.

ALTER TABLE notifications REPLICA IDENTITY FULL;
