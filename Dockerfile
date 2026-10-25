FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacidad.html sw.js manifest.webmanifest crm.js crm-config.js /srv/
COPY vendor /srv/vendor
COPY fonts /srv/fonts
COPY icons /srv/icons
COPY .well-known /srv/.well-known
