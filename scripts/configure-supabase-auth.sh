#!/usr/bin/env bash
# Configure Supabase Auth for the Dose Club signup flow:
#   - site_url         → doseclub:// (deep link back into the app)
#   - uri_allow_list   → adds doseclub://** (merged with existing entries)
#   - confirmation email subject + branded template
#
# Requires a Supabase personal access token (https://supabase.com/dashboard/account/tokens):
#   SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/configure-supabase-auth.sh
set -euo pipefail

PROJECT_REF="lfoalaodlepdjqebvdga"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "error: set SUPABASE_ACCESS_TOKEN (create one at https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi

current=$(curl -sf -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "$API")

body=$(python3 - "$current" <<'PY'
import json, sys

current = json.loads(sys.argv[1])

# Merge doseclub://** into the existing allow list instead of overwriting it.
allow = [u.strip() for u in (current.get("uri_allow_list") or "").split(",") if u.strip()]
for url in ("doseclub://**",):
    if url not in allow:
        allow.append(url)

template = """<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#2b1d12;">
  <h1 style="font-size:26px;margin:0 0 4px;">Dose Club</h1>
  <p style="font-size:14px;color:#8a7360;margin:0 0 24px;">Trade doses, not whole bags.</p>
  <h2 style="font-size:20px;margin:0 0 12px;">Confirm your email</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
    Welcome to Dose Club! Tap the button below on your phone to confirm your
    email — it will open the app and sign you in.
  </p>
  <p style="margin:0 0 24px;">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#2b1d12;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px;">
      Confirm email &amp; open Dose Club
    </a>
  </p>
  <p style="font-size:13px;color:#8a7360;line-height:1.5;margin:0;">
    If you didn't create a Dose Club account, you can safely ignore this email.
  </p>
</div>"""

print(json.dumps({
    "site_url": "doseclub://",
    "uri_allow_list": ",".join(allow),
    "mailer_subjects_confirmation": "Confirm your Dose Club account ☕",
    "mailer_templates_confirmation_content": template,
}))
PY
)

curl -sf -X PATCH "$API" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$body" >/dev/null

echo "done. site_url, redirect allow list, and confirmation email updated for ${PROJECT_REF}."
