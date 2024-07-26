CREATE OR REPLACE FUNCTION notify_new_block()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
BEGIN
  -- Build the payload
  payload := row_to_json(NEW);
  
  -- Notify the channel
  PERFORM pg_notify('new_block', payload);
  RETURN NEW;
END;
$$

 LANGUAGE plpgsql;