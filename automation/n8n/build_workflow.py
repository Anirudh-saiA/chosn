r"""Builds the n8n workflow "CHOSN update" and writes it next to this file as chosn-update.generated.json (git-ignored,
because it contains the control token and the email key).

    python automation/n8n/build_workflow.py        # then: see automation/n8n/README.md

Flow: two schedules (every night 02:00 = fast stores, Sunday 01:00 = everything) -> start the update through the control service
-> check its status every minute until it is no longer running -> write a short summary -> email it. The subject says OK or
ATTENTION (a store paused, a scrape failed, the safety check stopped the import, or the run failed).
"""
import json
import os
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
token = (ROOT / "data" / "webscraper" / "control-token.txt").read_text().strip()
env = {}
for line in (ROOT / "apps" / "api" / ".env").read_text(encoding="utf-8").splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m:
        env[m.group(1)] = m.group(2).strip()
RESEND_KEY = env.get("RESEND_API_KEY", "")
FROM = env.get("RESEND_FROM", "CHOSN <onboarding@resend.dev>")
# Until a domain is verified in Resend, an account can only email its own owner address, so alerts go there. Set
# ALERT_EMAIL in apps/api/.env to send them somewhere else once a domain is verified.
TO = env.get("ALERT_EMAIL", "anirudhsai356@gmail.com")
BASE = "http://host.docker.internal:8765"
HEAD = {"parameters": [{"name": "X-Control-Token", "value": token}]}


def node(name, typ, version, x, y, params, **extra):
    return {"id": name.lower().replace(" ", "-"), "name": name, "type": typ, "typeVersion": version, "position": [x, y], "parameters": params, **extra}


def start(name, mode, x, y):
    return node(name, "n8n-nodes-base.httpRequest", 4.2, x, y, {
        "method": "POST", "url": f"{BASE}/run", "sendHeaders": True, "headerParameters": HEAD,
        "sendBody": True, "specifyBody": "json", "jsonBody": json.dumps({"mode": mode}), "options": {"timeout": 20000}},
        onError="continueRegularOutput")


COMPOSE = r"""
const s = $json;
const last = s.last_run || {};
const paused = Object.entries(s.paused_domains || {}).map(([d, v]) => `${d} (${v.reason})`);
const scrapeErrors = (last.scrape || []).filter(x => x.error);
const problems = last.problems || [];
const bad = last.status !== 'ok' || scrapeErrors.length > 0 || paused.length > 0 || problems.length > 0;
const lines = [];
lines.push(`Mode: ${last.mode || '?'}   Status: ${last.status || 'unknown'}   Took: ${last.minutes ?? '?'} min`);
lines.push('');
lines.push('Rows imported per store:');
for (const [k, v] of Object.entries(last.rows || {})) lines.push(`  ${k}: ${v}`);
lines.push('');
lines.push('Scrape time per store:');
for (const x of (last.scrape || [])) lines.push(`  ${x.store}: ${x.minutes} min${x.error ? '  FAILED: ' + x.error : ''}`);
if ((last.not_scraped || []).length) lines.push('Not scraped this run: ' + last.not_scraped.join(', '));
if (paused.length) { lines.push(''); lines.push('Sites paused (the site said no, so nothing more is requested for 24 h):'); paused.forEach(p => lines.push('  ' + p)); }
if (problems.length) { lines.push(''); lines.push('Safety check stopped the import:'); problems.forEach(p => lines.push('  ' + p)); }
if (last.error) { lines.push(''); lines.push('Error: ' + last.error); }
return [{ json: { subject: `CHOSN update: ${bad ? 'ATTENTION' : 'OK'} (${last.mode || '?'})`, text: lines.join('\n') } }];
"""

