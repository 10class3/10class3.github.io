/* ══════════════════════════════════════════════════════════════
   할로윈 밤 — 3반 알리미 시즌 이벤트
   · 관리자가 이벤트를 켰을 때만 앱이 이 파일을 불러옴 (index.html의 EVENT_JS)
   · 테마(호박 랜턴의 밤) + 메인 카드 + 이벤트 공간 + 미션 다섯 개
   · 클리어 기록과 선착순 순번은 서버(worker.js /event)가 서버 시각으로 정함
   ══════════════════════════════════════════════════════════════ */

let A = null;                    // 앱이 넘겨준 기능 모음
let cfg = {};                    // config/event (on, prizes, skip, max)
let stats = { dist:[0,0,0,0,0,0], ranked:0, last:null };
let unsubStats = null, started = false, firstStats = true, webObs = null;

const STAGES = [
  { id:'dark',    name:'정전된 3반',   line:'손전등으로 숨은 호박 3개 찾기',      kind:'관찰' },
  { id:'soup',    name:'마녀의 수프',   line:'재료 네 가지의 순서를 추리하기',      kind:'추리' },
  { id:'scale',   name:'사탕 저울',     line:'저울 두 번으로 무거운 사탕 찾기',     kind:'논리' },
  { id:'lantern', name:'호박 등불',     line:'아홉 개의 등불을 모두 밝히기',        kind:'패턴' },
  { id:'cipher',  name:'유령의 암호',   line:'앱 속 단서로 쪽지 해독하기',          kind:'해독' }
];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => A ? A.esc(s) : String(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LS = {
  get(k){ try{ return JSON.parse(localStorage.getItem('hw:' + (A.SPACE || '') + k)); }catch{ return null; } },
  set(k, v){ try{ localStorage.setItem('hw:' + (A.SPACE || '') + k, JSON.stringify(v)); }catch{} }
};
const me = () => LS.get('me');                         // { num, key }
const done = () => new Set(LS.get('done') || []);
const myRank = () => LS.get('rank') || 0;
const prizes = () => Number(cfg.prizes) || 15;
const left = () => Math.max(0, prizes() - (stats.ranked || 0));
const cleared = () => (stats.dist || []).reduce((a, n, i) => i ? a + n : a, 0);

/* ───────── 그림 (전부 직접 그린 SVG — 기기마다 똑같이 보이게) ───────── */
const SVG = {
  pumpkin: (lit = true) => `<svg viewBox="0 0 64 64" aria-hidden="true" class="hw-pk${lit ? ' lit' : ''}">
    <path d="M32 17c-1-6 1-10 6-12" stroke="#5c8a2f" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M38 8c5-1 8 1 9 4-4 1-7 0-9-4z" fill="#6fa83a"/>
    <ellipse cx="20" cy="38" rx="14" ry="18" fill="${lit ? '#e8661a' : '#5a3a2c'}"/>
    <ellipse cx="44" cy="38" rx="14" ry="18" fill="${lit ? '#e8661a' : '#5a3a2c'}"/>
    <ellipse cx="32" cy="38" rx="13" ry="20" fill="${lit ? '#ff8a2a' : '#6b4636'}"/>
    <path class="face" d="M21 33l5-6 5 6zM33 33l5-6 5 6zM20 44q12 9 24 0l-4 3-3-3-3 3-3-3-3 3-3-3z" fill="${lit ? '#ffd76b' : '#2a1a14'}"/></svg>`,
  bat: `<svg viewBox="0 0 64 28" aria-hidden="true"><path d="M32 9c1.5-3 3-3.5 3-3.5l.6 3c5-2 9-6 9-6 0 5 4 9 9 9-2 2-2.5 4.5-2.5 4.5-3-2-6-1.5-6-1.5.5 3-1 6-1 6-4-4-8-3-8-3l-4 6-4-6s-4-1-8 3c0 0-1.5-3-1-6 0 0-3-.5-6 1.5 0 0-.5-2.5-2.5-4.5 5 0 9-4 9-9 0 0 4 4 9 6l.6-3s1.5.5 3 3.5z" fill="currentColor"/></svg>`,
  web: `<svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><path d="M0 0L100 38M0 0L78 78M0 0L38 100M0 0L100 8M0 0L8 100"/><path d="M22 8Q19 19 8 22M44 16Q36 36 16 44M66 25Q53 53 25 66M86 33Q68 68 33 86"/></svg>`,
  spider: `<svg viewBox="0 0 24 60" aria-hidden="true"><line x1="12" y1="0" x2="12" y2="42" stroke="currentColor" stroke-width=".8" opacity=".55"/><g fill="currentColor"><ellipse cx="12" cy="47" rx="4.2" ry="5"/><circle cx="12" cy="41.5" r="2.6"/></g><g stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"><path d="M8.5 44l-5-3-2 3M8.5 47H3l-2 3M8.7 50l-4 3 0 3M15.5 44l5-3 2 3M15.5 47H21l2 3M15.3 50l4 3 0 3"/></g></svg>`,
  ghost: `<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M24 3C12 3 5 12 5 24v27l6-5 6 5 7-5 7 5 6-5 6 5V24C43 12 36 3 24 3z" fill="#f4eefb"/><ellipse cx="17" cy="24" rx="3.4" ry="4.6" fill="#241a30"/><ellipse cx="31" cy="24" rx="3.4" ry="4.6" fill="#241a30"/><ellipse cx="24" cy="34" rx="3" ry="3.6" fill="#241a30"/></svg>`,
  snd: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  moon: `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="hwMoonG" cx="40%" cy="38%"><stop offset="0" stop-color="#fff6dc"/><stop offset="1" stop-color="#f3d79a"/></radialGradient></defs><circle cx="60" cy="60" r="40" fill="url(#hwMoonG)"/><circle cx="46" cy="50" r="7" fill="#e7c47f" opacity=".55"/><circle cx="70" cy="72" r="10" fill="#e7c47f" opacity=".45"/><circle cx="74" cy="44" r="4" fill="#e7c47f" opacity=".5"/></svg>`,
  // 수프 재료
  eye: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#fbf7ef"/><path d="M8 14q5 1 6 6M30 9q-2 5-6 6M33 26q-5-1-7 3" stroke="#e05555" stroke-width="1.2" fill="none"/><circle cx="21" cy="21" r="7" fill="#4bb3a8"/><circle cx="21" cy="21" r="3.4" fill="#141019"/><circle cx="19" cy="19" r="1.4" fill="#fff"/></svg>`,
  wing: `<svg viewBox="0 0 40 40"><path d="M4 26c4-12 13-18 26-20-2 4-1 7 3 9-3 1-4 4-2 7-4-1-7 1-8 4-3-3-7-3-10 0-2-3-5-3-9 0z" fill="#3a2c4a"/><path d="M8 24c5-7 12-11 21-14" stroke="#7b6693" stroke-width="1.3" fill="none"/></svg>`,
  shroom: `<svg viewBox="0 0 40 40"><path d="M15 22h10l2 12q-7 2-14 0z" fill="#efe3cf"/><path d="M5 23C5 13 12 6 20 6s15 7 15 17q-15 3-30 0z" fill="#d8443c"/><circle cx="14" cy="15" r="2.6" fill="#fff4e6"/><circle cx="24" cy="12" r="2" fill="#fff4e6"/><circle cx="27" cy="19" r="2.3" fill="#fff4e6"/></svg>`,
  frog: `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="25" rx="15" ry="11" fill="#5fbf4a"/><circle cx="12" cy="14" r="6" fill="#5fbf4a"/><circle cx="28" cy="14" r="6" fill="#5fbf4a"/><circle cx="12" cy="14" r="3" fill="#fff"/><circle cx="28" cy="14" r="3" fill="#fff"/><circle cx="12.6" cy="14.4" r="1.6" fill="#141019"/><circle cx="27.4" cy="14.4" r="1.6" fill="#141019"/><path d="M12 27q8 5 16 0" stroke="#2d6b22" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 40 40"><path d="M20 4l4.8 10 11 1.4-8 7.6 2 10.9L20 28.6 10.2 34l2-10.9-8-7.6 11-1.4z" fill="#ffd34d"/><path d="M20 10l2.6 5.5" stroke="#fff3c0" stroke-width="1.6" stroke-linecap="round"/></svg>`
};
/* 미션을 깨면 받는 '비밀 기록' 카드 (본문은 공개돼도 됨. 구석 도장의 조각만 서버가 줌) */
const CARDS = {
  dark:    { n:1, how:'drop',    t:'경계가 얇아지는 밤', b:'약 2000년 전 켈트족은 10월 31일을 한 해의 마지막 날로 여겼어요. 이날 밤에는 산 자와 죽은 자의 세계 사이 경계가 얇아진다고 믿었대요.' },
  soup:    { n:2, how:'rise',    t:'변장의 시작',       b:'사람들은 이 밤 떠도는 영혼에게 들키지 않으려고 동물 가죽이나 가면으로 변장했다고 전해져요. 오늘날 할로윈 코스튬의 뿌리예요.' },
  scale:   { n:3, how:'unwrap',  t:'소울 케이크',       b:'중세 영국에서는 사람들이 집집마다 돌며 기도를 해 주고 \'소울 케이크\'라는 과자를 받았어요. 트릭 오어 트릿의 조상이에요.' },
  lantern: { n:4, how:'project', t:'순무 등불',         b:'잭오랜턴은 원래 순무나 감자를 깎아 만들었어요. 아일랜드 사람들이 미국으로 건너가면서 크고 깎기 쉬운 호박으로 바뀌었어요.' },
  cipher:  { n:5, how:'leave',   t:'이름의 비밀',       b:'할로윈(Halloween)은 11월 1일 \'모든 성인의 날\' 전날 밤, All Hallows\' Eve가 줄어든 말이에요. 그런데 이 축제에는 이보다 훨씬 오래된 진짜 이름이 있어요…' }
};
const INGR = [
  { id:'eye', name:'눈알' }, { id:'wing', name:'박쥐 날개' }, { id:'shroom', name:'독버섯' },
  { id:'frog', name:'개구리' }, { id:'star', name:'별가루' }
];
const CANDY = ['#ff8a2a','#b07cff','#9be15d','#ff6b9a','#5ec8ff','#ffd34d','#ff8a2a','#b07cff','#9be15d'];
const candySVG = c => `<svg viewBox="0 0 48 30" aria-hidden="true"><path d="M4 6l9 9-9 9zM44 6l-9 9 9 9z" fill="${c}" opacity=".75"/><ellipse cx="24" cy="15" rx="12" ry="10" fill="${c}"/><path d="M16 9q8 6 16 0M15 21q9-6 18 0" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/></svg>`;

/* ───────── 효과음 (파일 없이 WebAudio로 합성 — 용량 0, 오프라인에서도 됨) ───────── */
let actx = null, master = null, noiseBuf = null;
const sndOn = () => LS.get('snd') !== false;
function au(){
  if(!sndOn()) return null;
  try{
    if(!actx){
      const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return null;
      actx = new Ctx(); master = actx.createGain(); master.gain.value = .55; master.connect(actx.destination);
    }
    if(actx.state === 'suspended') actx.resume();
    return actx;
  }catch{ return null; }
}
function tone(f, d, { type = 'sine', vol = .2, at = 0, to = null, attack = .006 } = {}){
  const c = au(); if(!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .03);
}
function noise(d, { f = 1200, q = .8, vol = .15, at = 0, to = null } = {}){
  const c = au(); if(!c) return;
  if(!noiseBuf){ noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const ch = noiseBuf.getChannelData(0); for(let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + at, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; src.loop = true; fl.type = 'bandpass'; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t); if(to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.05, d / 3)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t); src.stop(t + d + .03);
}
const SFX = {
  tap:    () => tone(880, .06, { type:'triangle', vol:.07 }),
  enter:  () => { noise(.8, { f:260, to:2600, vol:.12 }); [220, 330, 440, 659].forEach((f, i) => tone(f, 1, { vol:.06, at:.2 + i * .08 })); },
  leave:  () => noise(.42, { f:2200, to:280, vol:.08 }),
  find:   () => { tone(1046, .35, { type:'triangle', vol:.11 }); tone(1568, .45, { vol:.05, at:.05 }); },
  wrong:  () => tone(170, .3, { type:'square', vol:.045, to:110 }),
  drop:   () => tone(240 + Math.random() * 160, .12, { vol:.09, to:700 + Math.random() * 300 }),
  pour:   () => { for(let i = 0; i < 6; i++) tone(260 + Math.random() * 420, .09, { vol:.07, at:i * .06, to:700 + Math.random() * 600 }); },
  creak:  () => { noise(.7, { f:480, to:950, q:7, vol:.09 }); tone(95, .5, { type:'triangle', vol:.05, at:.35 }); },
  ignite: () => { noise(.22, { f:900, to:3200, vol:.08 }); tone(392 + Math.random() * 80, .28, { type:'triangle', vol:.045 }); },
  win:    () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .55, { type:'triangle', vol:.09, at:i * .09 })),
  flip:   () => { noise(.16, { f:3200, q:.6, vol:.1 }); noise(.13, { f:1900, q:.6, vol:.07, at:.11 }); },
  stash:  () => { noise(.38, { f:1300, to:380, vol:.08 }); tone(784, .22, { vol:.05, at:.42 }); },
  ghost:  () => tone(560, 1.1, { vol:.045, to:400, attack:.3 }),
  ding:   () => { tone(1318, .5, { vol:.05 }); tone(1975, .4, { vol:.02, at:.03 }); },
  gong:   () => { tone(110, 2.6, { vol:.16, attack:.01 }); tone(221, 2.1, { vol:.06 }); tone(333, 1.7, { vol:.035 }); },
  secret: () => [392, 494, 587, 740, 988, 1175].forEach((f, i) => tone(f, 1, { vol:.06, at:i * .11 })),
  bats:   () => { for(let i = 0; i < 9; i++) noise(.05, { f:1400 + Math.random() * 1600, q:2, vol:.05, at:i * .07 }); }
};
const sfx = n => { try{ SFX[n] && SFX[n](); }catch{} };
function drone(){                     // 달을 누르는 동안 낮게 차오르는 소리
  const c = au(); if(!c) return () => {};
  const t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o2.type = 'triangle';
  o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(165, t + 3);
  o2.frequency.setValueAtTime(120.5, t); o2.frequency.linearRampToValueAtTime(247, t + 3);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .5);
  o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t);
  return () => { try{ const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(Math.max(.0001, g.gain.value), n); g.gain.exponentialRampToValueAtTime(.0001, n + .2); o.stop(n + .25); o2.stop(n + .25); }catch{} };
}

