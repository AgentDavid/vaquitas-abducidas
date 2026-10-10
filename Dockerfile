FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html sw.js manifest.webmanifest /srv/
COPY icons /srv/icons
