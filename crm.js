// Programa de premios Elektra: conecta el juego con el CRM (API pública v1; el contrato está en
// crm_videogames/docs/integraciones/game-api-v1.md). Abre la sesión con el ?src= del QR, reproduce
// los videos de Elektra (inserts) que dan puntos o vidas extra y registra al jugador (opt-in).
// La interfaz es HTML encima del canvas. Sin configuración o sin internet todo queda oculto y el
// juego sigue igual. El juego lo usa por window.VaquitasCRM.
(() => {
'use strict';

const CONSENT_VERSION = '2026-10';          // versión del aviso de privacidad (privacidad.html)
const TIMEOUT_MS = 10000;
const STALL_MS = 20000;                     // video detenido tanto tiempo = error
const NO_VIDEO_MS = 10 * 60 * 1000;         // tras un "no hay videos" no se vuelven a ofrecer en 10 min
const USED_KEY = 'vaquitasCrmLivesUsed';    // vidas extra ya gastadas en este dispositivo

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

// ======================================================================
//  Textos (español e inglés; el resto de idiomas usa inglés)
// ======================================================================
const TX = {
  es: {
    title: 'Premios Elektra', points: 'Puntos', lives: 'Vidas extra',
    livesHint: 'Las vidas extra te dejan seguir jugando cuando pierdes tu último camión.',
    watch: 'Ver video y ganar', register: 'Registrarme', close: 'Cerrar', cont: 'Continuar', back: 'Volver',
    registered: 'Estás registrado: tus puntos quedan a tu nombre.',
    pitch: 'Regístrate para que tus puntos queden a tu nombre y participar en las promociones de Elektra.',
    loading: 'Cargando video…', tapToPlay: 'Ver video', closeVideo: 'Cerrar video',
    prize: 'Mira el video completo y gana {0}', pts: '+{0} puntos', life1: '+1 vida extra', livesN: '+{0} vidas extra',
    leaveWarn: 'Si cierras el video antes de que termine no ganas el premio.',
    checking: 'Validando tu premio…', won: '¡Ganaste!', noPrize: 'Esta vez no hay premio',
    TOO_EARLY: 'El video no se vio completo.',
    ALREADY_COMPLETED: 'Este video ya se había cobrado.',
    DAILY_CAP: 'Ya ganaste todos los premios de hoy. ¡Vuelve mañana!',
    noVideos: 'No hay videos disponibles por ahora. Vuelve más tarde.',
    videoError: 'No se pudo reproducir el video. Revisa tu conexión e inténtalo de nuevo.',
    netError: 'No hay conexión con Elektra. Inténtalo más tarde.',
    regTitle: 'Registro', name: 'Nombre', email: 'Correo', phone: 'Teléfono (10 dígitos)',
    contactHint: 'Escribe tu correo, tu teléfono o los dos.',
    consent: 'Acepto el <a href="privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a> y que mis datos se guarden para el programa de premios de Elektra.',
    marketing: 'Quiero recibir promociones de Elektra.',
    sending: 'Enviando…', needName: 'Escribe tu nombre.', needContact: 'Escribe tu correo o tu teléfono.',
    needConsent: 'Para registrarte debes aceptar el aviso de privacidad.',
    tooMany: 'Demasiados intentos. Espera unos minutos.',
    welcome: '¡Listo, {0}!', welcomeBack: '¡Hola de nuevo, {0}!', welcomeBody: 'Tus puntos ya quedan a tu nombre.'
  },
  en: {
    title: 'Elektra Rewards', points: 'Points', lives: 'Extra lives',
    livesHint: 'Extra lives let you keep playing when you lose your last truck.',
    watch: 'Watch video and win', register: 'Sign up', close: 'Close', cont: 'Continue', back: 'Back',
    registered: 'You are signed up: your points are saved under your name.',
    pitch: 'Sign up so your points are saved under your name and to join Elektra promotions.',
    loading: 'Loading video…', tapToPlay: 'Watch video', closeVideo: 'Close video',
    prize: 'Watch the whole video and win {0}', pts: '+{0} points', life1: '+1 extra life', livesN: '+{0} extra lives',
    leaveWarn: 'If you close the video before it ends you will not get the prize.',
    checking: 'Checking your prize…', won: 'You won!', noPrize: 'No prize this time',
    TOO_EARLY: 'The video was not watched to the end.',
    ALREADY_COMPLETED: 'This video was already claimed.',
    DAILY_CAP: 'You already won every prize for today. Come back tomorrow!',
    noVideos: 'No videos available right now. Come back later.',
    videoError: 'The video could not be played. Check your connection and try again.',
    netError: 'Cannot reach Elektra. Try again later.',
    regTitle: 'Sign up', name: 'Name', email: 'Email', phone: 'Phone (10 digits)',
    contactHint: 'Enter your email, your phone or both.',
    consent: 'I accept the <a href="privacidad.html" target="_blank" rel="noopener">privacy notice</a> and agree that my data is stored for the Elektra rewards program.',
    marketing: 'I want to receive Elektra promotions.',
    sending: 'Sending…', needName: 'Enter your name.', needContact: 'Enter your email or your phone.',
    needConsent: 'You must accept the privacy notice to sign up.',
    tooMany: 'Too many attempts. Wait a few minutes.',
    welcome: 'All set, {0}!', welcomeBack: 'Welcome back, {0}!', welcomeBody: 'Your points are now saved under your name.'
  }
};
const t = (k, a) => {
  const s = (TX[document.documentElement.lang] || TX.en)[k] ?? TX.en[k];
  return a === undefined ? s : s.replace('{0}', a);
};
const rewardText = r => r.type === 'LIVES' ? (r.amount === 1 ? t('life1') : t('livesN', r.amount)) : t('pts', r.amount);

// ======================================================================
//  Configuración y cliente
// ======================================================================
function readConfig() {
  let cfg = window.CRM_CONFIG || {};
  // En local (sin Caddy): localStorage.vaquitasCrmConfig = '{"apiUrl":"…","gameKey":"gk_…"}'
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    try { cfg = JSON.parse(localStorage.getItem('vaquitasCrmConfig')) || cfg; } catch {}
  }
  const ok = window.CrmGames && /^https?:\/\//.test(cfg.apiUrl || '') && /^gk_/.test(cfg.gameKey || '');
  return ok ? cfg : null;
}
const cfg = readConfig();
const client = cfg && CrmGames.createCrmClient({ apiUrl: cfg.apiUrl, gameKey: cfg.gameKey, storageKey: 'vaquitasDeviceId' });

const withTimeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const S = { online: false, registered: false, points: 0, lives: 0, noVideoUntil: 0, kind: null };
const livesUsed = () => parseInt(store.get(USED_KEY, '0'), 10) || 0;

async function connect() {
  if (!client || S.online) return;
  try {
    await withTimeout(client.startSession());
    S.online = true;
    await refresh();
  } catch {
    // sin internet o CRM caído: se reintenta al recuperar la conexión
  }
}
async function refresh() {
  try {
    const b = await withTimeout(client.getBalance());
    S.registered = b.registered; S.points = b.points; S.lives = b.lives;
  } catch {}
}

// ======================================================================
//  Interfaz (overlay HTML)
// ======================================================================
// Todo con la letra pixel del juego (fonts/vaquitas-pixel.woff2, sale de FONT_SRC con tools/pixel-font.py).
// La fuente mide 8 pixeles por em: a 16 px cada pixel ocupa 2. Lo que escribe el jugador va en VT323
// (pixel con minúsculas y acentos, licencia OFL), a 20 px para que el celular no haga zoom al enfocar.
const PIXEL = `"Vaquitas Pixel","VT323",ui-monospace,monospace`;
const CSS = `
@font-face{font-family:"Vaquitas Pixel";src:url(fonts/vaquitas-pixel.woff2?v=2) format("woff2");font-display:swap}
@font-face{font-family:"VT323";src:url(fonts/vt323.woff2) format("woff2");font-display:swap}
.crm{position:fixed;inset:0;z-index:10;display:flex;padding:16px;overflow-y:auto;background:rgba(4,8,24,.85);
  font:12px/1.5 ${PIXEL};text-transform:uppercase;color:#dfe6ff;-webkit-font-smoothing:none;font-smooth:never;
  -webkit-user-select:text;user-select:text;touch-action:auto}
.crm[hidden]{display:none}
.crm:focus{outline:none}
.crm button,.crm input{font-family:inherit;text-transform:inherit}
.crm h2,.crm b,.crm strong{font-weight:400}   /* sin negrita sintética: emborrona los pixeles */
.crm-card{width:100%;max-width:380px;margin:auto;padding:20px 16px;background:#0b1640;border:2px solid #1f5fd1;
  box-shadow:0 0 0 2px #06123a,0 6px 0 #050a1f}
.crm h2{margin:0 0 16px;text-align:center;font-size:24px;line-height:1.25;color:#ffd84a;text-shadow:2px 2px 0 #050a1f}
.crm p{margin:0 0 12px;color:#c3cdf0}
.crm a{color:#7fd0ff}
.crm-bal{display:flex;gap:8px;margin:0 0 14px}
.crm-bal div{flex:1;padding:12px 6px 10px;text-align:center;background:#06123a;border:2px solid #1c2f6e}
.crm-bal b{display:block;margin-bottom:8px;font-size:32px;line-height:1;font-weight:400;color:#fff;text-shadow:2px 2px 0 #050a1f}
.crm-bal span{font-size:12px;color:#7fb2ff}
.crm-btn{display:block;width:100%;min-height:46px;margin:10px 0 4px;padding:12px;cursor:pointer;color:#fff;font-size:16px;line-height:1.25;
  background:#16307a;border:0;box-shadow:0 4px 0 #06123a;text-shadow:2px 2px 0 #06123a}
.crm-btn:active:not(:disabled){transform:translateY(4px);box-shadow:none}
.crm-primary{background:#d03a33;box-shadow:0 4px 0 #6e1514;text-shadow:2px 2px 0 #6e1514}
.crm-ghost{background:transparent;box-shadow:none;color:#9ccaff;text-shadow:none}
.crm-btn:disabled{opacity:.5;cursor:default}
.crm-btn:focus-visible,.crm input:focus-visible,.crm-x:focus-visible{outline:2px solid #ffd84a;outline-offset:2px}
.crm-ok{color:#9fe39f !important}
.crm p.crm-big{margin:4px 0 16px;text-align:center;font-size:24px;line-height:1.25;color:#fff;text-shadow:2px 2px 0 #050a1f}
.crm-field{display:block;margin:0 0 12px;color:#9ccaff}
.crm-field input{display:block;width:100%;margin-top:6px;padding:6px 10px;font:20px/1.2 "VT323",${PIXEL};text-transform:none;
  color:#fff;background:#040818;border:2px solid #2a3d78;border-radius:0}
.crm-check{display:flex;gap:10px;align-items:flex-start;margin:12px 0;color:#c3cdf0}
.crm-check input{flex:none;width:20px;height:20px;margin:0;accent-color:#d03a33}
.crm-err{margin:6px 0 0 !important;color:#ff8f86 !important}
.crm-err:empty{display:none}
.crm-video{padding:0;background:#000}
.crm-video .crm-card{position:relative;display:flex;flex-direction:column;max-width:none;height:100%;margin:0;padding:0;
  background:#000;border:0;box-shadow:none}
.crm-vtop{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px}
.crm-prize{flex:1;margin:0 !important;font-size:16px;line-height:1.25;color:#ffd84a !important}
.crm-x{flex:none;width:40px;height:40px;cursor:pointer;font-size:16px;color:#fff;background:#16307a;border:0;box-shadow:0 3px 0 #06123a}
.crm-x:disabled{visibility:hidden}
.crm-video video{flex:1;width:100%;min-height:0;background:#000;object-fit:contain}
.crm-bar{height:6px;background:#1c2758}
.crm-bar i{display:block;width:0;height:100%;background:#ffd84a;transition:width .25s steps(4)}
.crm-status{min-height:1.8em;margin:0 !important;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 12px);text-align:center}
.crm-play{position:absolute;left:50%;top:50%;width:auto;transform:translate(-50%,-50%)}
.crm-play[hidden]{display:none}`;

const root = document.createElement('div');
root.className = 'crm';
root.hidden = true;
root.setAttribute('role', 'dialog');
root.setAttribute('aria-modal', 'true');
root.tabIndex = -1;
const card = document.createElement('div');
card.className = 'crm-card';
root.append(card);
let onEscape = null;
if (client) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  if (document.body) document.body.append(root);
  else addEventListener('DOMContentLoaded', () => document.body.append(root));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); } });
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function button(label, cls, onClick) {
  const b = el('button', 'crm-btn ' + cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
function balance() {
  const box = el('div', 'crm-bal');
  for (const [v, k] of [[S.points, 'points'], [api.extraLives, 'lives']]) {
    const d = el('div');
    d.append(el('b', '', String(v)), el('span', '', t(k)));
    box.append(d);
  }
  return box;
}
// Avisa al juego cuando el overlay se abre, cambia de tipo (panel / video) o se cierra
function setKind(kind) {
  if (kind === S.kind) return;
  S.kind = kind;
  try { api.onOverlay && api.onOverlay(kind); } catch {}
}
function show(nodes, kind = 'panel') {
  root.classList.toggle('crm-video', kind === 'video');
  root.setAttribute('aria-label', t('title'));
  card.replaceChildren(...nodes);
  root.hidden = false;
  setKind(kind);
  // En el video el foco va al overlay y no a la X, para que un Enter o Espacio no lo cierre por accidente
  const f = kind === 'video' ? root : card.querySelector('[data-focus]') || card.querySelector('button:not(:disabled), input');
  if (f) f.focus({ preventScroll: true });
}
function hide() {
  root.hidden = true;
  card.replaceChildren();
  onEscape = null;
  setKind(null);
}

// ---------- Panel de premios: saldo, video y registro ----------
function rewardsView() {
  const watch = button(t('watch'), 'crm-primary', async () => { await watchVideo({ stay: true }); rewardsView(); });
  const nodes = [el('h2', '', t('title')), balance(), el('p', '', t('livesHint')), watch];
  if (Date.now() < S.noVideoUntil) { watch.disabled = true; nodes.push(el('p', 'crm-err', t('noVideos'))); }
  if (S.registered) nodes.push(el('p', 'crm-ok', t('registered')));
  else nodes.push(el('p', '', t('pitch')), button(t('register'), '', registerView));
  nodes.push(button(t('close'), 'crm-ghost', hide));
  show(nodes);
  onEscape = hide;
}

// ---------- Registro (opt-in) ----------
function registerView() {
  const form = el('form');
  form.noValidate = true;
  const field = (key, type, auto, mode) => {
    const label = el('label', 'crm-field', t(key));
    const input = el('input');
    Object.assign(input, { type, name: key, autocomplete: auto, maxLength: key === 'phone' ? 20 : 120 });
    if (mode) input.inputMode = mode;
    const err = el('p', 'crm-err');
    label.append(input, err);
    form.append(label);
    return { input, err };
  };
  const check = html => {
    const label = el('label', 'crm-check');
    const input = el('input');
    input.type = 'checkbox';
    const span = el('span');
    span.innerHTML = html;      // textos fijos de TX (solo el enlace al aviso)
    label.append(input, span);
    form.append(label);
    return input;
  };
  form.append(el('h2', '', t('regTitle')));
  const name = field('name', 'text', 'name');
  form.append(el('p', '', t('contactHint')));
  const email = field('email', 'email', 'email', 'email');
  const phone = field('phone', 'tel', 'tel', 'tel');
  const consent = check(t('consent'));
  const consentErr = el('p', 'crm-err');
  form.append(consentErr);
  const marketing = check(t('marketing'));
  const general = el('p', 'crm-err');
  const send = el('button', 'crm-btn crm-primary', t('register'));
  send.type = 'submit';
  form.append(general, send, button(t('back'), 'crm-ghost', rewardsView));
  name.input.dataset.focus = '';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    for (const f of [name, email, phone]) f.err.textContent = '';
    consentErr.textContent = general.textContent = '';
    const v = { name: name.input.value.trim(), email: email.input.value.trim(), phone: phone.input.value.trim() };
    let bad = false;
    if (v.name.length < 2) { name.err.textContent = t('needName'); bad = true; }
    if (!v.email && !v.phone) { email.err.textContent = t('needContact'); bad = true; }
    if (!consent.checked) { consentErr.textContent = t('needConsent'); bad = true; }
    if (bad) return;
    send.disabled = true;
    send.textContent = t('sending');
    try {
      const r = await withTimeout(client.registerPlayer({
        name: v.name, email: v.email || undefined, phone: v.phone || undefined,
        consentVersion: CONSENT_VERSION, marketingOptIn: marketing.checked
      }));
      S.registered = true; S.points = r.points; S.lives = r.lives;
      welcomeView(v.name, r.created);
    } catch (err) {
      send.disabled = false;
      send.textContent = t('register');
      if (err && err.status === 400) {
        const errs = err.errors || {};
        for (const [k, f] of Object.entries({ name, email, phone })) if (errs[k]) f.err.textContent = errs[k][0];
        if (!Object.keys(errs).some(k => k in { name, email, phone })) general.textContent = err.message;
      } else general.textContent = err && err.status === 429 ? t('tooMany') : t('netError');
    }
  });
  show([form]);
  onEscape = rewardsView;
}
function welcomeView(name, created) {
  show([
    el('h2', '', t(created ? 'welcome' : 'welcomeBack', name.split(' ')[0])),
    el('p', 'crm-ok', t('welcomeBody')), balance(),
    button(t('cont'), 'crm-primary', rewardsView)
  ]);
  onEscape = rewardsView;
}