/* ───────── 스타일 ───────── */
const CSS = `
/* 테마: 호박 랜턴의 밤 (이벤트가 켜져 있는 동안만) */
html.hw-on,html.hw-on[data-theme="dark"],html.hw-on[data-theme="light"]{color-scheme:dark;
  --ink:#f6eee4;--paper:#141019;--panel:#1d1724;--rule:#2f2539;--dim:#a596b4;--dimmer:#6c5f7a;--urgent:#ff8a2a;--soft:#1d1724;--markpos:88%}
html.hw-on,html.hw-on body{background:#141019}
html.hw-on body{background:radial-gradient(120% 50% at 85% -10%,rgba(255,138,42,.16),transparent 60%),#141019!important}
html.hw-on .tab.on{color:#ff8a2a!important;border-color:#ff8a2a!important}
html.hw-on .urgentbox{border-color:#ff8a2a!important;position:relative;overflow:hidden}
html.hw-on .brand h1{display:flex;align-items:center;gap:7px}
.hw-title-pk{width:.95em;height:.95em;flex:none;transform:translateY(-1px) rotate(-6deg)}
.hw-title-pk svg{width:100%;height:100%;display:block}
.hw-deco{position:fixed;pointer-events:none;z-index:25;color:#b9a6cc}
.hw-web-tl{top:0;left:0;width:62px;opacity:.26}
.hw-web-bl{bottom:0;left:0;width:96px;opacity:.36;transform:scaleY(-1)}
.hw-fog{position:fixed;left:0;right:0;bottom:0;height:120px;pointer-events:none;z-index:20;background:linear-gradient(to top,rgba(120,70,170,.22),rgba(120,70,170,0))}
html.hw-on header{position:relative}
.hw-stars{position:absolute;inset:0 0 auto 0;height:120px;pointer-events:none;
  background-image:radial-gradient(1.4px 1.4px at 18% 22%,#fff8 50%,transparent),radial-gradient(1.2px 1.2px at 43% 9%,#fff6 50%,transparent),radial-gradient(1.6px 1.6px at 71% 30%,#ffd9a888 50%,transparent),radial-gradient(1.1px 1.1px at 88% 12%,#fff5 50%,transparent),radial-gradient(1.3px 1.3px at 33% 46%,#fff4 50%,transparent);
  animation:hw-twinkle 3.6s ease-in-out infinite alternate}
@keyframes hw-twinkle{from{opacity:.45}to{opacity:1}}
.hw-spider{position:absolute;top:58px;right:22px;width:15px;height:70px;color:#b9a6cc;pointer-events:none;transform-origin:50% 0;animation:hw-sway 4.8s ease-in-out infinite}
.hw-spider svg{width:100%;height:100%;display:block}
@keyframes hw-sway{0%,100%{transform:rotate(5deg)}50%{transform:rotate(-5deg) translateY(4px)}}
.hw-cw{position:absolute;top:0;right:0;width:34px;color:#b9a6cc;opacity:.45;transform:scaleX(-1);pointer-events:none}

/* 메인 카드 */
.hw-card{position:relative;overflow:hidden;display:flex;align-items:center;gap:13px;width:100%;margin:16px 0 0;padding:15px 16px;
  border-radius:16px;border:1.5px solid #4a2f5e;background:linear-gradient(135deg,#2a1838 0%,#1d1426 100%);color:#f6eee4;
  font-family:inherit;text-align:left;cursor:pointer;transition:transform .16s cubic-bezier(.23,1,.32,1)}
.hw-card:active{transform:scale(.98)}
.hw-card .pk{width:40px;height:40px;flex:none;filter:drop-shadow(0 0 10px rgba(255,138,42,.55));transform:rotate(-8deg)}
.hw-card .pk svg{width:100%;height:100%}
.hw-card .txt{flex:1;min-width:0}
.hw-card b{display:block;font-size:15.5px;font-weight:900;letter-spacing:-.03em}
.hw-card small{display:block;font-size:12.5px;font-weight:700;opacity:.72;margin-top:3px}
.hw-card .side{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:7px;white-space:nowrap}
.hw-card .go{border-radius:999px;padding:8px 14px;font-size:13px;font-weight:900;background:#ff8a2a;color:#1b0d02}
.hw-card .left{font-size:12px;font-weight:800;color:#ff8a2a;font-variant-numeric:tabular-nums}
.hw-card .left.hot{animation:hw-hot 1.2s ease-in-out infinite}
.hw-card .bats{position:absolute;top:8px;right:118px;color:#f6eee4;opacity:.2;pointer-events:none}
.hw-card .bats svg{display:block;width:28px}.hw-card .bats svg+svg{width:17px;margin:-4px 0 0 26px;opacity:.8}
.hw-dots{display:flex;gap:4px;margin-top:7px}
.hw-dots i{width:14px;height:4px;border-radius:2px;background:#3d2c4b}
.hw-dots i.on{background:#ff8a2a;box-shadow:0 0 6px rgba(255,138,42,.7)}
@keyframes hw-hot{50%{opacity:.45}}
.face{transition:fill .3s}
.hw-pk.lit .face{animation:hw-flicker 2.4s steps(1) infinite}
@keyframes hw-flicker{0%,100%{opacity:1}46%{opacity:.55}48%{opacity:1}74%{opacity:.75}76%{opacity:1}}

/* 공간 */
.hw-space{position:fixed;inset:0;z-index:95;background:#0f0b14;color:#f6eee4;overflow:hidden;
  font-family:inherit;display:flex;flex-direction:column}
.hw-space .sky{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(90% 60% at 80% 0%,rgba(255,150,60,.18),transparent 60%),radial-gradient(70% 50% at 10% 100%,rgba(130,70,190,.28),transparent 70%),#0f0b14}
.hw-space .sky::after{content:'';position:absolute;inset:0;background-image:radial-gradient(1.2px 1.2px at 12% 18%,#fff9 50%,transparent),radial-gradient(1px 1px at 28% 8%,#fff7 50%,transparent),radial-gradient(1.4px 1.4px at 52% 14%,#fff8 50%,transparent),radial-gradient(1px 1px at 64% 30%,#fff6 50%,transparent),radial-gradient(1.2px 1.2px at 86% 22%,#fff7 50%,transparent),radial-gradient(1px 1px at 40% 36%,#fff5 50%,transparent);animation:hw-twinkle 4s ease-in-out infinite alternate}
.hw-scroll{position:relative;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top) + 8px) 20px calc(env(safe-area-inset-bottom) + 40px)}
.hw-scroll > div{max-width:560px;margin:0 auto}
.hw-top{display:flex;align-items:center;gap:10px;height:48px}
.hw-iconbtn{width:40px;height:40px;border-radius:12px;border:0;background:rgba(255,255,255,.06);color:#f6eee4;display:grid;place-items:center;cursor:pointer;transition:transform .14s cubic-bezier(.23,1,.32,1),background .2s}
.hw-iconbtn:active{transform:scale(.92)}
.hw-iconbtn svg{width:20px;height:20px}
.hw-top h2{margin:0;font-size:17px;font-weight:900;letter-spacing:-.03em;flex:1}
.hw-chip{border-radius:999px;padding:6px 11px;font-size:12.5px;font-weight:900;background:rgba(255,138,42,.14);color:#ffb070;border:1px solid rgba(255,138,42,.3)}
.hw-hero{position:relative;text-align:center;padding:14px 0 6px}
.hw-moon{position:absolute;right:-6px;top:-14px;width:96px;opacity:.9;filter:drop-shadow(0 0 30px rgba(255,220,150,.35));pointer-events:none}
.hw-lanterns{display:flex;justify-content:center;gap:10px;margin:18px 0 18px}
.hw-lanterns .ln{width:44px;height:44px;transition:transform .4s cubic-bezier(.34,1.56,.64,1),filter .4s}
.hw-lanterns .ln.on{filter:drop-shadow(0 0 14px rgba(255,138,42,.75))}
.hw-lanterns .ln.pop{animation:hw-pop .6s cubic-bezier(.34,1.56,.64,1)}
@keyframes hw-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
.hw-left{font-size:56px;font-weight:900;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums;color:#ffb070;text-shadow:0 0 28px rgba(255,138,42,.45)}
.hw-left.hot{animation:hw-hot 1.1s ease-in-out infinite}
.hw-left-l{font-size:13px;font-weight:800;color:#b9a6cc;margin-top:8px}
.hw-board{display:flex;justify-content:center;gap:6px;margin:18px 0 4px;flex-wrap:wrap}
.hw-board span{font-size:11.5px;font-weight:800;color:#a596b4;background:rgba(255,255,255,.05);border-radius:999px;padding:5px 9px;font-variant-numeric:tabular-nums}
.hw-board span b{color:#f6eee4}
.hw-list{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.hw-m{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:15px 14px 15px 16px;border-radius:16px;border:1px solid #2f2539;
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));color:#f6eee4;text-align:left;font-family:inherit;cursor:pointer;
  transition:transform .16s cubic-bezier(.23,1,.32,1),border-color .2s}
.hw-m:active{transform:scale(.98)}
.hw-m .idx{width:34px;height:34px;flex:none}
.hw-m .idx svg{width:100%;height:100%}
.hw-m .t{flex:1;min-width:0}
.hw-m b{display:block;font-size:15.5px;font-weight:900;letter-spacing:-.03em}
.hw-m small{display:block;font-size:12.5px;font-weight:700;color:#a596b4;margin-top:3px}
.hw-m .k{font-size:11px;font-weight:900;color:#b07cff;letter-spacing:.02em;margin-right:6px}
.hw-m .st{flex:none;font-size:12.5px;font-weight:900;border-radius:999px;padding:7px 12px;background:#ff8a2a;color:#1b0d02}
.hw-m.done{border-color:rgba(155,225,93,.3)}
.hw-m.done .st{background:rgba(155,225,93,.14);color:#b8f08a;display:flex;align-items:center;gap:4px}
.hw-m.done .st svg{width:14px;height:14px}
.hw-rules{margin:22px 2px 0;font-size:12.5px;font-weight:700;color:#8f80a0;line-height:1.75}
.hw-rules b{color:#e4d8f0}
.hw-mine{margin:18px 0 0;padding:14px 16px;border-radius:14px;background:rgba(255,138,42,.1);border:1px solid rgba(255,138,42,.28);font-size:14px;font-weight:800;line-height:1.6}
.hw-ticker{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 22px);transform:translate(-50%,20px);opacity:0;z-index:99;
  background:#f6eee4;color:#1b0d02;padding:11px 16px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap;
  box-shadow:0 8px 24px rgba(0,0,0,.4);transition:transform .32s cubic-bezier(.23,1,.32,1),opacity .32s}
.hw-ticker.on{opacity:1;transform:translate(-50%,0)}

/* 입장: 호박 등불의 빛이 화면을 채우며 열림 */
.hw-iris{position:fixed;inset:0;z-index:96;pointer-events:none;
  background:radial-gradient(circle at var(--x) var(--y),#ffd28a 0,#ff8a2a 18%,rgba(120,40,10,.0) 46%);
  opacity:0}
.hw-space.enter{clip-path:circle(0 at var(--x) var(--y))}
.hw-space.entering{clip-path:circle(150% at var(--x) var(--y));transition:clip-path .62s cubic-bezier(.65,0,.35,1)}
.hw-space.leaving{clip-path:circle(0 at var(--x) var(--y));transition:clip-path .42s cubic-bezier(.65,0,.35,1)}
.hw-iris.flash{animation:hw-iris .7s cubic-bezier(.23,1,.32,1) forwards}
@keyframes hw-iris{0%{opacity:0;transform:scale(.6)}30%{opacity:.95}100%{opacity:0;transform:scale(1.4)}}
.hw-in > *{animation:hw-rise .5s cubic-bezier(.23,1,.32,1) both}
.hw-in > *:nth-child(2){animation-delay:.05s}.hw-in > *:nth-child(3){animation-delay:.1s}.hw-in > *:nth-child(4){animation-delay:.15s}.hw-in > *:nth-child(5){animation-delay:.2s}.hw-in > *:nth-child(6){animation-delay:.25s}
@keyframes hw-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* 번호 고르기 */
.hw-nums{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}
.hw-nums button{height:48px;border-radius:12px;border:1px solid #2f2539;background:rgba(255,255,255,.04);color:#f6eee4;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer;font-variant-numeric:tabular-nums;transition:transform .12s,background .2s}
.hw-nums button:active{transform:scale(.94)}
.hw-nums button.sel{background:#ff8a2a;color:#1b0d02;border-color:#ff8a2a}
.hw-p{font-size:14px;font-weight:700;color:#cbbfd8;line-height:1.7;margin:10px 0 0}
.hw-btn{display:block;width:100%;margin-top:18px;height:52px;border-radius:14px;border:0;background:#ff8a2a;color:#1b0d02;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer;transition:transform .14s cubic-bezier(.23,1,.32,1),opacity .2s}
.hw-btn:active{transform:scale(.97)}
.hw-btn:disabled{opacity:.35}
.hw-btn.ghost{background:rgba(255,255,255,.07);color:#f6eee4}

/* 미션 공통 */
.hw-stage{min-height:calc(100dvh - 120px);display:flex;flex-direction:column}
.hw-stage .hw-q{font-size:14px;font-weight:700;color:#cbbfd8;line-height:1.7;margin:8px 0 0}
.hw-ghost{position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom) + 18px);z-index:100;display:flex;align-items:flex-end;gap:8px;
  max-width:calc(100% - 28px);transform:translateY(30px);opacity:0;pointer-events:none;transition:transform .45s cubic-bezier(.34,1.56,.64,1),opacity .3s}
.hw-ghost.on{transform:none;opacity:1}
.hw-ghost .g{width:44px;flex:none;animation:hw-float 2.6s ease-in-out infinite}
@keyframes hw-float{50%{transform:translateY(-6px)}}
.hw-ghost .b{background:#f4eefb;color:#241a30;border-radius:16px 16px 16px 4px;padding:11px 14px;font-size:13.5px;font-weight:800;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.hw-win{position:fixed;inset:0;z-index:101;display:grid;place-items:center;background:rgba(10,6,14,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s}
.hw-win.on{opacity:1}
.hw-win .box{text-align:center;transform:scale(.8);transition:transform .5s cubic-bezier(.34,1.56,.64,1)}
.hw-win.on .box{transform:none}
.hw-win .pk{width:110px;margin:0 auto;filter:drop-shadow(0 0 30px rgba(255,138,42,.8))}
.hw-win h3{margin:14px 0 6px;font-size:24px;font-weight:900;letter-spacing:-.04em}
.hw-win p{margin:0;font-size:14px;font-weight:700;color:#e4d8f0}
.hw-batfly{position:fixed;z-index:102;width:46px;color:#1b1222;pointer-events:none;filter:drop-shadow(0 0 1px rgba(255,200,150,.6))}
.hw-spark{position:fixed;z-index:102;width:6px;height:6px;border-radius:50%;background:#ffd28a;pointer-events:none}

/* 1. 정전된 3반 */
.hw-dark{position:fixed;inset:0;z-index:97;touch-action:none;cursor:none}
.hw-dark .shade{position:absolute;inset:0;background:#05030a;
  -webkit-mask-image:radial-gradient(circle var(--r,78px) at var(--x,50%) var(--y,50%),transparent 0,transparent 58%,#000 100%);
          mask-image:radial-gradient(circle var(--r,78px) at var(--x,50%) var(--y,50%),transparent 0,transparent 58%,#000 100%);
  transition:opacity .5s}
.hw-dark .glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle 90px at var(--x,50%) var(--y,50%),rgba(255,230,170,.12),transparent 70%)}
.hw-dark .p{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s}
.hw-dark .p svg{width:100%;height:100%}
.hw-dark .p.got{transform:scale(1.8);opacity:0}
.hw-dark .bar{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top) + 12px) 16px 12px;display:flex;align-items:center;gap:10px;color:#f6eee4;z-index:2}
.hw-dark .bar b{font-size:15px;font-weight:900;flex:1}
.hw-dark .bar .cnt{font-size:14px;font-weight:900;color:#ffb070;font-variant-numeric:tabular-nums}
.hw-dark .hintdot{position:absolute;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;background:radial-gradient(circle,rgba(255,138,42,.35),transparent 70%);animation:hw-hot 1.4s ease-in-out infinite;pointer-events:none;z-index:1}
.hw-dark.flash .shade{opacity:.25}

/* 2. 마녀의 수프 */
.hw-pot{position:relative;width:200px;height:170px;margin:12px auto 0}
.hw-pot svg.pot{width:100%;height:100%}
.hw-pot .brew{transition:fill .6s}
.hw-bub{position:absolute;bottom:92px;width:10px;height:10px;border-radius:50%;background:var(--bc,#9be15d);opacity:.0;animation:hw-bub 1.8s ease-in infinite}
@keyframes hw-bub{0%{transform:translateY(0) scale(.5);opacity:0}20%{opacity:.9}100%{transform:translateY(-60px) scale(1.2);opacity:0}}
.hw-slots{display:flex;justify-content:center;gap:10px;margin:14px 0 0}
.hw-slot{width:58px;height:58px;border-radius:16px;border:1.5px dashed #4a3a5a;display:grid;place-items:center;background:rgba(255,255,255,.03);cursor:pointer}
.hw-slot.f{border-style:solid;border-color:#6b5481;background:rgba(255,255,255,.07);animation:hw-pop .35s cubic-bezier(.34,1.56,.64,1)}
.hw-slot.lock{border-color:#9be15d;box-shadow:0 0 0 2px rgba(155,225,93,.25)}
.hw-slot svg{width:40px;height:40px}
.hw-ings{display:flex;justify-content:center;gap:8px;margin:16px 0 0}
.hw-ing{width:60px;padding:6px 0 7px;border-radius:14px;border:1px solid #2f2539;background:rgba(255,255,255,.04);color:#cbbfd8;font-family:inherit;font-size:10.5px;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .12s,opacity .2s}
.hw-ing:active{transform:scale(.93)}
.hw-ing:disabled{opacity:.25}
.hw-ing svg{width:34px;height:34px}
.hw-hist{display:flex;flex-direction:column;gap:6px;margin:16px 0 0}
.hw-hr{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:rgba(255,255,255,.035);animation:hw-rise .35s cubic-bezier(.23,1,.32,1)}
.hw-hr .ic{display:flex;gap:3px}.hw-hr .ic svg{width:24px;height:24px}
.hw-hr .pegs{margin-left:auto;display:flex;gap:4px;align-items:center}
.hw-hr .pegs i{width:11px;height:11px;border-radius:50%;border:1.5px solid #6c5f7a}
.hw-hr .pegs i.x{background:#9be15d;border-color:#9be15d}
.hw-hr .pegs i.o{border-color:#ffd34d;background:radial-gradient(circle,#ffd34d 0 40%,transparent 45%)}
.hw-legend{display:flex;justify-content:center;gap:14px;margin:10px 0 0;font-size:11.5px;font-weight:800;color:#a596b4}
.hw-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}

/* 3. 사탕 저울 */
.hw-scale{position:relative;height:190px;margin:10px 0 0}
.hw-scale .beam{position:absolute;left:50%;top:44px;width:260px;margin-left:-130px;height:6px;border-radius:3px;background:#c9a77a;transform-origin:50% 50%;transition:transform .9s cubic-bezier(.34,1.3,.64,1)}
.hw-scale .post{position:absolute;left:50%;top:44px;width:8px;margin-left:-4px;height:120px;border-radius:4px;background:#8a6a4a}
.hw-scale .base{position:absolute;left:50%;top:160px;width:90px;margin-left:-45px;height:10px;border-radius:5px;background:#8a6a4a}
.hw-scale .pan{position:absolute;top:3px;width:104px;margin-left:-52px;transform-origin:50% 0;transition:transform .9s cubic-bezier(.34,1.3,.64,1)}
.hw-scale .pan.l{left:0}.hw-scale .pan.r{left:100%}
.hw-scale .pan .str{height:44px;border-left:1px solid #c9a77a;border-right:1px solid #c9a77a;margin:0 14px}
.hw-scale .pan .dish{height:12px;border-radius:0 0 52px 52px;background:#c9a77a}
.hw-scale .pan .on{position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:center;flex-wrap:wrap-reverse;gap:0 1px;padding:0 6px}
.hw-scale .pan .on svg{width:26px;height:17px}
.hw-candies{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin:14px 0 0}
.hw-candy{position:relative;height:58px;border-radius:12px;border:1px solid #2f2539;background:rgba(255,255,255,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:#cbbfd8;font-family:inherit;font-size:11px;font-weight:900;padding:0;transition:transform .14s,border-color .2s,background .2s}
.hw-candy:active{transform:scale(.92)}
.hw-candy svg{width:30px;height:19px}
.hw-candy.L{border-color:#5ec8ff;background:rgba(94,200,255,.12)}
.hw-candy.R{border-color:#ff6b9a;background:rgba(255,107,154,.12)}
.hw-candy .tag{position:absolute;top:3px;right:4px;font-size:9.5px}
.hw-candy.pick{animation:hw-hot 1s ease-in-out infinite}
.hw-log{margin:12px 0 0;display:flex;flex-direction:column;gap:5px}
.hw-log div{font-size:12.5px;font-weight:800;color:#cbbfd8;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.035);animation:hw-rise .35s cubic-bezier(.23,1,.32,1)}
.hw-row2{display:flex;gap:8px}
.hw-row2 .hw-btn{flex:1}

/* 4. 호박 등불 */
.hw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:min(78vw,300px);margin:24px auto 0}
.hw-cell{aspect-ratio:1;border-radius:22px;border:1px solid #2f2539;background:radial-gradient(circle at 50% 60%,rgba(255,255,255,.04),transparent 70%);display:grid;place-items:center;cursor:pointer;padding:12%;transition:transform .14s cubic-bezier(.23,1,.32,1),background .35s,box-shadow .35s}
.hw-cell:active{transform:scale(.93)}
.hw-cell svg{width:100%;height:100%;transition:filter .35s}
.hw-cell.on{background:radial-gradient(circle at 50% 60%,rgba(255,138,42,.28),transparent 70%);box-shadow:inset 0 0 0 1px rgba(255,138,42,.35)}
.hw-cell.on svg{filter:drop-shadow(0 0 12px rgba(255,138,42,.8))}
.hw-cell.hint{box-shadow:0 0 0 3px #b07cff,0 0 24px rgba(176,124,255,.5)}
.hw-moves{text-align:center;font-size:12.5px;font-weight:800;color:#a596b4;margin-top:16px}

/* 5. 유령의 암호 */
.hw-note{position:relative;margin:14px 0 0;padding:18px 18px 16px;border-radius:16px;background:#f4eefb;color:#241a30;transform:rotate(-1.2deg);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.hw-note::before{content:'';position:absolute;top:-9px;left:50%;width:70px;height:18px;margin-left:-35px;background:rgba(255,211,77,.7);transform:rotate(2deg)}
.hw-note ol{margin:0;padding-left:20px;font-size:14.5px;font-weight:800;line-height:1.9}
.hw-note .sig{text-align:right;font-size:12px;font-weight:800;color:#7a6a8c;margin-top:6px}
.hw-input{display:block;width:100%;margin-top:16px;height:56px;border-radius:14px;border:1.5px solid #4a3a5a;background:rgba(255,255,255,.05);color:#f6eee4;font-family:inherit;font-size:22px;font-weight:900;text-align:center;letter-spacing:.4em}
.hw-input:focus{outline:none;border-color:#ff8a2a}
.hw-input.bad{animation:hw-shake .4s}
@keyframes hw-shake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.hw-ref{margin:14px 0 0;border-radius:14px;border:1px solid #2f2539;overflow:hidden}
.hw-ref summary{padding:13px 14px;font-size:13.5px;font-weight:900;cursor:pointer;list-style:none;display:flex;justify-content:space-between}
.hw-ref summary::-webkit-details-marker{display:none}
.hw-ref .in{padding:4px 10px 12px;overflow-x:auto;font-size:12px}
.hw-ref table{border-collapse:collapse;width:100%}
.hw-ref td,.hw-ref th{border:1px solid #2f2539;padding:5px 4px;text-align:center;font-weight:700;color:#e4d8f0;white-space:nowrap}

/* 관리자 */
.hw-admin{margin:26px 0 0;padding:16px;border-radius:16px;border:1px dashed #4a3a5a}
.hw-admin h4{margin:0 0 12px;font-size:14px;font-weight:900}
.hw-admin .ln{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13.5px;font-weight:800}
.hw-admin .ln span{flex:1}
.hw-admin input{width:110px;height:38px;border-radius:10px;border:1px solid #4a3a5a;background:rgba(255,255,255,.05);color:#f6eee4;font-family:inherit;font-size:14px;font-weight:800;text-align:center}
.hw-admin .sm{height:38px;padding:0 12px;border-radius:10px;border:0;background:rgba(255,255,255,.1);color:#f6eee4;font-family:inherit;font-weight:900;cursor:pointer}
.hw-admin table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;font-variant-numeric:tabular-nums}
.hw-admin td,.hw-admin th{padding:7px 4px;border-bottom:1px solid #2f2539;text-align:left;font-weight:700}
.hw-admin th{color:#a596b4;font-size:11.5px}

/* 비밀 기록 카드 */
.hw-cardwrap{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(86vw,340px)}
.hw-cardwrap .hw-btn{margin:0;width:100%}
.hw-cardx{position:relative;width:100%;padding:22px 20px 26px;border-radius:6px;color:#2b1b10;
  background:radial-gradient(120% 90% at 30% 20%,#f8edd3 0%,#efdcb4 70%,#e3c896 100%);
  box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 0 40px rgba(120,80,30,.25);transform:rotate(-1.5deg)}
.hw-cardx::after{content:'';position:absolute;inset:8px;border:1px solid rgba(90,55,20,.25);border-radius:3px;pointer-events:none}
.hw-cardx .no{font-size:11.5px;font-weight:900;letter-spacing:.14em;color:#8a5a2a}
.hw-cardx h4{margin:8px 0 10px;font-size:21px;font-weight:900;letter-spacing:-.04em}
.hw-cardx p{margin:0;font-size:14.5px;font-weight:700;line-height:1.75;color:#3d2a18;word-break:keep-all}
.hw-cardx .stamp{position:absolute;right:16px;bottom:10px;padding:2px 7px;border:2px solid currentColor;border-radius:5px;color:#8b2a1a;opacity:.2;
  font-size:22px;font-weight:900;letter-spacing:.12em;transform:rotate(-12deg);font-family:Georgia,'Times New Roman',serif}
.hw-cardx .stamp.wet{font-size:10px;letter-spacing:0;opacity:.35;border-style:dashed;font-family:inherit}
.hw-cardx.how-drop{animation:hw-c-drop .9s cubic-bezier(.34,1.4,.64,1) both}
.hw-cardx.how-rise{animation:hw-c-rise 1.1s cubic-bezier(.23,1,.32,1) both}
.hw-cardx.how-unwrap{animation:hw-c-unwrap .9s cubic-bezier(.34,1.3,.64,1) both}
.hw-cardx.how-project{animation:hw-c-project 1.2s cubic-bezier(.23,1,.32,1) both}
.hw-cardx.how-leave{animation:hw-c-leave 1.3s cubic-bezier(.23,1,.32,1) both}
.hw-cardx.how-view{animation:hw-c-rise .45s cubic-bezier(.23,1,.32,1) both}
@keyframes hw-c-drop{0%{transform:translateY(-70vh) rotate(-24deg)}100%{transform:rotate(-1.5deg)}}
@keyframes hw-c-rise{0%{opacity:0;transform:translateY(60px) scale(.92) rotate(-1.5deg);filter:blur(10px)}100%{opacity:1;transform:rotate(-1.5deg);filter:none}}
@keyframes hw-c-unwrap{0%{transform:perspective(800px) rotateY(90deg) scale(.35) rotate(-30deg)}100%{transform:perspective(800px) rotateY(0) scale(1) rotate(-1.5deg)}}
@keyframes hw-c-project{0%{opacity:0;filter:brightness(3) blur(8px);transform:scale(1.08) rotate(-1.5deg)}50%{opacity:1}100%{opacity:1;filter:none;transform:rotate(-1.5deg)}}
@keyframes hw-c-leave{0%{opacity:0;transform:translateY(-14px) rotate(-1.5deg);filter:blur(4px)}100%{opacity:1;transform:rotate(-1.5deg);filter:none}}
.hw-cardwrap .hw-btn{animation:hw-rise .5s .7s cubic-bezier(.23,1,.32,1) both}
.hw-win.fly{background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;transition:background .3s}
.hw-win .box.out{transform:scale(.9);opacity:0;transition:transform .25s,opacity .25s}

/* 비밀 기록장 */
.hw-book{margin:20px 0 0}
.hw-book .hd{display:flex;align-items:baseline;justify-content:space-between;margin:0 2px 9px}
.hw-book .hd b{font-size:14px;font-weight:900}
.hw-book .hd small{font-size:12px;font-weight:800;color:#a596b4;font-variant-numeric:tabular-nums}
.hw-book .sl{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.hw-slot2{position:relative;aspect-ratio:3/4;border-radius:6px;border:1.5px dashed #3d2f4b;background:rgba(255,255,255,.02);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px;font-family:inherit;color:#6c5f7a}
.hw-slot2 i{font-style:normal;font-size:12px;font-weight:900}
.hw-slot2.got{border:0;cursor:pointer;color:#3d2a18;background:radial-gradient(120% 90% at 30% 20%,#f8edd3,#e3c896);box-shadow:0 4px 12px rgba(0,0,0,.35);transform:rotate(var(--r,-2deg));transition:transform .16s cubic-bezier(.23,1,.32,1)}
.hw-slot2.got:active{transform:scale(.94)}
.hw-slot2.got i{color:#8a5a2a;font-size:10px}
.hw-slot2.got span{font-size:10.5px;font-weight:900;line-height:1.3;text-align:center;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

/* 달 (꾹 누르면 일식) */
@media (max-width:360px){.hw-hero .hw-moon{width:78px;top:-18px;right:-4px}.hw-hero .hw-lanterns{margin-top:62px;gap:8px}.hw-lanterns .ln{width:40px;height:40px}}
#hwMoon{z-index:2;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:default;-webkit-tap-highlight-color:transparent}
#hwMoon svg{display:block;width:100%}
#hwMoon .eclip{position:absolute;left:16.5%;top:16.5%;width:67%;height:67%;border-radius:50%;overflow:hidden;pointer-events:none}
#hwMoon .ecl{position:absolute;inset:-1px;border-radius:50%;background:#120d18;box-shadow:inset 7px 0 12px rgba(255,140,60,.3);
  transform:translateX(calc((1 - var(--e,0)) * 106%))}
.hw-moon{position:absolute}
.hw-dark .wall{position:absolute;transform:translate(-50%,-50%) rotate(-7deg);font-size:15px;font-weight:900;color:#d7c3f0;letter-spacing:.12em;white-space:nowrap;font-style:italic;opacity:.6;pointer-events:none}

/* 달의 뒷면 */
.hw-back{text-align:center;padding-top:8px}
.hw-back .bm{width:140px;margin:10px auto 6px;filter:drop-shadow(0 0 40px rgba(255,140,60,.35))}
.hw-back .bm svg{width:100%;display:block;filter:hue-rotate(-20deg) saturate(1.4) brightness(.8)}
.hw-back .qq{margin:18px 0 0;padding:18px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid #2f2539;font-size:15px;font-weight:800;line-height:1.8}
.hw-back .qq b{color:#ffb070}
.hw-hid{letter-spacing:.14em!important;font-size:20px!important;text-transform:uppercase}
.hw-back .hw-rules{text-align:left}

@media (prefers-reduced-motion:reduce){
  .hw-cardx,.hw-cardwrap .hw-btn{animation:none!important}
  .hw-stars,.hw-spider,.hw-pk.lit .face,.hw-space .sky::after,.hw-ghost .g,.hw-bub{animation:none!important}
  .hw-space.enter,.hw-space.entering,.hw-space.leaving{clip-path:none!important;transition:none!important}
}`;

