-- Limited Edt (https://limitededt.in): an Indian sneaker store on Shopify. Its robots.txt allows the public product feed
-- (/products.json) and disallows /policies/, so delivery and returns terms are NOT read and none are claimed here.

INSERT INTO retailers (name, slug, base_url, integration_type, region_focus, status, logo_url)
VALUES ('Limited Edt', 'limited-edt', 'https://limitededt.in', 'manual', 'india', 'active', '/stores/limited-edt.png')
ON CONFLICT (slug) DO UPDATE SET logo_url = EXCLUDED.logo_url, base_url = EXCLUDED.base_url, status = 'active';
