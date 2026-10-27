"""Unit checks for the sneakers-only scope (card data-scope-slides). Run: python scripts/test_sneakers_only.py"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "webscraper"))
import scrape_mainstreet_prices as ms  # noqa: E402
import scrape_puma_prices as puma  # noqa: E402
import scrape_shopify_prices as sh  # noqa: E402


def prod(title, ptype="Sneakers", tags=()):
    return {"title": title, "product_type": ptype, "tags": list(tags)}


class SneakersOnly(unittest.TestCase):
    def test_puma_slugs(self):
        for slug in ("leadcat-20-slides", "popcat-sandals", "softride-slippers", "x-flip-flops", "kids-clogs", "mule-x"):
            self.assertTrue(puma.NOT_SHOES.search(slug), slug)
        for slug in ("suede-classic-xxi", "rs-x-efekt", "speedcat-og", "slipstream-lo", "palermo-leather"):
            self.assertFalse(puma.NOT_SHOES.search(slug), slug)

    def test_shopify_filter(self):
        for p in (prod("Adidas Adilette 22 Slides"), prod("Nike Victori One Slide", "Slides"), prod("Crocs Classic Clog", "Clogs"),
                  prod("Birkenstock Sandal", "Sandals"), prod("Flip Flops", "Footwear"), prod("Foo", "Sneakers", ["slippers"])):
            self.assertFalse(sh.is_sneaker(p), p["title"])
        for p in (prod("Nike Dunk Low Retro"), prod("Air Jordan 1 Low", "Sneakers"), prod("Slip-on Vans Old Skool", "Sneakers"),
                  prod("Asics Gel-Kayano 14", "Shoes"), prod("Yeezy Slideshow Runner", "Sneakers")):
            self.assertTrue(sh.is_sneaker(p), p["title"])

    def test_mainstreet_filter(self):
        self.assertFalse(ms.is_footwear(prod("Yeezy Slide Onyx", "Slides", ["sneakers"])))
        self.assertFalse(ms.is_footwear(prod("Nike Calm Flip Flop", "Sandals")))
        self.assertTrue(ms.is_footwear(prod("Nike Dunk Low", "Sneakers", ["sneakers"])))


if __name__ == "__main__":
    unittest.main()
