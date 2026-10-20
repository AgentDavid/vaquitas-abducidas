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