/* ───────── 시작·정지 ───────── */
export function start(api, config){
  A = api; cfg = config || {};
  if(started){ update(cfg); return; }
  started = true; firstStats = true;
  if(A.SPACE) STAGES[0].name = '정전된 교실';        // 체험판은 반 이름 대신
  const st = document.createElement('style'); st.id = 'hw-style'; st.textContent = CSS; document.head.appendChild(st);
  document.documentElement.classList.add('hw-on');
  A.setPalette(['#ff8a2a', '#b07cff', '#9be15d', '#ffbf9b', '#9fd7ff', '#ffb3d1', '#d7e37a', '#ffd6a5']);
  decorate();
  unsubStats = A.fs.onSnapshot(A.fs.doc(A.db, A.C('event_stats'), 'main'), s => {
    const prev = stats.ranked || 0;
    const v = s.exists() ? s.data() : {};
    stats = { dist: Array.isArray(v.dist) ? v.dist : [0,0,0,0,0,0], ranked: v.ranked || 0, last: v.last || null };
    if(!firstStats && stats.ranked > prev && stats.ranked !== myRank()) ticker(`방금 누군가 다섯 개를 모두 깼어요 · 남은 간식 ${left()}개`);
    firstStats = false;
    paintCard(); paintSpace();
  }, () => {});
  retryPending().then(refreshPieces);
  addEventListener('hashchange', onHash);
  setTimeout(onHash, 900);           // 링크(#halloween)로 들어온 경우
}
export function update(config){
  if(!started){ if(A && config && config.on) start(A, config); return; }   // 껐다가 다시 켠 경우
  cfg = config || {}; paintCard(); paintSpace();
}
export function stop(){
  if(!started) return;
  started = false;
  if(unsubStats){ unsubStats(); unsubStats = null; }
  removeEventListener('hashchange', onHash);
  if(webObs){ webObs.disconnect(); webObs = null; }
  document.documentElement.classList.remove('hw-on');
  document.querySelectorAll('.hw-deco,.hw-fog,.hw-stars,.hw-spider,.hw-card,.hw-cw,.hw-title-pk,#hw-style,.hw-ticker').forEach(n => n.remove());
  if($('.hw-space')) closeSpace(true);
  A.setPalette(null);
}
function onHash(){ if(started && location.hash === '#halloween' && !$('.hw-space')) openSpace(); }

