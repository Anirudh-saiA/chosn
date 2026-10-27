-- Schema-qualify the currency functions from 0004.
--
-- Newer Postgres (17+) runs functions with a restricted search_path while
-- it builds or refreshes a materialized view (0026 uses effective_price_inr
-- in one). Inside that, the unqualified fx_rates and fx_rate_to_inr in 0004
-- are not found ("function fx_rate_to_inr(text) does not exist"), so a fresh
-- database could not finish migrating. Same behaviour, public. prefixed.
-- CREATE OR REPLACE is safe to run on a database that already has 0004.

CREATE OR REPLACE FUNCTION fx_rate_to_inr(p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT rate_to_inr FROM public.fx_rates WHERE currency = upper(p_currency);
$$;

CREATE OR REPLACE FUNCTION effective_price_inr(p_price NUMERIC, p_shipping NUMERIC, p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_price IS NULL THEN NULL
      WHEN public.fx_rate_to_inr(p_currency) IS NULL THEN NULL
      ELSE (p_price + COALESCE(p_shipping, 0)) * public.fx_rate_to_inr(p_currency)
    END;
$$;
