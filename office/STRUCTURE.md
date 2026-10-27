# The CHOSN company structure

A startup at CHOSN's stage has the roles below. The founder covers any role that has no team yet; a team is added when the work needs someone full-time.
Status: **Active** = a session exists now. **Later** = start when the trigger happens.

## Leadership
| Role | Who | What they do | Status |
|---|---|---|---|
| **Founder / CEO** | You (this session is Main) | Vision, priorities, every decision, merging and pushing, every external action, fundraising and partnerships | Active |

## Product and engineering
| Role | Team | What they do | Status |
|---|---|---|---|
| **Product** | Founder (with R&D input) | What to build next and why; user feedback; roadmap | Founder covers |
| **Front end** | Front end team | `apps/web`: pages, design, the magazine, mobile, speed | Active |
| **Back end** | Back end team | `apps/api`: endpoints, database, auth, e-mail, tests, deployment | Active |
| **Security** | Security team | Finds and proves weaknesses in our own app, API, database, jobs, dependencies and secrets; privacy controls; checks fixes. Findings go to the owners | Active |
| **QA (testing)** | Back end and front end for now | Tests, breaking things on purpose | Later: a QA team when the site has real users |
| **Social (X / Twitter)** | Social team | Daily critic-voice posts, fact bank, calendar, picture matching, engagement ideas | Active |
| **Operations (scheduled jobs)** | Nightly team | Runs and watches the nightly, weekly and 10-minute jobs, catches up missed runs, triages failures, backs up the database | Active |
| **DevOps / infrastructure** | Back end and Nightly for now | Hosting, deployment, monitoring | Later: when deployed to a host |

## Data and intelligence
| Role | Team | What they do | Status |
|---|---|---|---|
| **Data** | Data team | Store scrapers, price history, the nightly import, datasets for the models | Active |
| **Research (R&D)** | R&D team | Answers "how, which, how much, is it allowed" with sources: technology, competitors, law, data sources, product ideas | Active |
| **AI/ML** | AI/ML team | Price forecast, sell now/later, legit check models | **Later:** after about 60 to 90 days of data and labelled datasets (see `roles/aiml.md`) |

## Content and growth
| Role | Team | What they do | Status |
|---|---|---|---|
| **Content / editorial** | Drops and News desk | Drop calendar, news, The CHOSN Times | Active |
| **Outreach and partnerships** | Outreach team | Finds events, programmes, partners and press; drafts, never sends | Active |
| **Growth and community** | Founder for now (waitlist e-mail work sits with Back end) | Waitlist, e-mail, social posts, community, referrals | Later: when launch nears |
| **Design / brand** | Front end for now | Logo, colours, type, the look of everything (the brand catalogue is in `docs/`) | Later: a design team if the brand needs it |

## Business and operations
| Role | Team | What they do | Status |
|---|---|---|---|
| **Legal and compliance** | R&D researches, founder decides, a real lawyer signs off | Terms, privacy policy, DPDP Act, copyright, store and brand relationships | Later: before public launch, get a real lawyer to review |
| **Finance** | Founder | Budget, costs per month, runway, funding | Founder covers |
| **Customer support** | Founder | Feedback form, e-mails, bug reports from users | Later: when there are users |

## How they connect
```
                       Founder / CEO (Main)
   ┌────────────┬──────────┼───────────┬─────────────┬───────────┐
Front end   Back end     Data       R&D      Drops & News     Outreach     Security     Nightly     Social        (AI/ML later, under Data and Back end)
```
- R&D feeds everyone: any team can add a question to `office/research/requests.md`.
- Data feeds AI/ML (later) and the product (prices, outlook).
- Back end deploys what Front end builds against and what AI/ML trains.
- Drops and News feeds the site and the magazine; Front end makes them look right.
- Outreach feeds the founder with opportunities and drafts.
- Security reads everything and reports to the founder; Back end and Front end fix what it finds; R&D researches the law, Security checks the code meets it.
- Everything reaches the founder through the evening report and the morning brief.

## Adding a team
1. Write `office/roles/<team>.md` (copy an existing one).
2. Add `office/tasks/<team>.md` and `office/reports/<team>/`.
3. Add it to the table in `ORG.md`, then create its session and paste the brief.
