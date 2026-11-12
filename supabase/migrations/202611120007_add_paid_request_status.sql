-- Separate paid from scheduled in the request lifecycle.
alter type request_status add value if not exists 'paid' after 'awaiting_payment';