nodes = [
    node("Every night 02:00", "n8n-nodes-base.scheduleTrigger", 1.2, 0, 0, {"rule": {"interval": [{"field": "cronExpression", "expression": "0 2 * * *"}]}}),
    node("Sunday 01:00 full", "n8n-nodes-base.scheduleTrigger", 1.2, 0, 220, {"rule": {"interval": [{"field": "cronExpression", "expression": "0 1 * * 0"}]}}),
    start("Start fast update", "quick", 260, 0),
    start("Start full update", "full", 260, 220),
    node("Wait 1 min", "n8n-nodes-base.wait", 1.1, 520, 110, {"resume": "timeInterval", "amount": 1, "unit": "minutes"}),
    node("Check status", "n8n-nodes-base.httpRequest", 4.2, 760, 110, {
        "method": "GET", "url": f"{BASE}/status", "sendHeaders": True, "headerParameters": HEAD, "options": {"timeout": 20000}}),
    node("Still running?", "n8n-nodes-base.if", 2.2, 1000, 110, {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                       "conditions": [{"id": "running-true", "leftValue": "={{ $json.running }}", "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}}),
    node("Write summary", "n8n-nodes-base.code", 2, 1240, 200, {"jsCode": COMPOSE}),
    node("Email summary", "n8n-nodes-base.httpRequest", 4.2, 1480, 200, {
        "method": "POST", "url": "https://api.resend.com/emails", "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "Authorization", "value": f"Bearer {RESEND_KEY}"}]},
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ from: " + json.dumps(FROM) + ", to: [" + json.dumps(TO) + "], subject: $json.subject, text: $json.text }) }}",
        "options": {}}),
]
conn = {
    "Every night 02:00": {"main": [[{"node": "Start fast update", "type": "main", "index": 0}]]},
    "Sunday 01:00 full": {"main": [[{"node": "Start full update", "type": "main", "index": 0}]]},
    "Start fast update": {"main": [[{"node": "Wait 1 min", "type": "main", "index": 0}]]},
    "Start full update": {"main": [[{"node": "Wait 1 min", "type": "main", "index": 0}]]},
    "Wait 1 min": {"main": [[{"node": "Check status", "type": "main", "index": 0}]]},
    "Check status": {"main": [[{"node": "Still running?", "type": "main", "index": 0}]]},
    "Still running?": {"main": [[{"node": "Wait 1 min", "type": "main", "index": 0}], [{"node": "Write summary", "type": "main", "index": 0}]]},
    "Write summary": {"main": [[{"node": "Email summary", "type": "main", "index": 0}]]},
}
wf = {"id": "chosnupdate0001", "name": "CHOSN update", "nodes": nodes, "connections": conn, "active": False,
      "settings": {"executionOrder": "v1", "timezone": "Asia/Kolkata", "executionTimeout": 21600}, "versionId": "1", "pinData": {}}
out = HERE / "chosn-update.generated.json"
out.write_text(json.dumps([wf], indent=2), encoding="utf-8")
print("wrote", out)

# A copy for testing: a manual trigger and the "test" mode (Limited Edt only, nothing saved), so it is safe to run any time.
import copy
t = copy.deepcopy(wf)
t["id"], t["name"] = "chosnupdatetest01", "CHOSN update (test)"
t["nodes"] = [n for n in t["nodes"] if n["name"] not in ("Every night 02:00", "Sunday 01:00 full", "Start full update")]
t["nodes"].insert(0, node("Run test", "n8n-nodes-base.manualTrigger", 1, 0, 0, {}))
for n in t["nodes"]:
    if n["name"] == "Start fast update":
        n["parameters"]["jsonBody"] = json.dumps({"mode": "test"})
t["connections"] = {k: v for k, v in conn.items() if k not in ("Every night 02:00", "Sunday 01:00 full", "Start full update")}
t["connections"]["Run test"] = {"main": [[{"node": "Start fast update", "type": "main", "index": 0}]]}
(HERE / "chosn-update-test.generated.json").write_text(json.dumps([t], indent=2), encoding="utf-8")
