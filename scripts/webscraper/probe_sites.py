"""Check, politely, which stores let CHOSN read their public pages. Three requests per site at most:
robots.txt, the home page, and /products.json (the Shopify feed). A 401/403/429 or a bot-challenge page means the site
says no: it goes on the blocked list and is not retried with another tool."""
import json, sys, time, urllib.request, urllib.error, urllib.robotparser

UA = "CHOSN-price-compare/1.0"
SITES = {
    "adidas India": "https://www.adidas.co.in", "Reebok India": "https://www.reebok.in", "ASICS India": "https://www.asics.com/in/en-in/",
    "New Balance India": "https://www.newbalance.in", "Puma India": "https://in.puma.com", "Skechers India": "https://www.skechers.in",
    "Under Armour India": "https://www.underarmour.in", "Converse India": "https://www.converse.in", "Vans India": "https://www.vansindia.com",
    "Crocs India": "https://www.crocs.in", "Hoka India": "https://www.hoka.com/en/in/", "On India": "https://www.on.com/en-in/",
    "Salomon India": "https://www.salomon.com/en-in", "Fila India": "https://www.fila.co.in", "Campus": "https://www.campusactivewear.com",
    "Foot Locker": "https://www.footlocker.in", "Limited Edt": "https://www.limitededt.in", "Culture Circle": "https://www.culturecircle.com",
    "Hypefly": "https://hypefly.co.in", "Ajio": "https://www.ajio.com", "Flipkart": "https://www.flipkart.com", "Amazon India": "https://www.amazon.in",
    "Tata CLiQ": "https://www.tatacliq.com", "Nykaa Fashion": "https://www.nykaafashion.com", "END. Clothing": "https://www.endclothing.com",
    "Nike India": "https://www.nike.com/in",
}
BLOCK = ("captcha", "access denied", "are you a robot", "verify you are human", "unusual traffic", "just a moment", "pardon our interruption")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        r = urllib.request.urlopen(req, timeout=25)
        return r.status, r.read(400_000).decode("utf-8", "ignore"), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, "", url
    except Exception as e:
        return 0, f"{type(e).__name__}", url


def probe(name, base):
    host = base.split("/")[0] + "//" + base.split("/")[2]
    res = {"site": name, "url": base}
    code, txt, _ = get(host + "/robots.txt")
    res["robots"] = code
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(txt.splitlines() if code == 200 else [])
    res["robots_allows_home"] = rp.can_fetch(UA, base) if code == 200 else None
    res["robots_allows_products_json"] = rp.can_fetch(UA, host + "/products.json") if code == 200 else None
    time.sleep(1.5)
    code, txt, final = get(base)
    res["home"] = code
    res["challenge"] = any(m in txt[:20000].lower() for m in BLOCK) if txt else False
    time.sleep(1.5)
    code, txt, _ = get(host + "/products.json?limit=1")
    res["shopify_feed"] = code == 200 and txt.lstrip().startswith("{") and '"products"' in txt[:50]
    ok = res["home"] == 200 and not res["challenge"] and res["robots"] in (200, 404) and res["robots_allows_home"] is not False
    res["verdict"] = "OPEN" if ok else "BLOCKED"
    return res


if __name__ == "__main__":
    out = []
    for n, b in SITES.items():
        r = probe(n, b)
        out.append(r)
        print(f"{r['verdict']:8} {n:20} robots={r['robots']} home={r['home']} challenge={r['challenge']} feed={r['shopify_feed']}", flush=True)
    json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "probe_results.json", "w"), indent=1)
