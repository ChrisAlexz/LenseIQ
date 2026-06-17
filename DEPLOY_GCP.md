# Deploying LenseIQ to Google Cloud (free $300 trial, HTTPS)

New Google Cloud accounts get **$300 in credits for 90 days**, which covers a
properly-sized VM running the full stack for free. This uses the same Docker
Compose + nginx + Let's Encrypt setup as the other guides — only the VM
creation and firewall differ (and GCP's are simpler than Oracle's).

> GCP VMs are x86_64 (amd64), so the build is straightforward — no ARM notes.
> Trial credit won't auto-charge you when it ends unless you manually upgrade.

## 1. Sign up + start the free trial

Go to <https://cloud.google.com/free> → **Get started for free**. A credit card
is required for verification; you get **$300 / 90 days** and are not charged
unless you explicitly upgrade to a paid account.

Create a project (e.g. `lenseiq`) when prompted.

## 2. Create the VM

Console → **☰ → Compute Engine → VM instances → Create instance**
(enable the Compute Engine API if asked, takes ~1 min):

| Setting | Value |
| --- | --- |
| Name | `lenseiq` |
| Region / Zone | pick one close to you (e.g. `us-central1` / `us-central1-a`) |
| Machine type | **E2 → e2-medium** (2 vCPU, 4 GB) — comfortably within credit. Use `e2-standard-2` (8 GB) for more build headroom. |
| Boot disk | click **Change** → **Ubuntu** → **Ubuntu 24.04 LTS (x86/64)**, size **50 GB** |
| Firewall | ✅ **Allow HTTP traffic** and ✅ **Allow HTTPS traffic** |

Before clicking Create, reserve a **static IP** so it survives reboots:
**Advanced options → Networking → Network interfaces** (click the default one) →
**External IPv4 address** → **Reserve static external IP address** → give it a
name → Done.

Click **Create**. When it's running, note the **External IP**.

## 3. Point the domain at the server (IONOS DNS)

IONOS → **Domains & SSL → lenseiq.app → DNS**, add two A records → your static IP:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | your GCP static IP |
| A | `www` | your GCP static IP |

Verify before the cert step:

```bash
dig +short lenseiq.app      # should print your GCP IP
```

## 4. Connect to the VM

Easiest: in the VM instances list, click the **SSH** button next to your
instance — it opens a terminal in the browser (no key setup needed). Run all the
commands below there.

(Alternative from your Mac, if you have the gcloud CLI:
`gcloud compute ssh lenseiq --zone us-central1-a`.)

## 5. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

### (Recommended) add a 2 GB swap file so builds don't run out of memory

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 6. Get the code + secrets

```bash
git clone https://github.com/ChrisAlexz/LenseIQ.git
cd LenseIQ

cp .env.production.example .env
nano .env        # fill in the REPLACE_WITH_* values
```

Fill in your real secrets: `SECRET_KEY` (`openssl rand -hex 32`), `DB_PASSWORD`,
`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `SMTP_PASS`. The domain values are already
set for `lenseiq.app`.

## 7. Get TLS certificates (one time)

With DNS resolving to the server:

```bash
./init-letsencrypt.sh
```

## 8. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes several minutes. Then open **https://lenseiq.app** 🎉

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

## Updating after a code change

```bash
cd ~/LenseIQ && git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Notes

- **`.app` is HTTPS-only** (HSTS preload) — nginx redirects 80→443; the cert
  must exist before the domain loads in a browser.
- **Certs auto-renew** (certbot every 12h, nginx reloads every 6h).
- **Cost**: free under the $300 trial credit (~$25/mo for e2-medium, so the
  credit lasts the full 90 days). Watch **Billing → Reports**. To avoid any
  charge after the trial, **stop or delete the VM** before the credit expires.
- **Data persists**: Postgres volume + `backend/storage` / `backend/outputs`.
