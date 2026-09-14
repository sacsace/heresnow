#!/bin/sh
set -eu

curl -fsS -X POST "${HERESNOW_URL}/api/cron/check-in-reminders" \
  -H "Authorization: Bearer ${CRON_SECRET}"
