-- Gully Labs (https://gullylabs.com): a one-brand Indian sneaker label that sells from its own Shopify store. Its robots.txt
-- allows the public product feed (/products.json). Delivery and returns terms are not read here, so none are claimed.

INSERT INTO retailers (name, slug, base_url, integration_type, region_focus, status, logo_url)
VALUES ('Gully Labs', 'gully-labs', 'https://gullylabs.com', 'manual', 'india', 'active', '/stores/gully-labs.png')
ON CONFLICT (slug) DO UPDATE SET logo_url = EXCLUDED.logo_url, base_url = EXCLUDED.base_url, status = 'active';
