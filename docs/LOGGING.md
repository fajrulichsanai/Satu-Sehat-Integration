# Logging, audit trail & retention

This covers SATUSEHAT self-assessment controls No. 7, 15, 17, 21 and 22.

## What the app records

| Source | Where | Contents | Never contains |
| --- | --- | --- | --- |
| HTTP request log (`RequestLoggerMiddleware`) | stdout, one JSON line per request (`"type":"http"`) | timestamp, method, path, status, duration, userId, role, clinicId, IP, user agent | query strings, request/response bodies, tokens |
| Audit trail (`audit_logs` table) | MySQL | login/logout (success + failure), create/update/delete, **reads of patient data (`VIEW`)**, exports, security alerts (`ALERT`) | for `VIEW`: the record itself — only who, what id, when, from where |
| SATUSEHAT transaction log (`satusehat_sync_logs`) | MySQL | resource type, local id, SATUSEHAT id, HTTP status, redacted error | FHIR request/response bodies |
| Bulk-read alert | stdout (`{"event":"bulk_read",...}` at WARN) + `audit_logs` row with `action_type = ALERT` | user, clinic, number of reads in the 10-minute window | patient data |

The bulk-read threshold is `AUDIT_VIEW_ALERT_THRESHOLD` (default 150 reads / 10 minutes / user).

## Retention (minimum 90 days)

`audit_logs` and `satusehat_sync_logs` are never purged by the app, so they
already satisfy the 90-day minimum. Size them into the database backup plan.

The stdout logs live in PM2's log files and must be rotated **and kept for at
least 90 days** on the server:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'   # rotate daily
pm2 set pm2-logrotate:retain 120                   # keep 120 files (> 90 days)
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:max_size 100M
```

## Central logging (recommended)

To make logs searchable and tamper-resistant off the app server, ship the PM2
logs to a managed/central store with ≥ 90 days retention, e.g. Grafana
Loki + Promtail:

```yaml
# /etc/promtail/config.yml (excerpt)
scrape_configs:
  - job_name: apexrecord-api
    static_configs:
      - targets: [localhost]
        labels:
          app: apexrecord-api
          env: staging
          __path__: /home/*/.pm2/logs/dental-clinic-out*.log
    pipeline_stages:
      - json:
          expressions: { type: type, status: status, event: event }
      - labels: { type: , event: }
```

Set Loki's `limits_config.retention_period: 2160h` (90 days) or longer, and
add an alert rule on `{app="apexrecord-api", event="bulk_read"}`.

## Behind a proxy

Client IPs in both the request log and the audit trail come from
`X-Forwarded-For`, which the API only trusts from the proxies listed in
`TRUST_PROXY` (default: same host). If nginx or the Next.js frontend runs on
another machine, set `TRUST_PROXY` accordingly — otherwise every request is
logged (and rate-limited) as the proxy's IP.
