CREATE TRIGGER notify_new_block_trigger
AFTER INSERT ON block
FOR EACH ROW
EXECUTE PROCEDURE notify_new_block();