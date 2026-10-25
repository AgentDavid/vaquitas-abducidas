# vaquitas-abducidas

Juego arcade en pixel art: defiende a las vaquitas de una flota de ovnis con tu camión lechero.
Funciona en navegador (PC y celular) y se puede instalar como app (PWA).

## Jugar en local

Cualquier servidor estático sirve. Por ejemplo:

```bash
python -m http.server 8765
```

y abre http://localhost:8765

## Controles

- **PC:** flechas o A/D para moverte, Espacio para disparar, P para pausa, M para sonido.
- **Celular:** botones en pantalla (◀ ▶ FUEGO).

## Estructura

- `index.html`: todo el juego (canvas + JavaScript, sin dependencias).
- `sw.js`: service worker para jugar sin conexión. Sube `VERSION` en cada publicación.
- `manifest.webmanifest` e `icons/`: datos para instalar como app.
- `privacidad.html`: política de privacidad (la pide Google Play).
- `.well-known/assetlinks.json`: vincula el sitio con la app de Android (TWA). Lleva el package ID y las huellas SHA-256 de la firma.
- `Dockerfile` y `Caddyfile`: servidor estático para el despliegue en Railway.
- `crm.js`, `crm-config.js` y `vendor/crm-games.js`: programa de premios de Elektra (ver abajo).
- `fonts/`: letra pixel para los textos HTML (panel de premios, registro, privacidad).
  `vaquitas-pixel.woff2` es la misma fuente 5x7 del canvas; se genera desde `FONT_SRC` con
  `python tools/pixel-font.py` (requiere `pip install fonttools brotli`); vuelve a correrlo si
  cambias la fuente y sube el `?v=` de su URL en `crm.js`, `privacidad.html` y `sw.js` (Cloudflare
  la guarda horas). En la fuente web `@` es una arroba, no el corazón del juego.
  `vt323.woff2` (licencia OFL) es solo para lo que escribe el jugador en el registro, porque
  tiene minúsculas y acentos.

## Programa de premios Elektra (CRM)

El juego se conecta al CRM de videojuegos (repo `crm_videogames`, contrato en
`docs/integraciones/game-api-v1.md`):

- **Entra al juego**: al abrir se crea una sesión con el `?src=` del QR, la campaña o la TV.
- **Ve un insert**: al perder el último camión se ofrece seguir con una vida extra; si no
  hay, se ofrece un video de Elektra. El botón **PREMIOS** (inicio y fin del juego, o la
  tecla R) muestra el saldo y permite ver videos y registrarse.
- **Gana recompensa**: el CRM decide si el video paga (visto completo, tope diario) y si
  da puntos o vidas extra. Las vidas extra que se gastan se cuentan en el dispositivo.
- **Se registra**: formulario con aviso de privacidad (`privacidad.html`, versión
  `2026-10`) y opt-in de promociones.

La configuración viene de dos variables del servicio en Railway, que Caddy escribe en la
plantilla `crm-config.js` y sirve en `/crm-config` (sin extensión, para que Cloudflare no la cachee):

```
CRM_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
CRM_GAME_KEY=gk_vaquitas_…   # panel del CRM → Juegos → Rotar llave
```

Sin ellas (o sin internet) todo lo del programa se oculta y el juego funciona igual. En
local, sin Caddy, se puede probar con
`localStorage.vaquitasCrmConfig = '{"apiUrl":"…","gameKey":"gk_…"}'`.

`vendor/crm-games.js` es el build IIFE de `packages/game-sdk`; si cambia el SDK, cópialo de
nuevo desde `packages/game-sdk/dist/crm-games.global.js`.
