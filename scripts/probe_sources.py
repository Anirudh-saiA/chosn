r"""Check which candidate sources CHOSN may read automatically.

    python scripts/probe_sources.py            # writes data/releases/source_probe.json and prints a table

For each candidate: is its robots.txt open to our identified User-Agent for the address we would read, does it publish a public feed (RSS /
Atom) or public product data (a Shopify store's /products.json), and does the feed have recent items? A source is "usable" only when both
robots.txt allows it and a real feed or public data answers. Nothing here copies article text: feeds give headlines and links.
"""
import concurrent.futures
import datetime
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "releases", "source_probe.json")
UA = "CHOSN-price-compare/1.0 (+contact: join.sneakercommunity@gmail.com)"

# name, kind (news | official | calendar | brand), region, candidate addresses to try in order
S = [
    # --- sneaker news
    ("Sneaker News", "news", "global", ["https://sneakernews.com/feed/", "https://sneakernews.com/feed"]),
    ("Sole Collector", "news", "global", ["https://solecollector.com/feed", "https://solecollector.com/rss.xml"]),
    ("Complex Sneakers", "news", "global", ["https://www.complex.com/sneakers/rss", "https://www.complex.com/feed"]),
    ("Nice Kicks", "news", "global", ["https://www.nicekicks.com/feed/"]),
    ("Sneaker Freaker", "news", "global", ["https://www.sneakerfreaker.com/feed", "https://www.sneakerfreaker.com/rss"]),
    ("Kicks On Fire", "news", "global", ["https://www.kicksonfire.com/feed/"]),
    ("Sole Retriever", "news", "global", ["https://www.soleretriever.com/feed", "https://www.soleretriever.com/news/rss"]),
    ("SoleSavy", "news", "global", ["https://solesavy.com/feed/"]),
    ("Sneakers Magazine", "news", "global", ["https://sneakersmagazine.com/feed/"]),
    ("Sneakerjagers", "news", "global", ["https://www.sneakerjagers.com/feed"]),
    ("Footwear News", "news", "global", ["https://footwearnews.com/feed/", "https://footwearnews.com/c/shoes/sneakers/feed/"]),
    ("Gear Patrol footwear", "news", "global", ["https://gearpatrol.com/feed/"]),
    ("Hypebeast", "news", "global", ["https://hypebeast.com/footwear/feed"]),
    ("Highsnobiety", "news", "global", ["https://www.highsnobiety.com/feed/"]),
    ("Sneaker Bar Detroit", "news", "global", ["https://sneakerbardetroit.com/feed/"]),
    ("Just Fresh Kicks", "news", "global", ["https://justfreshkicks.com/feed/"]),
    ("WearTesters", "news", "global", ["https://weartesters.com/feed/"]),
    ("Sneaker Files", "news", "global", ["https://www.sneakerfiles.com/feed/"]),
    ("House of Heat", "news", "global", ["https://houseofheat.co/feed", "https://houseofheat.co/rss"]),
    ("Slam Jam", "news", "global", ["https://slamjamsocialism.com/feed/"]),
    ("Fashionista", "news", "global", ["https://fashionista.com/.rss/full/"]),
    ("Business of Fashion", "news", "global", ["https://www.businessoffashion.com/arc/outboundfeeds/rss/"]),
    ("Vogue", "news", "global", ["https://www.vogue.com/feed/rss"]),
    ("GQ", "news", "global", ["https://www.gq.com/feed/rss"]),
    ("Esquire", "news", "global", ["https://www.esquire.com/rss/all.xml/"]),
    ("Dazed", "news", "global", ["https://www.dazeddigital.com/rss"]),
    # --- India press
    ("Homegrown", "news", "india", ["https://homegrown.co.in/feed", "https://homegrown.co.in/rss.xml"]),
    ("Esquire India", "news", "india", ["https://www.esquireindia.co.in/feed"]),
    ("GQ India", "news", "india", ["https://www.gqindia.com/feed/rss"]),
    ("Vogue India", "news", "india", ["https://www.vogue.in/feed/rss", "https://www.vogue.in/feed"]),
    ("Elle India", "news", "india", ["https://elle.in/feed/"]),
    ("Man's World India", "news", "india", ["https://www.mansworldindia.com/feed/"]),
    ("Lifestyle Asia India", "news", "india", ["https://www.lifestyleasia.com/ind/feed/"]),
    ("Rolling Stone India", "news", "india", ["https://rollingstoneindia.com/feed/"]),
    ("Hindustan Times lifestyle", "news", "india", ["https://www.hindustantimes.com/feeds/rss/lifestyle/rssfeed.xml"]),
    ("Times of India fashion", "news", "india", ["https://timesofindia.indiatimes.com/rssfeeds/2886704.cms"]),
    ("Indian Express lifestyle", "news", "india", ["https://indianexpress.com/section/lifestyle/feed/"]),
    ("The Hindu life & style", "news", "india", ["https://www.thehindu.com/life-and-style/fashion/feeder/default.rss"]),
    ("Mint Lounge", "news", "india", ["https://www.livemint.com/rss/lounge"]),
    ("Economic Times retail", "news", "india", ["https://retail.economictimes.indiatimes.com/rss/topstories"]),
    ("Indian Retailer", "news", "india", ["https://www.indianretailer.com/rss", "https://www.indianretailer.com/feed"]),
    ("FashionUnited India", "news", "india", ["https://fashionunited.in/rss", "https://fashionunited.in/news/rss"]),
    ("Media Infoline", "news", "india", ["https://www.mediainfoline.com/feed"]),
    ("Storyboard18", "news", "india", ["https://www.storyboard18.com/feed/"]),
    ("Inc42", "news", "india", ["https://inc42.com/feed/"]),
    ("YourStory", "news", "india", ["https://yourstory.com/feed"]),
    ("Business Standard lifestyle", "news", "india", ["https://www.business-standard.com/rss/lifestyle-111.rss"]),
    ("India Fashion Icon", "news", "india", ["https://indiafashionicon.com/feed/"]),
    # --- official brand newsrooms (the best source for confirmed dates)
    ("Nike News", "official", "global", ["https://about.nike.com/en/newsroom/rss", "https://news.nike.com/feed", "https://about.nike.com/en/newsroom/feed"]),
    ("adidas News", "official", "global", ["https://news.adidas.com/rss", "https://news.adidas.com/rss.xml"]),
    ("Puma newsroom", "official", "global", ["https://about.puma.com/en/newsroom/rss", "https://about.puma.com/en/newsroom/feed"]),
    ("New Balance newsroom", "official", "global", ["https://newbalance.newsroom.com/rss", "https://newbalance.newsroom.com/feed"]),
    ("ASICS press", "official", "global", ["https://corp.asics.com/en/press/rss"]),
    ("Reebok", "official", "global", ["https://www.reebok.com/blogs/news.atom"]),
    ("Converse blog", "official", "global", ["https://www.converse.com/blogs/news.atom"]),
    ("Onitsuka Tiger", "official", "global", ["https://www.onitsukatiger.com/blogs/news.atom"]),
    ("HOKA", "official", "global", ["https://www.hoka.com/en/us/blog/feed"]),
    ("Salomon", "official", "global", ["https://www.salomon.com/en-us/blog/feed"]),
    # --- release calendars
    ("SoleDispatch", "calendar", "global", ["https://soledispatch.com/releases/"]),
    ("Sneaker Files calendar", "calendar", "global", ["https://www.sneakerfiles.com/release-dates/"]),
    ("Sneaker Bar Detroit calendar", "calendar", "global", ["https://sneakerbardetroit.com/sneaker-release-dates/"]),
    ("Nice Kicks calendar", "calendar", "global", ["https://www.nicekicks.com/air-jordan-release-dates/"]),
    ("Sole Retriever calendar", "calendar", "global", ["https://www.soleretriever.com/sneaker-release-dates"]),
    ("Foot Locker calendar", "calendar", "global", ["https://www.footlocker.com/release-calendar.html"]),
    ("Hibbett calendar", "calendar", "global", ["https://www.hibbett.com/launch-calendar/"]),
    ("Sneaker Release Dates", "calendar", "global", ["https://sneakerreleasedates.net/calendar"]),
    ("Drop-list", "calendar", "global", ["https://www.drop-list.com/sneakers/"]),
    ("Highsnobiety calendar", "calendar", "global", ["https://www.highsnobiety.com/l/drop-calendar/"]),
    ("Just Fresh Kicks Jordan dates", "calendar", "global", ["https://justfreshkicks.com/air-jordan-sneaker-releases-2026/"]),
    ("House of Heat Jordan dates", "calendar", "global", ["https://houseofheat.co/jordan-release-dates"]),
    # --- Indian homegrown brands and retailers (public Shopify product data, if the store is on Shopify)
    ("Comet", "brand", "india", ["https://www.wearcomet.com/products.json?limit=5", "https://wearcomet.com/products.json?limit=5"]),
    ("Gully Labs", "brand", "india", ["https://gullylabs.com/products.json?limit=5"]),
    ("Thaely", "brand", "india", ["https://thaely.com/products.json?limit=5", "https://www.thaely.com/products.json?limit=5"]),
    ("Neeman's", "brand", "india", ["https://neemans.com/products.json?limit=5", "https://www.neemans.com/products.json?limit=5"]),
    ("Bacca Bucci", "brand", "india", ["https://baccabucci.com/products.json?limit=5", "https://www.baccabucci.com/products.json?limit=5"]),
    ("Campus", "brand", "india", ["https://www.campusshoes.com/products.json?limit=5"]),
    ("CHNKS", "brand", "india", ["https://chnks.in/products.json?limit=5"]),
    ("Almost Gods", "brand", "india", ["https://almostgods.com/products.json?limit=5", "https://www.almostgods.com/products.json?limit=5"]),
    ("Go CKH", "brand", "india", ["https://gockh.com/products.json?limit=5"]),
    ("Red Tape", "brand", "india", ["https://www.redtape.com/products.json?limit=5"]),
    ("Superkicks", "brand", "india", ["https://www.superkicks.in/products.json?limit=5"]),
    ("Crepdog Crew", "brand", "india", ["https://crepdogcrew.com/products.json?limit=5"]),
    ("Limited Edt", "brand", "india", ["https://limitededt.in/products.json?limit=5"]),
    ("VegNonVeg", "brand", "india", ["https://www.vegnonveg.com/products.json?limit=5"]),
    ("Sneakers India (Kicks Crew India)", "brand", "india", ["https://www.kickscrew.com/products.json?limit=5"]),
]

