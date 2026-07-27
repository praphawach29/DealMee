-- Quick introspection: run this and paste the results back, so the seed
-- script can be corrected to match the real deployed schema instead of
-- guessing column-by-column.

SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('products', 'shops', 'users')
ORDER BY table_name, ordinal_position;
