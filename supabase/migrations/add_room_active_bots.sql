-- Migration: Add room_active_bots mapping table
CREATE TABLE room_active_bots (
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, bot_id)
);

-- Enforce max 5 bots per room (Postgres trigger)
CREATE OR REPLACE FUNCTION enforce_max_bots_per_room()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM room_active_bots WHERE room_id = NEW.room_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 bots per room.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER max_bots_per_room_trigger
BEFORE INSERT ON room_active_bots
FOR EACH ROW EXECUTE FUNCTION enforce_max_bots_per_room();
