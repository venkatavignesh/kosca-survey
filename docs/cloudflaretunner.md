# Expose Kosca Survey via a Domain — Cloudflare Tunnel vs Nginx

## Context

The Kosca Survey app runs in Docker on an **office machine with a static
public IP**, behind a router. It binds to `localhost:3002` on the host (the
Next.js standalone server inside the container listens on `:3000`). Service
name in compose is `app`; container name is `kosca_survey`. The app shares
the existing `kosca_ar_system_default` Docker network so it can reach
`kosca_db:5432`. The user owns a domain (not yet on Cloudflare DNS) and
wants:

- staff (admin / HR) to reach the dashboard from anywhere
- employees to click the unique survey URL in their email and confirm OTP

With a static IP, **both Cloudflare Tunnel and Nginx are real options.**
They trade off differently:

| Concern | Cloudflare Tunnel | Nginx + Let's Encrypt |
|---|---|---|
| Works with your setup | ✅ | ✅ (you have static IP) |
| Opens inbound ports on your router | ❌ no port-forward needed | ✅ must forward 80 + 443 |
| TLS cert | ✅ auto, at Cloudflare edge | ✅ auto via `certbot --nginx` (Let's Encrypt) |
| Origin IP exposed | ❌ hidden | ✅ public (your ISP-assigned IP is the A record) |
| DDoS / bot protection | ✅ free, built in | ❌ you absorb it |
| WAF / rate limiting at edge | ✅ free tier | ❌ you configure in Nginx |
| Third-party dependency | Cloudflare in the data path | None — direct client → your box |
| Setup time | ~1 hr (incl. DNS move) | ~1–2 hrs (router port-forward + certbot + nginx conf) |
| Requires DNS at Cloudflare | ❌ no — one CNAME at your existing provider is enough | ❌ no — keep existing DNS provider |
| Cost | Free | Free |

**Recommendation: Cloudflare Tunnel.** A survey app is sent out via email
links; the moment the email lands in someone's inbox, the URL becomes
"public-ish" — Google's link previewers, mail-server URL scanners, and
phishing-defence bots all hit it. "Origin IP hidden + free WAF + free DDoS
protection" beats "no third-party dependency" for that load profile. Nginx
is a fully legitimate choice if you'd rather keep Cloudflare out of the
data path.

Either way, the app-side change (`NEXTAUTH_URL` + `APP_URL` set to the
HTTPS domain) is the same — only the ingress layer differs.

## Recommended Approach — Cloudflare Tunnel

### Step 0 — DNS setup (subdomain-only, keep parent domain where it is)

You do **not** have to move your whole domain's DNS to Cloudflare. Two
options — pick one:

#### Option A: CNAME at your existing DNS provider (simplest) ⭐

Works for one or a few hostnames. No nameserver changes anywhere.

1. Create a free Cloudflare account.
2. Skip "Add a site" — go directly to **Zero Trust** → Networks → Tunnels
   and create the tunnel (covered in Step 1 below).
3. After the tunnel exists, Cloudflare gives it a hostname like
   `<tunnel-uuid>.cfargotunnel.com`.
4. At **your current DNS provider**, create a CNAME:

   ```
   surveys.kosca.in.  CNAME  <tunnel-uuid>.cfargotunnel.com.
   ```

5. That's it. Traffic to `surveys.kosca.in` resolves to Cloudflare's edge,
   enters your tunnel, and reaches the `kosca_survey` container. Your
   parent domain's DNS stays untouched.

**Caveat for the dashboard flow:** Cloudflare's "Public Hostnames" UI
normally auto-creates the DNS record, but only if the zone is on
Cloudflare. Since yours isn't, you create the CNAME manually at your DNS
provider — the tunnel side still works identically.

#### Option B: Subdomain delegation (cleaner if you want many hosts)

Delegate just the `surveys` subdomain to Cloudflare via NS records.
Everything under `surveys.kosca.in` is then managed by Cloudflare; the
rest of `kosca.in` stays where it is.

1. In Cloudflare, **Add a site** → enter `surveys.kosca.in` as the zone.
   Cloudflare treats it as its own zone and shows you 2 nameservers.
2. At **your current DNS provider** (for `kosca.in`), add:

   ```
   surveys  NS  xxx1.ns.cloudflare.com.
   surveys  NS  xxx2.ns.cloudflare.com.
   ```

3. Cloudflare now manages DNS for `surveys.kosca.in`. Root and other
   subdomains are unaffected.
4. DNS records auto-created by the tunnel dashboard will now work.

**Recommendation:** use Option A. One CNAME, no subdomain zone to manage.
Only use Option B if you expect several hosts under `surveys.*`.

### Step 1 — Create the tunnel

Cloudflare dashboard → **Zero Trust** → Networks → Tunnels → **Create a
tunnel** → name it `kosca-survey` → choose **Docker** connector → copy the
token Cloudflare generates. Save it — you'll paste it into `.env` in the
next step.

### Step 2 — Add `cloudflared` to compose

Append one service to [`docker-compose.yml`](../docker-compose.yml):

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: kosca_survey_cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
    networks:
      - default
```

Add to [`.env`](../.env) (not committed):
```
CLOUDFLARE_TUNNEL_TOKEN=<paste token from Step 1>
```

`cloudflared` reaches the `app` service over the internal compose network.
You do **not** need to publish port 3002 to the host once the tunnel is
working, though leaving it for LAN access is fine.

### Step 3 — Route the hostname to the app

Back in the Cloudflare tunnel dashboard, under **Public Hostnames** for
this tunnel, add:

- **Subdomain:** `surveys`
- **Domain:** `kosca.in`
- **Service type:** `HTTP`
- **URL:** `app:3000`    ← compose service name + internal container port

If you used Option B, Cloudflare auto-creates the DNS record. If you used
Option A, you've already added the CNAME manually in Step 0.

### Step 4 — App-side fixes for HTTPS behind a proxy

Two things need to change in [`.env`](../.env) so cookies and email links
all match the public URL:

```
APP_URL=https://surveys.kosca.in
NEXTAUTH_URL=https://surveys.kosca.in
```

Why:

- **`APP_URL`** is rendered into invitation emails as the
  `${APP_URL}/survey/${token}` link. If it stays `http://192.168.2.222:3002`
  every email recipient hits the LAN IP and fails.
- **`NEXTAUTH_URL`** controls the cookie domain and the post-login redirect
  origin. NextAuth marks session cookies `Secure` automatically when this
  is `https://...` — required by the browser when the site is served over
  HTTPS.

Optional but recommended for Next 16 dev mode (does **not** affect prod):
keep [`next.config.js`](../next.config.js)'s `allowedDevOrigins` updated if
you also access the dev URL from new networks.

Next.js standalone reads `X-Forwarded-Proto` / `X-Forwarded-For` correctly
on its own — there's no Express-style `trust proxy` toggle to flip. The
proxy headers Cloudflare sends just work.

After editing `.env`, **force-recreate** (a plain `restart` does not re-read
the env file — the running container will keep the old `NEXTAUTH_URL` and
post-login redirects will bounce back to the previous hostname):

```bash
docker compose up -d --force-recreate app
```

### Step 5 — Deploy the tunnel

```bash
cd /home/koscait/survey
docker compose up -d cloudflared
```

### Files to touch
- [`docker-compose.yml`](../docker-compose.yml) — add the `cloudflared` service.
- [`.env`](../.env) — set `APP_URL` + `NEXTAUTH_URL` to `https://surveys.kosca.in`, add `CLOUDFLARE_TUNNEL_TOKEN`.
- (No source code changes needed.)

## On Cloudflare Access (skipping it for /survey/*, optional for /admin and /hr)

External employees click their unique survey link from email, so the
public survey routes (`/survey/*`) **must not** sit behind Zero Trust
Access — that would force employees through Cloudflare SSO before they
ever reach the OTP page. The app's existing per-employee token + emailed
OTP is the auth boundary for those routes.

For the staff side, you have a free hardening option:

- Put a Zero Trust **Access** policy on `surveys.kosca.in/admin/*` and
  `surveys.kosca.in/hr/*` that requires email-OTP to a list of staff
  addresses (e.g. `*@kosca.in`).
- The next-auth login still applies after — it's defence-in-depth, not a
  replacement.
- Survey pages (`/survey/*`, `/api/survey/*`, `/api/auth/*`) stay open.

That gives you "anyone with a kosca.in email can attempt admin login;
nobody else can even see the page." Not required, but a five-minute lift
that pays off if the URL leaks.

## Alternative Approach — Nginx + Let's Encrypt (direct)

Use this if you'd rather keep DNS at your current registrar and not put
Cloudflare in the data path. You absorb DDoS / bot traffic yourself.

### Step A — DNS

At your current DNS provider, create an A record:

- `surveys.kosca.in` → `<your static public IP>`
- TTL: 300

### Step B — Router port forwarding

On the router admin panel, forward:

- External TCP `80`  → internal IP of this Docker host, port `80`
- External TCP `443` → internal IP of this Docker host, port `443`

Give the Docker host a **static LAN IP** (DHCP reservation) so the
forwards survive reboots.

### Step C — Bind the survey container to localhost only

Edit [`docker-compose.yml`](../docker-compose.yml):

```yaml
  app:
    ports:
      - "127.0.0.1:3002:3000"
```

That stops the survey app from listening on the LAN IP — only Nginx (on
the host) can reach it.

### Step D — Install Nginx + certbot on the host

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step E — Nginx reverse-proxy config

Create `/etc/nginx/sites-available/kosca-survey`:

```nginx
server {
    listen 80;
    server_name surveys.kosca.in;

    client_max_body_size 5M;  # CSV employee imports

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/kosca-survey /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step F — Issue TLS

```bash
sudo certbot --nginx -d surveys.kosca.in
```

Certbot edits the Nginx config to add `listen 443 ssl`, drops in the
Let's Encrypt cert, and sets up an HTTP→HTTPS redirect. Auto-renewal is
installed as a systemd timer (`certbot.timer`).

### Step G — Same app-side fixes as Cloudflare path

In [`.env`](../.env):

```
APP_URL=https://surveys.kosca.in
NEXTAUTH_URL=https://surveys.kosca.in
```

Then `docker compose up -d --force-recreate app`.

### Files to touch (Nginx path)

- `/etc/nginx/sites-available/kosca-survey` — new file.
- [`docker-compose.yml`](../docker-compose.yml) — bind port to `127.0.0.1` only.
- [`.env`](../.env) — set `APP_URL` + `NEXTAUTH_URL` to `https://surveys.kosca.in`.
- Router admin panel — port-forward 80/443.
- DNS provider — A record for `surveys.kosca.in`.

### Hardening to add on this path

Since your origin IP is now public, bolt these on before going live:

- **UFW firewall** on the host: allow only 22 (SSH, ideally key-only), 80, 443.
- **fail2ban** for SSH and Nginx 401/403 floods.
- **Nginx rate limiting** on `/api/auth/callback/credentials`,
  `/api/survey/*/confirm`, and `/api/survey/*/request-code`
  (`limit_req_zone`) — to blunt credential-stuffing on the staff login and
  OTP brute-force on the survey side. The app already rate-limits OTP per
  token (5 attempts) and per request-code resend (30s cooldown), but edge
  rate limits are cheaper than Node-level ones for high-volume floods.
- Keep the system patched — `unattended-upgrades`.

None of this is needed with Cloudflare Tunnel because the edge handles it.

## Verification

### Cloudflare Tunnel path

1. `docker compose logs -f cloudflared` — look for `Registered tunnel connection` (usually 4 connections to different Cloudflare edge POPs). If it errors on token, the env var isn't being read.
2. `curl -I https://surveys.kosca.in/login` from any machine — expect `HTTP/2 200` and a valid cert chain.
3. From a phone on **mobile data** (not your office Wi-Fi, to prove it's not hitting the LAN), open `https://surveys.kosca.in/login` and sign in as `it@kosca.in`. Land on the change-password / dashboard.
4. As admin, create a tiny test campaign with one recipient (yourself) and click **Send invitations**. The email link should be `https://surveys.kosca.in/survey/<token>` — not the LAN IP. Open it on the phone, request a code, paste, submit.
5. As admin, view the response in `/admin/campaigns/[id]/responses/[employeeId]`. If you see your answer, the cookie + URL pipeline is correct.
6. In `docker compose logs app`, verify request log lines show real client IPs (e.g. mobile carrier IPs), not Cloudflare `172.x` ranges. If they're Cloudflare's, that just means we're not surfacing `CF-Connecting-IP` anywhere — fine for a survey app, but if you want real IPs in audit logs, surface that header in `proxy.ts`.
7. Kill the tunnel (`docker compose stop cloudflared`) and confirm `surveys.kosca.in` goes down — proves traffic is really flowing through the tunnel and not falling back to a direct A record.

### Nginx path

1. `curl -I http://surveys.kosca.in` from a non-LAN network — expect `301` redirect to HTTPS after certbot.
2. `curl -I https://surveys.kosca.in/login` — `HTTP/2 200` with a Let's Encrypt cert (`Issuer: R3` / `R10`).
3. `sudo certbot renew --dry-run` — confirms auto-renewal works.
4. `sudo nginx -T | grep -E 'proxy_pass|server_name'` — verify config matches.
5. Same end-to-end check as Cloudflare path: send yourself an invitation, complete it on a phone over mobile data, confirm the response shows up in admin / HR.
6. From an outside network, try connecting directly to `<static-ip>:3002` — should **fail** (port now bound to 127.0.0.1). Only 80/443 should be reachable.
7. `sudo systemctl status fail2ban` (if installed) — active and either banning nothing or already catching probes.
