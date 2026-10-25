// Configuración del CRM de Elektra, servida en /crm-config. Caddy la rellena (directiva templates del Caddyfile)
// con las variables CRM_API_URL y CRM_GAME_KEY del servicio en Railway. Servida sin Caddy queda tal cual
// y crm.js la ignora: el juego funciona igual, sin premios.
window.CRM_CONFIG = { apiUrl: '{{env "CRM_API_URL" | js}}', gameKey: '{{env "CRM_GAME_KEY" | js}}' };
