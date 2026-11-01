/* ══════════════════════════════════════════════════════════════
   할로윈 밤 — 3반 알리미 시즌 이벤트
   · 관리자가 이벤트를 켰을 때만 앱이 이 파일을 불러옴 (index.html의 EVENT_JS)
   · 테마(호박 랜턴의 밤) + 메인 카드 + 이벤트 공간 + 미션 다섯 개
   · 클리어 기록과 선착순 순번은 서버(worker.js /event)가 서버 시각으로 정함
   ══════════════════════════════════════════════════════════════ */

let A = null;                    // 앱이 넘겨준 기능 모음
let cfg = {};                    // config/event (on, prizes, skip, max)
let stats = { dist:[0,0,0,0,0,0], ranked:0, last:null, total:0 };
let unsubStats = null, started = false, firstStats = true, webObs = null;
let ROUND = 1;                   // 1일차 = 할로윈 밤, 2일차 = 망자의 날 (config/event.round)

const STAGES1 = [
  { id:'dark',    name:'정전된 3반',   line:'손전등으로 숨은 호박 3개 찾기',      kind:'관찰' },
  { id:'soup',    name:'마녀의 수프',   line:'재료 네 가지의 순서를 추리하기',      kind:'추리' },
  { id:'scale',   name:'사탕 저울',     line:'저울 두 번으로 무거운 사탕 찾기',     kind:'논리' },
  { id:'lantern', name:'호박 등불',     line:'아홉 개의 등불을 모두 밝히기',        kind:'패턴' },
  { id:'cipher',  name:'유령의 암호',   line:'앱 속 단서로 쪽지 해독하기',          kind:'해독' }
];
const STAGES2 = [
  { id:'bread',   name:'비밀 재료',     line:'거짓말 쪽지 속에서 진짜 재료 단지 찾기',  kind:'부엌' },
  { id:'paper',   name:'접힌 깃발',     line:'접고 뚫은 종이를 펼친 모양 맞히기',      kind:'작업대' },
  { id:'bell',    name:'영혼의 종',     line:'종 네 개의 순서를 추리하기',            kind:'창가' },
  { id:'spirit',  name:'바랜 사진',     line:'편지 단서로 가족의 자리 찾기',          kind:'제단' }
];
let STAGES = STAGES1;
const st = id => STAGES.find(x => x.id === id);
let PREVIEW = false;              // 총괄 관리자의 '2일차 미리보기' (이 기기에서만 · 서버 기록 없음)
const rk = k => ROUND > 1 ? `${PREVIEW ? 'p' : 'r'}${ROUND}:${k}` : k;          // 라운드마다 기기 기록을 따로 (미리보기는 또 따로)
const KN = () => ['', '한', '두', '세', '네', '다섯'][STAGES.length];
const TITLE = () => ROUND > 1 ? '망자의 날' : '할로윈 밤';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => A ? A.esc(s) : String(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LS = {
  get(k){ try{ return JSON.parse(localStorage.getItem('hw:' + (A.SPACE || '') + k)); }catch{ return null; } },
  set(k, v){ try{ localStorage.setItem('hw:' + (A.SPACE || '') + k, JSON.stringify(v)); }catch{} }
};
const me = () => LS.get('me');                         // { num, key }
const done = () => new Set(LS.get(rk('done')) || []);
const myRank = () => LS.get(rk('rank')) || 0;
const prizes = () => { const v = ROUND > 1 ? cfg['prizes' + ROUND] : cfg.prizes; return v === undefined || v === null || v === '' ? 15 : Number(v); };
const coopGoal = () => Number(cfg.coopGoal) || 60;
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
  mari: `<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#ff9f1c">${[0,45,90,135,180,225,270,315].map(a => `<ellipse cx="20" cy="8.5" rx="6" ry="8" transform="rotate(${a} 20 20)"/>`).join('')}</g><g fill="#ffbb4d">${[22,67,112,157,202,247,292,337].map(a => `<ellipse cx="20" cy="12" rx="4.4" ry="6" transform="rotate(${a} 20 20)"/>`).join('')}</g><circle cx="20" cy="20" r="5.5" fill="#d9601a"/></svg>`,
  skull: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3C10.5 3 4.5 9.5 4.5 18c0 5 2 8.5 5.5 10.5V35h20v-6.5c3.5-2 5.5-5.5 5.5-10.5C35.5 9.5 29.5 3 20 3z" fill="#f6eee4"/><circle cx="13.5" cy="18" r="5" fill="#2ec4b6"/><circle cx="26.5" cy="18" r="5" fill="#ff4f9a"/><circle cx="13.5" cy="18" r="2" fill="#160f22"/><circle cx="26.5" cy="18" r="2" fill="#160f22"/><path d="M20 22.5l-2.2 4h4.4z" fill="#160f22"/><path d="M13 31h14M16.5 29v4M20 29v4M23.5 29v4" stroke="#160f22" stroke-width="1.3"/><path d="M16 8.5q4-3.5 8 0" stroke="#ff9f1c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  grave: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 36V16a10 10 0 0120 0v20z" fill="#3b2f48"/><path d="M20 15v11M15.5 19.5h9" stroke="#6f5d82" stroke-width="2.4" stroke-linecap="round"/><path d="M6 36h28" stroke="#2a2134" stroke-width="3" stroke-linecap="round"/></svg>`,
  candle: lit => `<svg viewBox="0 0 40 64" aria-hidden="true" class="hw-cd${lit ? ' lit' : ''}"><g class="fl"><path d="M20 3c5.5 7.5 7.5 11.5 7.5 15.5a7.5 7.5 0 01-15 0C12.5 14.5 14.5 10.5 20 3z" fill="#ffc94d"/><path d="M20 10c3 5 4 8 4 10a4 4 0 01-8 0c0-2 1-5 4-10z" fill="#fff4d0"/></g><line x1="20" y1="22" x2="20" y2="28" stroke="#3a2a20" stroke-width="2" stroke-linecap="round"/><rect x="11" y="27" width="18" height="34" rx="3" fill="${lit ? '#f6e7cf' : '#6d5d78'}"/><path d="M11 34h18" stroke="#ff4f9a" stroke-width="3" opacity="${lit ? .75 : .35}"/><path d="M14 27v6" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/></svg>`,
  flag: (c, k) => `<svg viewBox="0 0 36 40" aria-hidden="true"><path fill="${c}" fill-rule="evenodd" d="M2 3h32v27l-4 5-4-5-4 5-4-5-4 5-4-5-4 5-4-5z${k % 2
    ? 'M18 9l5 6-5 6-5-6zM9 13m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0M27 13m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0M18 26m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'
    : 'M18 10m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0M8 22l3-4 3 4-3 4zM22 22l3-4 3 4-3 4z'}"/></svg>`,
  back: `<svg viewBox="0 0 24 24\" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
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
const CARDS1 = {
  dark:    { n:1, how:'drop',    t:'경계가 얇아지는 밤', b:'약 2000년 전 켈트족은 10월 31일을 한 해의 마지막 날로 여겼어요. 이날 밤에는 산 자와 죽은 자의 세계 사이 경계가 얇아진다고 믿었대요.' },
  soup:    { n:2, how:'rise',    t:'변장의 시작',       b:'사람들은 이 밤 떠도는 영혼에게 들키지 않으려고 동물 가죽이나 가면으로 변장했다고 전해져요. 오늘날 할로윈 코스튬의 뿌리예요.' },
  scale:   { n:3, how:'unwrap',  t:'소울 케이크',       b:'중세 영국에서는 사람들이 집집마다 돌며 기도를 해 주고 \'소울 케이크\'라는 과자를 받았어요. 트릭 오어 트릿의 조상이에요.' },
  lantern: { n:4, how:'project', t:'순무 등불',         b:'잭오랜턴은 원래 순무나 감자를 깎아 만들었어요. 아일랜드 사람들이 미국으로 건너가면서 크고 깎기 쉬운 호박으로 바뀌었어요.' },
  cipher:  { n:5, how:'leave',   t:'이름의 비밀',       b:'할로윈(Halloween)은 11월 1일 \'모든 성인의 날\' 전날 밤, All Hallows\' Eve가 줄어든 말이에요. 그런데 이 축제에는 이보다 훨씬 오래된 진짜 이름이 있어요…' }
};
const CARDS2 = {
  bread:   { n:1, how:'rise',    t:'망자의 빵',         b:'망자의 날(Día de Muertos)은 11월 1~2일 멕시코의 명절이에요. 세상을 떠난 가족이 잠시 돌아온다고 믿고, 슬퍼하기보다 함께 기억하며 즐겨요. 이때 굽는 둥근 \'망자의 빵\' 위의 십자 장식은 뼈를 나타낸다고 전해져요.' },
  paper:   { n:2, how:'unwrap',  t:'파펠 피카도',       b:'거리와 제단을 장식하는 \'파펠 피카도\'는 얇은 색종이를 겹쳐 접고 오려 만든 깃발이에요. 구멍 사이로 바람이 지나가며 펄럭이는 모습이 삶의 가벼움과 덧없음을 떠올리게 한대요.' },
  bell:    { n:3, how:'project', t:'오프렌다',          b:'가족들은 \'오프렌다\'라는 제단을 꾸며요. 떠난 사람의 사진과 좋아하던 음식을 올리고, 영혼이 길을 잃지 않도록 촛불을 밝혀 둬요. 망자의 날은 유네스코 인류무형문화유산이기도 해요.', mw:'촛불은 오른쪽부터 꺼야 해' },
  spirit:  { n:4, how:'drop',    t:'길을 비추는 꽃',    b:'주황색 금잔화(마리골드)는 진한 색과 향으로 영혼을 집까지 안내한다고 해요. 아즈텍 사람들은 이 꽃을 자기들 말(나와틀어)로 \'스물(20)의 꽃\'이라는 뜻의 이름으로 불렀어요… 그 이름은?' }
};
let CARDS = CARDS1;
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
function tone(f, d, { type = 'sine', vol = .2, at = 0, to = null, attack = .006, dest = null } = {}){
  const c = au(); if(!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + d + .03);
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
/* 이벤트 공간에서는 화면을 끌어내려도 새로고침되지 않게 */
html.hw-lock,html.hw-lock body{overscroll-behavior:none}
.hw-space,.hw-dark{overscroll-behavior:none}
.hw-scroll{overscroll-behavior:contain;position:relative;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top) + 8px) 20px calc(env(safe-area-inset-bottom) + 40px)}
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
html.hw-r2 .hw-back .bm svg{filter:none;animation:hw-spin 40s linear infinite}
@keyframes hw-spin{to{transform:rotate(360deg)}}
.hw-back .qq{margin:18px 0 0;padding:18px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid #2f2539;font-size:15px;font-weight:800;line-height:1.8}
.hw-back .qq b{color:#ffb070}
.hw-hid{letter-spacing:.14em!important;font-size:20px!important;text-transform:uppercase}
.hw-back .hw-rules{text-align:left}

/* ══ 2일차: 망자의 날 ══ */
html.hw-on.hw-r2,html.hw-on.hw-r2[data-theme="dark"],html.hw-on.hw-r2[data-theme="light"]{
  --paper:#150f1e;--panel:#1f1629;--rule:#33243f;--dim:#b4a3c4;--dimmer:#76658a;--urgent:#ff9f1c;--soft:#1f1629}
html.hw-on.hw-r2,html.hw-on.hw-r2 body{background:#150f1e}
html.hw-on.hw-r2 body{background:radial-gradient(110% 45% at 90% -8%,rgba(255,79,154,.16),transparent 60%),radial-gradient(90% 40% at -10% 105%,rgba(46,196,182,.12),transparent 60%),#150f1e!important}
html.hw-on.hw-r2 .tab.on{color:#ff9f1c!important;border-color:#ff9f1c!important}
html.hw-on.hw-r2 .urgentbox{border-color:#ff4f9a!important}
.hw-garland{position:fixed;top:0;left:0;right:0;height:30px;display:flex;justify-content:center;gap:2px;pointer-events:none;z-index:26;overflow:hidden;
  padding-top:env(safe-area-inset-top);transform-origin:50% 0;animation:hw-garl 6s ease-in-out infinite}
.hw-garland::before{content:'';position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 3px);height:1px;background:rgba(255,255,255,.25)}
.hw-garland svg{width:22px;height:25px;flex:none;opacity:.85;transform-origin:50% 0;animation:hw-flap 3.2s ease-in-out infinite}
.hw-garland svg:nth-child(2n){animation-delay:-1.2s}.hw-garland svg:nth-child(3n){animation-delay:-2.1s}
@keyframes hw-garl{50%{transform:translateY(1px)}}
@keyframes hw-flap{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) scaleY(.96)}}
.hw-petal{position:fixed;top:-20px;width:9px;height:12px;border-radius:60% 60% 50% 50%;background:#ff9f1c;opacity:.55;pointer-events:none;z-index:24;
  animation:hw-fall var(--d,16s) linear infinite;animation-delay:var(--dl,0s)}
@keyframes hw-fall{0%{transform:translate(0,-20px) rotate(0)}50%{transform:translate(var(--sx,30px),55vh) rotate(200deg)}100%{transform:translate(0,110vh) rotate(400deg)}}
.hw-mari{position:fixed;left:-8px;bottom:-6px;pointer-events:none;z-index:25;display:flex;align-items:flex-end;opacity:.6}
.hw-mari span{display:block}.hw-mari svg{width:100%;height:100%}
.hw-title-mg{width:.95em;height:.95em;flex:none;transform:translateY(-1px)}
.hw-title-mg svg{width:100%;height:100%;display:block}
.hw-cm{position:absolute;top:-6px;right:-6px;width:34px;height:34px;opacity:.5;pointer-events:none}
html.hw-r2 .hw-card{border-color:#5a2a4e;background:linear-gradient(135deg,#2c1433 0%,#1a1226 100%)}
html.hw-r2 .hw-card .pk{filter:drop-shadow(0 0 10px rgba(255,159,28,.6));transform:none}
html.hw-r2 .hw-card .go{background:#ff9f1c}
html.hw-r2 .hw-card .left{color:#ff9f1c}
html.hw-r2 .hw-card .bats{opacity:.6;top:-2px;display:flex;gap:2px}
html.hw-r2 .hw-card .bats svg{width:16px;height:18px;margin:0;opacity:1}
html.hw-r2 .hw-dots i.on{background:#ff9f1c}
html.hw-r2 .hw-space .sky{background:radial-gradient(85% 55% at 88% 0%,rgba(255,79,154,.24),transparent 60%),radial-gradient(70% 50% at 0% 100%,rgba(46,196,182,.22),transparent 70%),#110b18}
html.hw-r2 .hw-left{color:#ffbb4d;text-shadow:0 0 28px rgba(255,159,28,.45)}
html.hw-r2 .hw-chip{background:rgba(255,79,154,.14);color:#ff9ac4;border-color:rgba(255,79,154,.35)}
html.hw-r2 .hw-m .k{color:#2ec4b6}
html.hw-r2 .hw-m .st,html.hw-r2 .hw-btn:not(.ghost){background:#ff9f1c}
html.hw-r2 .hw-iris{background:radial-gradient(circle at var(--x) var(--y),#ffe0a0 0,#ff4f9a 20%,rgba(120,20,60,0) 48%)}
/* 제단과 촛불 */
.hw-altar{position:relative;margin:14px auto 18px;width:min(300px,86%)}
.hw-candles{margin:0!important;align-items:flex-end;gap:16px!important}
.hw-candles .ln{width:40px!important;height:64px!important;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hw-candles .ln svg{width:100%;height:100%;overflow:visible}
.hw-candles .ln.on{filter:drop-shadow(0 0 12px rgba(255,180,60,.6))}
.hw-candles .ln.out{filter:none}
.hw-cd .fl{opacity:0;transform-origin:20px 22px;transition:opacity .3s,transform .3s}
.hw-cd.lit .fl{opacity:1;animation:hw-flame 1.6s ease-in-out infinite}
.hw-candles .ln.out .fl{opacity:0!important;transform:scale(.2) translateY(-6px);animation:none}
@keyframes hw-flame{0%,100%{transform:scale(1,1) rotate(-2deg)}35%{transform:scale(.94,1.06) rotate(2deg)}70%{transform:scale(1.03,.95) rotate(-1deg)}}
.hw-altar .cloth{height:14px;margin:-2px -10px 0;border-radius:4px;background:repeating-linear-gradient(90deg,#ff4f9a 0 18px,#ff9f1c 18px 36px,#2ec4b6 36px 54px,#ffd34d 54px 72px);opacity:.85;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.hw-candles .ln.nudge{animation:hw-shake .35s}
.hw-coop{margin:18px 0 0;padding:13px 15px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid #33243f;text-align:left}
.hw-coop .hd{display:flex;align-items:baseline;justify-content:space-between;font-size:13.5px;font-weight:900}
.hw-coop .hd small{font-size:12.5px;font-weight:800;color:#b4a3c4;font-variant-numeric:tabular-nums}
.hw-coop .hd small b{color:#ffbb4d}
.hw-coop .bar{position:relative;height:10px;border-radius:5px;background:#2a1f35;overflow:hidden;margin-top:9px}
.hw-coop .fill{height:100%;width:var(--p,0%);border-radius:5px;background:linear-gradient(90deg,#ff4f9a,#ff9f1c);box-shadow:0 0 12px rgba(255,159,28,.6);transition:width .9s cubic-bezier(.23,1,.32,1)}
.hw-coop p{margin:8px 0 0;font-size:12px;font-weight:700;color:#9b8aab;line-height:1.6}
.hw-coop.full{border-color:rgba(255,159,28,.5);background:rgba(255,159,28,.08)}
.hw-coop.full .fill{background:linear-gradient(90deg,#ff4f9a,#ff9f1c,#ffd34d,#ff9f1c,#ff4f9a);background-size:200% 100%;animation:hw-shim 2.4s linear infinite}
@keyframes hw-shim{to{background-position:-200% 0}}
.hw-coop.full p{color:#ffd9a0}
.hw-cardx .mw{position:absolute;left:16px;bottom:12px;font-size:10.5px;font-weight:800;color:#8a5a2a;opacity:.33;transform:scaleX(-1) rotate(2deg);letter-spacing:.04em;white-space:nowrap}
/* ══ 2일차: 할머니의 집 (방탈출) ══ */
.fx{position:fixed;z-index:103;pointer-events:none;border-radius:50%}
.fx.petal{border-radius:60% 60% 50% 50%}
.fx.sq{border-radius:2px}
html.hw-r2 .hw-ghost{top:calc(env(safe-area-inset-top) + 100px);bottom:auto;transform:translateY(-20px)}
html.hw-r2 .hw-ghost.on{transform:none}
html.hw-r2 .hw-ghost .b{border-radius:16px 16px 16px 4px}
.hw-scroll.mw-mode{padding:0;overflow:hidden}
.hw-scroll > .mw-view{max-width:none;height:100%;display:flex;flex-direction:column}
.mw-top > .hw-top{max-width:560px;margin:0 auto}
.mw-top{padding:calc(env(safe-area-inset-top) + 8px) 16px 0;position:relative;z-index:5}
/* 방 */
.rm{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.rm-bar{display:flex;align-items:center;gap:8px;width:100%;max-width:560px;margin:0 auto;padding:0 16px 10px;box-sizing:border-box}
.rm-bk{flex:none;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#f6eee4;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.rm-bk b{color:#ffbb4d;margin-left:2px}
.rm-items{flex:1;display:flex;justify-content:center;gap:6px}
.rm-items i{width:32px;height:32px;padding:5px;box-sizing:border-box;border-radius:10px;border:1px dashed rgba(255,255,255,.16);opacity:.4;filter:grayscale(1);transition:opacity .4s,filter .4s,background .4s,transform .5s cubic-bezier(.34,1.56,.64,1)}
.rm-items i svg{width:100%;height:100%;display:block}
.rm-items i.on{opacity:1;filter:none;border:1px solid rgba(255,159,28,.45);background:rgba(255,159,28,.12)}
.rm-items i.pop{transform:scale(1.3)}
.rm-pv{align-self:center;display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:4px 4px 4px 12px;border-radius:999px;background:#9be15d;color:#14240a;font-size:11.5px;font-weight:900;white-space:nowrap}
.rm-pv button{height:24px;padding:0 10px;border-radius:999px;border:0;background:#14240a;color:#9be15d;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer}
.rm-stage{position:relative;flex:1;min-height:0;overflow:hidden;container-type:size;touch-action:pan-y;-webkit-user-select:none;user-select:none}
.rm-wall{position:absolute;inset:0;display:grid;place-items:center;padding:0 12px}
.rm-box{position:relative;width:min(100cqw - 24px,100cqh * 360 / 440);aspect-ratio:360/440;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.06)}
.rm-box > svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.rm-it{transition:opacity .7s}
.rm-it.off{opacity:0}
.rm-hs{position:absolute;z-index:3;border:0;padding:0;background:transparent;border-radius:16px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s}
.rm-hs:active{background:rgba(255,220,150,.1)}
.rm-hs .dot{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px;border-radius:50%;background:#ffd36b;animation:rm-dot 2.2s ease-out infinite}
.rm-hs.lock .dot{background:#9a8aab;animation:none;opacity:.55}
@keyframes rm-dot{0%{box-shadow:0 0 0 0 rgba(255,211,107,.7)}70%{box-shadow:0 0 0 16px rgba(255,211,107,0)}100%{box-shadow:0 0 0 0 rgba(255,211,107,0)}}
.rm-box .hw-candles{position:absolute;left:0;right:0;top:59.5%;margin:0!important;display:flex;justify-content:center;gap:5%!important;z-index:2}
.rm-box .hw-candles .ln{width:9.5%!important;height:auto!important;aspect-ratio:40/64}
.rm-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;max-width:560px;margin:0 auto;padding:12px 16px calc(env(safe-area-inset-bottom) + 14px);box-sizing:border-box}
.rm-ar{flex:1;max-width:150px;height:46px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#f6eee4;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:4px;transition:transform .14s cubic-bezier(.23,1,.32,1),background .2s}
.rm-ar:active{transform:scale(.95);background:rgba(255,255,255,.12)}
.rm-ar.r{justify-content:flex-end}
.rm-ar svg{width:18px;height:18px;flex:none}
.rm-ar.r svg{transform:scaleX(-1)}
.rm-nm{flex:none;text-align:center}
.rm-nm b{display:block;font-size:15px;font-weight:900;letter-spacing:-.03em}
.rm-nm span{display:flex;justify-content:center;gap:5px;margin-top:6px}
.rm-nm span i{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.22);transition:width .3s cubic-bezier(.23,1,.32,1),background .3s}
.rm-nm span i.on{width:16px;background:#ff9f1c}
.mw-intro{position:fixed;inset:0;z-index:110;display:grid;place-items:center;text-align:center;color:#f6eee4;padding:24px;
  background:radial-gradient(60% 50% at 50% 45%,rgba(255,79,154,.3),transparent 70%),#0d0815;transition:opacity .7s,transform .7s}
.mw-intro .mi{display:block;width:76px;margin:0 auto 14px;animation:mw-spin 2.4s cubic-bezier(.23,1,.32,1)}
.mw-intro .mi svg{width:100%;display:block}
.mw-intro small{display:block;font-size:12px;font-weight:900;letter-spacing:.32em;color:#ff9ac4;animation:hw-rise .7s .2s both}
.mw-intro h3{margin:8px 0 12px;font-size:32px;font-weight:900;letter-spacing:-.04em;animation:hw-rise .7s .35s both}
.mw-intro p{margin:0;font-size:14.5px;font-weight:700;color:#cbbfd8;line-height:1.75;animation:hw-rise .7s .5s both}
.mw-intro button{margin-top:22px;height:48px;padding:0 26px;border-radius:999px;border:0;background:#ff9f1c;color:#1b0d02;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;animation:hw-rise .7s .8s both}
.mw-intro.out{opacity:0;transform:scale(1.06);pointer-events:none}
@keyframes mw-spin{from{transform:rotate(-180deg) scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes rm-swing{0%{transform:rotate(0)}25%{transform:rotate(14deg)}55%{transform:rotate(-10deg)}80%{transform:rotate(5deg)}100%{transform:rotate(0)}}
/* 별점 */
.hw-win .stars{display:flex;justify-content:center;gap:6px;margin:10px 0 2px;font-size:30px}
.hw-win .stars i{font-style:normal;color:rgba(255,255,255,.18);transform:scale(.4);transition:transform .45s cubic-bezier(.34,1.56,.64,1),color .2s}
.hw-win .stars i.on{color:#ffd34d;transform:scale(1);text-shadow:0 0 16px rgba(255,211,77,.8)}
/* 퍼즐 공통 */
.pz{padding-bottom:28px}
.pz-story{margin:2px 0 14px;font-size:14px;font-weight:700;line-height:1.7;color:#cbbfd8}
.pz-story b{color:#ffbb4d}
.pz-hb{flex:none;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#a596b4;font-family:inherit;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;cursor:pointer;white-space:nowrap}
.pz-hb.on{background:#ffd34d;color:#2a1a02;border-color:#ffd34d;animation:hw-hot 1.4s ease-in-out infinite}
.pz-hb:disabled{cursor:default;opacity:.8}
.pz-hint{display:flex;flex-direction:column;gap:8px}
.pz-hint:not(:empty){margin:0 0 14px}
.pz-hint p{position:relative;margin:0;padding:11px 14px 11px 44px;border-radius:14px;background:rgba(255,211,77,.08);border:1px solid rgba(255,211,77,.28);font-size:13.5px;font-weight:700;line-height:1.6;color:#f3e6c4;animation:hw-rise .4s cubic-bezier(.23,1,.32,1)}
.pz-hint p::before{content:attr(data-n);position:absolute;left:12px;top:11px;height:22px;padding:0 6px;border-radius:6px;background:#ffd34d;color:#2a1a02;font-size:11px;font-weight:900;line-height:22px}
.pz-rule{margin:0 0 4px;padding:12px 14px;border-radius:8px;background:#f6e7cf;color:#3d2a18;font-size:14px;font-weight:800;line-height:1.6;transform:rotate(-.5deg);box-shadow:0 8px 20px rgba(0,0,0,.3)}
.pz-rule b{color:#c2410c}
.pz-msg{min-height:22px;margin:12px 0 0;text-align:center;font-size:13.5px;font-weight:800;color:#a596b4;line-height:1.6}
.pz-msg.bad{color:#ff8a9a}.pz-msg.ok{color:#9be15d}
.pz .hw-btn:disabled{opacity:.4;cursor:default}
/* 1. 비밀 재료 (참말은 하나) */
.lj-shelf{position:relative;display:flex;justify-content:space-between;gap:4px;margin:18px 0 0;padding:0 6px 8px}
.lj-shelf::after{content:'';position:absolute;left:0;right:0;bottom:0;height:8px;border-radius:3px;background:#6b4630;box-shadow:0 6px 12px rgba(0,0,0,.35)}
.lj-j{flex:1;max-width:64px;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;padding:0;cursor:pointer;color:#f6eee4;font-family:inherit;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.lj-j svg{width:100%;height:auto;display:block;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));transition:filter .25s}
.lj-j small{font-size:10.5px;font-weight:800;color:#cbbfd8;line-height:1.3;text-align:center;letter-spacing:-.04em;word-break:keep-all}
.lj-j small b{display:block;color:#f6eee4;font-size:12px}
.pz-rule .sig{display:block;text-align:right;font-size:12.5px;color:#8a6a4a}
.lj-j.sel{transform:translateY(-10px)}
.lj-j.sel svg{filter:drop-shadow(0 0 14px rgba(255,211,107,.95))}
.lj-j.crack{animation:hw-shake .4s}
.lj-j.crack svg{filter:grayscale(1) brightness(.6)}
.lj-notes{display:grid;gap:7px;margin-top:16px}
.lj-n{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;padding:9px 10px 9px 12px;border-radius:12px;border:1px solid #33243f;background:rgba(255,255,255,.04);color:#f0e6f8;font-family:inherit;font-size:14px;font-weight:700;text-align:left;cursor:pointer;transition:background .2s,border-color .2s}
.lj-n i{flex:none;width:24px;height:24px;border-radius:50%;background:#f6e7cf;color:#3d2a18;font-style:normal;font-size:12px;font-weight:900;display:grid;place-items:center}
.lj-n span{flex:1;line-height:1.45}
.lj-n em{flex:none;font-style:normal;font-size:11px;font-weight:900;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.06);color:#76658a}
.lj-n.t{border-color:rgba(155,225,93,.4)}
.lj-n.t em{background:rgba(155,225,93,.18);color:#9be15d}
.lj-n.f em{background:rgba(255,61,90,.15);color:#ff8a9a}
.lj-n.f span{color:#8a7a9a;text-decoration:line-through;text-decoration-color:rgba(255,122,138,.6)}
.lj-tip{margin:8px 0 0;font-size:11.5px;font-weight:700;color:#76658a;text-align:center}
.lj-oven{position:fixed;inset:0;z-index:104;display:grid;place-items:center;background:rgba(12,8,20,.78);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:0;transition:opacity .3s}
.lj-oven.on{opacity:1}
.lj-oven svg{width:min(56vw,220px)}
.lj-oven p{margin:10px 0 0;text-align:center;font-size:14px;font-weight:800;color:#ffd9a0}
.lj-oven .fl path{animation:hw-flame 1s ease-in-out infinite;transform-origin:110px 150px}
/* 2. 접힌 깃발 (종이 접기 추리) */
.pf-prog{display:flex;justify-content:center;align-items:center;gap:8px;margin:0 0 12px}
.pf-prog i{width:26px;height:30px;opacity:.22;transition:opacity .4s,transform .5s cubic-bezier(.34,1.56,.64,1)}
.pf-prog i svg{width:100%;height:100%;display:block}
.pf-prog i.on{opacity:1;transform:rotate(-4deg)}
.pf-prog small{margin-left:6px;font-size:12px;font-weight:900;color:#a596b4}
.pf-steps{display:flex;align-items:center;justify-content:center;gap:3px;padding:12px 6px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid #33243f}
.pf-steps .s{flex:0 1 76px;min-width:0;text-align:center}
.pf-steps .s svg{width:100%;height:auto;display:block}
.pf-steps .s small{display:block;margin-top:3px;font-size:10.5px;font-weight:800;color:#a596b4}
.pf-steps > b{flex:none;color:#76658a;font-size:13px}
.pf-q{margin:16px 0 10px;font-size:14px;font-weight:900;text-align:center}
.pf-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:330px;margin:0 auto}
.pf-o{position:relative;aspect-ratio:1;border-radius:16px;border:2px solid rgba(255,255,255,.06);background:rgba(255,255,255,.04);padding:12px;cursor:pointer;transition:border-color .2s,background .2s,opacity .3s}
.pf-o svg{width:100%;height:100%;display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.pf-o b{position:absolute;left:8px;top:6px;font-size:12px;font-weight:900;color:#a596b4}
.pf-o.bad{border-color:#ff3d5a;animation:hw-shake .4s}
.pf-o.ok{border-color:#9be15d;background:rgba(155,225,93,.12)}
.pf-o.gone{opacity:.12;pointer-events:none}
/* 3. 영혼의 종 (멜로디 추리) */
.mm-slots{display:flex;justify-content:center;gap:10px;padding:16px 10px;border-radius:18px;background:linear-gradient(#2c1a3a,#1f1529);border:1px solid #4a2f5e}
.mm-s{width:58px;height:66px;border-radius:14px;border:2px dashed rgba(255,255,255,.18);background:none;display:grid;place-items:center;padding:7px;cursor:pointer}
.mm-s.f{border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05)}
.mm-s svg,.mm-b svg{width:100%;height:100%;display:block;transform-origin:50% 8%}
.mm-s.ring svg,.mm-b.ring svg{animation:rm-swing .6s ease-out}
.mm-s.hit{border-color:#ffd34d;box-shadow:0 0 16px rgba(255,211,77,.5)}
.mm-bells{display:flex;justify-content:center;gap:8px;margin-top:14px}
.mm-b{width:56px;height:64px;border-radius:14px;border:0;background:rgba(255,255,255,.05);padding:7px;cursor:pointer;transition:opacity .2s,transform .12s}
.mm-b:active{transform:scale(.94)}
.mm-b:disabled{opacity:.22;cursor:default}
.mm-act{display:flex;gap:8px;margin-top:12px}
.mm-act .hw-btn{flex:1;margin:0}
.mm-act .hw-btn.ghost{flex:none;width:96px}
.mm-key{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 14px;margin:14px 0 0;font-size:12px;font-weight:800;color:#a596b4}
.mm-key span{display:inline-flex;align-items:center;gap:5px}
.mm-key svg{width:16px;height:16px}
.mm-hist{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.mm-r{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #2f2539;animation:hw-rise .35s cubic-bezier(.23,1,.32,1)}
.mm-r .n{width:22px;font-size:11px;font-weight:900;color:#76658a}
.mm-r .g{display:flex;gap:4px}
.mm-r .g svg{width:22px;height:25px}
.mm-r .fb{margin-left:auto;display:flex;align-items:center;gap:3px}
.mm-r .fb svg{width:18px;height:18px}
.mm-r .fb em{font-style:normal;font-size:11.5px;font-weight:800;color:#76658a}
/* 4. 바랜 사진 (자리 추리) */
.sp-letter{padding:14px 16px 12px;border-radius:4px;background:#f3e3c4;color:#3d2a18;box-shadow:0 10px 24px rgba(0,0,0,.35);transform:rotate(-.6deg)}
.sp-letter p{margin:0 0 6px;font-size:13px;font-weight:700;line-height:1.6;color:#6b4a2a}
.sp-letter ol{margin:0;padding:0 0 0 20px}
.sp-letter li{padding:5px 0;font-size:14px;font-weight:800;line-height:1.5;cursor:pointer;transition:opacity .2s}
.sp-letter li.x{text-decoration:line-through;opacity:.4}
.sp-letter small{display:block;margin-top:6px;text-align:right;font-size:12px;font-weight:800;color:#8a6a4a}
.sp-frames{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:20px}
.sp-f{display:flex;flex-direction:column;align-items:center;gap:5px;border:0;background:none;padding:0;cursor:pointer;color:#f6eee4;font-family:inherit}
.sp-f .fr{position:relative;width:100%;aspect-ratio:4/5;box-sizing:border-box;border-radius:5px;border:5px solid #c99a4a;background:#3a2f48;display:grid;place-items:center;box-shadow:inset 0 0 0 2px #7a5a2a,0 6px 14px rgba(0,0,0,.35);transition:background .3s}
.sp-f .fr svg{width:62%;height:auto}
.sp-f .fr > b{position:absolute;left:3px;top:1px;font-size:10px;font-weight:900;color:rgba(255,255,255,.4)}
.sp-f.has .fr{background:var(--c)}
.sp-f.has .fr > b{color:rgba(0,0,0,.35)}
.sp-f em{font-style:normal;font-size:11px;font-weight:800;color:#f6eee4;min-height:15px;letter-spacing:-.04em}
.sp-f small{font-size:11.5px;font-weight:900;color:#ffbb4d;letter-spacing:-.03em}
.sp-f.tgt .fr{outline:2px dashed #ffd34d;outline-offset:3px}
.sp-f.lit .fr{box-shadow:inset 0 0 0 2px #7a5a2a,0 0 26px rgba(255,211,107,.8)}
.sp-tok{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:16px}
.sp-t{display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;border-radius:14px;border:1px solid #33243f;background:rgba(255,255,255,.04);color:#f6eee4;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:opacity .2s,border-color .2s,background .2s}
.sp-t i{width:24px;height:28px;flex:none}
.sp-t i svg{width:100%;height:100%;display:block}
.sp-t.sel{border-color:#ffd34d;background:rgba(255,211,77,.12)}
.sp-t.used{opacity:.35}
/* 문 밖 */
.es-hd{text-align:center;margin:6px 0 14px}
.es-hd .mi{display:block;width:62px;margin:0 auto 8px;animation:mw-spin 1.8s cubic-bezier(.23,1,.32,1)}
.es-hd .mi svg{width:100%;display:block}
.es-hd h3{margin:0 0 6px;font-size:26px;font-weight:900;letter-spacing:-.04em}
.es-hd p{margin:0;font-size:13.5px;font-weight:700;color:#cbbfd8;line-height:1.7}
.es-sub{margin:20px 0 0;text-align:center;font-size:12.5px;font-weight:800;color:#a596b4}
.mw-ofr{position:relative;width:min(80vw,320px);margin:10px auto 0}
.mw-tiers{display:block;width:100%;height:130px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.4))}
.mw-fl{position:absolute;left:0;right:0;top:0;height:130px;z-index:3;pointer-events:none}
.mw-f{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;transform:scale(var(--s,1))}
.mw-f svg{width:100%;height:100%;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.mw-f.new{animation:mw-bloom .7s cubic-bezier(.34,1.56,.64,1)}
@keyframes mw-bloom{from{transform:scale(0) rotate(-90deg)}to{transform:scale(var(--s,1))}}
.es .hw-coop{margin:16px 0 0}
.mw-info{display:flex;align-items:baseline;justify-content:space-between;margin:12px 0 0;padding:12px 15px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid #33243f;font-size:13.5px;font-weight:800}
.mw-info b{font-size:20px;color:#ffbb4d;font-variant-numeric:tabular-nums}
.mw-info b.hot{animation:hw-hot 1.1s ease-in-out infinite}
.bk-now{margin:22px 0 0}
.bk-now h4{margin:0 0 8px;font-size:13px;font-weight:900;color:#a596b4}
@media (prefers-reduced-motion:reduce){.rm-hs .dot,.pz-hb.on{animation:none!important}}

@media (prefers-reduced-motion:reduce){
  .hw-garland,.hw-garland svg,.hw-cd.lit .fl{animation:none!important}
  .hw-petal{display:none}
  .hw-cardx,.hw-cardwrap .hw-btn{animation:none!important}
  .hw-stars,.hw-spider,.hw-pk.lit .face,.hw-space .sky::after,.hw-ghost .g,.hw-bub{animation:none!important}
  .hw-space.enter,.hw-space.entering,.hw-space.leaving{clip-path:none!important;transition:none!important}
}`;

/* ───────── 시작·정지 ───────── */
export function start(api, config){
  A = api; cfg = config || {};
  if(started){ update(cfg); return; }
  started = true; firstStats = true;
  ROUND = PREVIEW ? 2 : Number(cfg.round) === 2 ? 2 : 1;
  STAGES = ROUND > 1 ? STAGES2 : STAGES1; CARDS = ROUND > 1 ? CARDS2 : CARDS1;
  stats = { dist: Array(STAGES.length + 1).fill(0), ranked:0, last:null, total:0 };
  if(A.SPACE) STAGES1[0].name = '정전된 교실';        // 체험판은 반 이름 대신
  document.documentElement.classList.toggle('hw-r2', ROUND > 1);
  const st = document.createElement('style'); st.id = 'hw-style'; st.textContent = CSS; document.head.appendChild(st);
  document.documentElement.classList.add('hw-on');
  A.setPalette(ROUND > 1 ? ['#ff9f1c', '#ff4f9a', '#2ec4b6', '#ffd34d', '#b07cff', '#ffb3d1', '#9fe6d9', '#ffd6a5']
                         : ['#ff8a2a', '#b07cff', '#9be15d', '#ffbf9b', '#9fd7ff', '#ffb3d1', '#d7e37a', '#ffd6a5']);
  decorate();
  unsubStats = A.fs.onSnapshot(A.fs.doc(A.db, A.C('event_stats'), ROUND > 1 ? 'main' + ROUND : 'main'), s => {
    const prev = stats.ranked || 0, prevT = stats.total || 0;
    const v = s.exists() ? s.data() : {};
    stats = { dist: Array.isArray(v.dist) ? v.dist : Array(STAGES.length + 1).fill(0), ranked: v.ranked || 0, last: v.last || null, total: v.total || 0 };
    if(!firstStats && ROUND > 1 && prevT < coopGoal() && stats.total >= coopGoal()) ticker('반 전체 금잔화가 모두 피었어요!');
    else if(!firstStats && stats.ranked > prev && stats.ranked !== myRank())
      ticker(ROUND > 1 ? `방금 누군가 할머니의 집을 탈출했어요 · 남은 간식 ${left()}개` : `방금 누군가 다섯 개를 모두 깼어요 · 남은 간식 ${left()}개`);
    firstStats = false;
    paintCard(); paintSpace();
  }, () => {});
  if(!PREVIEW) retryPending().then(refreshPieces);
  addEventListener('hashchange', onHash);
  setTimeout(onHash, 900);           // 링크(#halloween)로 들어온 경우
}
export function update(config){
  if(!started){ if(A && config && config.on) start(A, config); return; }   // 껐다가 다시 켠 경우
  if((PREVIEW ? 2 : Number(config && config.round) === 2 ? 2 : 1) !== ROUND){           // 관리자가 1일차 ↔ 2일차를 바꿈
    const wasOpen = !!spaceEl;
    stop(); start(A, config);
    if(wasOpen) setTimeout(() => openSpace(), 120);
    return;
  }
  cfg = config || {}; paintCard(); paintSpace();
}
export function stop(){
  if(!started) return;
  started = false;
  if(unsubStats){ unsubStats(); unsubStats = null; }
  removeEventListener('hashchange', onHash);
  if(webObs){ webObs.disconnect(); webObs = null; }
  document.documentElement.classList.remove('hw-on', 'hw-r2');
  document.querySelectorAll('.hw-deco,.hw-fog,.hw-stars,.hw-spider,.hw-card,.hw-cw,.hw-cm,.hw-title-pk,.hw-title-mg,.hw-garland,.hw-petal,.hw-mari,#hw-style,.hw-ticker').forEach(n => n.remove());
  if($('.hw-space')) closeSpace(true);
  A.setPalette(null);
}
function onHash(){ if(started && location.hash === '#halloween' && !$('.hw-space')) openSpace(); }

/* ───────── 앱 곳곳의 디테일 + 메인 카드 ───────── */
function decorate(){
  if(ROUND > 1) return decorate2();
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
function decorate2(){                       // 망자의 날: 종이 깃발, 떨어지는 꽃잎, 금잔화
  const h1 = $('.brand h1');
  if(h1 && !$('.hw-title-mg')) h1.insertAdjacentHTML('afterbegin', `<span class="hw-title-mg">${SVG.mari}</span>`);
  const cols = ['#ff4f9a', '#ff9f1c', '#2ec4b6', '#b07cff', '#ffd34d'];
  document.body.insertAdjacentHTML('beforeend',
    `<div class="hw-garland">${[...Array(24)].map((_, i) => SVG.flag(cols[i % 5], i)).join('')}</div>` +
    (reduce ? '' : [...Array(7)].map((_, i) => `<i class="hw-petal" style="left:${6 + i * 14}%;--d:${15 + (i * 7) % 9}s;--dl:${-i * 2.7}s;--sx:${i % 2 ? 34 : -28}px;background:${i % 3 ? '#ff9f1c' : '#ff4f9a'}"></i>`).join('')) +
    `<div class="hw-mari"><span style="width:44px;height:44px">${SVG.mari}</span><span style="width:28px;height:28px;margin-left:-10px">${SVG.mari}</span><span style="width:20px;height:20px;margin-left:-4px">${SVG.mari}</span></div>`);
  const ub = $('#urgentBox');
  if(ub) ub.insertAdjacentHTML('beforebegin', `<button class="hw-card" id="hwCard" type="button"></button>`);
  $('#hwCard').onclick = e => openSpace(e.currentTarget.querySelector('.pk'));
  if(webObs) webObs.disconnect();
  const put = () => { const u = $('.urgentbox'); if(u && !u.querySelector('.hw-cm')) u.insertAdjacentHTML('afterbegin', `<span class="hw-cm">${SVG.mari}</span>`); };
  webObs = new MutationObserver(put);
  if(ub) webObs.observe(ub, { childList:true });
  put();
  paintCard();
}
function paintCard(){
  const c = $('#hwCard'); if(!c) return;
  const d = done(), n = left(), r = myRank();
  const N = STAGES.length;
  const R2 = ROUND > 1;
  const sub = r ? (r <= prizes() ? `선착순 ${r}번째! 간식 당첨` : `${R2 ? '탈출 성공' : KN() + ' 개 모두 클리어'} · 참여상`)
    : (d.size ? `${R2 ? '퍼즐 ' : ''}${d.size}/${N} ${R2 ? '풀이' : '클리어'} · 이어서 ${R2 ? '탈출하기' : '도전하기'}` : R2 ? `방탈출 · 퍼즐 1개만 풀어도 참여상` : `미션 ${N}개 · 1개만 깨도 참여상`);
  c.innerHTML = `<span class="bats">${ROUND > 1 ? SVG.flag('#ff4f9a', 1) + SVG.flag('#2ec4b6', 0) + SVG.flag('#ff9f1c', 1) : SVG.bat + SVG.bat}</span><span class="pk">${ROUND > 1 ? SVG.mari : SVG.pumpkin()}</span>
    <span class="txt"><b>${TITLE()}</b><small>${sub}</small><span class="hw-dots">${STAGES.map(s => `<i class="${d.has(s.id) ? 'on' : ''}"></i>`).join('')}</span></span>
    <span class="side"><span class="go">${d.size === STAGES.length ? '결과 보기' : d.size ? '이어하기' : R2 ? '입장하기' : '들어가기'}</span><span class="left${n && n <= 3 ? ' hot' : ''}">${n ? `간식 ${n}개 남음` : '간식 마감 · 참여상 계속'}</span></span>`;
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
    if(sb){ LS.set('snd', !sndOn()); spaceEl.querySelectorAll('.hw-snd').forEach(b => b.innerHTML = sndOn() ? SVG.snd : SVG.mute); sfx('tap');
      if(!sndOn()) ambientOff(); else if(ROUND > 1) ambientOn(); return; }
    if(e.target.closest('.hw-m,.hw-nums button,[data-back],.hw-ing,.hw-candy')) sfx('tap');
  });
  document.body.style.overflow = 'hidden';
  document.documentElement.classList.add('hw-lock');
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
let afterClose = null;
function closeSpace(instant){
  if(!spaceEl) return;
  stopMission(); ambientOff();
  const el = spaceEl; spaceEl = null;
  if(!instant) sfx('leave');
  // 미리보기는 이벤트 공간을 나가면 저절로 끝남 (다시 들어가면 원래 이벤트)
  const next = afterClose || (PREVIEW && !instant ? () => switchPreview(false, false) : null); afterClose = null;
  if(next) setTimeout(next, 60);
  const end = () => { el.remove(); if(spaceEl) return; document.documentElement.classList.remove('hw-lock'); if(!document.querySelector('.sheet.on')) document.body.style.overflow = ''; };
  if(instant || reduce){ end(); return; }
  el.classList.remove('entering'); el.classList.add('leaving');
  setTimeout(end, 440);
  paintCard();
}
/* 2일차 미리보기 켜기·끄기: 열린 공간은 '뒤로'로 정식으로 닫은 뒤 바꿔서 기록(뒤로 가기 단계)이 꼬이지 않게 */
function switchPreview(on, reopen){
  const go = () => { PREVIEW = on; stop(); start(A, cfg); if(reopen) setTimeout(() => openSpace(), 150); };
  if(spaceEl){ afterClose = go; A.back(); } else go();
}
const scroller = () => spaceEl && spaceEl.querySelector('.hw-scroll');
function view(html, cls = 'hw-in'){
  const s = scroller(); if(!s) return null;
  s.classList.toggle('mw-mode', cls.includes('mw-view'));
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
  const root = view(`${topbar(TITLE())}
    <div class="hw-hero">${heroHTML(new Set(), false)}</div>
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
    const res = PREVIEW ? { ok:true } : await send({ num: sel, key, stage:'' });
    if(res && res.ok){ LS.set('me', { num: sel, key }); keepPieces(res); sfx('ignite'); showHome(); }
    else{ j.disabled = false; j.textContent = `${sel}번으로 들어가기`; A.note('들어가지 못했어요', (res && res.error) || '인터넷 연결을 확인해 주세요.'); }
  };
}

/* 공간의 첫 화면 */
function showHome(ignite){
  const m = me(); if(!m) return showPick();
  if(ROUND > 1) return showWorld();
  const d = done();
  const root = view(`${topbar(TITLE(), `<span class="hw-chip">${m.num}번</span>`)}
    <div class="hw-hero">${heroHTML(d, true)}
      <div class="hw-left" id="hwLeft"></div><div class="hw-left-l" id="hwLeftL"></div>
      <div class="hw-board" id="hwBoard"></div>${ROUND > 1 ? '<div class="hw-coop" id="hwCoop"></div>' : ''}</div>
    <div id="hwMine"></div>
    <div class="hw-book" id="hwBook"><div class="hd"><b>비밀 기록장</b><small>${d.size} / ${STAGES.length}</small></div>
      <div class="sl">${STAGES.map((s, i) => d.has(s.id)
        ? `<button class="hw-slot2 got" data-s="${s.id}" style="--r:${[-2, 1.5, -1, 2, -1.5][i]}deg"><i>${CARDS[s.id].n}</i><span>${CARDS[s.id].t}</span></button>`
        : `<span class="hw-slot2" data-s="${s.id}"><i>${CARDS[s.id].n}</i></span>`).join('')}</div></div>
    <div class="hw-list">${STAGES.map((s, i) => `<button class="hw-m${d.has(s.id) ? ' done' : ''}" data-s="${s.id}">
        <span class="idx">${ROUND > 1 ? (d.has(s.id) ? SVG.mari : SVG.candle(false)) : SVG.pumpkin(d.has(s.id))}</span>
        <span class="t"><b><span class="k">${s.kind}</span>${s.name}</b><small>${s.line}</small></span>
        <span class="st">${d.has(s.id) ? SVG.check + '클리어' : '도전'}</span></button>`).join('')}</div>
    <p class="hw-rules"><b>참여상</b> 미션 1개만 깨도 받아요.<br><b>선착순 간식</b> ${KN()} 개를 모두 깬 순서대로 ${prizes()}명.<br>미션을 깰 때마다 ${ROUND > 1 ? '망자의 날' : '할로윈'}의 비밀 기록이 한 장씩 모여요.<br>미션은 사람마다 다르게 나와서 답을 알려 줘도 소용없어요. 막히면 유령이 힌트를 줘요.</p>
    <div id="hwAdmin"></div>`);
  bindBack(root, () => A.back());
  root.querySelectorAll('.hw-m').forEach(b => b.onclick = () => openMission(b.dataset.s));
  root.querySelectorAll('.hw-slot2.got').forEach(b => b.onclick = () => showCard(b.dataset.s));
  if(ROUND > 1) bindCandles($('#hwCandles', root)); else bindMoon($('#hwMoon', root));
  paintSpace();
  if(A.isMain()) paintAdmin();
  if(ignite && !reduce) root.querySelectorAll('.hw-lanterns .ln.on').forEach((l, i) => { l.style.animationDelay = (.35 + i * .08) + 's'; l.classList.add('pop'); });
}
function heroHTML(d, home){
  if(ROUND > 1) return `<div class="hw-altar"><div class="hw-lanterns hw-candles"${home ? ' id="hwCandles"' : ''}>${STAGES.map((s, i) =>
      `<span class="ln${d.has(s.id) ? ' on' : ''}" data-s="${s.id}" data-i="${i}">${SVG.candle(d.has(s.id))}</span>`).join('')}</div><div class="cloth"></div></div>`;
  return `<span class="hw-moon"${home ? ' id="hwMoon"' : ''}>${SVG.moon}${home ? '<i class="eclip"><i class="ecl"></i></i>' : ''}</span>
      <div class="hw-lanterns">${STAGES.map(s => `<span class="ln${d.has(s.id) ? ' on' : ''}" data-s="${s.id}">${SVG.pumpkin(d.has(s.id))}</span>`).join('')}</div>`;
}
function paintSpace(){
  if(!spaceEl) return;
  if(ROUND > 1) paintWorld();
  const L = $('#hwLeft'), LL = $('#hwLeftL'), B = $('#hwBoard'), M = $('#hwMine');
  if(L){ const n = left(); L.textContent = n; L.classList.toggle('hot', n > 0 && n <= 3); LL.textContent = n ? '남은 선착순 간식' : '간식은 마감 · 참여상은 계속 받을 수 있어요'; }
  const C2 = $('#hwCoop');
  if(C2){ const t = stats.total || 0, g = coopGoal(), full = t >= g;
    C2.classList.toggle('full', full);
    C2.innerHTML = `<div class="hd">반 전체 금잔화<small><b>${Math.min(t, g)}</b> / ${g}</small></div><div class="bar"><div class="fill" style="--p:${Math.min(100, t / g * 100)}%"></div></div>
      <p>${full ? (cfg.coopPrize ? `목표 달성! ${esc(cfg.coopPrize)}` : '목표 달성! 반 전체 보너스가 열렸어요.') : `반 친구들이 푼 퍼즐 수를 모두 모아요. ${g}개를 채우면 반 전체 보너스!`}</p>`; }
  if(B){ const d = stats.dist || []; B.innerHTML = [...Array(STAGES.length)].map((_, i) => STAGES.length - i).filter(k => d[k]).map(k => `<span>${k}개 클리어 <b>${d[k]}명</b></span>`).join('') || '<span>아직 아무도 깨지 못했어요. 첫 번째가 돼 보세요</span>'; }
  if(M){ const r = myRank(), n = done().size;
    const R2 = ROUND > 1;
    M.innerHTML = r ? `<div class="hw-mine">${r <= prizes() ? `선착순 <b>${r}번째</b>로 ${R2 ? '탈출했어요' : KN() + ' 개를 모두 깼어요'}! 간식 당첨이에요.` : `${R2 ? '탈출 성공' : KN() + ' 개를 모두 깼어요'}(${r}번째). 아쉽게 간식은 마감됐지만 참여상을 받아요.`}</div>`
      : n ? `<div class="hw-mine">${R2 ? '퍼즐' : '미션'} ${n}개 ${R2 ? '풀이' : '클리어'} · 참여상 확보! ${R2 ? '네 퍼즐을 모두 풀고 탈출하면' : KN() + ' 개를 모두 깨면'} 선착순 간식에 도전할 수 있어요.</div>` : ''; }
}

/* 관리자: 선착순 인원, 번호 설정, 명단 */
async function paintAdmin(){
  const box = $('#hwAdmin'); if(!box) return;
  box.innerHTML = `<div class="hw-admin"><h4>관리자</h4>
    ${PREVIEW ? `<div class="ln"><span>지금은 <b style="color:#9be15d">2일차 미리보기</b>예요<br><small style="font-weight:700;color:#a596b4">이 기기에서만 보이고 기록이 남지 않아요</small></span><button class="sm" id="hwPvR">진행 초기화</button><button class="sm" id="hwPvX">끝내기</button></div>`
    : `<div class="ln"><span>진행 중: <b style="color:#ffb070">${ROUND}일차 · ${TITLE()}</b></span><button class="sm" id="hwRd">${ROUND > 1 ? '1일차로 되돌리기' : '2일차 열기'}</button></div>
    ${ROUND === 1 ? '<div class="ln"><span>2일차 미리보기<br><small style="font-weight:700;color:#a596b4">나만 보임 · 기록 안 남음</small></span><button class="sm" id="hwPv">미리보기</button></div>' : ''}`}
    <div class="ln"><span>선착순 간식 인원 (${ROUND}일차)</span><input id="hwPz" type="number" min="0" max="60" value="${prizes()}"><button class="sm" id="hwPzS">저장</button></div>
    <div class="ln"><span>마지막 번호 / 없는 번호</span><input id="hwMax" type="number" min="1" max="60" value="${Number(cfg.max) || 35}" style="width:60px"><input id="hwSkip" value="${(cfg.skip || []).join(',')}" style="width:80px" placeholder="예: 7,21"><button class="sm" id="hwNumS">저장</button></div>
    <div class="ln"><span>번호 옮기기<br><small style="font-weight:700;color:#a596b4">잘못 고른 번호를 바로잡아요</small></span><input id="hwMvA" type="number" min="1" max="60" placeholder="원래" style="width:60px"><input id="hwMvB" type="number" min="1" max="60" placeholder="바꿀" style="width:60px"><button class="sm" id="hwMvS">옮기기</button></div>
    ${ROUND > 1 ? `<div class="ln"><span>반 전체 금잔화 목표 / 보너스</span><input id="hwCg" type="number" min="1" max="300" value="${coopGoal()}" style="width:64px"><input id="hwCp" maxlength="30" value="${esc(cfg.coopPrize || '')}" placeholder="예: 반 전체 사탕" style="width:110px"><button class="sm" id="hwCgS">저장</button></div>` : ''}
    <div class="ln" style="margin-top:16px"><span>명단</span><button class="sm" data-rr="1">1일차</button><button class="sm" data-rr="2">2일차</button><button class="sm" id="hwCsv">파일로 저장</button></div>
    <div id="hwList" class="hw-p">명단 불러오는 중…</div></div>`;
  const save = async data => { try{ await A.fs.setDoc(A.fs.doc(A.db, A.C('config'), 'event'), data, { merge:true }); A.toast('저장했어요'); }catch{ A.toast('저장하지 못했어요'); } };
  $('#hwPzS').onclick = () => save({ [ROUND > 1 ? 'prizes' + ROUND : 'prizes']: Math.max(0, Math.min(60, Number($('#hwPz').value) || 0)) });
  const pv = $('#hwPv'); if(pv) pv.onclick = () => { A.toast('2일차 미리보기를 열어요 · 친구들 화면은 그대로예요', 2400); switchPreview(true, true); };
  const px = $('#hwPvX'); if(px) px.onclick = () => { A.toast('미리보기를 끝냈어요'); switchPreview(false, true); };
  const pr = $('#hwPvR'); if(pr) pr.onclick = () => { ['done', 'stars', 'pieces', 'rank', 'hidden', 'intro', 'pz'].forEach(k => { try{ localStorage.removeItem('hw:' + (A.SPACE || '') + rk(k)); }catch{} }); A.toast('미리보기 진행을 처음으로 돌렸어요'); switchPreview(true, true); };
  if(!$('#hwRd')){ /* 미리보기 중에는 라운드 전환 버튼 없음 */ }
  else $('#hwRd').onclick = async () => {
    const to = ROUND > 1 ? 1 : 2;
    const ok = to === 2
      ? await A.ask('2일차(망자의 날)를 열까요?', '모두의 화면이 바로 2일차로 바뀌어요. 1일차 기록은 지금 상태 그대로 보관되고 더 이상 바뀌지 않아요. 열기 전에 1일차 명단을 "파일로 저장"해 두는 걸 추천해요.', '2일차 열기')
      : await A.ask('1일차로 되돌릴까요?', '모두의 화면이 다시 할로윈 밤으로 바뀌어요. 2일차 기록은 그대로 남아 있어요.', '되돌리기');
    if(!ok) return;
    save(to === 2 ? { round:2, prizes2: cfg.prizes2 ?? 15, coopGoal: cfg.coopGoal ?? 60 } : { round:1 });
  };
  const cg = $('#hwCgS');
  if(cg) cg.onclick = () => save({ coopGoal: Math.max(1, Math.min(300, Number($('#hwCg').value) || 60)), coopPrize: String($('#hwCp').value).trim().slice(0, 30) });
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
    const all = { 1:[], 2:[] };
    const when = v => { try{ const d = v && v.toDate ? v.toDate() : new Date(v); return isNaN(d) ? null : d; }catch{ return null; } };
    snap.forEach(d => {
      const m = d.id.match(/^(?:r(\d+)_)?(\d+)$/); if(!m) return;
      const r = Number(m[1] || 1); if(!all[r]) return;
      const v = d.data(), sts = v.stages || {};
      const times = Object.values(sts).map(when).filter(Boolean).sort((a, b) => a - b);
      all[r].push({ n: v.n || Number(m[2]), c: Object.keys(sts).length, rank: v.rank || 0, h: v.hidden || 0, ids: Object.keys(sts),
        end: v.rank ? times[times.length - 1] : null, hat: when(v.hat) });
    });
    const pz = r => { const v = r > 1 ? cfg['prizes' + r] : cfg.prizes; return v === undefined || v === null || v === '' ? 15 : Number(v); };
    const ST = r => r > 1 ? STAGES2 : STAGES1;
    let showR = ROUND;
    const fmt = d => d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}` : '';
    const sorted = r => all[r].slice().sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.c - a.c || a.n - b.n);
    const draw = () => {
      box.querySelectorAll('[data-rr]').forEach(b => b.style.background = Number(b.dataset.rr) === showR ? 'rgba(255,159,28,.35)' : '');
      const rows = sorted(showR), P = pz(showR), N = ST(showR).length;
      $('#hwList').innerHTML = rows.length ? `<table><tr><th>순번</th><th>번호</th><th>클리어</th><th>상품</th><th>히든</th></tr>${rows.map(r =>
      `<tr><td>${r.rank || '–'}</td><td>${r.n}번</td><td>${r.c}/${N}</td><td>${r.rank && r.rank <= P ? '<b style="color:#ffb070">선착순 간식</b>' : r.c ? '참여상' : '–'}</td><td>${r.h ? `<b style="color:#b07cff">${r.h}번째</b>` : ''}</td></tr>`).join('')}</table>
      <p class="hw-p" style="font-size:12px">${showR}일차 · 간식 ${rows.filter(r => r.rank && r.rank <= P).length}명 · 참여상 ${rows.filter(r => r.c && !(r.rank && r.rank <= P)).length}명 · 히든 미션 ${rows.filter(r => r.h).length}명</p>` : `${showR}일차에 참여한 사람이 아직 없어요.`;
    };
    box.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => { showR = Number(b.dataset.rr); draw(); });
    $('#hwCsv').onclick = () => {
      const rows = sorted(showR), P = pz(showR), S = ST(showR);
      const out = [['순번', '번호', '클리어 수', '깬 미션', '모두 깬 시각', '상품', '히든 순서', '히든 맞힌 시각']];
      rows.forEach(r => out.push([r.rank || '', r.n, `${r.c}/${S.length}`, S.filter(x => r.ids.includes(x.id)).map(x => x.name).join(' · '), fmt(r.end),
        r.rank && r.rank <= P ? '선착순 간식' : r.c ? '참여상' : '', r.h || '', fmt(r.hat)]));
      const csv = '\ufeff' + out.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
      a.download = `할로윈_${showR}일차_결과_${fmt(new Date()).replace(/[/: ]/g, '-')}.csv`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      A.toast(`${showR}일차 명단을 파일로 저장했어요`);
    };
    draw();
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
function keepPieces(res){ if(res && res.pieces) LS.set(rk('pieces'), { ...(LS.get(rk('pieces')) || {}), ...res.pieces }); }
async function refreshPieces(){          // 앱을 열 때 한 번: 도장 조각·순번·옮겨진 번호를 서버와 맞춤
  const m = me(); if(!m) return;
  const res = await send({ num: m.num, key: m.key, stage:'' });
  if(res && res.ok){ keepPieces(res); if(res.rank) LS.set(rk('rank'), res.rank); paintCard(); }
}
async function recordClear(stage){
  const m = me(); if(!m) return null;
  const d = done(); d.add(stage); LS.set(rk('done'), [...d]);
  if(PREVIEW){ keepPieces({ pieces:{ [stage]:'TEST' } }); paintCard(); return { ok:true, preview:true }; }   // 미리보기는 서버에 안 보냄
  const res = await send({ num: m.num, key: m.key, stage });
  if(res && res.ok){
    if(res.rank) LS.set(rk('rank'), res.rank);
    keepPieces(res);
    LS.set(rk('pending'), (LS.get(rk('pending')) || []).filter(s => s !== stage));
  }else{
    const p = new Set(LS.get(rk('pending')) || []); p.add(stage); LS.set(rk('pending'), [...p]);   // 인터넷이 끊겼으면 나중에 다시 보냄
  }
  paintCard();
  return res;
}
async function retryPending(){
  const p = LS.get(rk('pending')) || [];
  for(const s of p) await recordClear(s);
}

/* ───────── 미션 틀: 힌트 타이머, 클리어 연출 ───────── */
let mission = null;            // { id, timers:[], cleanup }
function stopMission(){
  if(!mission) return;
  mission.timers.forEach(clearTimeout);
  if(mission.cleanup) mission.cleanup();
  if(mission.howto) mission.howto.remove();
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
  clearTimeout(g._h); g._h = setTimeout(() => g.classList.remove('on'), 6500);   // 마을에서 한 말도 저절로 사라지게
}
function openMission(id){
  stopMission();
  { const g = $('.hw-ghost'); if(g) g.remove(); }
  mission = { id, timers:[], cleanup:null, t0: Date.now() };
  ({ dark: mDark, soup: mSoup, scale: mScale, lantern: mLantern, cipher: mCipher, bread: mBread, paper: mPaper, bell: mBell, spirit: mSpirit })[id]();
}
async function win(id, msg, stars = 0){
  if(document.querySelector('.hw-win')) return;          // 같은 클리어가 두 번 처리되지 않게
  const wasDone = done().has(id);
  sfx(ROUND > 1 ? 'fanfare' : 'win');
  const box = document.createElement('div'); box.className = 'hw-win';
  box.innerHTML = `<div class="box"><div class="pk">${ROUND > 1 ? SVG.mari : SVG.pumpkin()}</div><h3>클리어!</h3>
    ${stars ? `<div class="stars">${[0, 1, 2].map(i => `<i>★</i>`).join('')}</div>` : ''}<p>${esc(msg)}</p></div>`;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('on'));
  box.querySelectorAll('.stars i').forEach((st3, i) => { if(i < stars) setTimeout(() => { st3.classList.add('on'); sfx('star'); }, 450 + i * 260); });
  burst(innerWidth / 2, innerHeight / 2 - 40);
  stopMission();
  const resP = wasDone ? Promise.resolve(null) : recordClear(id);
  await sleep(stars ? 1700 : 1250);
  const res = await Promise.race([resP, sleep(3500)]);      // 인터넷이 느려도 너무 오래 기다리지 않음
  if(!spaceEl){ box.remove(); return; }
  box.querySelector('.box').classList.add('out');
  await sleep(220);
  await showCard(id, box);                                    // '기록장에 넣기'를 누르면 끝남
  if(!spaceEl) return;
  if(done().size === STAGES.length && !wasDone){
    await sleep(350); bats();
    const r = (res && res.rank) || myRank();
    if(r) A.note(r <= prizes() ? `선착순 ${r}번째!` : ROUND > 1 ? '탈출 성공!' : `${KN()} 개 모두 클리어!`,
      r <= prizes() ? '간식 당첨이에요. 반장·부반장에게 받으러 오세요.' : `${r}번째로 깼어요. 간식은 마감됐지만 참여상을 받아요.`);
    else A.note(ROUND > 1 ? '탈출 성공!' : `${KN()} 개 모두 클리어!`, '기록을 보내는 중이에요. 인터넷이 연결되면 순번이 정해져요.');
  }
}
/* 비밀 기록 카드 — host가 있으면 미션 클리어 직후(기록장으로 날아감), 없으면 기록장에서 다시 보기 */
function showCard(id, host){
  return new Promise(resolve => {
    const c = CARDS[id], pc = (LS.get(rk('pieces')) || {})[id];
    const ov = host || document.createElement('div');
    if(!host){ ov.className = 'hw-win'; document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on')); }
    ov.innerHTML = `<div class="hw-cardwrap"><div class="hw-cardx how-${host ? c.how : 'view'}">
        <div class="no">비밀 기록 ${c.n} / ${STAGES.length}</div><h4>${c.t}</h4><p>${c.b}</p>${c.mw ? `<span class="mw">${c.mw}</span>` : ''}
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
      if(ROUND > 1) lastCleared = id;
      if(spaceEl) showHome();
      const slot = spaceEl && (spaceEl.querySelector(`.hw-slot2[data-s="${id}"]`) || spaceEl.querySelector('#mwBook'));
      if(slot && !reduce){
        if(slot.id !== 'mwBook') slot.style.visibility = 'hidden';
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
/* 2일차 히든 입구: 네 촛불이 모두 켜졌을 때 오른쪽부터 차례로 끄면 열림 */
function bindCandles(box){
  if(!box) return;
  let pos = 0, t = 0;
  const lights = () => box.querySelectorAll('.ln');
  const relight = () => { lights().forEach(l => l.classList.remove('out')); pos = 0; };
  lights().forEach(l => l.addEventListener('click', () => {
    if(!l.classList.contains('on') || done().size !== STAGES.length){ l.classList.remove('nudge'); void l.offsetWidth; l.classList.add('nudge'); return; }
    if(l.classList.contains('out')) return;
    clearTimeout(t); t = setTimeout(relight, 4000);
    const want = STAGES.length - 1 - pos;
    if(Number(l.dataset.i) === want){
      l.classList.add('out'); pos++; noise(.18, { f:900, to:240, vol:.07 });
      if(pos === STAGES.length){ clearTimeout(t); sfx('gong'); setTimeout(() => { if(spaceEl) showHidden(); }, 750); }
    }else{
      sfx('ignite'); relight();
    }
  }));
}
function showHidden(){
  const m = me(); if(!m) return;
  const all = done().size === STAGES.length, h = LS.get(rk('hidden')), R2 = ROUND > 1;
  const place = R2 ? '제단의 비밀을 찾았' : '달의 뒷면을 봤';
  const okHTML = n => `<div class="hw-mine" style="text-align:center">히든 미션 성공 · <b>${n}번째</b>로 ${place}어요</div>
    <p class="hw-rules">이 비밀은 너만 알고 있어 줘. 명단에 자동으로 기록됐으니 따로 말하지 않아도 상품을 받아요.</p>`;
  const body = h ? okHTML(h)
    : !all ? (R2 ? `<div class="qq">제단이 조용해요.<br>촛불 네 개가 모두 켜진 뒤에 다시 와 보세요.</div>`
                 : `<div class="qq">달이 아무 말도 하지 않아요.<br>등불 다섯 개가 모두 타오르는 밤에 다시 와 보세요.</div>`)
    : `<div class="qq">${R2 ? '여기까지 온 걸 축하해요.<br>망자의 날, 영혼을 집까지 데려온다는<br>주황색 꽃이 있어요.<br><b>아즈텍 사람들이 부르던 그 꽃의 이름은?</b>'
                         : '여기까지 온 걸 축하해요.<br>할로윈이 생기기 훨씬 전, 이 축제는<br>다른 이름으로 불렸어요.<br><b>그 진짜 이름은?</b>'}</div>
       <input class="hw-input hw-hid" id="hwHid" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="정답">
       <button class="hw-btn" id="hwHidGo">${R2 ? '제단에 말하기' : '달에게 말하기'}</button>
       <p class="hw-rules">정답은 친구에게 알려 주지 말고, 직접 찾게 해 주세요. 비밀은 찾아낸 사람의 것이에요.</p>`;
  const root = view(`${topbar(R2 ? '제단 아래' : '달의 뒷면')}<div class="hw-back"><div class="bm">${R2 ? SVG.mari : SVG.moon}</div><div id="hwHidBody">${body}</div></div>`, 'hw-stage hw-in');
  bindBack(root, () => showHome());
  const go = $('#hwHidGo', root); if(!go) return;
  const inp = $('#hwHid', root);
  const submit = async () => {
    const v = inp.value.trim(); if(!v) return;
    if(PREVIEW){ A.note('미리보기', '미리보기에서는 정답을 서버에서 확인하지 않아요. 입구가 열리는 것까지만 시험해 보세요.'); return; }
    go.disabled = true; go.textContent = R2 ? '촛불이 듣는 중…' : '달이 듣는 중…';
    const res = await send({ num: m.num, key: m.key, answer: v });
    go.disabled = false; go.textContent = R2 ? '제단에 말하기' : '달에게 말하기';
    if(res && res.ok && res.hidden){
      LS.set(rk('hidden'), res.hidden); sfx('secret'); bats(); burst(innerWidth / 2, innerHeight / 3);
      $('#hwHidBody', root).innerHTML = okHTML(res.hidden);
    }else if(res && res.wrong){
      sfx('wrong'); inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
      A.toast(res.left > 0 ? (res.left <= 5 ? `${R2 ? '촛불이 흔들려요' : '달이 고개를 저어요'} · 남은 기회 ${res.left}번` : '달이 고개를 저어요') : '오늘은 달이 더 이상 대답하지 않아요');
    }else if(res && res.locked){ A.note('아직이에요', R2 ? '퍼즐 네 개를 모두 푼 뒤에 다시 와 보세요.' : `미션 ${KN()} 개를 모두 깬 뒤에 다시 와 보세요.`); }
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

/* ══════════════════ 2일차 · 소리 ══════════════════ */

/* ── 소리: 기타(카플러스-스트롱)·종·생활 소리 ── */
const ksCache = new Map();
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
function pluck(freq, at = 0, vol = .1, dest = null){
  const c = au(); if(!c) return;
  const key = Math.round(freq * 10);
  let buf = ksCache.get(key);
  if(!buf){
    const sr = c.sampleRate, N = Math.floor(sr * 1.8), p = Math.max(2, Math.round(sr / freq));
    buf = c.createBuffer(1, N, sr);
    const d = buf.getChannelData(0), ring = new Float32Array(p);
    for(let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
    let k = 0;
    for(let i = 0; i < N; i++){ const a = ring[k], b = ring[(k + 1) % p]; d[i] = a; ring[k] = (a + b) * .4985; k = (k + 1) % p; }
    ksCache.set(key, buf);
  }
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 3400;
  s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(dest || master); s.start(c.currentTime + Math.max(0, at));
}
const strum = (midis, at = 0, vol = .08, gap = .026) => midis.forEach((m, i) => pluck(NOTE(m), at + i * gap, vol));
function bell(freq, at = 0, vol = .12, dest = null){
  [[1, 1, 2.2], [2.0, .42, 1.5], [2.76, .28, 1.1], [5.4, .14, .6], [8.93, .07, .35]]
    .forEach(([r, g, d]) => tone(freq * r, d, { vol: vol * g, at, attack:.003, dest }));
}
Object.assign(SFX, {
  squish: () => { noise(.13, { f:240 + Math.random() * 140, q:1.3, vol:.1, to:130 }); tone(105 + Math.random() * 30, .12, { vol:.035, to:70 }); },
  sizzle: () => noise(1, { f:5200, q:.5, vol:.06, to:3200 }),
  crackle: () => { for(let i = 0; i < 3; i++) noise(.025, { f:2500 + Math.random() * 2500, q:3, vol:.04, at:i * (.03 + Math.random() * .05) }); },
  burnt: () => { noise(.7, { f:320, q:.6, vol:.09, to:120 }); tone(92, .55, { type:'sawtooth', vol:.018, to:58 }); },
  snip: () => { noise(.03, { f:5600, q:2.5, vol:.09 }); noise(.028, { f:3900, q:2.5, vol:.07, at:.045 }); },
  unfold: () => { noise(.55, { f:450, to:2600, q:.7, vol:.09 }); for(let i = 0; i < 4; i++) noise(.06, { f:1700 + i * 320, q:1.2, vol:.045, at:.16 + i * .07 }); },
  petal: () => tone(1700 + Math.random() * 1100, .07, { vol:.016 }),
  whoosh: () => noise(.32, { f:380, to:1900, q:.8, vol:.06 }),
  door: () => { tone(210, .16, { type:'triangle', vol:.05, to:170 }); noise(.22, { f:850, q:1, vol:.04 }); },
  thunk: () => tone(130, .08, { type:'triangle', vol:.05, to:90 }),
  fanfare: () => { strum([45, 52, 57, 60, 64, 69], 0, .09); strum([45, 52, 57, 60, 64, 69], .3, .065); bell(NOTE(81), .55, .09); },
  star: () => bell(NOTE(88), 0, .08),
  light: () => { strum([57, 64, 69, 72], 0, .07, .05); bell(NOTE(84), .2, .06); }
});

/* 배경음: 기타 아르페지오 + 바람. 멈췄다 다시 켜도 처음으로 돌아가지 않고 이어서 흐름 (8마디 진행 × 4가지 무늬) */
let ambT = 0, ambBus = null, ambWind = null, ambStep = 0, ambNext = 0, ambDucked = false;
const AMB_PROG = [[45, 57, 60, 64], [50, 57, 62, 65], [52, 56, 59, 64], [45, 57, 60, 64], [48, 55, 60, 64], [43, 55, 59, 62], [41, 53, 57, 60], [40, 56, 59, 64]];  // Am Dm E Am C G F E
const AMB_PAT = [[0, 2, 1, 3, 2, 1], [0, 1, 2, 3, 2, 1], [0, 2, 3, 1, 3, 2], [0, 3, 2, 1, 2, 3]];
const AMB_MEL = [[76, 74], [77, 76], [74, 71], [72, 69], [76, 79], [74, 71], [72, 77], [71, 68]];
function ambGain(){ return ambDucked ? .3 : 1; }
function ambientOn(){
  if(ambT || !sndOn()) return;
  const c = au(); if(!c) return;
  if(!ambBus){ ambBus = c.createGain(); ambBus.gain.value = .0001; ambBus.connect(master); }
  const t = c.currentTime;
  ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(Math.max(.0001, ambBus.gain.value), t); ambBus.gain.linearRampToValueAtTime(ambGain(), t + 1.8);
  ambNext = t + .2;
  const E = .34;
  ambT = setInterval(() => {
    if(!sndOn()) return;
    if(document.hidden){ ambNext = c.currentTime + .2; return; }
    if(ambNext < c.currentTime) ambNext = c.currentTime + .05;          // 탭이 잠깐 멈췄다 돌아와도 몰아서 치지 않게
    while(ambNext < c.currentTime + .45){
      const bar = Math.floor(ambStep / 6), beat = ambStep % 6, cycle = Math.floor(bar / 8);
      const ch = AMB_PROG[bar % 8], pat = AMB_PAT[(bar + cycle) % 4], at = ambNext - c.currentTime;
      pluck(NOTE(ch[pat[beat]] + 12), at, beat === 0 ? .042 : .028, ambBus);
      if(beat === 0) pluck(NOTE(ch[0]), at, .05, ambBus);
      if(beat === 3) pluck(NOTE(ch[0] + 7), at, .026, ambBus);
      if(cycle % 2 === 1 && (beat === 0 || beat === 3)) pluck(NOTE(AMB_MEL[bar % 8][beat ? 1 : 0]), at + .01, .05, ambBus);   // 두 바퀴마다 한 번 멜로디가 얹힘
      if(bar % 8 === 7 && beat === 5) bell(NOTE(88), at, .02, ambBus);
      ambStep++; ambNext += E;
    }
  }, 90);
  try{
    if(!noiseBuf){ noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const ch = noiseBuf.getChannelData(0); for(let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(.0001, c.currentTime); g.gain.linearRampToValueAtTime(.014, c.currentTime + 2);
    lfo.frequency.value = .13; lg.gain.value = .008; lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(); lfo.start();
    ambWind = { src, lfo };
  }catch{}
}
function ambientOff(){
  if(!ambT) return;
  clearInterval(ambT); ambT = 0;
  try{ const t = actx.currentTime; ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(Math.max(.0001, ambBus.gain.value), t); ambBus.gain.linearRampToValueAtTime(.0001, t + .5); }catch{}
  if(ambWind){ const { src, lfo } = ambWind; ambWind = null; try{ const t = actx.currentTime; src.stop(t + .55); lfo.stop(t + .55); }catch{} }
}
function ambDuck(on){
  ambDucked = on;
  if(!ambT || !ambBus) return;
  try{ const t = actx.currentTime; ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(Math.max(.0001, ambBus.gain.value), t); ambBus.gain.linearRampToValueAtTime(ambGain(), t + .5); }catch{}
}
Object.assign(SFX, {
  shatter: () => { for(let i = 0; i < 7; i++) noise(.07, { f:2600 + Math.random() * 3600, q:3, vol:.07, at:i * .028 }); tone(1900, .18, { vol:.03, to:800 }); },
  unlock: () => { noise(.05, { f:2400, q:4, vol:.08 }); tone(520, .12, { type:'triangle', vol:.06, at:.08 }); tone(780, .22, { type:'triangle', vol:.05, at:.17 }); },
  creakDoor: () => { noise(1.1, { f:380, to:900, q:9, vol:.08 }); noise(.9, { f:600, to:300, q:7, vol:.05, at:.5 }); tone(82, .9, { type:'triangle', vol:.05, at:.9 }); },
  pen: () => noise(.06, { f:3800, q:1.5, vol:.04 })
});

/* ══════════════════ 2일차 · 할머니의 집 (방탈출) ══════════════════
   방 하나를 네 벽으로 돌아보며 퍼즐 네 개를 풀어 제단을 완성하면 문이 열림.
   부엌(비밀 재료) → 편지 → 제단(바랜 사진) / 작업대(접힌 깃발) → 종 망치 → 창가(영혼의 종)
   퍼즐은 사람마다(기기 키로) 다르게 만들어지고, 힌트는 퍼즐을 처음 연 뒤 2분·4분에 열림 */

/* ── 공통 도구 ── */
const hashS = s => { let h = 1779033703 ^ s.length; for(let i = 0; i < s.length; i++){ h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; };
const rng = seed => { let a = hashS(String(seed)); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const sshuf = (r, arr) => { const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const seedOf = (id, v) => `${(me() || {}).key || 'x'}:${ROUND}:${id}:${v}`;
const pzGet = (k, d) => { const o = LS.get(rk('pz')) || {}; return o[k] === undefined ? d : o[k]; };
const pzSet = (k, v) => { const o = LS.get(rk('pz')) || {}; o[k] = v; LS.set(rk('pz'), o); };
const jo = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c <= 11171 && c % 28 ? a : b); };
function saveStars(id, n){ const s = LS.get(rk('stars')) || {}; if(!s[id] || s[id] < n){ s[id] = n; LS.set(rk('stars'), s); } }
function sparks(x, y, { n = 14, colors = ['#ffd34d', '#ff9f1c', '#ff4f9a', '#2ec4b6'], dist = 70, size = 6, shape = 'dot', dur = 700 } = {}){
  if(reduce) return;
  for(let i = 0; i < n; i++){
    const e = document.createElement('i'); e.className = 'fx ' + shape;
    e.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${shape === 'petal' ? size * 1.4 : size}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(e);
    const a = Math.random() * 6.283, d = dist * (.45 + Math.random() * .75), r = Math.random() * 360;
    e.animate([{ transform:`translate(-50%,-50%) rotate(${r}deg) scale(1)`, opacity:1 },
      { transform:`translate(calc(-50% + ${(Math.cos(a) * d).toFixed(1)}px),calc(-50% + ${(Math.sin(a) * d).toFixed(1)}px)) rotate(${r + 200}deg) scale(.25)`, opacity:0 }],
      { duration: dur * (.7 + Math.random() * .6), easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards' }).onfinish = () => e.remove();
  }
}
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const ICON = {
  bread: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="38" rx="24" ry="16" fill="#e9a85c"/><path d="M14 34q18-8 36 0M32 22v32" stroke="#c8732b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="6" fill="#d9822b"/></svg>`,
  paper: `<svg viewBox="0 0 64 64"><path d="M10 8h44v40l-5 6-5-6-5 6-5-6-5 6-5-6-5 6-4-6z" fill="#ff4f9a"/><path d="M32 16l6 8-6 8-6-8zM18 22a3 3 0 106 0 3 3 0 00-6 0M40 22a3 3 0 106 0 3 3 0 00-6 0" fill="#150f1e"/></svg>`,
  bell: `<svg viewBox="0 0 64 64"><path d="M32 8c-14 0-18 12-18 22v10l-6 8h48l-6-8V30c0-10-4-22-18-22z" fill="#ffbf3c"/><circle cx="32" cy="52" r="5" fill="#ff9f1c"/><path d="M24 18q8-6 16 0" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/></svg>`,
  spirit: `<svg viewBox="0 0 64 64"><rect x="12" y="6" width="40" height="52" rx="3" fill="#c99a4a"/><rect x="17" y="11" width="30" height="42" fill="#ff9ac4"/><circle cx="32" cy="27" r="7" fill="#3d2a18" opacity=".8"/><path d="M21 52q11-18 22 0z" fill="#3d2a18" opacity=".8"/></svg>`
};
const bellSVG = c => `<svg viewBox="0 0 40 46" aria-hidden="true"><rect x="18" y="0" width="4" height="6" rx="2" fill="#c9a97a"/><path d="M20 5c-9 0-12 8-12 15v8l-4 6h32l-4-6v-8c0-7-3-15-12-15z" fill="${c}"/><circle cx="20" cy="38.5" r="4" fill="${c}" opacity=".85"/><path d="M13 14q7-5 14 0" stroke="#fff" stroke-width="2.2" fill="none" opacity=".45" stroke-linecap="round"/></svg>`;
const ghostSVG = (c, dog) => `<svg viewBox="0 0 48 56" aria-hidden="true">${dog ? `<path d="M8 10l6 12-10 2zM40 10l-6 12 10 2z" fill="${c}"/>` : ''}<path d="M24 3C12 3 5 12 5 24v27l6-5 6 5 7-5 7 5 6-5 6 5V24C43 12 36 3 24 3z" fill="${c}"/><ellipse cx="17" cy="24" rx="3.4" ry="4.6" fill="#241a30"/><ellipse cx="31" cy="24" rx="3.4" ry="4.6" fill="#241a30"/>${dog ? '<ellipse cx="24" cy="33" rx="4" ry="3" fill="#241a30"/>' : '<ellipse cx="24" cy="34" rx="3" ry="3.6" fill="#241a30"/>'}</svg>`;
const flameSVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z" fill="#ffc94d"/><path d="M10 7c2 3 3 5 3 6.5a3 3 0 01-6 0C7 12 8 10 10 7z" fill="#fff4d0"/></svg>`;
const mariAt = (x, y, s) => SVG.mari.replace('<svg viewBox="0 0 40 40"', `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 40 40"`);
const zig = (x0, x1, y, w = 10, h = 6, c = '#f6e7cf') => { let d = `M${x0} ${y}`; for(let x = x0; x < x1; x += w) d += `l${w / 2} ${h} ${w / 2} ${-h}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" opacity=".75"/>`; };

/* ── 방의 네 벽 ── */
const WALLS = [{ id:'altar', name:'제단' }, { id:'bench', name:'작업대' }, { id:'door', name:'창가와 문' }, { id:'kitchen', name:'부엌' }];
const PZ_WALL = { bread:3, paper:1, bell:2, spirit:0 };
const NEED = { spirit:'bread', bell:'paper' };
const NEED_SAY = {
  spirit: '사진이 너무 바래서 누가 누군지 모르겠어… 할머니가 남긴 편지가 어딘가 있을 텐데. 부엌부터 살펴볼까?',
  bell: '종을 칠 작은 망치가 없어. 작업대 서랍 안에 있지 않을까?'
};
const GOT_SAY = {
  bread: '빵 틀 밑에서 할머니의 편지가 나왔어! 제단의 바랜 사진을 살펴보자',
  paper: '서랍에서 작은 종 망치가 나왔어! 창가의 종을 울릴 수 있겠어',
  bell: '종소리가 퍼졌어. 영혼들이 길을 찾아오고 있어!',
  spirit: '가족들이 모두 자기 사진을 찾았어!'
};
const BELLS = [{ c:'#ff4f9a', n:'분홍', m:72 }, { c:'#ff9f1c', n:'주황', m:74 }, { c:'#2ec4b6', n:'청록', m:76 }, { c:'#ffd34d', n:'노랑', m:79 }, { c:'#b07cff', n:'보라', m:81 }];
const wallBg = k => `<defs><pattern id="rmWp${k}" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M18 5l5 13-5 13-5-13z" fill="#ff9ac4" opacity=".06"/><circle cx="0" cy="0" r="2.2" fill="#ffd34d" opacity=".08"/><circle cx="36" cy="36" r="2.2" fill="#ffd34d" opacity=".08"/></pattern>
  <radialGradient id="rmLt${k}" cx="50%" cy="4%" r="80%"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".2"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient></defs>
  <rect width="360" height="440" fill="#241a33"/><rect width="360" height="372" fill="url(#rmWp${k})"/>
  <rect y="364" width="360" height="8" fill="#3a2638"/><rect y="372" width="360" height="68" fill="#2a1c22"/>
  <path d="M0 395h360M0 418h360M60 372v23M170 372v23M280 372v23M110 395v23M230 395v23M330 395v23M40 418v22M200 418v22" stroke="#1d1317" stroke-width="2"/>`;
const wallLight = k => `<rect width="360" height="440" fill="url(#rmLt${k})" pointer-events="none"/>`;
function wAltar(d){
  const cols = ['#ff4f9a', '#ff9f1c', '#2ec4b6', '#ffd34d', '#b07cff'], sp = d.has('spirit');
  const flags = [...Array(9)].map((_, i) => { const x = 27 + i * 38.25, y = 33 + Math.sin((i + .5) / 9 * Math.PI) * 17;
    return `<g transform="translate(${(x - 12).toFixed(1)} ${y.toFixed(1)})"><path d="M0 0h24v22l-4 5-4-5-4 5-4-5-4 5-4-5z" fill="${cols[i % 5]}"/><path d="M12 6l4 5-4 5-4-5zM4.5 8a1.8 1.8 0 103.6 0 1.8 1.8 0 10-3.6 0M15.9 8a1.8 1.8 0 103.6 0 1.8 1.8 0 10-3.6 0" fill="#241a33" opacity=".75"/></g>`; }).join('');
  const pc = ['#ff9ac4', '#9fe6d9', '#ffd34d', '#c8a27a'];
  const frames = [0, 1, 2, 3].map(i => { const x = 98 + i * 42;
    return `<rect x="${x}" y="112" width="36" height="46" rx="2" fill="#c99a4a"/><rect x="${x + 4}" y="116" width="28" height="38" fill="${sp ? pc[i] : '#463a52'}"/>
      <circle cx="${x + 18}" cy="130" r="7" fill="${sp ? '#3d2a18' : '#5a4c68'}" opacity="${sp ? .75 : 1}"/><path d="M${x + 7} 154q11-17 22 0z" fill="${sp ? '#3d2a18' : '#5a4c68'}" opacity="${sp ? .75 : 1}"/>${sp ? '' : `<rect x="${x + 4}" y="116" width="28" height="38" fill="#c9bfd6" opacity=".12"/>`}`; }).join('');
  return `<svg viewBox="0 0 360 440" aria-hidden="true">${wallBg(0)}
    <path d="M6 30Q180 66 354 30" stroke="#f6e7cf" stroke-opacity=".35" stroke-width="1.5" fill="none"/>
    <g class="rm-it${d.has('paper') ? '' : ' off'}" data-s="paper">${flags}</g>
    <path d="M60 104h240" stroke="#3a2a4a" stroke-width="2"/>${frames}
    ${sp ? `<rect x="92" y="106" width="176" height="58" rx="8" fill="#ffd36b" opacity=".12"/>` : ''}
    <rect x="128" y="196" width="104" height="44" fill="#ff4f9a"/>${zig(128, 232, 198)}
    <rect x="78" y="240" width="204" height="60" fill="#ff9f1c"/>${zig(78, 282, 242)}
    <rect x="28" y="300" width="304" height="72" fill="#2ec4b6"/>${zig(28, 332, 302)}
    <rect x="28" y="364" width="304" height="8" fill="#000" opacity=".2"/>
    ${mariAt(134, 170, 28)}${mariAt(198, 170, 28)}
    <g transform="translate(166 172)"><path d="M14 0C6 0 1 5 1 12c0 4 2 7 5 8v5h16v-5c3-1 5-4 5-8C27 5 22 0 14 0z" fill="#f6eee4"/><circle cx="9" cy="12" r="3.4" fill="#ff4f9a"/><circle cx="19" cy="12" r="3.4" fill="#2ec4b6"/><path d="M14 15l-1.6 3h3.2z" fill="#241a33"/></g>
    <g class="rm-it${d.has('bread') ? '' : ' off'}" data-s="bread"><ellipse cx="103" cy="230" rx="21" ry="11" fill="#e9a85c"/><path d="M86 228q17-8 34 0M103 220v20" stroke="#c8732b" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="103" cy="225" r="4" fill="#d9822b"/></g>
    <g class="rm-it${d.has('bell') ? '' : ' off'}" data-s="bell" transform="translate(240 206) scale(.8)">${bellSVG('#ffbf3c').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
    <path d="M10 372l8-34h26l8 34z" fill="#c2410c"/><path d="M308 372l8-34h26l8 34z" fill="#c2410c"/>${mariAt(4, 300, 54)}${mariAt(302, 300, 54)}
    ${wallLight(0)}</svg>`;
}
function wBench(d){
  const open = d.has('paper');
  const sheet = (x, y, r, c, holes) => `<g transform="rotate(${r} ${x + 30} ${y})"><rect x="${x}" y="${y}" width="60" height="70" fill="${c}"/>${holes}<circle cx="${x + 30}" cy="${y + 4}" r="3" fill="#c9a97a"/></g>`;
  return `<svg viewBox="0 0 360 440" aria-hidden="true">${wallBg(1)}
    ${sheet(44, 64, -5, '#ff4f9a', '<circle cx="62" cy="96" r="6" fill="#241a33"/><circle cx="86" cy="96" r="6" fill="#241a33"/><circle cx="62" cy="116" r="6" fill="#241a33"/><circle cx="86" cy="116" r="6" fill="#241a33"/>')}
    ${sheet(150, 56, 3, '#2ec4b6', '<path d="M180 76l9 12-9 12-9-12z" fill="#241a33"/><circle cx="163" cy="112" r="5" fill="#241a33"/><circle cx="197" cy="112" r="5" fill="#241a33"/>')}
    ${sheet(256, 66, -2, '#ffd34d', '<circle cx="272" cy="86" r="5" fill="#241a33"/><circle cx="300" cy="86" r="5" fill="#241a33"/><circle cx="286" cy="104" r="5" fill="#241a33"/><circle cx="272" cy="122" r="5" fill="#241a33"/><circle cx="300" cy="122" r="5" fill="#241a33"/>')}
    <path d="M30 170h300" stroke="#6b4630" stroke-width="6"/><path d="M48 170v14M312 170v14" stroke="#6b4630" stroke-width="5"/>
    <rect x="60" y="146" width="16" height="24" rx="3" fill="#ff9f1c"/><rect x="80" y="140" width="16" height="30" rx="3" fill="#b07cff"/><rect x="100" y="150" width="16" height="20" rx="3" fill="#9be15d"/>
    <path d="M250 170v-26h36v26" fill="#3a2a4a"/><path d="M256 150h24" stroke="#ffd34d" stroke-width="3"/>
    <g transform="translate(46 214)"><rect width="80" height="8" fill="#ff4f9a"/><rect x="4" y="-6" width="80" height="8" fill="#2ec4b6"/><rect x="-2" y="-12" width="80" height="8" fill="#ffd34d"/><rect x="6" y="-18" width="80" height="8" fill="#b07cff"/></g>
    <g transform="translate(250 222) rotate(-18)"><circle cx="0" cy="0" r="7" fill="none" stroke="#ff4f9a" stroke-width="4"/><circle cx="0" cy="18" r="7" fill="none" stroke="#ff4f9a" stroke-width="4"/><path d="M6 4l40 12M6 14l40-8" stroke="#d8d4e0" stroke-width="4" stroke-linecap="round"/></g>
    <rect x="20" y="228" width="320" height="16" rx="3" fill="#8a5a3a"/><rect x="20" y="228" width="320" height="4" rx="2" fill="#a8744c"/>
    <rect x="30" y="244" width="300" height="46" fill="#6e4630"/><rect x="36" y="290" width="16" height="82" fill="#5a3826"/><rect x="308" y="290" width="16" height="82" fill="#5a3826"/>
    ${open ? `<rect x="122" y="250" width="116" height="34" fill="#2a1a12"/><g transform="translate(150 258) rotate(-8)"><rect x="0" y="6" width="40" height="5" rx="2" fill="#c9a97a"/><rect x="34" y="0" width="12" height="16" rx="3" fill="#ffbf3c"/></g>
      <rect x="116" y="282" width="128" height="30" rx="3" fill="#5a3826" stroke="#3e2618" stroke-width="2"/><rect x="168" y="294" width="24" height="5" rx="2" fill="#c9a97a"/>`
    : `<rect x="128" y="252" width="104" height="30" rx="3" fill="#5a3826" stroke="#3e2618" stroke-width="2"/><rect x="168" y="263" width="24" height="5" rx="2" fill="#c9a97a"/>
      <g transform="translate(180 272)"><path d="M-6 0v-5a6 6 0 0112 0v5" stroke="#c9a97a" stroke-width="2.4" fill="none"/><rect x="-8" y="0" width="16" height="12" rx="2" fill="#ffbf3c"/><circle cx="0" cy="6" r="1.8" fill="#5a3826"/></g>`}
    <path d="M70 290h220" stroke="#5a3826" stroke-width="2"/>
    ${wallLight(1)}</svg>`;
}
function wDoor(d){
  const all = d.size === STAGES.length;
  const bells = BELLS.map((b, i) => `<g transform="translate(${212 + i * 21} 182) scale(.42)">${bellSVG(b.c).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`).join('');
  return `<svg viewBox="0 0 360 440" aria-hidden="true">${wallBg(2)}
    <defs><linearGradient id="rmNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c24"/><stop offset="1" stop-color="#3a1f4a"/></linearGradient>
      <radialGradient id="rmOut" cx="50%" cy="80%" r="70%"><stop offset="0" stop-color="#ffd36b"/><stop offset=".55" stop-color="#ff9f1c"/><stop offset="1" stop-color="#7a2a3a"/></radialGradient></defs>
    <path d="M26 372V176a66 66 0 01132 0v196z" fill="#3e2618"/>
    ${all ? `<path d="M36 372V178a56 56 0 01112 0v194z" fill="url(#rmOut)"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${92 + Math.sin(i) * 10}" cy="${360 - i * 22}" r="${4 - i * .4}" fill="#ff9f1c"/>`).join('')}
      <path d="M36 372V178l26-14v222z" fill="#6b3f2a"/><circle cx="56" cy="300" r="3.5" fill="#ffbf3c"/>`
    : `<path d="M36 372V178a56 56 0 01112 0v194z" fill="#6b3f2a"/>
      <rect x="50" y="196" width="36" height="74" rx="4" fill="#5a3424"/><rect x="98" y="196" width="36" height="74" rx="4" fill="#5a3424"/>
      <rect x="50" y="284" width="36" height="76" rx="4" fill="#5a3424"/><rect x="98" y="284" width="36" height="76" rx="4" fill="#5a3424"/>
      <circle cx="136" cy="290" r="5" fill="#ffbf3c"/><rect x="130" y="300" width="12" height="18" rx="3" fill="#3e2618"/><circle cx="136" cy="307" r="2.4" fill="#ffbf3c"/>`}
    ${mariAt(76, 132, 32)}
    <rect x="186" y="86" width="152" height="144" rx="6" fill="#6b4a35"/><rect x="194" y="94" width="136" height="128" fill="url(#rmNight)"/>
    <circle cx="300" cy="122" r="14" fill="#fff1c9"/><circle cx="294" cy="118" r="3" fill="#ead39a"/>
    <g fill="#fff" opacity=".7"><circle cx="214" cy="110" r="1"/><circle cx="244" cy="128" r="1.2"/><circle cx="226" cy="150" r=".9"/><circle cx="318" cy="160" r="1"/></g>
    <path d="M194 206q30-14 60-4t76-6v26H194z" fill="#1d1230"/>${[206, 230, 262, 290, 316].map((x, i) => `<circle cx="${x}" cy="${206 - i % 2 * 4}" r="3.4" fill="#ff9f1c" opacity=".8"/>`).join('')}
    <path d="M262 94v128M194 158h136" stroke="#6b4a35" stroke-width="6"/>
    <path d="M180 82h20v150q-10-60-20-74z" fill="#c2185b" opacity=".85"/><path d="M344 82h-20v150q10-60 20-74z" fill="#c2185b" opacity=".85"/>
    <path d="M208 178h116" stroke="#c9a97a" stroke-width="3"/><path d="M212 178v38M320 178v38" stroke="#c9a97a" stroke-width="3"/>${bells}
    <rect x="178" y="228" width="168" height="12" rx="3" fill="#8a5a3a"/><rect x="200" y="214" width="124" height="14" rx="3" fill="#7a3b5a"/>
    <rect x="214" y="290" width="104" height="82" rx="4" fill="#4a2f22"/><rect x="220" y="282" width="92" height="10" rx="3" fill="#6b4630"/>
    <ellipse cx="266" cy="280" rx="18" ry="4" fill="#2ec4b6"/><path d="M252 280q14-40 28 0" fill="#9be15d" opacity=".7"/>
    ${wallLight(2)}</svg>`;
}
function wKitchen(d){
  const baked = d.has('bread');
  const jc = ['#ffb36b', '#9be15d', '#c8732b', '#f6e7cf', '#ffbf3c'];
  const jars = jc.map((c, i) => { const x = 66 + i * 57;
    return `<rect x="${x - 19}" y="160" width="38" height="52" rx="10" fill="${c}" opacity=".88"/><rect x="${x - 15}" y="152" width="30" height="10" rx="3" fill="#c9a97a"/><rect x="${x - 10}" y="178" width="20" height="15" rx="2" fill="#f6e7cf"/><text x="${x}" y="190" text-anchor="middle" font-size="11" font-weight="900" fill="#3d2a18">${i + 1}</text>`; }).join('');
  return `<svg viewBox="0 0 360 440" aria-hidden="true">${wallBg(3)}
    <rect x="30" y="66" width="300" height="152" fill="#3a2419"/><rect x="30" y="66" width="300" height="152" fill="none" stroke="#6b4630" stroke-width="8"/>
    <rect x="30" y="134" width="300" height="6" fill="#6b4630"/><rect x="30" y="212" width="300" height="8" fill="#6b4630"/>
    ${[70, 112, 154].map(x => `<circle cx="${x}" cy="108" r="20" fill="#f6eee4"/><circle cx="${x}" cy="108" r="14" fill="none" stroke="#2f6bd0" stroke-width="3"/><circle cx="${x}" cy="108" r="5" fill="#2f6bd0"/>`).join('')}
    ${[214, 248, 282].map((x, i) => `<path d="M${x - 12} 106h24l-3 22h-18z" fill="${['#ff4f9a', '#2ec4b6', '#ffd34d'][i]}"/><path d="M${x + 12} 112q8 2 0 10" stroke="${['#ff4f9a', '#2ec4b6', '#ffd34d'][i]}" stroke-width="3" fill="none"/>`).join('')}
    ${jars}
    <rect x="14" y="262" width="186" height="10" rx="3" fill="#f6e7cf"/><rect x="20" y="272" width="174" height="100" fill="#2ec4b6"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${28 + i * 28}" y="282" width="22" height="22" fill="#f6eee4" opacity=".9"/><path d="M${39 + i * 28} 285l8 8-8 8-8-8z" fill="#2f6bd0"/>`).join('')}
    <path d="M44 262q0-26 34-26t34 26z" fill="#c9a97a"/><ellipse cx="78" cy="242" rx="24" ry="6" fill="#f3d9a8"/>
    <rect x="124" y="250" width="58" height="8" rx="4" fill="#b98a5a"/>
    <path d="M206 372V296a62 62 0 01124 0v76z" fill="#a84a28"/>
    <path d="M216 300h104M212 324h112M210 348h116M240 276v24M296 276v24M226 300v24M268 300v24M310 300v24M244 324v24M290 324v24" stroke="#7a3018" stroke-width="2"/>
    <path d="M240 372v-40a28 28 0 0156 0v40z" fill="#1a0f12"/>
    ${baked ? `<g><ellipse cx="268" cy="364" rx="22" ry="8" fill="#ff7a1a" opacity=".6"/><path d="M256 368c0-12 6-16 6-24 6 8 4 14 6 18 2-6 6-8 6-14 4 8 6 14 4 20z" fill="#ffbf3c"/></g><ellipse cx="268" cy="350" rx="40" ry="30" fill="#ff9f1c" opacity=".12"/>` : ''}
    <rect x="252" y="196" width="32" height="40" fill="#7a3018"/>
    <g transform="translate(212 236) rotate(4)"><rect width="0" height="0"/></g>
    ${wallLight(3)}</svg>`;
}
const WALL_SVG = [wAltar, wBench, wDoor, wKitchen];
const HOTSPOTS = [
  [{ id:'spirit', l:24, t:22.5, w:52, h:16 }],
  [{ id:'paper', l:8, t:49, w:84, h:23 }],
  [{ id:'bell', l:53, t:38, w:41, h:17 }, { id:'door', l:7, t:30, w:38, h:55 }],
  [{ id:'bread', l:10, t:33, w:80, h:16 }]
];

let lastCleared = null, roomWall = 0, roomGo = null;
function showWorld(){
  const m = me(); if(!m) return showPick();
  ambientOn();
  const d = done(), just = lastCleared; lastCleared = null;
  if(just) roomWall = 0;
  const firstOpen = !LS.get(rk('intro'));
  const root = view(`<div class="mw-top">${topbar('할머니의 집', `<span class="hw-chip">${m.num}번</span>`)}</div>
    <div class="rm">
      <div class="rm-bar"><button class="rm-bk" id="mwBook">기록장 <b>${d.size}/${STAGES.length}</b></button>
        <div class="rm-items">${STAGES.map(s => `<i class="${d.has(s.id) && s.id !== just ? 'on' : ''}" data-s="${s.id}" title="${s.name}">${ICON[s.id]}</i>`).join('')}</div>
        ${A.isMain() ? '<button class="rm-bk" id="mwAdm">관리자</button>' : ''}</div>
      ${PREVIEW ? '<div class="rm-pv">미리보기 · 나만 보여요 · 기록 안 남음<button id="rmPvX">끝내기</button></div>' : ''}
      <div class="rm-stage" id="rmStage"></div>
      <div class="rm-nav"><button class="rm-ar l" id="rmL"></button><div class="rm-nm"><b id="rmName"></b><span>${WALLS.map(() => '<i></i>').join('')}</span></div><button class="rm-ar r" id="rmR"></button></div>
    </div>`, 'mw-view');
  bindBack(root, () => A.back());
  const stage = $('#rmStage', root);
  let busy = false;
  const wallHTML = k => {
    const dd = done();
    const hs = HOTSPOTS[k].map(h => {
      const isDoor = h.id === 'door', solved = !isDoor && dd.has(h.id);
      const locked = isDoor ? dd.size < STAGES.length : NEED[h.id] && !dd.has(NEED[h.id]);
      return `<button class="rm-hs${locked ? ' lock' : ''}" data-h="${h.id}" style="left:${h.l}%;top:${h.t}%;width:${h.w}%;height:${h.h}%" aria-label="${isDoor ? '문' : st(h.id).name}">${solved ? '' : '<i class="dot"></i>'}</button>`;
    }).join('');
    const candles = k === 0 ? `<div class="hw-lanterns hw-candles" id="hwCandles">${STAGES.map((s, i) => `<span class="ln${dd.has(s.id) ? ' on' : ''}" data-s="${s.id}" data-i="${i}">${SVG.candle(dd.has(s.id))}</span>`).join('')}</div>` : '';
    return `<div class="rm-wall" data-w="${k}"><div class="rm-box">${WALL_SVG[k](dd)}${candles}${hs}</div></div>`;
  };
  const label = () => {
    $('#rmL', root).innerHTML = `${ARROW}${WALLS[(roomWall + 3) % 4].name}`;
    $('#rmR', root).innerHTML = `${WALLS[(roomWall + 1) % 4].name}${ARROW}`;
    $('#rmName', root).textContent = WALLS[roomWall].name;
    root.querySelectorAll('.rm-nm span i').forEach((i, n) => i.classList.toggle('on', n === roomWall));
  };
  const bindWall = el => {
    el.querySelectorAll('.rm-hs').forEach(b => b.onclick = () => tapHotspot(b.dataset.h, b));
    bindCandles(el.querySelector('#hwCandles'));
  };
  const go = (dir, to) => {
    if(busy) return;
    const k = to ?? (roomWall + dir + 4) % 4; if(k === roomWall) return;
    const old = stage.firstElementChild;
    roomWall = k; label();
    stage.insertAdjacentHTML('beforeend', wallHTML(k));
    const nu = stage.lastElementChild; bindWall(nu);
    sfx('whoosh');
    if(reduce || !old){ if(old) old.remove(); return; }
    busy = true;
    const opt = { duration:420, easing:'cubic-bezier(.65,0,.35,1)', fill:'forwards' };
    // 왼쪽 벽으로 가면 새 벽이 왼쪽에서 들어오고, 오른쪽 벽으로 가면 오른쪽에서 들어옴
    old.animate([{ transform:'translateX(0)', opacity:1 }, { transform:`translateX(${-dir * 100}%)`, opacity:.3 }], opt);
    nu.animate([{ transform:`translateX(${dir * 100}%)`, opacity:.3 }, { transform:'translateX(0)', opacity:1 }], opt).finished.then(() => { old.remove(); busy = false; }).catch(() => { old.remove(); busy = false; });
  };
  roomGo = go;
  $('#rmL', root).onclick = () => go(-1);
  $('#rmR', root).onclick = () => go(1);
  root.querySelectorAll('.rm-nm span i').forEach((i, n) => i.onclick = () => go(n === (roomWall + 3) % 4 ? -1 : 1, n));
  // 밀어서 돌아보기 (손가락을 왼쪽으로 밀면 오른쪽 벽이 보임)
  let sx = 0, sy = 0, st0 = 0;
  stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st0 = performance.now(); });
  stage.addEventListener('pointerup', e => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if(Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - st0 < 700) go(dx < 0 ? 1 : -1);
  });
  stage.innerHTML = wallHTML(roomWall); bindWall(stage.firstElementChild); label();
  $('#mwBook', root).onclick = () => showBook();
  const adm = $('#mwAdm', root); if(adm) adm.onclick = () => showAdminView();
  const px = $('#rmPvX', root); if(px) px.onclick = () => switchPreview(false, true);
  paintSpace();
  if(just){
    const item = stage.querySelector(`.rm-it[data-s="${just}"]`);
    if(item){ item.classList.add('off'); setTimeout(() => item.classList.remove('off'), 350); }
    setTimeout(() => {
      if(!root.isConnected) return;
      const ic = root.querySelector(`.rm-items i[data-s="${just}"]`);
      if(ic){ ic.classList.add('on', 'pop'); setTimeout(() => ic.classList.remove('pop'), 500); }
      sfx('light');
      const box = stage.querySelector('.rm-box'); if(box){ const [x, y] = centerOf(box); sparks(x, y - 20, { n:22, dist:130, shape:'petal', size:7, colors:['#ff9f1c', '#ffbb4d', '#ff4f9a'] }); }
      const all = done().size === STAGES.length;
      ghostSay(all ? '제단이 완성됐어! 창가 쪽 문이 열리는 소리가 났어' : GOT_SAY[just]);
      if(all) setTimeout(() => sfx('creakDoor'), 700);
    }, 500);
  }else if(firstOpen){
    LS.set(rk('intro'), 1);
    const ov = document.createElement('div'); ov.className = 'mw-intro';
    ov.innerHTML = `<div><span class="mi">${SVG.mari}</span><small>DÍA DE MUERTOS</small><h3>할머니의 집</h3><p>망자의 날 밤, 할머니 집에 들어왔는데<br>등 뒤에서 문이 잠겨 버렸어요.<br>자정에 돌아올 가족 영혼들을 위해<br><b style="color:#ffbb4d">제단을 완성하면 문이 열린대요.</b></p><button>둘러보기</button></div>`;
    document.body.appendChild(ov); sfx('fanfare');
    const close = () => { if(ov.classList.contains('out')) return; ov.classList.add('out'); setTimeout(() => ov.remove(), 700);
      setTimeout(() => ghostSay('양옆 버튼으로 방을 둘러보자. 반짝이는 곳을 누르면 자세히 볼 수 있어'), 500); };
    ov.querySelector('button').onclick = close;
  }
}
function tapHotspot(id, el){
  const d = done();
  if(id === 'door'){
    if(d.size < STAGES.length){ sfx('thunk'); return ghostSay(`꿈쩍도 안 해. 제단이 완성돼야 열릴 것 같아 (${d.size}/${STAGES.length})`); }
    sfx('creakDoor'); return showEscape();
  }
  if(d.has(id)) return showCard(id);
  if(NEED[id] && !d.has(NEED[id])){ sfx('thunk'); return ghostSay(NEED_SAY[id]); }
  sfx('door');
  if(!reduce && el){ const box = el.closest('.rm-box'); if(box) box.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)', opacity:.2 }], { duration:240, easing:'cubic-bezier(.65,0,.35,1)', fill:'forwards' }); }
  setTimeout(() => openMission(id), reduce ? 0 : 200);
}
function paintWorld(){
  const L = $('#mwLeft'); if(L){ const n = left(); L.textContent = n ? `${n}개` : '마감'; L.classList.toggle('hot', n > 0 && n <= 3); }
  const F = $('#mwFl'); if(!F) return;
  const g = coopGoal(), t = Math.min(stats.total || 0, g);
  const have = F.children.length;
  if(have > t) F.innerHTML = '';
  for(let i = F.children.length; i < t; i++){
    const row = i % 3, col = Math.floor(i / 3), cols = Math.ceil(g / 3);
    const x = 6 + ((col + (row % 2) * .5) / cols) * 88, y = [10, 42, 76][row] + ((i * 37) % 9) - 4;
    const f = document.createElement('i'); f.className = 'mw-f'; f.style.left = x + '%'; f.style.top = y + '%';
    f.style.setProperty('--s', (.8 + ((i * 53) % 5) / 10).toFixed(2)); f.innerHTML = SVG.mari;
    if(have && !reduce){ f.classList.add('new'); sfx('petal'); }
    F.appendChild(f);
  }
}
const TIERS = `<svg class="mw-tiers" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true"><path d="M30 20h240v24H30z" fill="#ff4f9a"/><path d="M14 44h272v34H14z" fill="#ff9f1c"/><path d="M0 78h300v42H0z" fill="#2ec4b6"/>
  <path d="M30 44l12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8M14 78l13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8" fill="none" stroke="#f6e7cf" stroke-width="2" opacity=".7"/></svg>`;
function showEscape(){
  const root = view(`${topbar('문 밖 · 금잔화 길')}
    <div class="es"><div class="es-hd"><span class="mi">${SVG.mari}</span><h3>탈출 성공</h3><p>문이 열리고 금잔화 길을 따라<br>가족 영혼들이 할머니 집으로 돌아오고 있어요.</p></div>
      <div id="hwMine"></div>
      <p class="es-sub">우리 반 제단 · 친구들이 퍼즐을 풀 때마다 금잔화가 한 송이씩 피어요</p>
      <div class="mw-ofr"><div class="mw-fl" id="mwFl"></div>${TIERS}</div>
      <div class="hw-coop" id="hwCoop"></div>
      <div class="mw-info"><span>남은 선착순 간식</span><b id="mwLeft"></b></div></div>`, 'hw-stage hw-in');
  bindBack(root, () => { roomWall = 2; showHome(); });
  paintSpace();
}
function showBook(){
  const d = done();
  const root = view(`${topbar('기록장', `<span class="hw-chip">${d.size} / ${STAGES.length}</span>`)}
    <p class="hw-q">퍼즐을 풀 때마다 망자의 날 이야기가 한 장씩 모여요. 눌러서 다시 읽을 수 있어요.</p>
    <div class="hw-book"><div class="sl">${STAGES.map((s, i) => d.has(s.id)
      ? `<button class="hw-slot2 got" data-s="${s.id}" style="--r:${[-2, 1.5, -1, 2][i]}deg"><i>${CARDS[s.id].n}</i><span>${CARDS[s.id].t}</span></button>`
      : `<span class="hw-slot2" data-s="${s.id}"><i>${CARDS[s.id].n}</i></span>`).join('')}</div></div>
    <div class="bk-now"><h4>지금 우리 반</h4><div id="hwMine"></div><div class="hw-coop" id="hwCoop"></div><div class="mw-info"><span>남은 선착순 간식</span><b id="mwLeft"></b></div></div>
    <p class="hw-rules"><b>참여상</b> 퍼즐 1개만 풀어도 받아요.<br><b>선착순 간식</b> 네 퍼즐을 모두 풀고 탈출한 순서대로 ${prizes()}명.<br>퍼즐은 사람마다 다르게 나와서 답을 알려 줘도 소용없어요. 막히면 퍼즐을 연 뒤 2분, 4분에 힌트가 열려요.</p>`, 'hw-stage hw-in');
  bindBack(root, () => showHome());
  root.querySelectorAll('.hw-slot2.got').forEach(b => b.onclick = () => showCard(b.dataset.s));
  paintSpace();
}
function showAdminView(){
  const root = view(`${topbar('관리자')}<div id="hwAdmin"></div>`, 'hw-stage hw-in');
  bindBack(root, () => showHome());
  paintAdmin();
}

/* ── 퍼즐 공통 화면: 이야기 한 줄 + 힌트(퍼즐을 처음 연 뒤 2분·4분) ── */
const HINT_AT = [120, 240];
function pzView(id, story, inner){
  const root = view(`${topbar(st(id).name, '<button class="pz-hb" id="pzHb" disabled>힌트</button>')}
    <div class="pz"><p class="pz-story">${story}</p><div class="pz-hint" id="pzHint"></div>${inner}</div>`, 'hw-stage hw-in');
  bindBack(root, () => { stopMission(); showHome(); });
  return root;
}
function hintSystem(id, root, texts){        // texts: () => [첫째, 둘째] (지금 문제에 맞춰 매번 새로 계산)
  if(!pzGet('t0' + id)) pzSet('t0' + id, Date.now());
  const btn = $('#pzHb', root), box = $('#pzHint', root);
  const used = () => pzGet('hu' + id, 0);
  const draw = () => {
    const tx = texts();
    box.innerHTML = tx.slice(0, used()).map((t, i) => `<p data-n="힌트 ${i + 1}">${t}</p>`).join('');
  };
  const tick = () => {
    if(!btn.isConnected) return;
    const el = (Date.now() - pzGet('t0' + id)) / 1000, u = used();
    const open = HINT_AT.filter(s => el >= s).length;
    if(u >= HINT_AT.length){ btn.disabled = true; btn.classList.remove('on'); btn.textContent = '힌트 끝'; return; }
    if(open > u){ btn.disabled = false; btn.classList.add('on'); btn.textContent = `힌트 ${u + 1} 보기`; return; }
    const left2 = Math.max(0, Math.ceil(HINT_AT[u] - el));
    btn.disabled = true; btn.classList.remove('on'); btn.textContent = `힌트 ${Math.floor(left2 / 60)}:${String(left2 % 60).padStart(2, '0')}`;
  };
  btn.onclick = () => {
    const el = (Date.now() - pzGet('t0' + id)) / 1000, u = used();
    if(u >= HINT_AT.length || el < HINT_AT[u]) return;
    pzSet('hu' + id, u + 1); sfx('ghost');
    if(mission && mission.onHint) mission.onHint(u + 1);
    draw(); tick();
    const p = box.lastElementChild; if(p) p.scrollIntoView({ block:'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };
  draw(); tick();
  if(mission.hintT) clearInterval(mission.hintT);
  mission.hintT = setInterval(tick, 1000); mission.timers.push(mission.hintT);
  return { redraw: draw, used };
}
const pzStars = (id, extra = 0) => Math.max(1, 3 - pzGet('hu' + id, 0) - extra);
function pzMsg(root, text, cls = ''){ const m = $('#pzMsg', root); if(m){ m.className = 'pz-msg ' + cls; m.innerHTML = text; } }

/* ───────── 1. 부엌 · 비밀 재료 (쪽지 다섯 장 중 참말은 딱 하나) ───────── */
const JARS = [{ n:'오렌지꽃물', c:'#ffb36b' }, { n:'아니스', c:'#9be15d' }, { n:'계피', c:'#c8732b' }, { n:'바닐라', c:'#f6e7cf' }, { n:'흑설탕', c:'#8a5a3a' }, { n:'꿀', c:'#ffbf3c' }, { n:'오렌지 껍질', c:'#ff7a1a' }, { n:'버터', c:'#ffe08a' }];
function liarStmt(r, s, N){
  const other = () => { let v; do{ v = Math.floor(r() * N); }while(v === s); return v; };
  for(;;){
    const k = Math.floor(r() * 10);
    if(k === 0){ const v = other(); return { text:`진짜는 ${v + 1}번 단지야`, t: X => X === v, direct:true }; }
    if(k === 1){ const v = other(); return { text:`${v + 1}번 단지는 가짜야`, t: X => X !== v }; }
    if(k === 2 && s > 0) return { text:'진짜는 나보다 왼쪽에 있어', t: X => X < s };
    if(k === 3 && s < N - 1) return { text:'진짜는 나보다 오른쪽에 있어', t: X => X > s };
    if(k === 4) return { text:'진짜는 홀수 번 단지야', t: X => X % 2 === 0 };
    if(k === 5) return { text:'진짜는 짝수 번 단지야', t: X => X % 2 === 1 };
    if(k === 6) return { text:'진짜는 양 끝 단지 중 하나야', t: X => X === 0 || X === N - 1 };
    if(k === 7){ const v = other(); return { text:`진짜는 ${v + 1}번 단지 바로 옆이야`, t: X => Math.abs(X - v) === 1 }; }
    if(k === 8) return { text:'내가 진짜야', t: X => X === s, direct:true };
    if(k === 9) return { text:'나는 가짜야', t: X => X !== s };
  }
}
function genLiar(seed){
  const r = rng(seed), N = 5;
  for(let n = 0; n < 6000; n++){
    const sts = [...Array(N)].map((_, s) => liarStmt(r, s, N));
    if(new Set(sts.map(x => x.text)).size < N) continue;
    const sols = [...Array(N)].map((_, X) => X).filter(X => sts.filter(f => f.t(X)).length === 1);
    if(sols.length !== 1) continue;
    const X = sols[0], truth = sts.findIndex(f => f.t(X));
    if(sts[truth].direct) continue;                                   // 참말이 '진짜는 n번' 같은 직접 답이면 너무 쉬움
    if(sts.filter(f => f.direct).length > 2) continue;
    const jars = sshuf(r, JARS).slice(0, N);
    const decoy = sshuf(r, [...Array(N)].map((_, i) => i).filter(i => i !== X))[0];
    return { sts, X, jars, decoy };
  }
  return null;
}
const jarSVG = c => `<svg viewBox="0 0 60 84" aria-hidden="true"><rect x="10" y="4" width="40" height="12" rx="4" fill="#c9a97a"/><rect x="14" y="14" width="32" height="6" fill="#a8835a"/><rect x="6" y="18" width="48" height="62" rx="14" fill="${c}"/><rect x="12" y="24" width="8" height="40" rx="4" fill="#fff" opacity=".25"/><rect x="18" y="42" width="24" height="20" rx="3" fill="#f6e7cf"/><path d="M22 48h16M22 54h11" stroke="#a8835a" stroke-width="2" stroke-linecap="round"/></svg>`;
function mBread(){
  const v = pzGet('vbread', 0), P = genLiar(seedOf('bread', v));
  const marks = {};
  let sel = -1;
  const root = pzView('bread', '할머니는 망자의 빵에 <b>비밀 재료</b> 하나를 꼭 넣으셨대요. 찬장에는 단지 다섯 개, 단지마다 쪽지가 붙어 있어요.',
    `<div class="pz-rule">쪽지 다섯 장 중 <b>참말은 딱 한 장</b>뿐이야.<br>진짜 비밀 재료 단지를 찾아 빵을 구워 보렴.<span class="sig">— 할머니가</span></div>
    <div class="lj-shelf">${P.jars.map((j, i) => `<button class="lj-j" data-i="${i}">${jarSVG(j.c)}<small><b>${i + 1}번</b>${j.n}</small></button>`).join('')}</div>
    <div class="lj-notes">${P.sts.map((s, i) => `<button class="lj-n" data-i="${i}"><i>${i + 1}</i><span>“${s.text}”</span><em>표시</em></button>`).join('')}</div>
    <p class="lj-tip">쪽지를 누르면 ‘참’·‘거짓’ 표시를 할 수 있어요</p>
    <button class="hw-btn" id="ljGo" disabled>단지를 골라 주세요</button><p class="pz-msg" id="pzMsg"></p>`);
  hintSystem('bread', root, () => ['단지 하나하나에 대해 “이게 진짜라면?” 하고 가정해 봐. 그때 참말이 되는 쪽지가 <b>딱 한 장</b>이면 그 단지가 정답이야.',
    `진짜는 <b>${Math.min(P.X, P.decoy) + 1}번</b>이나 <b>${Math.max(P.X, P.decoy) + 1}번</b> 중 하나야.`]);
  root.querySelectorAll('.lj-n').forEach(b => b.onclick = () => {
    const i = b.dataset.i, m = ((marks[i] || 0) + 1) % 3; marks[i] = m;
    b.classList.toggle('t', m === 1); b.classList.toggle('f', m === 2);
    b.querySelector('em').textContent = ['표시', '참', '거짓'][m]; sfx('pen');
  });
  const go = $('#ljGo', root);
  root.querySelectorAll('.lj-j').forEach(b => b.onclick = () => {
    sel = Number(b.dataset.i);
    root.querySelectorAll('.lj-j').forEach(x => x.classList.toggle('sel', x === b));
    go.disabled = false; go.textContent = `${sel + 1}번 ${P.jars[sel].n}(으)로 빵 굽기`; sfx('tap');
  });
  go.onclick = async () => {
    if(sel < 0) return;
    go.disabled = true;
    if(sel !== P.X){
      const j = root.querySelector(`.lj-j[data-i="${sel}"]`); j.classList.remove('sel'); j.classList.add('crack'); sfx('shatter');
      const miss = pzGet('mbread', 0) + 1; pzSet('mbread', miss); pzSet('vbread', v + 1);
      pzMsg(root, '앗, 반죽이 부풀지 않아요. 그건 비밀 재료가 아니었어요!<br>할머니가 찬장을 다시 채우셨어요 · <b>쪽지가 바뀌었어요</b>', 'bad');
      mission.timers.push(setTimeout(() => { if(mission && mission.id === 'bread') mBread(); }, 2200));
      return;
    }
    sfx('find');
    const ov = document.createElement('div'); ov.className = 'lj-oven';
    ov.innerHTML = `<div><svg viewBox="0 0 220 190" aria-hidden="true"><path d="M20 190V100a90 90 0 01180 0v90z" fill="#a84a28"/><path d="M60 190v-60a50 50 0 01100 0v60z" fill="#1a0f12"/>
      <g class="fl"><path d="M92 186c0-18 10-24 10-36 8 12 6 20 8 26 3-8 9-12 9-20 6 12 9 20 6 30z" fill="#ffbf3c"/><path d="M100 186c0-10 5-14 5-20 5 7 4 12 5 15 2-5 5-7 5-11 3 7 5 11 3 16z" fill="#fff1c9"/></g>
      <ellipse cx="110" cy="168" rx="30" ry="12" fill="#e9a85c"/><path d="M86 166q24-10 48 0M110 156v22" stroke="#c8732b" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
      <p>${P.jars[sel].n}을(를) 넣은 반죽이 노릇하게 구워지는 중…</p></div>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
    sfx('sizzle'); setTimeout(() => sfx('crackle'), 500); setTimeout(() => sfx('crackle'), 1100);
    mission.cleanup = () => ov.remove();
    await sleep(1900);
    ov.classList.remove('on'); setTimeout(() => ov.remove(), 300);
    const n = pzStars('bread', pzGet('mbread', 0) >= 2 ? 1 : 0); saveStars('bread', n);
    win('bread', `할머니의 빵이 구워졌어요. 빵 틀 밑에서 낡은 편지가 나왔어요!`, n);
  };
}

