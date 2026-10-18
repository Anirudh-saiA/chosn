# CHOSN n8n automation

n8n schedules the price update, watches it, and emails a summary (subject says OK or ATTENTION).

```
n8n (Docker, localhost:5679)  --HTTP-->  control service (127.0.0.1:8765, this PC)  -->  scripts/webscraper/run.py all [--quick]
```

* **Every night 02:00:** `--quick` (Superkicks, Crepdog, Mainstreet, Limited Edt, Gully Labs).
* **Sundays 01:00:** everything (adds VegNonVeg, Myntra, Puma India).
* After starting, n8n checks `/status` every minute until the run ends, then emails the per-store rows, timings, paused sites and
  any safety-check stop to `RESEND_REPLY_TO` (apps/api/.env), through Resend.

## Set up (once)

1. `powershell -ExecutionPolicy Bypass -File scripts\register-control-service.ps1`  (starts the control service at login)
2. `powershell -ExecutionPolicy Bypass -File scripts\register-daily-task.ps1 -Remove`  (removes the old Windows nightly tasks, n8n replaces them)
3. `docker compose -f automation/n8n/docker-compose.yml up -d`, then open http://localhost:5679 and create the owner login.
4. `python automation/n8n/build_workflow.py`, then import both generated files:
   `docker cp automation/n8n/chosn-update.generated.json chosn-n8n:/tmp/wf.json`
   `docker exec chosn-n8n n8n import:workflow --input=/tmp/wf.json`   (Git Bash: prefix `MSYS_NO_PATHCONV=1`)
   and activate "CHOSN update" in the n8n editor (toggle top right).
5. Test: open "CHOSN update (test)" and press Execute. It runs Limited Edt with nothing saved and sends a test email.

`chosn-update*.generated.json` contain the control token and the email key, so they are git-ignored. After rotating the Resend key
or the token (`data/webscraper/control-token.txt`), run `build_workflow.py` again and re-import.