/* ───────── 앱 곳곳의 디테일 + 메인 카드 ───────── */
function decorate(){
  const h1 = $('.brand h1');
  if(h1 && !$('.hw-title-pk')) h1.insertAdjacentHTML('afterbegin', `<span class="hw-title-pk">${SVG.pumpkin()}</span>`);
  const header = $('header');
  if(header) header.insertAdjacentHTML('afterbegin', `<div class="hw-stars"></div><span class="hw-spider">${SVG.spider}</span>`);
  document.body.insertAdjacentHTML('beforeend',
    `<span class="hw-deco hw-web-tl">${SVG.web}</span><span class="hw-deco hw-web-bl">${SVG.web}</span><div class="hw-fog"></div>`);
  const ub = $('#urgentBox');
  if(ub) ub.insertAdjacentHTML('beforebegin', `<button class="hw-card" id="hwCard" type="button"></button>`);
  $('#hwCard').onclick = e => openSpace(e.currentTarget.querySelector('.pk'));
  // 다가오는 할 일 상자 모서리 거미줄 (앱이 상자를 다시 그려도 붙도록)
  if(webObs) webObs.disconnect();
  const mo = webObs = new MutationObserver(() => { const u = $('.urgentbox'); if(u && !u.querySelector('.hw-cw')) u.insertAdjacentHTML('afterbegin', `<span class="hw-cw">${SVG.web}</span>`); });
  if(ub) mo.observe(ub, { childList:true });
  const u = $('.urgentbox'); if(u) u.insertAdjacentHTML('afterbegin', `<span class="hw-cw">${SVG.web}</span>`);
  paintCard();
}
function paintCard(){
  const c = $('#hwCard'); if(!c) return;
  const d = done(), n = left(), r = myRank();
  const sub = r ? (r <= prizes() ? `선착순 ${r}번째! 간식 당첨` : `다섯 개 모두 클리어 · 참여상`) : (d.size ? `${d.size}/5 클리어 · 이어서 도전하기` : '미션 5개 · 1개만 깨도 참여상');
  c.innerHTML = `<span class="bats">${SVG.bat}${SVG.bat}</span><span class="pk">${SVG.pumpkin()}</span>
    <span class="txt"><b>할로윈 밤</b><small>${sub}</small><span class="hw-dots">${STAGES.map(s => `<i class="${d.has(s.id) ? 'on' : ''}"></i>`).join('')}</span></span>
    <span class="side"><span class="go">${d.size === STAGES.length ? '결과 보기' : d.size ? '이어하기' : '들어가기'}</span><span class="left${n && n <= 3 ? ' hot' : ''}">${n ? `간식 ${n}개 남음` : '간식 마감 · 참여상 계속'}</span></span>`;
}
function ticker(text){
  let t = $('.hw-ticker');
  if(!t){ t = document.createElement('div'); t.className = 'hw-ticker'; document.body.appendChild(t); }
  t.textContent = text; t.classList.add('on'); sfx('ding');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3600);
}

