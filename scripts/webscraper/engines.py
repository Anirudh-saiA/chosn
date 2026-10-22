r"""The scraping tools, in the order they are tried. Each one fetches a page and hands back the same thing.

  http         plain HTTP (core.polite_get): fastest, no limits, good for public JSON and server-rendered pages
  crawl4ai     github.com/unclecode/crawl4ai    local browser rendering -> HTML + markdown. Free, no quota.
  scrapling    github.com/D4Vinci/Scrapling     local fetcher (plain, then browser-rendered). Free, no quota.
  firecrawl    github.com/firecrawl/firecrawl   hosted API (needs FIRECRAWL_API_KEY, or FIRECRAWL_API_URL for a self-hosted
                                                copy). Has a credit allowance: when it runs out it is skipped.
  browser-use  github.com/browser-use/browser-use  an AI agent drives a real browser. Needs an LLM key (ANTHROPIC_API_KEY or
                                                OPENAI_API_KEY) and costs per run, so it is the last resort.

Rules for all of them live in core.py (robots.txt, pacing, no evading blocks). Anti-bot "stealth" modes that some of these tools
offer (for example Scrapling's StealthyFetcher) are deliberately not used: they exist to get past a site's protection.
"""
import asyncio
import os
import re

from core import LimitReached, NeedsRendering, SiteBlocked, check_page, polite_get


class Page:
    def __init__(self, url, html="", markdown="", engine=""):
        self.url, self.html, self.markdown, self.engine = url, html, markdown, engine

    @property
    def text(self):
        return self.markdown or re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", self.html, flags=re.S)


class Engine:
    name = ""

    def available(self):
        """(ok, reason). Not ok means 'skip this tool without counting it as a failure'."""
        return True, ""

    def fetch(self, url):
        raise NotImplementedError


def _wrap_tool_error(engine, exc):
    """Anything a tool raises that is not a site refusal is that tool's own problem."""
    msg = str(exc)
    if re.search(r"(402|429.*(quota|credit|limit)|credit|quota|rate limit|insufficient|payment required|exceeded)", msg, re.I):
        return LimitReached(f"{engine}: {msg[:200]}")
    return LimitReached(f"{engine} failed: {type(exc).__name__}: {msg[:200]}")


class HttpEngine(Engine):
    name = "http"

    def fetch(self, url):
        import urllib.error
        try:
            body = polite_get(url)
        except urllib.error.HTTPError as e:
            raise LimitReached(f"http: HTTP {e.code}")
        check_page(url, 200, body)  # raises NeedsRendering for JS-only pages so a rendering tool takes over
        return Page(url, html=body, engine=self.name)


class Crawl4AIEngine(Engine):
    name = "crawl4ai"

    def available(self):
        try:
            import crawl4ai  # noqa: F401
            return True, ""
        except Exception as e:
            return False, f"crawl4ai not installed ({e})"

    def fetch(self, url):
        from crawl4ai import AsyncWebCrawler

        async def go():
            async with AsyncWebCrawler() as crawler:
                return await crawler.arun(url=url)

        try:
            res = asyncio.run(go())
        except Exception as e:
            raise _wrap_tool_error(self.name, e)
        status = getattr(res, "status_code", 200) or 200
        html = res.html or ""
        check_page(url, status, html)
        md = getattr(res, "markdown", "") or ""
        return Page(url, html=html, markdown=str(md), engine=self.name)


class ScraplingEngine(Engine):
    name = "scrapling"

    def available(self):
        try:
            import scrapling  # noqa: F401
            return True, ""
        except Exception as e:
            return False, f"scrapling not installed ({e})"

    def fetch(self, url):
        try:
            try:
                from scrapling.fetchers import DynamicFetcher  # real browser rendering, no stealth mode
                resp = DynamicFetcher.fetch(url, headless=True, network_idle=True)
            except ImportError:
                from scrapling.fetchers import Fetcher
                resp = Fetcher.get(url)
        except Exception as e:
            raise _wrap_tool_error(self.name, e)
        body = str(getattr(resp, "html_content", "") or getattr(resp, "body", "") or "")
        check_page(url, getattr(resp, "status", 200) or 200, body)
        return Page(url, html=body, engine=self.name)


class FirecrawlEngine(Engine):
    name = "firecrawl"

    def available(self):
        if not (os.environ.get("FIRECRAWL_API_KEY") or os.environ.get("FIRECRAWL_API_URL")):
            return False, "set FIRECRAWL_API_KEY (hosted) or FIRECRAWL_API_URL (self-hosted) to use Firecrawl"
        try:
            import firecrawl  # noqa: F401
            return True, ""
        except Exception as e:
            return False, f"firecrawl-py not installed ({e})"

    def fetch(self, url):
        try:
            from firecrawl import Firecrawl
            kwargs = {"api_key": os.environ.get("FIRECRAWL_API_KEY", "self-hosted")}
            if os.environ.get("FIRECRAWL_API_URL"):
                kwargs["api_url"] = os.environ["FIRECRAWL_API_URL"]
            app = Firecrawl(**kwargs)
            doc = app.scrape(url, formats=["html", "markdown"])
        except Exception as e:
            raise _wrap_tool_error(self.name, e)
        html = getattr(doc, "html", None) or (doc.get("html") if isinstance(doc, dict) else "") or ""
        md = getattr(doc, "markdown", None) or (doc.get("markdown") if isinstance(doc, dict) else "") or ""
        check_page(url, 200, html or md)
        return Page(url, html=html, markdown=md, engine=self.name)


class BrowserUseEngine(Engine):
    name = "browser-use"

    def available(self):
        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY")):
            return False, "browser-use needs an LLM key (ANTHROPIC_API_KEY or OPENAI_API_KEY)"
        try:
            import browser_use  # noqa: F401
            return True, ""
        except Exception as e:
            return False, f"browser-use not installed ({e})"

    def fetch(self, url):
        try:
            from browser_use import Agent
            if os.environ.get("ANTHROPIC_API_KEY"):
                from browser_use import ChatAnthropic
                llm = ChatAnthropic(model="claude-sonnet-5-5")
            else:
                from browser_use import ChatOpenAI
                llm = ChatOpenAI(model="gpt-4o-mini")
            agent = Agent(task=f"Open {url} and return the visible text of the page. Do not log in or fill any form.", llm=llm)
            history = asyncio.run(agent.run(max_steps=6))
            text = history.final_result() or ""
        except Exception as e:
            raise _wrap_tool_error(self.name, e)
        check_page(url, 200, text if len(text) > 300 else text + " " * 300)
        return Page(url, markdown=text, engine=self.name)


CHAIN = [HttpEngine(), Crawl4AIEngine(), ScraplingEngine(), FirecrawlEngine(), BrowserUseEngine()]
