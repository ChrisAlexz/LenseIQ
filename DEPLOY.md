# Deploying LenseIQ to EC2 (lenseiq.vip, HTTPS)

Production runs the whole stack with Docker Compose behind an nginx reverse
proxy that terminates TLS (Let's Encrypt). Everything below happens on a fresh
Ubuntu EC2 instance.

## 1. Launch the EC2 instance

AWS Console → EC2 → **Launch instance**:

| Setting | Value |
| --- | --- |
| AMI | **Ubuntu Server 24.04 LTS** |
| Instance type | **t3.xlarge** (4 vCPU / 16 GB) — ffmpeg clip generation is CPU-heavy. `t3.large` works but is slower. |
| Key pair | Create one, download the `.pem`, keep it safe. |
| Storage | **40 GB gp3** (videos + outputs + docker images). |
| Security group | Inbound rules below. |

**Security group inbound rules:**

| Type | Port | Source |
| --- | --- | --- |
| SSH | 22 | **My IP** (just you) |
| HTTP | 80 | Anywhere (0.0.0.0/0) — needed for the cert challenge + redirect |
| HTTPS | 443 | Anywhere (0.0.0.0/0) |

Do **not** open 5432 / 8001 / 3001 — those stay internal to the docker network.

After it launches, note the instance's **Public IPv4 address** (e.g. `3.91.x.x`).
Allocate an **Elastic IP** and associate it so the IP doesn't change on reboot.

## 2. Point the domain at the server (IONOS DNS)

In the IONOS control panel → **Domains → lenseiq.vip → DNS**, add:

| Type | Host name | Value |
| --- | --- | --- |
| A | `@` | your EC2 Elastic IP |
| A | `www` | your EC2 Elastic IP |

DNS can take a few minutes to a couple of hours. Verify before continuing:

```bash
dig +short lenseiq.vip      # should print your EC2 IP
```

> The Let's Encrypt step **will fail** until the domain resolves to the server,
> so wait for `dig` to return the right IP first.

## 3. Install Docker on the server

SSH in:

```bash
ssh -i /path/to/key.pem ubuntu@<EC2-IP>
```

Install Docker + the compose plugin:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# run docker without sudo (log out/in afterwards for it to take effect)
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Get the code + secrets

```bash
git clone https://github.com/ChrisAlexz/LenseIQ.git
cd LenseIQ

cp .env.production.example .env
nano .env        # fill in the REPLACE_WITH_* values
```

Fill `.env` with your real secrets (same ones from local dev):
`SECRET_KEY` (run `openssl rand -hex 32`), `DB_PASSWORD`, `GEMINI_API_KEY`,
`DEEPGRAM_API_KEY`, `SMTP_PASS` (Gmail app password). The domain values
(`CORS_ORIGINS`, `FRONTEND_URL`) are already set for `lenseiq.vip`.

## 5. Get TLS certificates (one time)

With DNS resolving to the server:

```bash
./init-letsencrypt.sh
```

This stands nginx up with a temporary cert, then swaps in a real Let's Encrypt
cert for `lenseiq.vip` + `www.lenseiq.vip`. (To test the flow without hitting
rate limits, set `staging=1` inside the script first, run it, confirm it works,
then set it back to `0` and rerun.)

## 6. Launch everything

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes several minutes (Go binary + npm build + pip install).
Check status / logs:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Then open **https://lenseiq.vip** 🎉

## Updating after a code change

```bash
cd ~/LenseIQ
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Notes / gotchas

- **`.app` is HTTPS-only** (HSTS preload). The site won't load over plain HTTP
  at the domain — that's expected; nginx redirects 80→443 automatically.
- **Certs auto-renew**: the `certbot` container renews every 12h and nginx
  reloads every 6h. No cron needed.
- **Data persists** across restarts: Postgres in the `postgres_data` volume,
  uploads/outputs in `backend/storage` + `backend/outputs` (bind mounts).
- **Backups**: snapshot the EBS volume periodically, or `pg_dump` the DB.
- **Disk fills up** from old uploads/outputs over time — clear
  `backend/storage/videos` and `backend/outputs/*` when needed.
