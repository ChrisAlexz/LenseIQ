# Deploying LenseIQ to Oracle Cloud (Always Free, HTTPS)

Oracle Cloud's **Always Free** tier gives an ARM **Ampere A1** VM with up to
**4 cores / 24 GB RAM** — free forever, and plenty for this stack. Everything
runs with the same Docker Compose setup; only the instance creation and
firewall differ from AWS.

> ARM note: the app builds and runs natively on ARM (all base images and Python
> wheels have arm64 builds). No code changes needed.

## 1. Sign up

Create an account at <https://www.oracle.com/cloud/free/>. A credit card is
required for verification, but Always Free resources are never charged. Pick a
home region close to you (you can't change it later).

## 2. Create the ARM instance

Console → **☰ Menu → Compute → Instances → Create instance**:

| Setting | Value |
| --- | --- |
| Image | **Canonical Ubuntu 24.04** |
| Shape | **Ampere → VM.Standard.A1.Flex**, set **4 OCPUs** and **24 GB** memory (all free) |
| Boot volume | Expand "Specify a custom boot volume size" → **100 GB** (Always Free includes up to 200 GB block storage) |
| SSH keys | **Generate a key pair** and download both files, or paste your existing public key |
| Networking | Leave default (it creates a VCN with a public subnet) |

Click **Create**.

> **"Out of host capacity" error?** Free ARM instances are in high demand. Just
> retry every few minutes, try a different Availability Domain in the create
> form, or change region. It usually succeeds within a few tries.

When it's running, copy the instance's **Public IP address**.

> Optional but recommended: reserve the IP so it survives a stop/terminate.
> Instance details → Attached VNICs → click the VNIC → IPv4 Addresses → edit the
> public IP → **Reserved**.

## 3. Open the firewall (TWO layers — this is the #1 gotcha)

Oracle blocks ports in **two** places. You must open 80 and 443 in **both**.

**Layer 1 — Cloud Security List:**
Instance details → **Virtual Cloud Network** link → **Security Lists** →
**Default Security List** → **Add Ingress Rules**, add two:

| Source CIDR | IP Protocol | Destination Port |
| --- | --- | --- |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

(Port 22 is already open by default.)

**Layer 2 — the VM's own iptables** (Ubuntu on OCI ships with a default-deny
firewall). SSH in first:

```bash
ssh -i /path/to/key.pem ubuntu@<PUBLIC-IP>
```

Then open the ports and persist:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(If `dig`/cert issuance later fails to reach the server, it's almost always
this step — double-check with `sudo iptables -L INPUT --line-numbers` that the
two ACCEPT rules sit **above** the final `REJECT all` rule.)

## 4. Point the domain at the server (IONOS DNS)

IONOS → **Domains & SSL → lenseiq.app → DNS**, add two A records → your Oracle
public IP:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | your Oracle public IP |
| A | `www` | your Oracle public IP |

Verify before continuing (Let's Encrypt needs this to resolve):

```bash
dig +short lenseiq.app      # should print your Oracle IP
```

## 5. Install Docker

On the instance:

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

(The `$(dpkg --print-architecture)` automatically picks the arm64 repo.)

## 6. Get the code + secrets

```bash
git clone https://github.com/ChrisAlexz/LenseIQ.git
cd LenseIQ

cp .env.production.example .env
nano .env        # fill in the REPLACE_WITH_* values
```

Fill in your real secrets: `SECRET_KEY` (`openssl rand -hex 32`),
`DB_PASSWORD`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `SMTP_PASS`. Domain values
are already set for `lenseiq.app`.

## 7. Get TLS certificates (one time)

With DNS resolving to the server:

```bash
./init-letsencrypt.sh
```

## 8. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes a while (Go + npm + pip, all on ARM). Then open
**https://lenseiq.app** 🎉

Check status / logs:

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
- **Data persists**: Postgres volume + `backend/storage` / `backend/outputs`.
- **It's free** — but don't terminate the instance casually; reserve the public
  IP (step 2) so you don't lose it, and snapshot the boot volume for backups.