// ---------- Video (insert) ----------
// Resuelve con lo que respondió el CRM ({ rewarded, reward, reason }) o con
// { cancelled }, { unavailable } o { error }.
function playInsert() {
  return new Promise(resolve => {
    let done = false, stall = null;
    const video = el('video');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    const prize = el('p', 'crm-prize', t('loading'));
    const x = el('button', 'crm-x', 'X');
    x.type = 'button';
    x.setAttribute('aria-label', t('closeVideo'));
    const top = el('div', 'crm-vtop');
    top.append(prize, x);
    const bar = el('div', 'crm-bar'), fill = el('i');
    bar.append(fill);
    const status = el('p', 'crm-status', t('leaveWarn'));
    const play = button(t('tapToPlay'), 'crm-primary crm-play', () => { play.hidden = true; watchStall(); video.play().catch(() => fail('error')); });
    play.hidden = true;
    show([top, video, play, bar, status], 'video');

    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(stall);
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };
    const fail = kind => finish(kind === 'error' ? { error: 'video' } : { cancelled: true });
    const watchStall = () => { clearTimeout(stall); stall = setTimeout(() => fail('error'), STALL_MS); };
    x.addEventListener('click', () => fail('cancel'));
    onEscape = () => { if (!x.disabled) fail('cancel'); };

    (async () => {
      let ins;
      try {
        ins = await withTimeout(client.nextInsert());
      } catch (err) {
        if (err && err.status === 404) { S.noVideoUntil = Date.now() + NO_VIDEO_MS; finish({ unavailable: true }); }
        else finish({ error: 'net' });
        return;
      }
      if (done) return;
      const openedAt = performance.now();
      prize.textContent = t('prize', rewardText(ins.reward));
      video.src = ins.videoUrl;
      watchStall();
      video.addEventListener('playing', () => clearTimeout(stall));
      video.addEventListener('waiting', watchStall);
      video.addEventListener('timeupdate', () => {
        if (video.duration) fill.style.width = (100 * video.currentTime / video.duration).toFixed(1) + '%';
      });
      video.addEventListener('error', () => fail('error'));
      video.addEventListener('ended', async () => {
        clearTimeout(stall);
        x.disabled = true;
        status.textContent = t('checking');
        // El servidor paga si pasó ≥ 90 % de durationSec desde nextInsert; si el archivo dura menos
        // que lo configurado en el panel, se espera lo que falte antes de reclamar.
        await sleep(Math.max(0, ins.durationSec * 900 + 500 - (performance.now() - openedAt)));
        try { finish(await withTimeout(client.completeInsert(ins.viewId))); }
        catch { finish({ error: 'net' }); }
      });
      // Sin un toque reciente (iOS, o si la carga tardó) el navegador no deja reproducir: se pide un toque
      video.play().catch(() => { clearTimeout(stall); play.hidden = false; play.focus(); });
    })();
  });
}
function resultView(r) {
  return new Promise(resolve => {
    const nodes = [];
    if (r.rewarded) nodes.push(el('h2', '', t('won')), el('p', 'crm-big', rewardText(r.reward)), balance());
    else if (r.reason) nodes.push(el('h2', '', t('noPrize')), el('p', '', t(r.reason)));
    else nodes.push(el('h2', '', t('title')), el('p', '', t(r.unavailable ? 'noVideos' : r.error === 'video' ? 'videoError' : 'netError')));
    const done = () => resolve();
    nodes.push(button(t('cont'), 'crm-primary', done));
    show(nodes);
    onEscape = done;
  });
}
async function watchVideo({ stay = false } = {}) {
  const r = await playInsert();
  if (r.rewarded) {
    // se refleja al instante; el saldo real llega con refresh()
    if (r.reward.type === 'LIVES') S.lives += r.reward.amount; else S.points += r.reward.amount;
    refresh();
  }
  if (!r.cancelled) await resultView(r);
  if (!stay) hide();
  return r;
}

