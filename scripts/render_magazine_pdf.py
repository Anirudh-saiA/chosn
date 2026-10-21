r"""Render an issue of The CHOSN Times to a PDF:

    python scripts/render_magazine_pdf.py                # every issue that has no PDF yet
    python scripts/render_magazine_pdf.py 2026-10-21     # one issue (overwrites)

The site's print page (/magazine/<slug>/print) lays every page out on its own 600 x 800 sheet; a headless Chromium prints it to
data/media/magazine/<slug>.pdf, which the API serves at /magazine/<slug>/pdf (the "Download PDF" button). Needs the web site running
(WEB_URL, default http://localhost:3000), the API running, and Playwright with Chromium (the webscraper venv has it).
Photos are the publishers' and carry their credit lines on the pages.
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "media", "magazine")
WEB = os.environ.get("WEB_URL", "http://localhost:3000").rstrip("/")
API = os.environ.get("API_PUBLIC_URL", "http://localhost:4000").rstrip("/")


def issues():
    with urllib.request.urlopen(f"{API}/magazine", timeout=30) as r:
        return json.load(r)


def render(slug):
    from playwright.sync_api import sync_playwright

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{slug}.pdf")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 600, "height": 800})
        page.goto(f"{WEB}/magazine/{slug}/print", wait_until="networkidle", timeout=120000)
        # Anything fixed to the screen (cookie banner, dev overlay) must not land on page 1.
        page.evaluate(
            """() => {
              document.querySelectorAll('nextjs-portal').forEach(e => e.remove());
              document.querySelectorAll('body *').forEach(e => { if (!e.closest('.mag-print') && getComputedStyle(e).position === 'fixed') e.remove(); });
            }"""
        )
        page.evaluate("() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))")
        page.pdf(path=path, width="600px", height="800px", print_background=True, prefer_css_page_size=True)
        browser.close()
    return path


def main():
    wanted = sys.argv[1:]
    todo = wanted or [i["slug"] for i in issues() if not i.get("hasPdf")]
    for slug in todo:
        print(f"[magazine-pdf] {slug}: {render(slug)} ({os.path.getsize(os.path.join(OUT, slug + '.pdf')) // 1024} KB)")
    if not todo:
        print("[magazine-pdf] every issue already has a PDF")
    return 0


if __name__ == "__main__":
    sys.exit(main())