/* ───────── 2. 작업대 · 접힌 깃발 (접고 뚫은 종이를 펼치면?) ───────── */
const PF_ROUNDS = [{ nf:1, nh:2 }, { nf:2, nh:2 }, { nf:3, nh:1 }];
const pfKey = H => H.map(([x, y]) => x + ',' + y).sort().join('|');
const pfUniq = H => { const s = new Set(), o = []; H.forEach(h => { const k = h.join(','); if(!s.has(k)){ s.add(k); o.push(h); } }); return o; };
function pfUnfold(folds, regs, holes, mod = {}){
  let H = holes.map(h => h.slice());
  for(let i = folds.length - 1; i >= 0; i--){
    if(mod.skip === i) continue;
    const R = regs[i], ax = mod.swap === i ? (folds[i].ax === 'v' ? 'h' : 'v') : folds[i].ax;
    H = pfUniq(H.concat(H.map(([x, y]) => ax === 'v' ? [R.x0 + R.x1 - 1 - x, y] : [x, R.y0 + R.y1 - 1 - y])));
  }
  return H;
}
function genFold(seed, round){
  const r = rng(seed), cf = PF_ROUNDS[round];
  let R = { x0:0, y0:0, x1:4, y1:4 }; const folds = [], regs = [];
  let ax = r() < .5 ? 'v' : 'h';
  for(let i = 0; i < cf.nf; i++){
    if((ax === 'v' ? R.x1 - R.x0 : R.y1 - R.y0) < 2) ax = ax === 'v' ? 'h' : 'v';
    const hi = r() < .5; regs.push({ ...R }); folds.push({ ax, hi });
    if(ax === 'v'){ const m = (R.x0 + R.x1) / 2; R = hi ? { ...R, x0:m } : { ...R, x1:m }; }
    else{ const m = (R.y0 + R.y1) / 2; R = hi ? { ...R, y0:m } : { ...R, y1:m }; }
    ax = ax === 'v' ? 'h' : 'v';
  }
  const cells = []; for(let x = R.x0; x < R.x1; x++) for(let y = R.y0; y < R.y1; y++) cells.push([x, y]);
  const holes = sshuf(r, cells).slice(0, cf.nh);
  const ans = pfUnfold(folds, regs, holes), key = pfKey(ans);
  const inb = H => H.every(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4);
  const cand = [];
  folds.forEach((_, i) => { cand.push(pfUnfold(folds, regs, holes, { swap:i })); if(folds.length > 1 || holes.length > 1) cand.push(pfUnfold(folds, regs, holes, { skip:i })); });
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => cand.push(ans.map(([x, y]) => [x + dx, y + dy])));
  cand.push(ans.map(([x, y]) => [3 - y, x]));
  cells.filter(c => !holes.some(h => h[0] === c[0] && h[1] === c[1])).forEach(c => cand.push(pfUnfold(folds, regs, [c, ...holes.slice(1)])));
  const seen = new Set([key]), wrong = [];
  sshuf(r, cand).forEach(H => { const k = pfKey(H); if(inb(H) && H.length && !seen.has(k)){ seen.add(k); wrong.push(H); } });
  while(wrong.length < 3){               // 혹시 모자라면 구멍 하나를 옮긴 모양으로 채움
    const H = ans.map(h => h.slice()), i = Math.floor(r() * H.length); H[i] = [Math.floor(r() * 4), Math.floor(r() * 4)];
    const k = pfKey(pfUniq(H)); if(!seen.has(k)){ seen.add(k); wrong.push(pfUniq(H)); }
  }
  const opts = sshuf(r, [ans, ...wrong.slice(0, 3)]);
  return { folds, regs, final:R, holes, opts, ans: opts.indexOf(ans) };
}
const PFU = 16, PFO = 6;
function pfRect(R, fill){ return `<rect x="${PFO + R.x0 * PFU}" y="${PFO + R.y0 * PFU}" width="${(R.x1 - R.x0) * PFU}" height="${(R.y1 - R.y0) * PFU}" fill="${fill}"/>`; }
function pfStep(R, f, holes){
  let s = `<svg viewBox="0 0 76 76" aria-hidden="true"><rect x="${PFO}" y="${PFO}" width="64" height="64" fill="none" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 3"/>${pfRect(R, '#ff4f9a')}`;
  if(f){
    const mx = (R.x0 + R.x1) / 2, my = (R.y0 + R.y1) / 2;
    const mov = f.ax === 'v' ? (f.hi ? { ...R, x1:mx } : { ...R, x0:mx }) : (f.hi ? { ...R, y1:my } : { ...R, y0:my });
    const keep = f.ax === 'v' ? (f.hi ? { ...R, x0:mx } : { ...R, x1:mx }) : (f.hi ? { ...R, y0:my } : { ...R, y1:my });
    s += pfRect(mov, 'rgba(20,10,30,.28)');
    s += f.ax === 'v' ? `<line x1="${PFO + mx * PFU}" y1="${PFO + R.y0 * PFU - 3}" x2="${PFO + mx * PFU}" y2="${PFO + R.y1 * PFU + 3}" stroke="#ffd34d" stroke-width="2" stroke-dasharray="4 3"/>`
                      : `<line x1="${PFO + R.x0 * PFU - 3}" y1="${PFO + my * PFU}" x2="${PFO + R.x1 * PFU + 3}" y2="${PFO + my * PFU}" stroke="#ffd34d" stroke-width="2" stroke-dasharray="4 3"/>`;
    const c = Q => [PFO + (Q.x0 + Q.x1) / 2 * PFU, PFO + (Q.y0 + Q.y1) / 2 * PFU];
    const [ax, ay] = c(mov), [bx, by] = c(keep);
    const qx = (ax + bx) / 2 + (f.ax === 'h' ? 16 : 0), qy = (ay + by) / 2 - (f.ax === 'v' ? 16 : 0);
    const ang = Math.atan2(by - qy, bx - qx), hx = bx - Math.cos(ang) * 2, hy = by - Math.sin(ang) * 2;
    const p1 = [hx - Math.cos(ang - .5) * 7, hy - Math.sin(ang - .5) * 7], p2 = [hx - Math.cos(ang + .5) * 7, hy - Math.sin(ang + .5) * 7];
    s += `<path d="M${ax} ${ay}Q${qx} ${qy} ${hx} ${hy}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M${hx} ${hy}L${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}z" fill="#fff"/>`;
  }
  if(holes) holes.forEach(([x, y]) => { s += `<circle cx="${PFO + (x + .5) * PFU}" cy="${PFO + (y + .5) * PFU}" r="5" fill="#160e20" stroke="#fff" stroke-width="1.4"/>`; });
  return s + '</svg>';
}
function pfPaper(H){
  let s = `<svg viewBox="0 0 76 76" aria-hidden="true"><rect x="${PFO}" y="${PFO}" width="64" height="64" fill="#ff4f9a"/>`;
  for(let i = 1; i < 4; i++) s += `<path d="M${PFO + i * PFU} ${PFO}v64M${PFO} ${PFO + i * PFU}h64" stroke="#000" stroke-opacity=".08" stroke-width="1"/>`;
  H.forEach(([x, y]) => { s += `<circle cx="${PFO + (x + .5) * PFU}" cy="${PFO + (y + .5) * PFU}" r="5" fill="#160e20"/>`; });
  return s + '</svg>';
}
function mPaper(){
  const round = pzGet('rpaper', 0);
  if(round >= PF_ROUNDS.length) return finishPaper();
  const v = pzGet('vpaper', 0), P = genFold(seedOf('paper', `${round}:${v}`), round);
  let elim = [];
  const steps = P.folds.map((f, i) => `<div class="s">${pfStep(P.regs[i], f)}<small>${i + 1}. 접기</small></div><b>›</b>`).join('')
    + `<div class="s">${pfStep(P.final, null, P.holes)}<small>${P.folds.length + 1}. 뚫기</small></div>`;
  const root = pzView('paper', '작업대 서랍이 잠겨 있어요. 자물쇠에 할머니 글씨: <b>“깃발 세 장을 제대로 펼쳐 내면 열린단다.”</b>',
    `<div class="pf-prog">${PF_ROUNDS.map((_, i) => `<i class="${i < round ? 'on' : ''}">${ICON.paper}</i>`).join('')}<small>깃발 ${round + 1} / ${PF_ROUNDS.length}</small></div>
    <div class="pf-steps">${steps}</div>
    <p class="pf-q">점선을 따라 접고 구멍을 뚫었어요. 펼치면 어떤 모양일까요?</p>
    <div class="pf-opts">${P.opts.map((H, i) => `<button class="pf-o" data-i="${i}"><b>${'가나다라'[i]}</b>${pfPaper(H)}</button>`).join('')}</div>
    <p class="pz-msg" id="pzMsg"></p>`);
  const tag = round * 100 + v;
  const applyElim = () => { elim = sshuf(rng(seedOf('paperE', tag)), [0, 1, 2, 3].filter(i => i !== P.ans)).slice(0, 2);
    root.querySelectorAll('.pf-o').forEach(b => b.classList.toggle('gone', elim.includes(Number(b.dataset.i)))); };
  mission.onHint = n => { if(n === 2){ pzSet('epaper', tag); applyElim(); } };
  hintSystem('paper', root, () => ['접은 순서를 <b>거꾸로</b> 하나씩 펼쳐 봐. 한 번 펼칠 때마다 구멍이 <b>접는 선을 기준으로 거울처럼</b> 하나씩 더 생겨.',
    pzGet('epaper', -1) === tag ? '지금 문제에서 틀린 보기 두 개를 지웠어. 남은 둘 중에 골라 봐.' : '두 번째 힌트는 그때 풀던 문제의 틀린 보기 두 개를 지워 줬어.']);
  if(pzGet('epaper', -1) === tag) applyElim();
  let lockd = false;
  root.querySelectorAll('.pf-o').forEach(b => b.onclick = () => {
    if(lockd) return;
    const i = Number(b.dataset.i);
    if(i === P.ans){
      lockd = true; b.classList.add('ok'); sfx('unfold'); setTimeout(() => sfx('find'), 350);
      const [x, y] = centerOf(b); sparks(x, y, { n:16, dist:80, shape:'sq', size:6 });
      pzSet('rpaper', round + 1); pzSet('vpaper', 0);
      pzMsg(root, round + 1 < PF_ROUNDS.length ? '딱 맞아요! 다음 깃발로' : '세 장 모두 완성!', 'ok');
      mission.timers.push(setTimeout(() => { if(mission && mission.id === 'paper') mPaper(); }, 1100));
    }else{
      lockd = true; b.classList.add('bad'); sfx('wrong');
      pzSet('mpaper', pzGet('mpaper', 0) + 1); pzSet('vpaper', v + 1);
      pzMsg(root, '펼쳐 보니 모양이 달라요. <b>새 종이로 다시!</b>', 'bad');
      mission.timers.push(setTimeout(() => { if(mission && mission.id === 'paper') mPaper(); }, 1500));
    }
  });
}
function finishPaper(){
  sfx('unlock');
  const n = pzStars('paper', pzGet('mpaper', 0) >= 2 ? 1 : 0); saveStars('paper', n);
  win('paper', '깃발 세 장이 제단 위에 걸렸어요. 작업대 서랍이 열리고 작은 종 망치가 나왔어요!', n);
}

