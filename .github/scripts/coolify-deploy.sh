#!/bin/sh
# Tell Coolify a fresh image is in GHCR. Best effort: the image is already pushed, so a
# failed ping warns instead of failing the build (redeploy by hand in Coolify).
# COOLIFY_WEBHOOK: the app's Deploy Webhook URL, http://<host>:8000/api/v1/deploy?uuid=<uuid>&force=false
# COOLIFY_TOKEN:   a Coolify API token with deploy permission (the webhook is auth-required)
# POST: since Coolify 4.5 a GET on /api/v1/deploy answers 405 "This endpoint has changed to a
# POST request". uuid and force still ride in the query string.
code=$(curl -sS -X POST -o /tmp/coolify_resp -w '%{http_code}' \
  ${COOLIFY_TOKEN:+-H "Authorization: Bearer $COOLIFY_TOKEN"} \
  "$COOLIFY_WEBHOOK") || true
echo "Coolify responded HTTP ${code:-000}"
cat /tmp/coolify_resp 2>/dev/null || true
echo
case "${code:-000}" in
  2*)  echo "Coolify accepted the deploy." ;;
  405) echo "::warning::Coolify returned 405: it wants a different HTTP method. The image is in GHCR; redeploy in Coolify." ;;
  401) echo "::warning::Coolify returned 401: set the COOLIFY_TOKEN secret. The image is in GHCR; redeploy in Coolify." ;;
  *)   echo "::warning::Coolify deploy trigger returned HTTP ${code:-000}. The image is in GHCR; redeploy in Coolify." ;;
esac
