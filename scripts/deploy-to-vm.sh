#!/usr/bin/env bash
# =============================================================================
# Deploy the app + database migration + Caddy config to the StuSta VM.
# Run from this repo on your PC (Git Bash), while connected to StuStaNet:
#
#   bash scripts/deploy-to-vm.sh
#
# Uses the SSH alias "gym" (see ~/.ssh/config). Steps:
#   1. upload source, migration and Caddyfile
#   2. full database backup
#   3. apply pending migration in one transaction (rolls back on any error)
#   4. build the frontend on the VM (uses the VM's own .env.production)
#   5. swap in the new build
#   6. install the fixed backup script and the Caddy config (old ones are backed up;
#      an invalid Caddyfile is rolled back automatically)
#   7. smoke tests
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
MIGRATION=supabase/migrations/006_security_and_fixes.sql
STAMP=$(date +%Y%m%d_%H%M%S)

echo "[1/7] Uploading source, migration and server config..."
# .env* stay on the VM (they hold the production URL/key); src/public are replaced
# completely so deleted files (e.g. the Klaro consent banner) are gone there too.
FILES=(src index.html package.json package-lock.json tsconfig.json vite.config.ts
       "$MIGRATION" server/Caddyfile server/backup.sh)
[ -d public ] && FILES+=(public)   # optional: only static assets, may not exist
tar czf - "${FILES[@]}" \
  | ssh gym "mkdir -p /tmp/gym-deploy && rm -rf /tmp/gym-deploy/* && tar xzf - -C /tmp/gym-deploy"

ssh gym STAMP="$STAMP" MIGRATION="$MIGRATION" bash -s << 'REMOTE'
set -euo pipefail
APP=/root/stusta-gym-app
WEB=/var/www/stusta-gym
NEW=/tmp/gym-deploy

echo "[2/7] Database backup..."
mkdir -p /var/backups/stusta-gym
docker exec supabase-db pg_dump -U postgres -Fc --no-owner -d postgres > /var/backups/stusta-gym/pre-deploy_$STAMP.dump
ls -lh /var/backups/stusta-gym/pre-deploy_$STAMP.dump | awk '{print "       " $5 " " $9}'

echo "[3/7] Applying migration (single transaction)..."
{ echo '\set ON_ERROR_STOP 1'; echo 'begin;'; cat "$NEW/$MIGRATION"; echo; echo 'commit;'; } \
  | docker exec -i supabase-db psql -U postgres -q 2>&1 | grep -v 'does not exist, skipping' || true
docker exec supabase-db psql -U postgres -tAc "select to_regclass('public.notification_reads') is not null and exists(select 1 from pg_proc where proname='claim_shift')" \
  | grep -q t || { echo "       MIGRATION FAILED - nothing was changed. Aborting."; exit 1; }
echo "       OK"

echo "[4/7] Building frontend..."
cp -a "$APP/src" "$APP/src.bak.$STAMP"
rm -rf "$APP/src" "$APP/public"
cp -a "$NEW/src" "$NEW/index.html" "$NEW/package.json" "$NEW/package-lock.json" \
      "$NEW/tsconfig.json" "$NEW/vite.config.ts" "$APP/"
[ -d "$NEW/public" ] && cp -a "$NEW/public" "$APP/"
mkdir -p "$APP/supabase/migrations" && cp "$NEW/$MIGRATION" "$APP/supabase/migrations/"
cd "$APP"
npm ci --silent
npm run build 2>&1 | grep -E 'built in|error' || true
test -f dist/index.html || { echo "       BUILD FAILED - site unchanged."; exit 1; }

echo "[5/7] Swapping in the new build..."
rm -rf "$WEB.new" && cp -a dist "$WEB.new"
rm -rf "$WEB.old" && mv "$WEB" "$WEB.old" && mv "$WEB.new" "$WEB"
echo "       OK (previous build kept in $WEB.old)"

echo "[6/7] Server config (backup script, Caddy)..."
# Backup script: the old one left empty dumps when pg_dump failed (cron runs it at 03:00)
cp "$APP/deploy/production/backup.sh" "$APP/deploy/production/backup.sh.bak.$STAMP"
install -m 755 "$NEW/server/backup.sh" "$APP/deploy/production/backup.sh"
echo "       backup.sh updated"

cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$STAMP
cp "$NEW/server/Caddyfile" /etc/caddy/Caddyfile
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy && echo "       OK"
else
  cp /etc/caddy/Caddyfile.bak.$STAMP /etc/caddy/Caddyfile
  echo "       Caddyfile invalid - restored the old one."
fi
REMOTE

echo "[7/7] Smoke tests (via the public HAProxy)..."
check() { printf '       %-34s %s\n' "$1" "$(curl -s -o /dev/null -w '%{http_code}' "${@:2}")"; }
check "App /                  (200)"      https://gym.stusta.de/
check "App /calendar          (200)"      https://gym.stusta.de/calendar
check "App /auth/callback     (200)"      https://gym.stusta.de/auth/callback
check "Auth health no key     (401)"      https://gym.stusta.de/auth/v1/health
check "Studio via Upgrade hdr (200=SPA)"  -H 'Connection: Upgrade' -H 'Upgrade: websocket' https://gym.stusta.de/api/platform/profile
check "Missing asset          (404)"      https://gym.stusta.de/assets/does-not-exist.js
curl -sI https://gym.stusta.de/ | grep -iE '^(strict-transport|x-frame|content-security)' | sed 's/^/       /'
echo "Done."