/* ───────── 공간: 들어가기·나가기 ───────── */
let spaceEl = null;
function openSpace(fromEl){
  if(spaceEl) return;
  const r = fromEl && fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width:0, height:0 };
  const x = Math.round(r.left + r.width / 2) + 'px', y = Math.round(r.top + r.height / 2) + 'px';
  spaceEl = document.createElement('section');
  spaceEl.className = 'hw-space' + (reduce ? '' : ' enter');
  spaceEl.style.setProperty('--x', x); spaceEl.style.setProperty('--y', y);
  spaceEl.innerHTML = `<div class="sky"></div><div class="hw-scroll"></div>`;
  document.body.appendChild(spaceEl);
  sfx('enter');
  spaceEl.addEventListener('click', e => {
    const sb = e.target.closest('.hw-snd');
    if(sb){ LS.set('snd', !sndOn()); spaceEl.querySelectorAll('.hw-snd').forEach(b => b.innerHTML = sndOn() ? SVG.snd : SVG.mute); sfx('tap'); return; }
    if(e.target.closest('.hw-m,.hw-nums button,[data-back],.hw-ing,.hw-candy')) sfx('tap');
  });
  document.body.style.overflow = 'hidden';
  if(!reduce){
    const iris = document.createElement('div'); iris.className = 'hw-iris flash';
    iris.style.setProperty('--x', x); iris.style.setProperty('--y', y);
    document.body.appendChild(iris); setTimeout(() => iris.remove(), 800);
    requestAnimationFrame(() => requestAnimationFrame(() => spaceEl && spaceEl.classList.add('entering')));
  }
  if(location.hash === '#halloween') history.replaceState(history.state, '', location.pathname + location.search);
  A.pushLayer(() => closeSpace());
  me() ? showHome(true) : showPick();
}
function closeSpace(instant){
  if(!spaceEl) return;
  stopMission();
  const el = spaceEl; spaceEl = null;
  if(!instant) sfx('leave');
  const end = () => { el.remove(); if(!document.querySelector('.sheet.on')) document.body.style.overflow = ''; };
  if(instant || reduce){ end(); return; }
  el.classList.remove('entering'); el.classList.add('leaving');
  setTimeout(end, 440);
  paintCard();
}
const scroller = () => spaceEl && spaceEl.querySelector('.hw-scroll');
function view(html, cls = 'hw-in'){
  const s = scroller(); if(!s) return null;
  s.innerHTML = `<div class="${cls}">${html}</div>`; s.scrollTop = 0;
  return s.firstElementChild;
}
const topbar = (title, right = '') => `<div class="hw-top"><button class="hw-iconbtn" data-back aria-label="뒤로">${SVG.back}</button><h2>${title}</h2>${right}<button class="hw-iconbtn hw-snd" aria-label="효과음 켜기·끄기">${sndOn() ? SVG.snd : SVG.mute}</button></div>`;
function bindBack(root, fn){ root.querySelectorAll('[data-back]').forEach(b => b.onclick = fn); }

/* 번호 고르기 */
function showPick(){
  const max = Number(cfg.max) || 35, skip = new Set((cfg.skip || []).map(Number));
  const nums = []; for(let i = 1; i <= max; i++) if(!skip.has(i)) nums.push(i);
  let sel = 0;
  const root = view(`${topbar('할로윈 밤')}
    <div class="hw-hero"><span class="hw-moon">${SVG.moon}</span>
      <div class="hw-lanterns">${STAGES.map(() => `<span class="ln">${SVG.pumpkin(false)}</span>`).join('')}</div></div>
    <p class="hw-p" style="font-size:17px;font-weight:900;color:#f6eee4">내 번호를 골라 주세요</p>
    <p class="hw-p">이 기기에서는 이 번호로 기록돼요. 다른 사람 번호를 고르면 그 친구가 참여할 수 없으니 꼭 내 번호로!</p>
    <div class="hw-nums">${nums.map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>
    <button class="hw-btn" id="hwJoin" disabled>번호를 골라 주세요</button>`);
  bindBack(root, () => A.back());
  root.querySelectorAll('.hw-nums button').forEach(b => b.onclick = () => {
    root.querySelectorAll('.hw-nums button').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); sel = Number(b.dataset.n);
    const j = $('#hwJoin', root); j.disabled = false; j.textContent = `${sel}번으로 들어가기`;
  });
  $('#hwJoin', root).onclick = async () => {
    if(!sel) return;
    if(!await A.ask(`${sel}번이 맞나요?`, '한 번 정하면 이 기기에서는 바꿀 수 없어요.', '맞아요')) return;
    const key = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))).replace(/-/g, '');
    const j = $('#hwJoin', root); j.disabled = true; j.textContent = '들어가는 중…';
    const res = await send({ num: sel, key, stage:'' });
    if(res && res.ok){ LS.set('me', { num: sel, key }); keepPieces(res); sfx('ignite'); showHome(); }
    else{ j.disabled = false; j.textContent = `${sel}번으로 들어가기`; A.note('들어가지 못했어요', (res && res.error) || '인터넷 연결을 확인해 주세요.'); }
  };
}

/* 공간의 첫 화면 */
function showHome(ignite){
  const m = me(); if(!m) return showPick();
  const d = done();
  const root = view(`${topbar('할로윈 밤', `<span class="hw-chip">${m.num}번</span>`)}
    <div class="hw-hero"><span class="hw-moon" id="hwMoon">${SVG.moon}<i class="eclip"><i class="ecl"></i></i></span>
      <div class="hw-lanterns">${STAGES.map(s => `<span class="ln${d.has(s.id) ? ' on' : ''}" data-s="${s.id}">${SVG.pumpkin(d.has(s.id))}</span>`).join('')}</div>
      <div class="hw-left" id="hwLeft"></div><div class="hw-left-l" id="hwLeftL"></div>
      <div class="hw-board" id="hwBoard"></div></div>
    <div id="hwMine"></div>
    <div class="hw-book" id="hwBook"><div class="hd"><b>비밀 기록장</b><small>${d.size} / 5</small></div>
      <div class="sl">${STAGES.map((s, i) => d.has(s.id)
        ? `<button class="hw-slot2 got" data-s="${s.id}" style="--r:${[-2, 1.5, -1, 2, -1.5][i]}deg"><i>${CARDS[s.id].n}</i><span>${CARDS[s.id].t}</span></button>`
        : `<span class="hw-slot2" data-s="${s.id}"><i>${CARDS[s.id].n}</i></span>`).join('')}</div></div>
    <div class="hw-list">${STAGES.map((s, i) => `<button class="hw-m${d.has(s.id) ? ' done' : ''}" data-s="${s.id}">
        <span class="idx">${SVG.pumpkin(d.has(s.id))}</span>
        <span class="t"><b><span class="k">${s.kind}</span>${s.name}</b><small>${s.line}</small></span>
        <span class="st">${d.has(s.id) ? SVG.check + '클리어' : '도전'}</span></button>`).join('')}</div>
    <p class="hw-rules"><b>참여상</b> 미션 1개만 깨도 받아요.<br><b>선착순 간식</b> 다섯 개를 모두 깬 순서대로 ${prizes()}명.<br>미션을 깰 때마다 할로윈의 비밀 기록이 한 장씩 모여요.<br>미션은 사람마다 다르게 나와서 답을 알려 줘도 소용없어요. 막히면 유령이 힌트를 줘요.</p>
    <div id="hwAdmin"></div>`);
  bindBack(root, () => A.back());
  root.querySelectorAll('.hw-m').forEach(b => b.onclick = () => openMission(b.dataset.s));
  root.querySelectorAll('.hw-slot2.got').forEach(b => b.onclick = () => showCard(b.dataset.s));
  bindMoon($('#hwMoon', root));
  paintSpace();
  if(A.isMain()) paintAdmin();
  if(ignite && !reduce) root.querySelectorAll('.hw-lanterns .ln.on').forEach((l, i) => { l.style.animationDelay = (.35 + i * .08) + 's'; l.classList.add('pop'); });
}
function paintSpace(){
  if(!spaceEl) return;
  const L = $('#hwLeft'), LL = $('#hwLeftL'), B = $('#hwBoard'), M = $('#hwMine');
  if(L){ const n = left(); L.textContent = n; L.classList.toggle('hot', n > 0 && n <= 3); LL.textContent = n ? '남은 선착순 간식' : '간식은 마감 · 참여상은 계속 받을 수 있어요'; }
  if(B){ const d = stats.dist || []; B.innerHTML = [5,4,3,2,1].filter(k => d[k]).map(k => `<span>${k}개 클리어 <b>${d[k]}명</b></span>`).join('') || '<span>아직 아무도 깨지 못했어요. 첫 번째가 돼 보세요</span>'; }
  if(M){ const r = myRank(), n = done().size;
    M.innerHTML = r ? `<div class="hw-mine">${r <= prizes() ? `선착순 <b>${r}번째</b>로 다섯 개를 모두 깼어요! 간식 당첨이에요.` : `다섯 개를 모두 깼어요(${r}번째). 아쉽게 간식은 마감됐지만 참여상을 받아요.`}</div>`
      : n ? `<div class="hw-mine">미션 ${n}개 클리어 · 참여상 확보! 다섯 개를 모두 깨면 선착순 간식에 도전할 수 있어요.</div>` : ''; }
}

/* 관리자: 선착순 인원, 번호 설정, 명단 */
async function paintAdmin(){
  const box = $('#hwAdmin'); if(!box) return;
  box.innerHTML = `<div class="hw-admin"><h4>관리자</h4>
    <div class="ln"><span>선착순 간식 인원</span><input id="hwPz" type="number" min="0" max="60" value="${prizes()}"><button class="sm" id="hwPzS">저장</button></div>
    <div class="ln"><span>마지막 번호 / 없는 번호</span><input id="hwMax" type="number" min="1" max="60" value="${Number(cfg.max) || 35}" style="width:60px"><input id="hwSkip" value="${(cfg.skip || []).join(',')}" style="width:80px" placeholder="예: 7,21"><button class="sm" id="hwNumS">저장</button></div>
    <div class="ln"><span>번호 옮기기<br><small style="font-weight:700;color:#a596b4">잘못 고른 번호를 바로잡아요</small></span><input id="hwMvA" type="number" min="1" max="60" placeholder="원래" style="width:60px"><input id="hwMvB" type="number" min="1" max="60" placeholder="바꿀" style="width:60px"><button class="sm" id="hwMvS">옮기기</button></div>
    <div id="hwList" class="hw-p">명단 불러오는 중…</div></div>`;
  const save = async data => { try{ await A.fs.setDoc(A.fs.doc(A.db, A.C('config'), 'event'), data, { merge:true }); A.toast('저장했어요'); }catch{ A.toast('저장하지 못했어요'); } };
  $('#hwPzS').onclick = () => save({ prizes: Math.max(0, Math.min(60, Number($('#hwPz').value) || 0)) });
  $('#hwNumS').onclick = () => save({ max: Math.max(1, Math.min(60, Number($('#hwMax').value) || 35)),
    skip: String($('#hwSkip').value).split(/[^0-9]+/).map(Number).filter(n => n > 0 && n <= 60) });
  $('#hwMvS').onclick = async () => {
    const from = Number($('#hwMvA').value), to = Number($('#hwMvB').value);
    if(!from || !to || from === to) return A.toast('원래 번호와 바꿀 번호를 넣어 주세요');
    if(!await A.ask(`${from}번 기록을 ${to}번으로 옮길까요?`, '클리어 기록과 순위는 그대로 옮겨지고, 그 친구 기기는 앱을 다시 열면 자동으로 새 번호로 바뀌어요. 원래 번호는 비어서 다른 친구가 참여할 수 있어요.', '옮기기')) return;
    const b = $('#hwMvS'); b.disabled = true;
    try{
      const idToken = await A.auth.currentUser.getIdToken();
      const r = await fetch(A.PUSH_URL + 'event', { method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ space: A.SPACE, move:true, from, to, idToken }) });
      const res = await r.json();
      if(res.ok){ A.toast(`${from}번 → ${to}번으로 옮겼어요`); paintAdmin(); }
      else A.note('옮기지 못했어요', res.error || '다시 시도해 주세요.');
    }catch{ A.note('옮기지 못했어요', '인터넷 연결을 확인해 주세요.'); }
    b.disabled = false;
  };
  try{
    const snap = await A.fs.getDocs(A.fs.collection(A.db, A.C('event_players')));
    const rows = [];
    snap.forEach(d => { if(d.id.startsWith('_')) return; const v = d.data(); const st = v.stages || {}; rows.push({ n: v.n || Number(d.id), c: Object.keys(st).length, rank: v.rank || 0, h: v.hidden || 0 }); });
    rows.sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.c - a.c || a.n - b.n);
    const P = prizes();
    $('#hwList').innerHTML = rows.length ? `<table><tr><th>순번</th><th>번호</th><th>클리어</th><th>상품</th><th>히든</th></tr>${rows.map(r =>
      `<tr><td>${r.rank || '–'}</td><td>${r.n}번</td><td>${r.c}/5</td><td>${r.rank && r.rank <= P ? '<b style="color:#ffb070">선착순 간식</b>' : r.c ? '참여상' : '–'}</td><td>${r.h ? `<b style="color:#b07cff">${r.h}번째</b>` : ''}</td></tr>`).join('')}</table>
      <p class="hw-p" style="font-size:12px">간식 ${rows.filter(r => r.rank && r.rank <= P).length}명 · 참여상 ${rows.filter(r => r.c && !(r.rank && r.rank <= P)).length}명 · 히든 미션 ${rows.filter(r => r.h).length}명</p>` : '아직 참여한 사람이 없어요.';
  }catch{ $('#hwList').textContent = '명단을 불러오지 못했어요. 보안 규칙을 확인해 주세요.'; }
}