/* ───────── 3. 창가 · 영혼의 종 (네 종의 순서 추리) ───────── */
function mBell(){
  const r = rng(seedOf('bell', 0)), code = sshuf(r, [0, 1, 2, 3, 4]).slice(0, 4);
  const hist = pzGet('gbell', []);
  let cur = [];
  ambDuck(true);
  mission.cleanup = () => ambDuck(false);
  const root = pzView('bell', '창가의 작은 종 다섯 개. 할머니는 매년 이 종으로 <b>자장가</b>를 쳐서 영혼들에게 길을 알려 주셨대요. 서로 다른 종 <b>네 개</b>를 맞는 순서로 울려 보세요.',
    `<div class="mm-slots" id="mmS">${[0, 1, 2, 3].map(i => `<button class="mm-s" data-i="${i}" aria-label="${i + 1}번째 자리"></button>`).join('')}</div>
    <div class="mm-bells">${BELLS.map((b, i) => `<button class="mm-b" data-b="${i}" aria-label="${b.n} 종">${bellSVG(b.c)}</button>`).join('')}</div>
    <div class="mm-act"><button class="hw-btn ghost" id="mmClr">지우기</button><button class="hw-btn" id="mmGo" disabled>울려 보기</button></div>
    <div class="mm-key"><span>${SVG.mari}종도 자리도 맞음</span><span>${flameSVG}종은 맞는데 자리가 다름</span></div>
    <p class="pz-msg" id="pzMsg"></p>
    <div class="mm-hist" id="mmH"></div>`);
  hintSystem('bell', root, () => ['한 번에 <b>종 하나만</b> 바꿔서 울려 봐. 금잔화와 촛불 수가 어떻게 바뀌는지 보면 그 종이 맞는지 알 수 있어.',
    `첫 번째 종은 <b>${BELLS[code[0]].n} 종</b>이야.`]);
  const fb = g => { const ex = g.filter((b, i) => b === code[i]).length, inc = g.filter(b => code.includes(b)).length - ex; return [ex, inc]; };
  const drawHist = () => {
    $('#mmH', root).innerHTML = hist.slice().reverse().map((g, k) => { const [ex, inc] = fb(g);
      return `<div class="mm-r"><span class="n">${hist.length - k}</span><span class="g">${g.map(b => bellSVG(BELLS[b].c)).join('')}</span>
        <span class="fb">${ex + inc ? SVG.mari.repeat(ex) + flameSVG.repeat(inc) : '<em>하나도 없음</em>'}</span></div>`; }).join('');
  };
  const drawCur = () => {
    root.querySelectorAll('.mm-s').forEach((s, i) => { s.classList.toggle('f', cur[i] !== undefined); s.innerHTML = cur[i] !== undefined ? bellSVG(BELLS[cur[i]].c) : ''; });
    root.querySelectorAll('.mm-b').forEach(b => b.disabled = cur.includes(Number(b.dataset.b)) || cur.length >= 4);
    $('#mmGo', root).disabled = cur.length < 4;
  };
  const ring = (b, el, at = 0) => { bell(NOTE(BELLS[b].m), at, .13); if(el){ el.classList.remove('ring'); void el.offsetWidth; el.classList.add('ring'); } };
  root.querySelectorAll('.mm-b').forEach(b => b.onclick = () => { const i = Number(b.dataset.b); if(cur.length >= 4 || cur.includes(i)) return; cur.push(i); ring(i, b); drawCur(); });
  root.querySelectorAll('.mm-s').forEach(s => s.onclick = () => { const i = Number(s.dataset.i); if(cur[i] === undefined) return; cur.splice(i, 1); sfx('tap'); drawCur(); });
  $('#mmClr', root).onclick = () => { cur = []; sfx('tap'); drawCur(); };
  let playing = false;
  $('#mmGo', root).onclick = async () => {
    if(cur.length < 4 || playing) return;
    playing = true; $('#mmGo', root).disabled = true;
    const g = cur.slice(), slots = [...root.querySelectorAll('.mm-s')];
    for(let i = 0; i < 4; i++){ ring(g[i], slots[i].firstElementChild ? slots[i] : null); await sleep(380); if(!root.isConnected) return; }
    const [ex, inc] = fb(g);
    hist.push(g); pzSet('gbell', hist);
    if(ex === 4){
      slots.forEach((s, i) => setTimeout(() => s.classList.add('hit'), i * 120));
      await sleep(350);
      strum([60, 64, 67, 72], 0, .07, .06); [0, 1, 2, 3].forEach(i => bell(NOTE(BELLS[g[i]].m + 12), .25 + i * .2, .08));
      pzMsg(root, '종소리가 멀리 퍼져 나가요…', 'ok');
      await sleep(1500);
      const n = pzStars('bell', hist.length > 8 ? 1 : 0); saveStars('bell', n);
      return win('bell', `${hist.length}번 만에 자장가를 찾았어요. 종소리를 듣고 영혼들이 길을 찾기 시작했어요!`, n);
    }
    for(let i = 0; i < ex; i++) setTimeout(() => sfx('petal'), i * 90);
    pzMsg(root, ex + inc ? `금잔화 ${ex}개 · 촛불 ${inc}개` : '영혼들이 아무 반응이 없어요', '');
    cur = []; drawCur(); drawHist(); playing = false;
  };
  drawCur(); drawHist();
}

