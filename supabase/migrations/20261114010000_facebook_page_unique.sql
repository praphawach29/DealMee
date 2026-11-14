-- One Facebook page id belongs to one shop, including writes that skip the
-- settings screen (PostgREST updates the shops row directly).
--
-- Does not change existing rows. If two shops already share a non-blank page id,
-- the script stops and lists those ids so the unique index is not attempted.
-- Safe to run more than once.
--
-- Inspect duplicates before re-running:
--   SELECT facebook_page_id, count(*) AS shops
--   FROM public.shops
--   WHERE facebook_page_id IS NOT NULL AND btrim(facebook_page_id) <> ''
--   GROUP BY facebook_page_id
--   HAVING count(*) > 1;

DO $$
DECLARE
  n int;
  sample text;
BEGIN
  IF to_regclass('public.shops') IS NULL THEN
    RAISE EXCEPTION 'facebook page uniqueness stopped: public.shops does not exist. No data was changed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shops'
      AND column_name = 'facebook_page_id'
  ) THEN
    RAISE EXCEPTION 'facebook page uniqueness stopped: public.shops.facebook_page_id does not exist. No data was changed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'shops_facebook_page_id_key'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO n
  FROM (
    SELECT facebook_page_id
    FROM public.shops
    WHERE facebook_page_id IS NOT NULL
      AND btrim(facebook_page_id) <> ''
    GROUP BY facebook_page_id
    HAVING count(*) > 1
  ) d;

  IF n > 0 THEN
    SELECT string_agg(facebook_page_id, ', ') INTO sample
    FROM (
      SELECT facebook_page_id
      FROM public.shops
      WHERE facebook_page_id IS NOT NULL
        AND btrim(facebook_page_id) <> ''
      GROUP BY facebook_page_id
      HAVING count(*) > 1
      ORDER BY facebook_page_id
      LIMIT 20
    ) d;

    RAISE EXCEPTION
      'facebook page uniqueness stopped: % page id(s) are already used by more than one shop. No rows were changed and the unique index was not created. Disconnect the extra shop, then run this script again. Page ids: %',
      n, coalesce(sample, '(none)');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS shops_facebook_page_id_key
  ON public.shops (facebook_page_id)
  WHERE facebook_page_id IS NOT NULL AND btrim(facebook_page_id) <> '';

SELECT 'facebook page uniqueness applied successfully' AS result;