/* ───────── 서버 기록 ───────── */
async function send(body, again = true){
  try{
    const r = await fetch(A.PUSH_URL + 'event', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ space: A.SPACE, ...body }) });
    const res = await r.json();
    // 관리자가 번호를 옮겼으면 이 기기도 새 번호로 바꾸고 한 번 더 보냄
    if(res && res.moved && again && body.key){
      const m = me();
      if(m && m.key === body.key){ LS.set('me', { ...m, num: res.moved }); paintCard(); const chip = spaceEl && spaceEl.querySelector('.hw-top .hw-chip'); if(chip) chip.textContent = res.moved + '번'; }
      return send({ ...body, num: res.moved }, false);
    }
    return res;
  }catch{ return null; }
}
function keepPieces(res){ if(res && res.pieces) LS.set('pieces', { ...(LS.get('pieces') || {}), ...res.pieces }); }
async function refreshPieces(){          // 앱을 열 때 한 번: 도장 조각·순번·옮겨진 번호를 서버와 맞춤
  const m = me(); if(!m) return;
  const res = await send({ num: m.num, key: m.key, stage:'' });
  if(res && res.ok){ keepPieces(res); if(res.rank) LS.set('rank', res.rank); paintCard(); }
}
async function recordClear(stage){
  const m = me(); if(!m) return null;
  const d = done(); d.add(stage); LS.set('done', [...d]);
  const res = await send({ num: m.num, key: m.key, stage });
  if(res && res.ok){
    if(res.rank) LS.set('rank', res.rank);
    keepPieces(res);
    LS.set('pending', (LS.get('pending') || []).filter(s => s !== stage));
  }else{
    const p = new Set(LS.get('pending') || []); p.add(stage); LS.set('pending', [...p]);   // 인터넷이 끊겼으면 나중에 다시 보냄
  }
  paintCard();
  return res;
}
async function retryPending(){
  const p = LS.get('pending') || [];
  for(const s of p) await recordClear(s);
}

/* ───────── 미션 틀: 힌트 타이머, 클리어 연출 ───────── */
let mission = null;            // { id, timers:[], cleanup }
function stopMission(){
  if(!mission) return;
  mission.timers.forEach(clearTimeout);
  if(mission.cleanup) mission.cleanup();
  const g = $('.hw-ghost'); if(g) g.remove();
  mission = null;
}
function hints(list){             // [{at:초, text, fn}]
  list.forEach(h => mission.timers.push(setTimeout(() => { if(h.fn) h.fn(); ghostSay(h.text); }, h.at * 1000)));
}
function ghostSay(text){
  let g = $('.hw-ghost');
  if(!g){ g = document.createElement('div'); g.className = 'hw-ghost'; g.innerHTML = `<span class="g">${SVG.ghost}</span><span class="b"></span>`; document.body.appendChild(g); }
  g.querySelector('.b').textContent = text;
  sfx('ghost');
  requestAnimationFrame(() => g.classList.add('on'));
  if(mission) mission.timers.push(setTimeout(() => g.classList.remove('on'), 7000));
}
function openMission(id){
  stopMission();
  mission = { id, timers:[], cleanup:null, t0: Date.now() };
  ({ dark: mDark, soup: mSoup, scale: mScale, lantern: mLantern, cipher: mCipher })[id]();
}
async function win(id, msg){
  const wasDone = done().has(id);
  sfx('win');
  const box = document.createElement('div'); box.className = 'hw-win';
  box.innerHTML = `<div class="box"><div class="pk">${SVG.pumpkin()}</div><h3>클리어!</h3><p>${esc(msg)}</p></div>`;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('on'));
  burst(innerWidth / 2, innerHeight / 2 - 40);
  stopMission();
  const resP = wasDone ? Promise.resolve(null) : recordClear(id);
  await sleep(1250);
  const res = await Promise.race([resP, sleep(3500)]);      // 인터넷이 느려도 너무 오래 기다리지 않음
  if(!spaceEl){ box.remove(); return; }
  box.querySelector('.box').classList.add('out');
  await sleep(220);
  await showCard(id, box);                                    // '기록장에 넣기'를 누르면 끝남
  if(!spaceEl) return;
  if(done().size === STAGES.length && !wasDone){
    await sleep(350); bats();
    const r = (res && res.rank) || myRank();
    if(r) A.note(r <= prizes() ? `선착순 ${r}번째!` : '다섯 개 모두 클리어!',
      r <= prizes() ? '간식 당첨이에요. 반장·부반장에게 받으러 오세요.' : `${r}번째로 깼어요. 간식은 마감됐지만 참여상을 받아요.`);
    else A.note('다섯 개 모두 클리어!', '기록을 보내는 중이에요. 인터넷이 연결되면 순번이 정해져요.');
  }
}
/* 비밀 기록 카드 — host가 있으면 미션 클리어 직후(기록장으로 날아감), 없으면 기록장에서 다시 보기 */
function showCard(id, host){
  return new Promise(resolve => {
    const c = CARDS[id], pc = (LS.get('pieces') || {})[id];
    const ov = host || document.createElement('div');
    if(!host){ ov.className = 'hw-win'; document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on')); }
    ov.innerHTML = `<div class="hw-cardwrap"><div class="hw-cardx how-${host ? c.how : 'view'}">
        <div class="no">비밀 기록 ${c.n} / 5</div><h4>${c.t}</h4><p>${c.b}</p>
        ${pc ? `<span class="stamp">${esc(pc)}</span>` : '<span class="stamp wet">잉크가 마르는 중</span>'}</div>
      <button class="hw-btn${host ? '' : ' ghost'}">${host ? '기록장에 넣기' : '닫기'}</button></div>`;
    sfx('flip');
    if(host && c.how === 'drop') setTimeout(() => sfx('drop'), 520);
    const btn = ov.querySelector('.hw-btn'), card = ov.querySelector('.hw-cardx');
    const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 260); resolve(); };
    if(!host){ btn.onclick = close; ov.onclick = e => { if(e.target === ov) close(); }; return; }
    btn.onclick = async () => {
      btn.disabled = true; btn.style.opacity = 0;
      sfx('stash');
      if(spaceEl) showHome();
      const slot = spaceEl && spaceEl.querySelector(`.hw-slot2[data-s="${id}"]`);
      if(slot && !reduce){
        slot.style.visibility = 'hidden';
        const a = card.getBoundingClientRect(), b = slot.getBoundingClientRect();
        ov.classList.add('fly');
        await card.animate([
          { transform:'rotate(-1.5deg)', opacity:1 },
          { transform:`translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px,${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${b.width / a.width}) rotate(-2deg)`, opacity:.85 }
        ], { duration:560, easing:'cubic-bezier(.65,0,.35,1)', fill:'forwards' }).finished.catch(() => {});
        slot.style.visibility = '';
        slot.animate([{ transform:'scale(1.25)' }, { transform:'scale(1)' }], { duration:380, easing:'cubic-bezier(.34,1.56,.64,1)' });
      }
      ov.remove();
      const ln = spaceEl && spaceEl.querySelector(`.hw-lanterns .ln[data-s="${id}"]`);
      if(ln && !reduce){ ln.classList.add('pop'); sfx('ignite'); }
      resolve();
    };
  });
}

