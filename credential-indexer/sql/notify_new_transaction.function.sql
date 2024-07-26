CREATE OR REPLACE FUNCTION notify_new_transaction()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
  block_slot INTEGER;
  block_hash TEXT;
  block_height INTEGER;
BEGIN
  -- Get the block_id from the transactions table
  SELECT block_id INTO block_slot FROM transactions WHERE tx_id = NEW.tx_id;

  -- Get the slot and hash from the blocks table
  SELECT height, slot, hash INTO block_height, block_slot, block_hash FROM block WHERE slot = block_slot;

  -- Build the payload
  payload := json_build_object(
    'tx_id', NEW.tx_id,
    'block_height', block_height,
    'block_slot', block_slot,
    'block_hash', block_hash
  );

  -- Notify the channel
  PERFORM pg_notify('new_transaction', payload);

  RETURN NEW;
END;
$$
 LANGUAGE plpgsql;