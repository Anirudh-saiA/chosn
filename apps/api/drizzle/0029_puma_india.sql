-- Puma India (https://in.puma.com): the brand's own store. Prices and per-size stock come from its public product pages
-- (allowed by its robots.txt), read in a local browser. Delivery and returns terms are not read here, so none are claimed.

INSERT INTO retailers (name, slug, base_url, integration_type, region_focus, status, logo_url)
VALUES ('Puma India', 'puma-india', 'https://in.puma.com', 'manual', 'india', 'active', '/stores/puma-india.png')
ON CONFLICT (slug) DO UPDATE SET logo_url = EXCLUDED.logo_url, base_url = EXCLUDED.base_url, status = 'active';
