-- Cancellation is financially distinct from deletion and remains publicly
-- visible while refunds are processed and after they complete.
alter type public.project_status add value if not exists 'cancelling' after 'live';
alter type public.project_status add value if not exists 'cancelled' after 'cancelling';
