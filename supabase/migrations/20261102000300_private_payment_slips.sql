-- Top-up slips were in a public bucket with a "SELECT ... TO public" policy: anyone holding a
-- link, or guessing a shop id, could open a slip (names, bank, account digits, amounts).
-- The bucket goes private. Slips are uploaded by /api/billing/submit-slip with the service
-- role, and /admin/payments shows them through signed links that expire after an hour, so
-- neither policy is needed. The insert policy also let any signed-in user drop files into
-- any shop's folder.
--
-- Existing slips stay where they are; billing_payments.slip_url keeps the old public URL and
-- the admin page signs it the same way. A public link that was already sent out stops opening.
--
-- Safe to re-run.

update storage.buckets set public = false where id = 'payment-slips';

drop policy if exists "payment_slips_select" on storage.objects;
drop policy if exists "payment_slips_insert" on storage.objects;

-- Check: public should read false, and no policy on storage.objects should name payment-slips
select id, public from storage.buckets where id = 'payment-slips';
select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' and (qual like '%payment-slips%' or with_check like '%payment-slips%');