/* ───────── 달: 3초 꾹 누르면 일식 → 달의 뒷면(히든 미션) ───────── */
function bindMoon(el){
  if(!el) return;
  let raf = 0, t0 = 0, stopD = null, e = 0;
  const set = v => { e = v; el.style.setProperty('--e', v); };
  const tick = () => {
    const v = Math.min(1, (performance.now() - t0) / 3000); set(v);
    if(v >= 1) return end(true);
    raf = requestAnimationFrame(tick);
  };
  const begin = ev => { if(t0) return; ev.preventDefault(); t0 = performance.now(); stopD = drone(); raf = requestAnimationFrame(tick); };
  const end = ok => {
    if(!t0) return;
    cancelAnimationFrame(raf); t0 = 0; if(stopD){ stopD(); stopD = null; }
    if(ok === true){
      sfx('gong');
      if(!reduce) el.animate([{ filter:'none' }, { filter:'drop-shadow(0 0 30px #ff8a2a) brightness(1.4)' }, { filter:'none' }], { duration:700 });
      setTimeout(() => { if(spaceEl) showHidden(); }, 650);
      return;
    }
    const from = e, s0 = performance.now();
    const back = () => { const v = Math.max(0, from - (performance.now() - s0) / 450); set(v); if(v > 0 && !t0) requestAnimationFrame(back); };
    back();
  };
  el.addEventListener('pointerdown', begin);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => el.addEventListener(n, () => end(false)));
  el.addEventListener('contextmenu', ev => ev.preventDefault());
}
function showHidden(){
  const m = me(); if(!m) return;
  const all = done().size === STAGES.length, h = LS.get('hidden');
  const okHTML = n => `<div class="hw-mine" style="text-align:center">히든 미션 성공 · <b>${n}번째</b>로 달의 뒷면을 봤어요</div>
    <p class="hw-rules">이 비밀은 너만 알고 있어 줘. 반장·부반장에게 <b>"달의 뒷면을 봤다"</b>고 말하면 상품을 받아요. 명단에 이미 기록돼 있어요.</p>`;
  const body = h ? okHTML(h)
    : !all ? `<div class="qq">달이 아무 말도 하지 않아요.<br>등불 다섯 개가 모두 타오르는 밤에 다시 와 보세요.</div>`
    : `<div class="qq">여기까지 온 걸 축하해요.<br>할로윈이 생기기 훨씬 전, 이 축제는<br>다른 이름으로 불렸어요.<br><b>그 진짜 이름은?</b></div>
       <input class="hw-input hw-hid" id="hwHid" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="정답">
       <button class="hw-btn" id="hwHidGo">달에게 말하기</button>
       <p class="hw-rules">정답은 친구에게 알려 주지 말고, 직접 찾게 해 주세요. 비밀은 찾아낸 사람의 것이에요.</p>`;
  const root = view(`${topbar('달의 뒷면')}<div class="hw-back"><div class="bm">${SVG.moon}</div><div id="hwHidBody">${body}</div></div>`, 'hw-stage hw-in');
  bindBack(root, () => showHome());
  const go = $('#hwHidGo', root); if(!go) return;
  const inp = $('#hwHid', root);
  const submit = async () => {
    const v = inp.value.trim(); if(!v) return;
    go.disabled = true; go.textContent = '달이 듣는 중…';
    const res = await send({ num: m.num, key: m.key, answer: v });
    go.disabled = false; go.textContent = '달에게 말하기';
    if(res && res.ok && res.hidden){
      LS.set('hidden', res.hidden); sfx('secret'); bats(); burst(innerWidth / 2, innerHeight / 3);
      $('#hwHidBody', root).innerHTML = okHTML(res.hidden);
    }else if(res && res.wrong){
      sfx('wrong'); inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
      A.toast(res.left > 0 ? (res.left <= 5 ? `달이 고개를 저어요 · 남은 기회 ${res.left}번` : '달이 고개를 저어요') : '오늘은 달이 더 이상 대답하지 않아요');
    }else if(res && res.locked){ A.note('아직이에요', '미션 다섯 개를 모두 깬 뒤에 다시 와 보세요.'); }
    else A.note('전하지 못했어요', (res && res.error) || '인터넷 연결을 확인해 주세요.');
  };
  go.onclick = submit;
  inp.onkeydown = e => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); submit(); } };
}
function burst(x, y){
  if(reduce) return;
  for(let i = 0; i < 18; i++){
    const s = document.createElement('i'); s.className = 'hw-spark';
    const a = Math.PI * 2 * i / 18, d = 70 + Math.random() * 70;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.background = ['#ffd28a','#ff8a2a','#b07cff','#9be15d'][i % 4];
    document.body.appendChild(s);
    s.animate([{ transform:'translate(0,0) scale(1)', opacity:1 }, { transform:`translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.3)`, opacity:0 }],
      { duration: 700 + Math.random() * 300, easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards' }).onfinish = () => s.remove();
  }
}
function bats(){
  sfx('bats');
  if(reduce) return;
  for(let i = 0; i < 7; i++){
    const b = document.createElement('span'); b.className = 'hw-batfly'; b.innerHTML = SVG.bat;
    const y0 = innerHeight * (.25 + Math.random() * .5), w = 30 + Math.random() * 26;
    b.style.width = w + 'px'; b.style.left = '-60px'; b.style.top = y0 + 'px'; b.style.color = i % 2 ? '#2a1838' : '#1b1222';
    document.body.appendChild(b);
    b.animate([{ transform:'translate(0,0)' }, { transform:`translate(${innerWidth * .5}px,${-60 - Math.random() * 80}px)` }, { transform:`translate(${innerWidth + 120}px,${-160 - Math.random() * 120}px)` }],
      { duration: 1500 + Math.random() * 700, delay: i * 90, easing:'cubic-bezier(.45,0,.55,1)', fill:'forwards' }).onfinish = () => b.remove();
  }
}
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const stageHead = (s, extra = '') => `${topbar(s.name, extra)}`;
function backToHome(root){ bindBack(root, () => { stopMission(); showHome(); }); }

/* ───────── 1. 정전된 3반 ─────────
   공간이 잠깐 사라지고 실제 앱 화면이 정전됨. 손가락(마우스)이 손전등. */
function mDark(){
  const s = STAGES[0];
  spaceEl.style.visibility = 'hidden';
  const W = innerWidth, H = innerHeight;
  const spots = [];
  for(let tries = 0; spots.length < 3 && tries < 400; tries++){
    const p = { x: 30 + rnd(W - 60), y: 110 + rnd(Math.max(60, H - 220)) };
    if(spots.every(q => Math.hypot(q.x - p.x, q.y - p.y) > Math.min(W, H) * .32)) spots.push(p);
  }
  while(spots.length < 3) spots.push({ x: 40 + rnd(W - 80), y: 120 + rnd(H - 240) });
  let wall = null;
  for(let tries = 0; !wall && tries < 300; tries++){
    const q = { x: 90 + rnd(Math.max(20, W - 180)), y: 130 + rnd(Math.max(40, H - 260)) };
    if(spots.every(p => Math.hypot(p.x - q.x, p.y - q.y) > 110)) wall = q;
  }
  wall = wall || { x: W / 2, y: H - 140 };
  const el = document.createElement('div'); el.className = 'hw-dark';
  el.innerHTML = `<span class="wall" style="left:${wall.x}px;top:${wall.y}px">달을 오래 바라봐</span>` + spots.map((p, i) => `<span class="p" data-i="${i}" style="left:${p.x}px;top:${p.y}px">${SVG.pumpkin()}</span>`).join('') +
    `<div class="shade"></div><div class="glow"></div>
     <div class="bar"><button class="hw-iconbtn" data-back aria-label="그만하기">${SVG.back}</button><b>${s.name}</b><span class="cnt">0 / 3</span></div>`;
  document.body.appendChild(el);
  let got = 0;
  const setLight = (x, y) => { el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px'); };
  setLight(W / 2, H / 2);
  const tryGet = (x, y) => {
    el.querySelectorAll('.p:not(.got)').forEach(p => {
      const px = parseFloat(p.style.left), py = parseFloat(p.style.top);
      if(Math.hypot(px - x, py - y) < 34){
        p.classList.add('got'); got++; el.querySelector('.cnt').textContent = `${got} / 3`; sfx('find');
        burstAt(px, py);
        el.querySelectorAll(`.hintdot[data-i="${p.dataset.i}"]`).forEach(h => h.remove());
        if(got === 3) finish();
      }
    });
  };
  const burstAt = (x, y) => { if(!reduce) for(let i = 0; i < 8; i++){ const sp = document.createElement('i'); sp.className = 'hw-spark'; sp.style.left = x + 'px'; sp.style.top = y + 'px'; sp.style.zIndex = 98; el.appendChild(sp);
    const a = Math.PI * 2 * i / 8; sp.animate([{ transform:'none', opacity:1 }, { transform:`translate(${Math.cos(a) * 36}px,${Math.sin(a) * 36}px)`, opacity:0 }], { duration:500, easing:'ease-out', fill:'forwards' }).onfinish = () => sp.remove(); } };
  const onMove = e => { setLight(e.clientX, e.clientY); };
  const onDown = e => { if(e.target.closest('[data-back]')) return; setLight(e.clientX, e.clientY); tryGet(e.clientX, e.clientY); };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
  el.querySelector('[data-back]').onclick = () => { stopMission(); showHome(); };
  const finish = () => {
    el.querySelector('.shade').style.opacity = 0;
    setTimeout(() => win('dark', '불이 다시 들어왔어요'), 450);
  };
  mission.cleanup = () => { el.remove(); if(spaceEl) spaceEl.style.visibility = ''; };
  hints([
    { at:40, text:'번개가 칠 때 잘 봐… 호박이 반짝여!', fn: () => { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 180); setTimeout(() => el.classList.add('flash'), 360); setTimeout(() => el.classList.remove('flash'), 520); } },
    { at:80, text:'남은 호박 자리에 주황빛을 비춰 둘게', fn: () => el.querySelectorAll('.p:not(.got)').forEach(p => el.insertAdjacentHTML('beforeend', `<span class="hintdot" data-i="${p.dataset.i}" style="left:${p.style.left};top:${p.style.top}"></span>`)) }
  ]);
  ghostSay('불이 나갔어! 화면을 문질러서 비추고, 호박이 보이면 톡 눌러');
}

/* ───────── 2. 마녀의 수프 (네 칸 순서 추리) ───────── */
function mSoup(){
  const s = STAGES[1];
  let secret = shuffle(INGR.map(i => i.id)).slice(0, 4), cur = [], hist = [], locked = new Map();
  const TRIES = 6;
  const root = view(`${stageHead(s, '<span class="hw-chip" id="hwTries"></span>')}
    <p class="hw-q">재료 다섯 가지 중 <b>네 가지</b>를 정해진 순서로 넣어야 수프가 완성돼요. 같은 재료는 한 번만. 넣을 때마다 솥이 알려 줘요.</p>
    <div class="hw-pot" id="hwPot">${potSVG()}${[18,46,74,100,128,152].map((l, i) => `<i class="hw-bub" style="left:${l + 14}px;animation-delay:${i * .3}s"></i>`).join('')}</div>
    <div class="hw-legend"><span><i style="background:#9be15d"></i>재료·자리 다 맞음</span><span><i style="background:radial-gradient(circle,#ffd34d 0 40%,transparent 45%);border:1.5px solid #ffd34d"></i>재료만 맞음</span></div>
    <div class="hw-slots" id="hwSlots"></div>
    <div class="hw-ings" id="hwIngs">${INGR.map(i => `<button class="hw-ing" data-i="${i.id}">${SVG[i.id]}${i.name}</button>`).join('')}</div>
    <button class="hw-btn" id="hwPour" disabled>솥에 넣기</button>
    <div class="hw-hist" id="hwHist"></div>`, 'hw-stage hw-in');
  backToHome(root);
  const pot = $('#hwPot', root);
  const paint = () => {
    $('#hwTries', root).textContent = `기회 ${TRIES - hist.length}번`;
    $('#hwSlots', root).innerHTML = [0,1,2,3].map(k => {
      const v = locked.has(k) ? locked.get(k) : cur[k];
      return `<span class="hw-slot${v ? ' f' : ''}${locked.has(k) ? ' lock' : ''}" data-k="${k}">${v ? SVG[v] : ''}</span>`; }).join('');
    const used = new Set([...cur.filter(Boolean), ...locked.values()]);
    root.querySelectorAll('.hw-ing').forEach(b => b.disabled = used.has(b.dataset.i) || filled() === 4);
    $('#hwPour', root).disabled = filled() < 4;
    root.querySelectorAll('.hw-slot').forEach(sl => sl.onclick = () => { const k = +sl.dataset.k; if(!locked.has(k) && cur[k]){ cur[k] = null; paint(); } });
  };
  const filled = () => [0,1,2,3].filter(k => locked.has(k) || cur[k]).length;
  root.querySelectorAll('.hw-ing').forEach(b => b.onclick = () => {
    const k = [0,1,2,3].find(k => !locked.has(k) && !cur[k]); if(k === undefined) return;
    cur[k] = b.dataset.i; sfx('drop'); paint();
  });
  $('#hwPour', root).onclick = () => {
    const guess = [0,1,2,3].map(k => locked.has(k) ? locked.get(k) : cur[k]);
    const x = guess.filter((g, k) => g === secret[k]).length;
    const o = guess.filter((g, k) => g !== secret[k] && secret.includes(g)).length;
    hist.push({ guess, x, o });
    $('#hwHist', root).insertAdjacentHTML('afterbegin', `<div class="hw-hr" data-g="${guess.join(',')}"><span class="ic">${guess.map(g => SVG[g]).join('')}</span>
      <span class="pegs">${'<i class="x"></i>'.repeat(x)}${'<i class="o"></i>'.repeat(o)}${'<i></i>'.repeat(4 - x - o)}</span></div>`);
    brew(pot, x); sfx('pour');
    if(x === 4) return setTimeout(() => win('soup', '마녀도 감탄한 완벽한 수프!'), 700);
    cur = [];
    if(hist.length >= TRIES){
      A.toast('수프가 넘쳐 버렸어요! 새 재료로 다시 시작해요', 3200); sfx('wrong');
      secret = shuffle(INGR.map(i => i.id)).slice(0, 4); hist = []; locked = new Map(); $('#hwHist', root).innerHTML = ''; brew(pot, 0);
    }
    paint();
  };
  paint();
  hints([
    { at:40, text:'첫 번째 칸에 들어갈 재료를 알려 줄게', fn: () => { locked.set(0, secret[0]); cur[0] = null; cur = cur.map(v => v === secret[0] ? null : v); paint(); } },
    { at:80, text:'두 번째 칸도 고정해 뒀어. 나머지는 초록 구슬을 보며!', fn: () => { locked.set(1, secret[1]); cur = cur.map((v, k) => (k === 1 || v === secret[1]) ? null : v); paint(); } }
  ]);
}
function potSVG(){
  return `<svg class="pot" viewBox="0 0 200 170" aria-hidden="true">
    <ellipse cx="100" cy="74" rx="78" ry="16" fill="#2b2233"/>
    <ellipse class="brew" cx="100" cy="74" rx="70" ry="12" fill="#5a3f7a"/>
    <path d="M24 76c0 52 30 80 76 80s76-28 76-80" fill="#231b2b"/>
    <path d="M38 96c8 30 30 46 62 46" stroke="#3a2f45" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M60 154l-12 12M140 154l12 12" stroke="#231b2b" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="100" cy="74" rx="80" ry="17" fill="none" stroke="#3a2f45" stroke-width="6"/></svg>`;
}
function brew(pot, x){
  const col = ['#5a3f7a', '#6b4f8a', '#7a6aa0', '#83b862', '#9be15d'][x];
  const b = pot.querySelector('.brew'); if(b) b.setAttribute('fill', col);
  pot.querySelectorAll('.hw-bub').forEach(i => { i.style.setProperty('--bc', col); i.style.animationDuration = (2.2 - x * .35) + 's'; });
  if(!reduce) pot.animate([{ transform:'none' }, { transform:'translateY(-4px) scale(1.02)' }, { transform:'none' }], { duration:420, easing:'cubic-bezier(.34,1.56,.64,1)' });
}

/* ───────── 3. 사탕 저울 (9개 중 무거운 1개, 저울 2번) ───────── */
function mScale(){
  const s = STAGES[2];
  let heavy = rnd(9), place = Array(9).fill(''), weighs = 0, picking = false;
  const cols = shuffle(CANDY.slice());
  const root = view(`${stageHead(s, '<span class="hw-chip" id="hwW"></span>')}
    <p class="hw-q">겉모습은 똑같은데 하나만 살짝 무거워요. 저울은 <b>두 번</b>만 쓸 수 있어요. 사탕을 누르면 왼쪽 → 오른쪽 → 내리기 순서로 바뀌어요.</p>
    <div class="hw-scale" id="hwScale"><div class="post"></div><div class="base"></div>
      <div class="beam" id="hwBeam"><div class="pan l"><div class="str"></div><div class="dish"></div><div class="on" id="hwPL"></div></div><div class="pan r"><div class="str"></div><div class="dish"></div><div class="on" id="hwPR"></div></div></div></div>
    <div class="hw-candies" id="hwCandies"></div>
    <div class="hw-row2"><button class="hw-btn ghost" id="hwPick">무거운 사탕 고르기</button><button class="hw-btn" id="hwWeigh">저울에 달기</button></div>
    <div class="hw-log" id="hwLog"></div>`, 'hw-stage hw-in');
  backToHome(root);
  const beam = $('#hwBeam', root), pans = root.querySelectorAll('.pan');
  const tilt = deg => { beam.style.transform = `rotate(${deg}deg)`; pans.forEach(p => p.style.transform = `rotate(${-deg}deg)`); };
  const paint = () => {
    $('#hwW', root).textContent = `저울 ${2 - weighs}번 남음`;
    $('#hwCandies', root).innerHTML = cols.map((c, i) => `<button class="hw-candy ${place[i]}${picking ? ' pick' : ''}" data-i="${i}">${candySVG(c)}${i + 1}<span class="tag">${place[i] === 'L' ? '왼' : place[i] === 'R' ? '오' : ''}</span></button>`).join('');
    $('#hwPL', root).innerHTML = place.map((p, i) => p === 'L' ? candySVG(cols[i]) : '').join('');
    $('#hwPR', root).innerHTML = place.map((p, i) => p === 'R' ? candySVG(cols[i]) : '').join('');
    const nl = place.filter(p => p === 'L').length, nr = place.filter(p => p === 'R').length;
    const w = $('#hwWeigh', root);
    w.disabled = picking || weighs >= 2 || !nl || nl !== nr;
    w.textContent = weighs >= 2 ? '저울을 다 썼어요' : (nl && nl !== nr) ? '양쪽 개수를 같게' : '저울에 달기';
    $('#hwPick', root).textContent = picking ? '고르기 취소' : '무거운 사탕 고르기';
    root.querySelectorAll('.hw-candy').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if(picking){
        if(i === heavy) return win('scale', '역시! 이 사탕이 범인이었어요');
        A.toast('앗, 그 사탕은 보통 무게예요. 사탕을 다시 섞을게요', 3000); sfx('wrong');
        return reset();
      }
      place[i] = place[i] === '' ? 'L' : place[i] === 'L' ? 'R' : ''; tilt(0); paint();
    });
  };
  const reset = () => { heavy = rnd(9); place = Array(9).fill(''); weighs = 0; picking = false; shuffle(cols); tilt(0); $('#hwLog', root).innerHTML = ''; paint(); };
  $('#hwWeigh', root).onclick = () => {
    const L = place.map((p, i) => p === 'L' ? i : -1).filter(i => i >= 0), R = place.map((p, i) => p === 'R' ? i : -1).filter(i => i >= 0);
    const r = L.includes(heavy) ? 'L' : R.includes(heavy) ? 'R' : '=';
    weighs++; sfx('creak');
    tilt(r === 'L' ? -9 : r === 'R' ? 9 : 0);
    if(r === '=' && !reduce) beam.animate([{ transform:'rotate(-3deg)' }, { transform:'rotate(3deg)' }, { transform:'rotate(0)' }], { duration:700, easing:'ease-out' });
    const nm = a => a.map(i => i + 1).join('·');
    $('#hwLog', root).insertAdjacentHTML('beforeend', `<div>${weighs}번째: 왼쪽 ${nm(L)} vs 오른쪽 ${nm(R)} → ${r === 'L' ? '왼쪽이 무거워요' : r === 'R' ? '오른쪽이 무거워요' : '평평해요'}</div>`);
    setTimeout(() => { place = Array(9).fill(''); if(weighs >= 2){ picking = true; A.toast('이제 무거운 사탕을 골라 주세요'); } paint(); }, 1100);
    paint();
  };
  $('#hwPick', root).onclick = () => { picking = !picking; paint(); };
  paint();
  hints([
    { at:40, text:'아홉 개를 세 묶음으로 나눠 봐. 세 개씩 양쪽에!', fn: null },
    { at:80, text:'무거운 묶음을 찾았다면, 그중 두 개만 하나씩 올려 봐', fn: null }
  ]);
}

