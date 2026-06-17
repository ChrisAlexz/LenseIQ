#!/bin/bash
# One-time Let's Encrypt bootstrap for the production nginx stack.
#
# Run this ONCE on the EC2 host, AFTER:
#   - DNS for lenseiq.vip + www.lenseiq.vip points at this server, and
#   - your .env exists.
#
# It creates a temporary self-signed cert so nginx can start, then swaps it
# for a real Let's Encrypt cert via the HTTP-01 challenge. After this, the
# certbot container in docker-compose.prod.yml auto-renews.
set -e

domains=(lenseiq.vip www.lenseiq.vip)
email="lenseiqsupport@gmail.com"   # used by Let's Encrypt for renewal/security notices
staging=0                          # set to 1 to test without hitting LE rate limits

compose="docker compose -f docker-compose.prod.yml"
data_path="./certbot"
primary="${domains[0]}"

if [ -d "$data_path/conf/live/$primary" ]; then
  read -p "Existing certificate for $primary found. Replace it? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Creating temporary self-signed certificate for $primary ..."
live_path="/etc/letsencrypt/live/$primary"
mkdir -p "$data_path/conf/live/$primary"
$compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$live_path/privkey.pem' \
    -out '$live_path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
$compose up --force-recreate -d nginx

echo "### Removing temporary certificate ..."
$compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$primary && \
  rm -Rf /etc/letsencrypt/archive/$primary && \
  rm -Rf /etc/letsencrypt/renewal/$primary.conf" certbot

echo "### Requesting Let's Encrypt certificate for ${domains[*]} ..."
domain_args=""
for d in "${domains[@]}"; do
  domain_args="$domain_args -d $d"
done

if [ -z "$email" ]; then
  email_arg="--register-unsafely-without-email"
else
  email_arg="--email $email"
fi

staging_arg=""
if [ "$staging" != "0" ]; then
  staging_arg="--staging"
fi

$compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg $email_arg $domain_args \
    --rsa-key-size 2048 --agree-tos --no-eff-email --force-renewal" certbot

echo "### Reloading nginx ..."
$compose exec nginx nginx -s reload

echo "### Done. https://$primary should now be live."