// ======================================================================
//  API para el juego
// ======================================================================
const api = {
  /** Hay sesión abierta con el CRM. */
  get online() { return S.online; },
  get registered() { return S.registered; },
  get points() { return S.points; },
  /** Vidas ganadas con videos que aún no se gastan en este dispositivo. */
  get extraLives() { return Math.max(0, S.lives - livesUsed()); },
  /** Puede haber video que ver (falso un rato después de un "no hay videos"). */
  get videos() { return S.online && Date.now() >= S.noVideoUntil; },
  /** El overlay está abierto: el juego ignora teclado y toques. */
  get busy() { return S.kind !== null; },
  /** El juego lo asigna: recibe 'panel', 'video' o null al cerrar. */
  onOverlay: null,
  useLife() {
    if (api.extraLives <= 0) return false;
    store.set(USED_KEY, String(livesUsed() + 1));
    return true;
  },
  watchVideo: () => watchVideo(),
  openRewards() { if (S.online) rewardsView(); },
  openRegister() { if (S.online) registerView(); }
};
window.VaquitasCRM = api;

if (client) {
  connect();
  addEventListener('online', connect);
  // al volver a la pestaña se actualiza el saldo (por ejemplo, tras registrarse en otro dispositivo)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.online && !api.busy) refresh(); });
}
})();