/* ───────── 4. 호박 등불 (누르면 상하좌우가 함께 바뀜, 모두 켜기) ───────── */
function mLantern(){
  const s = STAGES[3];
  const MASK = i => { let m = 1 << i; const r = i / 3 | 0, c = i % 3; if(r) m |= 1 << (i - 3); if(r < 2) m |= 1 << (i + 3); if(c) m |= 1 << (i - 1); if(c < 2) m |= 1 << (i + 1); return m; };
  const FULL = 511;
  const solve = st => { for(let p = 0; p < 512; p++){ let x = st; for(let i = 0; i < 9; i++) if(p >> i & 1) x ^= MASK(i); if(x === FULL) return p; } return 0; };
  let state, moves = 0;
  const fresh = () => {                  // 정답이 4~5번 누르기인 판을 사람마다 다르게
    for(;;){ const presses = shuffle([0,1,2,3,4,5,6,7,8]).slice(0, 4 + rnd(2)); let x = FULL; presses.forEach(i => x ^= MASK(i)); if(x !== FULL && solve(x)){ state = x; break; } }
    moves = 0;
  };
  fresh();
  const root = view(`${stageHead(s, '<span class="hw-chip" id="hwMv"></span>')}
    <p class="hw-q">등불을 누르면 <b>그 등불과 위·아래·양옆</b>이 함께 켜지거나 꺼져요. 아홉 개를 모두 밝혀 주세요.</p>
    <div class="hw-grid" id="hwGrid"></div>
    <p class="hw-moves">막히면 아래 버튼으로 처음 상태로 돌릴 수 있어요</p>
    <button class="hw-btn ghost" id="hwReset">처음부터</button>`, 'hw-stage hw-in');
  backToHome(root);
  let start = state, hintCell = -1;
  const paint = () => {
    $('#hwMv', root).textContent = `${moves}번 누름`;
    $('#hwGrid', root).innerHTML = [...Array(9)].map((_, i) => `<button class="hw-cell${state >> i & 1 ? ' on' : ''}${i === hintCell ? ' hint' : ''}" data-i="${i}" aria-label="등불 ${i + 1}">${SVG.pumpkin(!!(state >> i & 1))}</button>`).join('');
    root.querySelectorAll('.hw-cell').forEach(b => b.onclick = () => {
      const i = +b.dataset.i; state ^= MASK(i); moves++; sfx('ignite'); if(i === hintCell) hintCell = -1;
      if(!reduce) b.animate([{ transform:'scale(.9)' }, { transform:'scale(1)' }], { duration:260, easing:'cubic-bezier(.34,1.56,.64,1)' });
      paint();
      if(state === FULL) setTimeout(() => win('lantern', '아홉 개의 등불이 모두 타올라요'), 450);
    });
  };
  $('#hwReset', root).onclick = () => { state = start; moves = 0; hintCell = -1; paint(); };
  paint();
  const showHint = () => { const p = solve(state); for(let i = 0; i < 9; i++) if(p >> i & 1){ hintCell = i; break; } paint(); };
  hints([
    { at:40, text:'보라색 테두리 등불을 눌러 봐', fn: showHint },
    { at:80, text:'또 하나! 테두리가 생긴 곳을 차례로 눌러', fn: showHint }
  ]);
}

/* ───────── 5. 유령의 암호 (앱 속 시간표·급식을 단서로) ───────── */
function mCipher(){
  const s = STAGES[4];
  const DAYS = ['일','월','화','수','목','금','토'];
  const tt = (A.timetable() || []).filter(t => t && t.subject && t.date);
  const ml = (A.meals() || []).filter(m => m && m.menu && m.menu.length);
  let clues = [], ref = '';
  const dName = ymd => DAYS[new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00`).getDay()];
  const first = t => String(t).replace(/[^가-힣A-Za-z0-9]/g, '').charAt(0);
  if(tt.length >= 6){
    // 날짜·교시가 겹치지 않게 세 칸을 고르고, 같은 요일이 두 번 나오면 날짜로 구분
    const uniq = shuffle(tt.slice()).filter((t, i, a) => a.findIndex(q => q.subject === t.subject) === i);
    const pick = [];                       // 되도록 서로 다른 날에서 골라 표를 오가게
    uniq.forEach(t => { if(pick.length < 3 && !pick.some(q => q.date === t.date)) pick.push(t); });
    uniq.forEach(t => { if(pick.length < 3 && !pick.includes(t)) pick.push(t); });
    clues = pick.map(t => ({ q: `${+t.date.slice(4,6)}월 ${+t.date.slice(6,8)}일(${dName(t.date)}) <b>${t.period}교시</b> 과목의 첫 글자`, a: first(t.subject) }));
    ref = `<details class="hw-ref" id="hwRef"><summary>시간표 펼쳐 보기<span>▾</span></summary><div class="in">${A.timetableHTML()}</div></details>`;
  }else if(ml.length >= 2){
    const pick = shuffle(ml.slice()).slice(0, 3);
    clues = pick.map(m => { const k = rnd(Math.min(m.menu.length, 4)); return { q: `${+m.date.slice(4,6)}월 ${+m.date.slice(6,8)}일(${dName(m.date)}) 급식 <b>${k + 1}번째</b> 메뉴의 첫 글자`, a: first(m.menu[k]) }; });
    ref = `<details class="hw-ref" id="hwRef"><summary>급식표 펼쳐 보기<span>▾</span></summary><div class="in"><table>${ml.slice(0, 6).map(m => `<tr><th>${+m.date.slice(4,6)}/${+m.date.slice(6,8)}</th><td style="text-align:left;white-space:normal">${m.menu.map(esc).join(', ')}</td></tr>`).join('')}</table></div></details>`;
  }else{
    // 시간표·급식이 없는 날(주말·방학)을 위한 수수께끼
    const bank = shuffle([
      { q:'핼러윈에 속을 파내 등불을 만드는 채소 (두 글자 중 첫 글자)', a:'호' }, { q:'밤에 거꾸로 매달려 자는 동물 (두 글자 중 첫 글자)', a:'박' },
      { q:'빗자루를 타고 나는 사람 (두 글자 중 첫 글자)', a:'마' }, { q:'하얀 천을 뒤집어쓴 귀신 (두 글자 중 첫 글자)', a:'유' },
      { q:'"과자 안 주면 장난칠 거야!" 할 때 받는 것 (두 글자 중 첫 글자)', a:'사' }
    ]).slice(0, 3);
    clues = bank;
  }
  const answer = clues.map(c => c.a).join('');
  const root = view(`${stageHead(s)}
    <p class="hw-q">유령이 교실에 쪽지를 남기고 사라졌어요. 단서의 답을 순서대로 이어 붙이면 암호가 돼요.</p>
    <div class="hw-note"><ol>${clues.map(c => `<li>${c.q}</li>`).join('')}</ol><div class="sig">— ${A.SPACE ? '교실' : '3반'} 유령</div></div>
    ${ref}
    <input class="hw-input" id="hwAns" maxlength="6" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="세 글자">
    <button class="hw-btn" id="hwTry">암호 확인</button>`, 'hw-stage hw-in');
  backToHome(root);
  const inp = $('#hwAns', root);
  const check = () => {
    const v = inp.value.replace(/\s/g, '');
    if(v === answer) return win('cipher', `암호는 "${answer}"! 유령이 웃으며 사라져요`);
    inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); sfx('wrong');
    A.toast(v.length < answer.length ? `${answer.length}글자를 모두 입력해 주세요` : '유령이 고개를 저어요. 다시 볼까요?');
  };
  $('#hwTry', root).onclick = check;
  inp.onkeydown = e => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); check(); } };
  hints([
    { at:40, text: ref ? '아래 표를 펼쳐서 날짜와 교시를 찾아봐' : '핼러윈 하면 떠오르는 것들이야!', fn: () => { const d = $('#hwRef', root); if(d) d.open = true; } },
    { at:80, text:`첫 글자는 "${answer.charAt(0)}"야. 나머지도 할 수 있어!`, fn: null }
  ]);
}
