FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacidad.html sw.js manifest.webmanifest /srv/
COPY icons /srv/icons
COPY .well-known /srv/.well-known
