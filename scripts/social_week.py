"""Weekly pack of evergreen X posts, for scheduling a week ahead in X's own Schedule box (free; the founder does the scheduling).

Only kinds that do not go stale are packed: fact, controversy, random and reality (a reality post's price line is as of the pack date).
Live kinds (new releases, sale, market, news, collab, wearing) need the day's data, so the daily draft covers them.
The daily draft (scripts/social_posts.py) sees the pack and says "already scheduled" for those slots.

Usage: python scripts/social_week.py [--start YYYY-MM-DD]     (default: tomorrow)  ->  office/social/week-<start>.md
"""
import argparse
import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import social_posts as sp  # noqa: E402

EVERGREEN = ("fact", "controversy", "random", "reality")
TIMES = {"morning": "09:00", "evening": "19:00"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default=(datetime.date.today() + datetime.timedelta(days=1)).isoformat())
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    start = datetime.date.fromisoformat(a.start)
    ctx = {"facts": sp.load_facts(), "used": sp.recent_ids(a.start)}
    out = [f"# Weekly pack from {a.start}: evergreen posts to schedule in X", "",
           "In X: Post -> write the text -> the calendar-and-clock icon (Schedule) -> pick the date and time. Paste the text exactly; the hashtags are optional and at the end.",
           "Live posts (new releases, sale, market, news, collab, wearing) are not in this pack: the daily draft covers them. Reality posts carry the price as of today, so re-check one before the day.",
           "I could not check that your account has the Schedule option.", ""]
    marks, live = [], []
    for n in range(7):
        day = (start + datetime.timedelta(days=n)).isoformat()
        d = start + datetime.timedelta(days=n)
        out += [f"## {d.strftime('%A %d %b')} ({day})", ""]
        for slot, kind in zip(("morning", "evening"), sp.SLOTS[d.weekday()]):
            if slot == "morning":
                rel = sp.q(f"select count(*) from drop_events where not hidden and not is_demo and release_date='{day}' and confirmation in ('confirmed','reported')")
                if rel and int(rel[0][0]) > 0:
                    out += [f"- {TIMES[slot]} {slot}: **new releases** (a shoe releases this day): use the daily draft; no evergreen post here.", ""]
                    live.append((day, slot, "drops"))
                    continue
            if kind not in EVERGREEN:
                out += [f"- {TIMES[slot]} {slot}: **{kind}**, a live post: use the daily draft that day.", ""]
                live.append((day, slot, kind))
                continue
            p = sp.KINDS[kind](day, ctx)
            if not p:
                out += [f"- {TIMES[slot]} {slot}: planned {kind}, nothing usable; use the daily draft.", ""]
                continue
            ctx["used"].update(p["ids"])
            tags = " ".join(sp.hashtags(kind, p))
            out += [f"### {TIMES[slot]} {slot}: {p['label']}", "", "```", p["text"], "```",
                    f"Length: {sp.x_len(p['text'])}/{sp.LIMIT}  |  confidence: {p['conf']}  |  optional hashtags: {tags} (with tags {sp.x_len(p['text'] + chr(10) * 2 + tags)}/{sp.LIMIT})"]
            if p["sources"]:
                out += ["Sources: " + " ; ".join(p["sources"])]
            out += [f"Picture: your own photo of {p['title']}" if p["slug"] else "Picture: optional", ""]
            marks.append(f"<!-- slot {day} {slot} | {kind} | {p['ids'][0]} -->")
    out += [""] + marks
    path = sp.ROOT / "office" / "social" / f"week-{a.start}.md"
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {path} ({len(marks)} evergreen posts packed)")


if __name__ == "__main__":
    main()
