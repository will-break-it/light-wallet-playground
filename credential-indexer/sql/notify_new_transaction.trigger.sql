CREATE TRIGGER notify_new_transaction_trigger
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE PROCEDURE notify_new_transaction();