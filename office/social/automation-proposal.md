# Proposal: automating the daily X posts

Written 2026-10-23 for the founder's decision. Status: **proposal only. Nothing below is built or switched on.** The Social team has no X login and no API keys and cannot post.

## What is automated today
- The draft for each day is written by `scripts/social_posts.py`, from our own data, with sources and a confidence line. The 10-minute news cycle already calls it once after 07:00 and refreshes it once after 17:00 (the call is in `scripts/news_update.py`, which main has not merged yet).
- Pictures are matched by `scripts/social_images.py`.
- What is left manual: copy the text, attach a picture, press Post, twice a day.

## Options for posting (cheapest and safest first)
1. **X's own scheduler (recommended first step).** In the X web composer, check whether the clock icon "Schedule" is available on your account. If it is, you paste the two drafts once in the morning, set 09:00 and 19:00, and X posts them. No keys, no third-party access, and every post is still read by you. I could not check whether your account has it.
2. **A posting script through the X API.** A script would post the approved text at 09:00 and 19:00. Needs: an X developer app, an API tier that allows posting (pricing and limits change: check X's developer page, I did not verify current prices), and keys kept only on your machine in an ignored `.env`, never in the repo or in chat. Safety rules I would build in: it posts only a draft you have marked `approved: yes` in the day's file; one post per slot; it refuses anything over 280 characters or with a failed check; it logs what it posted; one command to stop it. The Back end or Nightly team would own the scheduling, since it is a scheduled job.
3. **A third-party scheduler app.** Not recommended: it needs access to your account and adds a company between us and X.

## The risk to weigh
Automated posting of sourced facts is only as safe as the sources. Many facts are "Reported" from retailers, reviews and search summaries, and sale posts quote store listings that change within hours. A wrong post about a brand or a store is public. That is why option 2 requires your `approved: yes` per day, and why sale and drops posts should be re-read the morning they go out.

## What I need from you to continue
- Choose 1 (try the X scheduler first) or 2 (API script, needs your key and an owner team).
- Do not paste any key or password in chat. If you choose 2, you put the key in `.env` yourself and tell the owner team where.

## Not checked
Whether your account has Schedule; X API tiers, prices and rate limits; X's rules on automated accounts (an account that posts automatically may need the "automated" label in settings: check before enabling).