_robots = {}


def robots_ok(url):
    p = urllib.parse.urlparse(url)
    host = p.netloc
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            txt = urllib.request.urlopen(urllib.request.Request(f"{p.scheme}://{host}/robots.txt", headers={"User-Agent": UA}), timeout=15).read().decode("utf-8", "ignore")
            rp.parse(txt.splitlines())
            _robots[host] = rp
        except urllib.error.HTTPError as e:
            _robots[host] = "open" if e.code == 404 else None
        except Exception:
            _robots[host] = None
    rp = _robots[host]
    if rp == "open":
        return True
    return bool(rp and rp.can_fetch(UA, url))


def probe(entry):
    name, kind, region, urls = entry
    res = {"name": name, "kind": kind, "region": region, "tried": [], "usable": False}
    for u in urls:
        t = {"url": u}
        ok = robots_ok(u)
        t["robots"] = ok
        if ok:
            try:
                req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, application/json, text/html"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    body = r.read(1_500_000).decode("utf-8", "ignore")
                    t["status"] = r.status
                if kind == "brand":
                    try:
                        prods = json.loads(body).get("products", [])
                        t["items"] = len(prods)
                        t["newest"] = max((p.get("published_at") or "")[:10] for p in prods) if prods else None
                    except ValueError:
                        t["items"] = 0
                elif kind == "calendar":
                    t["items"] = len(re.findall(r"release", body, re.I)) // 5
                else:
                    t["items"] = len(re.findall(r"<item[ >]", body)) or len(re.findall(r"<entry[ >]", body))
            except Exception as e:
                t["status"] = f"{type(e).__name__}{getattr(e, 'code', '')}"
                t["items"] = 0
        res["tried"].append(t)
        if ok and t.get("items", 0) > 0:
            res["usable"] = True
            res["url"] = u
            break
    if not res["usable"]:
        why = []
        for t in res["tried"]:
            if t["robots"] is not True:
                why.append("robots.txt does not allow us or cannot be read")
            elif t.get("items", 0) == 0:
                why.append(f"no feed or data ({t.get('status')})")
        res["why"] = why[0] if why else "unreachable"
    return res


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(probe, S))
    json.dump({"checked": datetime.date.today().isoformat(), "results": results}, open(OUT, "w", encoding="utf-8"), indent=1)
    for r in results:
        print(f"{'OK ' if r['usable'] else '-- '} {r['kind']:9} {r['region']:6} {r['name']:34} {r.get('url', r.get('why', ''))[:90]}")
    print(f"\n{sum(1 for r in results if r['usable'])} usable of {len(results)} checked")


if __name__ == "__main__":
    main()