/* ───────── 4. 제단 · 바랜 사진 (편지 단서로 가족의 자리 찾기) ───────── */
const FAM = [{ n:'로사 할머니', c:'#ff9ac4' }, { n:'미겔 할아버지', c:'#9fe6d9' }, { n:'루시아 이모', c:'#ffd34d' }, { n:'강아지 초코', c:'#e0b88a', dog:true }];
const FOOD = ['핫초코', '망고', '타말레', '설탕 해골'];
const PERMS = (() => { const o = []; const f = (a, r) => { if(!r.length) o.push(a); r.forEach((x, i) => f([...a, x], r.filter((_, j) => j !== i))); }; f([], [0, 1, 2, 3]); return o; })();   // perm[p] = p가 있는 사진 자리
function genPhotos(seed){
  const r = rng(seed), sol = PERMS[Math.floor(r() * 24)], food = sshuf(r, FOOD);
  const N = p => FAM[p].n, fi = x => food.indexOf(x);
  const pool = [];
  for(let p = 0; p < 4; p++){
    pool.push({ text:`${jo(N(p), '은', '는')} 양 끝 사진 중 하나야`, t: q => q[p] === 0 || q[p] === 3 });
    pool.push({ text:`${jo(N(p), '은', '는')} 양 끝 사진이 아니야`, t: q => q[p] !== 0 && q[p] !== 3 });
    food.forEach(x => {
      pool.push({ text:`${jo(N(p), '은', '는')} ${jo(x, '을', '를')} 싫어했어`, t: q => q[p] !== fi(x) });
      pool.push({ text:`${jo(N(p), '은', '는')} ${x} 바로 옆 사진이야`, t: q => Math.abs(q[p] - fi(x)) === 1 });
      pool.push({ text:`${x} 바로 오른쪽 사진은 ${jo(N(p), '이야', '야')}`, t: q => q[p] === fi(x) + 1 });
      pool.push({ text:`${jo(N(p), '이', '가')} 제일 좋아한 건 ${jo(x, '이었어', '였어')}`, t: q => q[p] === fi(x), direct:true });
    });
    for(let q2 = 0; q2 < 4; q2++){ if(q2 === p) continue;
      pool.push({ text:`${jo(N(p), '은', '는')} ${N(q2)}보다 왼쪽이야`, t: q => q[p] < q[q2] });
      if(p < q2){
        pool.push({ text:`${jo(N(p), '과', '와')} ${jo(N(q2), '은', '는')} 나란히 붙어 있어`, t: q => Math.abs(q[p] - q[q2]) === 1 });
        pool.push({ text:`${jo(N(p), '과', '와')} ${jo(N(q2), '은', '는')} 붙어 있지 않아`, t: q => Math.abs(q[p] - q[q2]) !== 1 });
        pool.push({ text:`${jo(N(p), '과', '와')} ${N(q2)} 사이에는 사진이 딱 하나 있어`, t: q => Math.abs(q[p] - q[q2]) === 2 });
      }
    }
  }
  const truthy = pool.filter(c => c.t(sol));
  for(let attempt = 0; attempt < 40; attempt++){
    const order = [...sshuf(r, truthy.filter(c => !c.direct)), ...sshuf(r, truthy.filter(c => c.direct))];
    let rest = PERMS.slice(); const used = [];
    for(const c of order){ const nx = rest.filter(c.t); if(nx.length < rest.length){ used.push(c); rest = nx; } if(rest.length === 1) break; }
    if(rest.length !== 1) continue;
    for(let i = used.length - 1; i >= 0; i--){ const tr = used.filter((_, j) => j !== i); if(PERMS.filter(q => tr.every(c => c.t(q))).length === 1) used.splice(i, 1); }
    if(used.length < 4 && attempt < 30) continue;                         // 단서가 너무 적으면 너무 쉬움
    if(used.filter(c => c.direct).length > 1) continue;
    return { sol, food, clues: sshuf(r, used) };
  }
  return { sol, food, clues: truthy.slice(0, 6) };
}
function mSpirit(){
  const P = genPhotos(seedOf('spirit', 0));
  const asg = pzGet('aspirit', [null, null, null, null]);      // asg[사진 자리] = 사람
  const crossed = new Set(pzGet('xspirit', []));
  let sel = -1;
  const hp = Math.floor(rng(seedOf('spiritH', 0))() * 4);
  const root = pzView('spirit', '오븐 속 빵 틀 밑에서 나온 할머니의 편지. 제단의 사진 네 장이 바래서 누가 누군지 알 수 없어요. <b>가족 영혼이 각자 자기 사진을 찾아가도록</b> 자리를 정해 주세요.',
    `<div class="sp-letter"><p>얘들아, 사진 앞에는 저마다 좋아하던 것을 하나씩 놓아 두었단다. 사진은 왼쪽부터 1~4번이야.</p>
      <ol>${P.clues.map((c, i) => `<li data-i="${i}" class="${crossed.has(i) ? 'x' : ''}">${c.text}</li>`).join('')}</ol><small>— 할머니가 · 줄을 누르면 지울 수 있어요</small></div>
    <div class="sp-frames">${[0, 1, 2, 3].map(f => `<button class="sp-f" data-f="${f}"><span class="fr"><b>${f + 1}</b></span><em></em><small>${P.food[f]}</small></button>`).join('')}</div>
    <div class="sp-tok">${FAM.map((p, i) => `<button class="sp-t" data-p="${i}"><i>${ghostSVG(p.c, p.dog)}</i>${p.n}</button>`).join('')}</div>
    <button class="hw-btn" id="spGo" disabled>영혼들을 사진으로 안내하기</button><p class="pz-msg" id="pzMsg"></p>`);
  hintSystem('spirit', root, () => ['‘싫어했어’, ‘양 끝’ 같은 단서로 <b>안 되는 자리부터</b> 지워 봐. 그다음 ‘바로 옆’, ‘사이에 하나’ 단서로 좁히면 돼.',
    `${jo(FAM[hp].n, '은', '는')} <b>${P.sol[hp] + 1}번 사진</b>이야.`]);
  const draw = () => {
    root.querySelectorAll('.sp-f').forEach(b => { const f = Number(b.dataset.f), p = asg[f];
      b.classList.toggle('has', p !== null); b.style.setProperty('--c', p !== null ? FAM[p].c : '');
      b.querySelector('.fr').innerHTML = `<b>${f + 1}</b>${p !== null ? ghostSVG('#fff', FAM[p].dog) : ''}`;
      b.querySelector('em').textContent = p !== null ? FAM[p].n.split(' ').pop() : '';
      b.classList.toggle('tgt', sel >= 0); });
    root.querySelectorAll('.sp-t').forEach(t => { const p = Number(t.dataset.p); t.classList.toggle('sel', p === sel); t.classList.toggle('used', asg.includes(p) && p !== sel); });
    $('#spGo', root).disabled = asg.some(p => p === null);
    pzSet('aspirit', asg);
  };
  root.querySelectorAll('.sp-letter li').forEach(li => li.onclick = () => { const i = Number(li.dataset.i); crossed.has(i) ? crossed.delete(i) : crossed.add(i); li.classList.toggle('x'); pzSet('xspirit', [...crossed]); sfx('pen'); });
  root.querySelectorAll('.sp-t').forEach(t => t.onclick = () => { const p = Number(t.dataset.p); sel = sel === p ? -1 : p; sfx('tap'); draw(); });
  root.querySelectorAll('.sp-f').forEach(b => b.onclick = () => {
    const f = Number(b.dataset.f);
    if(sel < 0){ if(asg[f] !== null){ asg[f] = null; sfx('tap'); draw(); } return; }
    const was = asg.indexOf(sel); if(was >= 0) asg[was] = null;
    asg[f] = sel; sel = -1; sfx('ghost'); draw();
  });
  $('#spGo', root).onclick = async () => {
    if(asg.some(p => p === null)) return;
    const ok = asg.every((p, f) => P.sol[p] === f);
    if(!ok){
      sfx('wrong'); pzSet('mspirit', pzGet('mspirit', 0) + 1);
      root.querySelectorAll('.sp-f').forEach(b => { b.animate([{ transform:'translateX(0)' }, { transform:'translateX(-5px)' }, { transform:'translateX(5px)' }, { transform:'translateX(0)' }], { duration:320 }); });
      return pzMsg(root, '영혼들이 사진 앞에서 고개를 갸웃해요. <b>어딘가 자리가 틀렸어요.</b>', 'bad');
    }
    $('#spGo', root).disabled = true;
    const fr = [...root.querySelectorAll('.sp-f')];
    for(let i = 0; i < 4; i++){ fr[i].classList.add('lit'); bell(NOTE([72, 76, 79, 84][i]), 0, .08); await sleep(260); }
    pzMsg(root, '가족들이 모두 자기 사진을 찾았어요!', 'ok');
    await sleep(900);
    const n = pzStars('spirit', pzGet('mspirit', 0) >= 2 ? 1 : 0); saveStars('spirit', n);
    win('spirit', '로사 할머니, 미겔 할아버지, 루시아 이모, 강아지 초코까지 모두 자기 사진 앞에 도착했어요.', n);
  };
  draw();
}
