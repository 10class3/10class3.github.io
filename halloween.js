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
  { id:'bread',   name:'망자의 빵',     line:'제단에 올릴 빵을 주문대로 굽기',      kind:'빵집', got:'빵이 제단에 올라갔어요' },
  { id:'paper',   name:'파펠 피카도',   line:'제단을 꾸밀 깃발 2장 오리기',        kind:'공방', got:'제단 위에 깃발이 걸렸어요' },
  { id:'bell',    name:'영혼의 종',     line:'돌아올 시간을 종소리로 알리기',       kind:'종탑', got:'종소리가 영혼들에게 닿았어요' },
  { id:'spirit',  name:'꽃길 안내',     line:'꽃잎 길로 영혼을 제단까지 데려오기',  kind:'묘지', got:'영혼들이 꽃길을 따라 도착했어요' }
];
let STAGES = STAGES1;
const st = id => STAGES.find(x => x.id === id);
const rk = k => ROUND > 1 ? `r${ROUND}:${k}` : k;          // 라운드마다 기기 기록을 따로
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
/* ══ 2일차: 금잔화 마을 ══ */
.fx{position:fixed;z-index:103;pointer-events:none;border-radius:50%}
.fx.petal{border-radius:60% 60% 50% 50%}
.fx.sq{border-radius:2px}
.fx.puff{background:rgba(255,248,235,.75)!important;filter:blur(1.5px)}
.fx.smoke{background:rgba(60,48,58,.7)!important;filter:blur(3px)}
/* 미션 시작 카드 */
.mi-why{margin:-6px 0 10px;font-size:13px;font-weight:800;color:#ff9ac4}
/* 제단에 놓인 것들 */
.mw-it{position:absolute;z-index:4;opacity:0;transform:scale(.4);transition:opacity .5s,transform .6s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
.mw-it.on{opacity:1;transform:none}
.it-flags{left:-4%;right:-4%;top:-14px;display:flex;justify-content:space-between}
.it-flags svg{width:13%;height:auto;animation:hw-flap 3s ease-in-out infinite}
.it-bread{left:12%;top:58px;width:44px}.it-bell{right:10%;top:52px;width:36px}
.it-bread svg,.it-bell svg{width:100%;display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.it-path{left:50%;bottom:-38px;width:30px;height:40px;margin-left:-15px;display:flex;flex-direction:column;align-items:center;gap:1px}
.it-path i{width:7px;height:7px;border-radius:50%;background:#ff9f1c;box-shadow:0 0 6px #ff9f1c}
/* 빵 주문서·꺼내기 */
.mb-order{display:flex;align-items:center;gap:10px;margin:14px 0 0;padding:10px 14px;border-radius:14px;background:#f6e7cf;color:#3d2a18;font-size:14px;font-weight:800;transform:rotate(-.6deg)}
.mb-order .sw{width:22px;height:22px;border-radius:50%;flex:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.15)}
.mb-order b{color:#c2410c}
.mb-win{position:absolute;top:-3px;bottom:-3px;border-radius:4px;border:2px solid #9be15d;background:rgba(155,225,93,.15);z-index:1}
.mb-ctl{display:flex;gap:10px;margin-top:16px}
.mb-ctl .mb-hold{flex:1;margin:0}
.mb-out{flex:none;width:96px;height:76px;border-radius:20px;border:0;background:rgba(255,255,255,.08);color:#a596b4;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer;transition:background .2s,color .2s,transform .1s}
.mb-out:active{transform:scale(.95)}
.mb-out.ready{background:#9be15d;color:#14240a;box-shadow:0 0 18px rgba(155,225,93,.6);animation:hw-hot .8s ease-in-out infinite}
/* 펼친 종이 */
.mp-wrap .mp-un{position:absolute;left:0;top:10px;opacity:0;pointer-events:none;transform-origin:0 0;transform:scale(.5,1);transition:transform .65s cubic-bezier(.65,0,.35,1),opacity .15s;filter:drop-shadow(0 10px 22px rgba(0,0,0,.45));border-radius:3px}
.mp-wrap.q .mp-un{transform:scale(.5,.5)}
.mp-wrap.open .mp-un{opacity:1;transform:none}
.mp-wrap #mpC{display:block;touch-action:none;border-radius:3px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.45))}
.mp-wrap.open #mpC{visibility:hidden}
.mi-ov{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:rgba(12,8,20,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .28s}
.mi-ov.on{opacity:1}
.mi-card{width:min(100%,360px);padding:22px 20px 16px;border-radius:24px;background:linear-gradient(180deg,#2a1838,#1c1428);border:1px solid #4a2f5e;box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center;transform:translateY(16px) scale(.96);transition:transform .45s cubic-bezier(.34,1.4,.64,1)}
.mi-ov.on .mi-card{transform:none}
.mi-demo{position:relative;width:130px;height:96px;margin:0 auto 10px}
.mi-ic{position:absolute;left:50%;top:50%;width:62px;height:62px;translate:-50% -50%}
.mi-ic svg{width:100%;height:100%;display:block;filter:drop-shadow(0 0 12px rgba(255,159,28,.45))}
.mi-hand{position:absolute;left:58%;top:52%;width:30px;height:36px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))}
.mi-hand svg{width:100%;height:100%}
.mi-tr{position:absolute;inset:0;width:100%;height:100%;opacity:0}
.mi-tr path{fill:none;stroke:#ffd34d;stroke-width:2.5;stroke-dasharray:4 4;stroke-linejoin:round}
.mi-r{position:absolute;left:50%;top:40%;width:20px;height:20px;margin:-10px;border-radius:50%;border:2px solid #ffd34d;opacity:0}
.g-rub .mi-hand{animation:mi-rub 1.6s linear infinite}
@keyframes mi-rub{0%{transform:translate(-14px,-6px)}25%{transform:translate(0,-14px)}50%{transform:translate(14px,-6px)}75%{transform:translate(0,4px)}100%{transform:translate(-14px,-6px)}}
.g-draw .mi-tr{opacity:1}.g-draw .mi-tr path{animation:mi-draw 2.4s linear infinite;stroke-dasharray:180;stroke-dashoffset:180}
.g-draw .mi-ic{opacity:.35}.g-draw .mi-hand{animation:mi-dh 2.4s linear infinite}
@keyframes mi-draw{70%,100%{stroke-dashoffset:0}}
@keyframes mi-dh{0%{left:20%;top:16%}17%{left:45%;top:2%}35%{left:70%;top:16%}52%{left:62%;top:62%}70%,100%{left:28%;top:62%}}
.g-tap .mi-hand{left:44%;top:40%;animation:mi-tap 1s ease-in-out infinite}
.g-tap .mi-r{animation:mi-ring 1s ease-out infinite}
@keyframes mi-tap{0%,100%{transform:translateY(-8px)}40%{transform:translateY(2px) scale(.94)}}
@keyframes mi-ring{0%,35%{opacity:0;transform:scale(.4)}45%{opacity:1}100%{opacity:0;transform:scale(2.2)}}
.g-swipe .mi-ic{left:18%;width:34px;height:40px}
.g-swipe .mi-hand{animation:mi-sw 2s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mi-sw{0%{left:12%;top:58%;opacity:0}10%{opacity:1}80%{left:80%;top:40%;opacity:1}100%{left:80%;top:40%;opacity:0}}
.mi-k{display:inline-block;font-size:11.5px;font-weight:900;color:#2ec4b6;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:rgba(46,196,182,.12)}
.mi-card h3{margin:8px 0 12px;font-size:23px;font-weight:900;letter-spacing:-.04em}
.mi-card ol{margin:0;padding:0;list-style:none;counter-reset:mi;text-align:left}
.mi-card li{position:relative;padding:8px 0 8px 34px;font-size:14px;font-weight:700;color:#e4d8f0;line-height:1.55;counter-increment:mi;border-top:1px solid rgba(255,255,255,.06)}
.mi-card li:first-child{border-top:0}
.mi-card li::before{content:counter(mi);position:absolute;left:0;top:8px;width:22px;height:22px;border-radius:50%;background:#ff9f1c;color:#1b0d02;font-size:12px;font-weight:900;display:grid;place-items:center}
.mi-card li b{color:#ffd34d}
.mi-st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0 0}
.mi-st div{padding:8px 4px;border-radius:12px;background:rgba(255,255,255,.04);font-size:11.5px;font-weight:800;color:#b4a3c4;line-height:1.5}
.mi-st span,.mi-best span{display:block;color:#ffd34d;font-size:13px;letter-spacing:1px}
.mi-st em,.mi-best em{font-style:normal;color:rgba(255,255,255,.18)}
.mi-best{margin:10px 0 0;font-size:12.5px;font-weight:800;color:#cbbfd8}
.mi-best span{display:inline}
.mi-card .hw-btn{margin-top:14px}
.mi-back{display:block;width:100%;margin-top:6px;height:40px;border:0;background:none;color:#a596b4;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer}
/* 마을 디테일 */
.mw-k{display:inline-block;font-size:11px;font-weight:900;color:#2ec4b6;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:rgba(46,196,182,.12);margin-bottom:6px}
.mw-lamp{position:absolute;left:-6px;bottom:22%;width:20px;height:100px;pointer-events:none}
.mw-lamp svg{width:100%;height:100%;display:block}
.mw-lamp::after{content:'';position:absolute;left:50%;top:12px;width:120px;height:120px;margin-left:-60px;border-radius:50%;background:radial-gradient(circle,rgba(255,211,107,.28),transparent 65%);pointer-events:none}
.mw-smoke{position:absolute;left:78%;top:2%;width:24px;height:60px;pointer-events:none}
.mw-smoke i{position:absolute;left:0;bottom:0;width:16px;height:16px;border-radius:50%;background:rgba(240,230,220,.28);filter:blur(2px);animation:mw-smoke 3.6s ease-out infinite}
.mw-smoke i:nth-child(2){animation-delay:-1.2s}.mw-smoke i:nth-child(3){animation-delay:-2.4s}
@keyframes mw-smoke{0%{transform:translate(0,0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translate(14px,-56px) scale(1.8);opacity:0}}
.mw-gh{position:absolute;width:26px;opacity:.55;pointer-events:none;animation:mw-gh 5s ease-in-out infinite}
.mw-gh svg{width:100%;display:block}
.mw-gh.a{left:30%;top:36%}.mw-gh.b{left:62%;top:46%;width:20px;animation-delay:-2.5s}
@keyframes mw-gh{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-12px)}}
.mw-pn.lit .mw-gh{opacity:.9;filter:drop-shadow(0 0 8px rgba(255,220,150,.8))}
.mw-pts{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
.mw-pts i{position:absolute;top:-16px;width:8px;height:11px;border-radius:60% 60% 50% 50%;background:#ff9f1c;opacity:.5;animation:hw-fall var(--d) linear infinite;animation-delay:var(--dl)}
.mw-plate .mw-st{position:static;justify-content:center;margin-top:6px;font-size:16px}
.mw-map{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 10px);transform:translateX(-50%);display:flex;align-items:center;gap:0;padding:6px 8px;border-radius:999px;background:rgba(20,14,30,.75);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.1);z-index:4}
.mw-map button{width:32px;height:32px;padding:5px;border:0;border-radius:50%;background:transparent;cursor:pointer;opacity:.38;filter:grayscale(1);transition:opacity .3s,filter .3s,transform .3s cubic-bezier(.34,1.56,.64,1),background .3s}
.mw-map button svg{width:100%;height:100%;display:block}
.mw-map button.lit{opacity:1;filter:none}
.mw-map button.on{opacity:1;background:rgba(255,159,28,.2);transform:scale(1.15)}
.mw-map > b{width:12px;height:2px;background:rgba(255,255,255,.18)}
/* 게임 디테일 */
.mb-d.press{transform:scale(1.04,.95)}
.mb-d{transition:transform .12s}
.mb-bar{position:relative;height:14px}
.mb-bar span{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);font-variant-numeric:tabular-nums}
.mb-ov.gold .mb-oven{filter:drop-shadow(0 0 22px rgba(255,191,60,.6))}
#mbBun{transition:ry .2s}
.mp-wrap{position:relative}
.mp-sc{position:absolute;left:0;top:0;width:28px;height:28px;z-index:3;pointer-events:none;opacity:0;transition:opacity .15s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.mp-sc.on{opacity:1}
.mp-sc svg{width:100%;height:100%}
.ml-prog{position:absolute;left:0;right:0;top:0;height:4px;background:rgba(255,255,255,.06);z-index:2}
.ml-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff4f9a,#ffd34d)}
#mlC.fire{background:rgba(255,159,28,.25);color:#ffd34d;border-color:#ff9f1c;box-shadow:0 0 14px rgba(255,159,28,.5)}
#msC{display:flex;gap:2px;padding:4px 8px}
#msC i{width:16px;height:18px;opacity:.25;transition:opacity .3s,transform .4s cubic-bezier(.34,1.56,.64,1)}
#msC i svg{width:100%;height:100%;display:block}
#msC i.on{opacity:1;transform:scale(1.15);filter:drop-shadow(0 0 4px rgba(255,220,150,.9))}
html.hw-r2 .hw-ghost{top:calc(env(safe-area-inset-top) + 62px);bottom:auto;transform:translateY(-20px)}
html.hw-r2 .hw-ghost.on{transform:none}
html.hw-r2 .hw-ghost .b{border-radius:16px 16px 16px 4px}
.hw-scroll.mw-mode{padding:0;overflow:hidden}
.hw-scroll > .mw-view{max-width:none;height:100%;display:flex;flex-direction:column}
.mw-top > .hw-top{max-width:560px;margin:0 auto}
.mw-top{padding:calc(env(safe-area-inset-top) + 8px) 16px 0;position:relative;z-index:5}
.mw{position:relative;flex:1;min-height:0;overflow:hidden}
.mw-sky{position:absolute;inset:0;background:radial-gradient(70% 45% at 78% 8%,rgba(255,79,154,.22),transparent 65%),radial-gradient(60% 40% at 10% 30%,rgba(46,196,182,.14),transparent 70%),linear-gradient(#120b1d,#1c1230 60%,#24183a)}
.mw-sky::after{content:'';position:absolute;inset:0 0 45% 0;background-image:radial-gradient(1.3px 1.3px at 12% 18%,#fff9 50%,transparent),radial-gradient(1px 1px at 33% 8%,#fff7 50%,transparent),radial-gradient(1.5px 1.5px at 58% 22%,#fff8 50%,transparent),radial-gradient(1px 1px at 72% 12%,#fff6 50%,transparent),radial-gradient(1.2px 1.2px at 90% 30%,#fff7 50%,transparent),radial-gradient(1px 1px at 46% 38%,#fff5 50%,transparent);animation:hw-twinkle 4s ease-in-out infinite alternate}
.mw-moon{position:absolute;right:9%;top:6%;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff6dc,#f3d79a 70%);box-shadow:0 0 40px rgba(255,220,150,.35)}
.mw-far{position:absolute;left:0;bottom:22%;width:400%;height:150px;background-repeat:repeat-x;background-size:600px 150px;opacity:.95;will-change:transform}
.mw-flags{position:absolute;left:0;top:4px;display:flex;gap:4px;white-space:nowrap;will-change:transform;opacity:.9}
.mw-flags svg{width:24px;height:27px;flex:none;transform-origin:50% 0;animation:hw-flap 3.2s ease-in-out infinite}
.mw-flags svg:nth-child(3n){animation-delay:-1.4s}.mw-flags svg:nth-child(2n){animation-delay:-2.2s}
.mw-flags::before{content:'';position:absolute;left:0;right:0;top:3px;height:1px;background:rgba(255,255,255,.25)}
.mw-sc{position:absolute;inset:0;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior:contain}
.mw-sc::-webkit-scrollbar{display:none}
.mw-tr{display:flex;height:100%;padding:0 calc(50% - min(44vw,210px))}
.mw-tr::after{content:'';position:absolute;left:0;right:0;bottom:0;height:22%;pointer-events:none}
.mw-pn{position:relative;flex:0 0 min(88vw,420px);height:100%;scroll-snap-align:center;container-type:size}
.mw-pn::after{content:'';position:absolute;left:-20px;right:-20px;bottom:0;height:22%;background:linear-gradient(#2b1f3e,#21172f);border-top:2px solid #3a2a50;z-index:-1;
  background-image:radial-gradient(ellipse 10px 4px at 12px 10px,#3a2a50 60%,transparent 62%),radial-gradient(ellipse 10px 4px at 34px 22px,#3a2a50 60%,transparent 62%);background-size:44px 30px}
.mw-glow{position:absolute;left:50%;bottom:20%;width:120%;height:70%;transform:translateX(-50%);background:radial-gradient(50% 50% at 50% 70%,rgba(255,191,60,.32),transparent 70%);opacity:0;transition:opacity 1s;pointer-events:none}
.mw-pn.lit .mw-glow{opacity:1}
.mw-plate{position:absolute;top:44px;left:50%;transform:translateX(-50%);width:86%;text-align:center}
.mw-plate b{display:block;font-size:20px;font-weight:900;letter-spacing:-.04em}
.mw-plate small{display:block;margin-top:5px;font-size:12.5px;font-weight:700;color:#b4a3c4;line-height:1.5}
.mw-bd{position:absolute;left:50%;bottom:22%;width:min(76vw,300px);width:min(76vw,320px,calc((78cqh - 150px) * 1.09));translate:-50% 0;transform-origin:50% 100%;margin-bottom:-2px}
.mw-b{display:block;width:100%;height:auto;overflow:visible}
.mw-b .w{fill:#1b1328;transition:fill .8s}
.mw-b .wf{stroke:#2a1f38;stroke-width:3;transition:stroke .8s}
.mw-b .dr{fill:#3a2a4a}
.mw-b .mw-in{opacity:0;transition:opacity .8s}
.mw-pn.lit .mw-b .w{fill:#ffd36b}
.mw-pn.lit .mw-b .wf{stroke:#e9a03c}
.mw-pn.lit .mw-b .mw-in{opacity:1}
.mw-pn.lit .mw-bl{animation:mw-swing 2.4s ease-in-out infinite;transform-origin:120px 36px}
@keyframes mw-swing{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
.mw-st{position:absolute;bottom:calc(22% + 6px);right:16%;display:flex;gap:1px;font-size:15px;color:#3a2a50}
.mw-st i{font-style:normal;transition:color .3s,transform .4s cubic-bezier(.34,1.56,.64,1)}
.mw-st i.on{color:#ffd34d;transform:scale(1.15);text-shadow:0 0 8px rgba(255,211,77,.7)}
.mw-go{position:absolute;bottom:calc(22% - 62px);left:50%;transform:translateX(-50%);z-index:2;height:44px;padding:0 22px;border-radius:999px;border:0;background:#ff9f1c;color:#1b0d02;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;
  box-shadow:0 0 0 0 rgba(255,159,28,.6);animation:mw-pulse 2.2s ease-out infinite;transition:transform .14s cubic-bezier(.23,1,.32,1)}
.mw-go:active{transform:translateX(-50%) scale(.95)}
.mw-pn.lit .mw-go{background:rgba(255,255,255,.1);color:#f6eee4;animation:none}
@keyframes mw-pulse{0%{box-shadow:0 0 0 0 rgba(255,159,28,.55)}70%{box-shadow:0 0 0 16px rgba(255,159,28,0)}100%{box-shadow:0 0 0 0 rgba(255,159,28,0)}}
.mw-path{position:absolute;left:50%;width:100%;bottom:calc(22% - 18px);height:8px;z-index:1;pointer-events:none;
  background-image:radial-gradient(circle 3px at 6px 4px,#4a3a5a 95%,transparent);background-size:18px 8px;background-repeat:repeat-x}
.mw-pn:last-child .mw-path{display:none}
.mw-path.on{background-image:radial-gradient(circle 3.5px at 6px 4px,#ff9f1c 95%,transparent);filter:drop-shadow(0 0 4px rgba(255,159,28,.8));animation:mw-path .9s cubic-bezier(.23,1,.32,1) both}
@keyframes mw-path{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.mw-hud{position:absolute;left:12px;right:12px;top:10px;display:flex;justify-content:flex-end;gap:8px;z-index:4;pointer-events:none}
.mw-hb{pointer-events:auto;height:36px;padding:0 13px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(20,14,30,.7);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#f6eee4;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
.mw-hb b{color:#ffbb4d;margin-left:3px}
.mw-dots{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 12px);display:flex;justify-content:center;gap:8px;z-index:4}
.mw-dots i{width:8px;height:8px;border-radius:4px;background:rgba(255,255,255,.25);cursor:pointer;transition:width .3s cubic-bezier(.23,1,.32,1),background .3s}
.mw-dots i.on{width:22px;background:#ff9f1c}
/* 제단 */
.mw-alt{display:flex;flex-direction:column;align-items:center;padding:84px 10px 60px;overflow-y:auto}
.mw-alt .mw-plate{position:static;transform:none;width:100%;margin-bottom:10px}
.mw-ofr{position:relative;width:min(80vw,320px);margin:6px auto 0;padding-top:70px}
.mw-ofr .hw-candles{position:absolute;top:0;left:0;right:0;justify-content:center;z-index:2}
.mw-tiers{display:block;width:100%;height:130px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.4))}
.mw-fl{position:absolute;left:0;right:0;top:70px;height:130px;z-index:3;pointer-events:none}
.mw-f{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;transform:scale(var(--s,1))}
.mw-f svg{width:100%;height:100%;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.mw-f.new{animation:mw-bloom .7s cubic-bezier(.34,1.56,.64,1)}
@keyframes mw-bloom{from{transform:scale(0) rotate(-90deg)}to{transform:scale(var(--s,1))}}
.mw-alt .hw-coop{width:min(84vw,340px);margin:16px auto 0}
.mw-info{display:flex;align-items:baseline;justify-content:space-between;width:min(84vw,340px);margin:12px auto 0;padding:12px 15px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid #33243f;font-size:13.5px;font-weight:800}
.mw-info b{font-size:20px;color:#ffbb4d;font-variant-numeric:tabular-nums}
.mw-info b.hot{animation:hw-hot 1.1s ease-in-out infinite}
.mw-alt #hwMine{width:min(84vw,340px);margin:0 auto}
.mw-intro{position:fixed;inset:0;z-index:110;display:grid;place-items:center;text-align:center;color:#f6eee4;
  background:radial-gradient(60% 50% at 50% 45%,rgba(255,79,154,.35),transparent 70%),#0d0815;transition:opacity .7s,transform .7s}
.mw-intro .mi{display:block;width:84px;margin:0 auto 14px;animation:mw-spin 2.4s cubic-bezier(.23,1,.32,1)}
.mw-intro .mi svg{width:100%;display:block}
.mw-intro small{display:block;font-size:12px;font-weight:900;letter-spacing:.32em;color:#ff9ac4;animation:hw-rise .7s .2s both}
.mw-intro h3{margin:8px 0 10px;font-size:34px;font-weight:900;letter-spacing:-.04em;animation:hw-rise .7s .35s both}
.mw-intro p{margin:0;font-size:14px;font-weight:700;color:#cbbfd8;animation:hw-rise .7s .5s both}
.mw-intro.out{opacity:0;transform:scale(1.06);pointer-events:none}
@keyframes mw-spin{from{transform:rotate(-180deg) scale(.3);opacity:0}to{transform:none;opacity:1}}
/* 별점 */
.hw-win .stars{display:flex;justify-content:center;gap:6px;margin:10px 0 2px;font-size:30px}
.hw-win .stars i{font-style:normal;color:rgba(255,255,255,.18);transform:scale(.4);transition:transform .45s cubic-bezier(.34,1.56,.64,1),color .2s}
.hw-win .stars i.on{color:#ffd34d;transform:scale(1);text-shadow:0 0 16px rgba(255,211,77,.8)}
/* 망자의 빵 */
.mb-st{position:relative;min-height:min(58vw,280px);margin:18px auto 0;display:grid;place-items:center}
.mb-st .mb-d{height:min(58vw,280px)}
.mb-d{width:min(64vw,270px);height:100%;touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
.mb-d path#mbP{transition:d .08s}
.mb-ov{display:flex;flex-direction:column;align-items:center;width:100%}
.mb-oven{width:min(62vw,250px)}
#mbFire{transform-origin:130px 218px;transition:transform .12s}
#mbFire path{animation:hw-flame 1.1s ease-in-out infinite}
#mbFire .fl1{animation-delay:-.3s}#mbFire .fl2{animation-delay:-.6s}#mbFire .fl3{animation-delay:-.2s}#mbFire .fl4{animation-delay:-.8s}
.mb-g{position:relative;width:min(56vw,220px);margin-top:-6px}
.mb-g svg{display:block;width:100%}
.mb-tl{position:absolute;left:0;right:0;bottom:4px;text-align:center;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;color:#b4a3c4}
.mb-tl.gold{color:#ffbf3c}.mb-tl.hot{color:#ff3d5a}
.mb-bar{height:8px;border-radius:4px;background:#2a1f35;overflow:hidden;margin:16px 0 0}
.mb-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff9f1c,#ffd34d);border-radius:4px;transition:width .15s}
.mb-hold{display:block;width:100%;height:76px;margin-top:16px;border-radius:20px;border:0;background:radial-gradient(circle at 50% 120%,#ff5a1a,#c2410c);color:#fff;font-family:inherit;font-size:16px;font-weight:900;
  touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-shadow:0 8px 0 #7a2a08;transition:transform .08s,box-shadow .08s}
.mb-hold.on{transform:translateY(6px);box-shadow:0 2px 0 #7a2a08;background:radial-gradient(circle at 50% 120%,#ffbf3c,#ff5a1a)}
/* 파펠 피카도 */
.mp-row{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:14px}
.mp-wrap{display:flex;justify-content:flex-start;touch-action:none;padding:10px 0;margin:-10px 0}
.mp-tg{flex:none;text-align:center;padding:8px;border-radius:12px;background:rgba(255,255,255,.04)}
.mp-tg small{display:block;font-size:11px;font-weight:900;color:#ff9ac4;margin-bottom:5px}
.mp-tg canvas{display:block;border-radius:3px}
.mp-fold{position:relative;flex:none;perspective:900px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.45))}
.mp-fold canvas{display:block;touch-action:none;border-radius:3px 0 0 3px}
.mp-mir{position:absolute;left:100%;top:0;transform-origin:0 50%;transform:rotateY(-180deg);opacity:0;pointer-events:none;border-radius:0 3px 3px 0!important;transition:transform .7s cubic-bezier(.65,0,.35,1),opacity .2s}
.mp-fold.open .mp-mir{transform:none;opacity:1}
.mp-res{min-height:44px;text-align:center;font-size:14px;font-weight:800;color:#cbbfd8;line-height:1.6;margin:14px 0 0}
.mp-res b{color:#ffbb4d;font-size:18px}
.mp-res.ok b{color:#9be15d}
/* 영혼의 종 */
.ml{position:relative;display:grid;grid-template-columns:repeat(3,1fr);height:min(64vh,460px);margin-top:14px;border-radius:18px;overflow:hidden;
  background:linear-gradient(#150e22,#21172f);border:1px solid #33243f;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.ml-ln{position:relative;border-right:1px solid rgba(255,255,255,.05);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ml-ln:last-of-type{border-right:0}
.ml-ln.ring{animation:ml-ring .3s ease-out}
@keyframes ml-ring{from{background:rgba(255,211,107,.18)}to{background:transparent}}
.ml-ln.bad{background:rgba(255,61,90,.12)}
.ml-bell{position:absolute;left:50%;top:80%;width:54px;height:54px;transform:translate(-50%,-28%);pointer-events:none}
.ml-bell svg{width:100%;height:100%;transform-origin:50% 10%}
.ml-ln.ring .ml-bell svg{animation:mw-swing .45s ease-out}
.ml-line{position:absolute;left:0;right:0;top:80%;height:2px;background:linear-gradient(90deg,transparent,#ffd36b,transparent);box-shadow:0 0 12px #ffbf3c;pointer-events:none}
.ml-notes{position:absolute;inset:0;pointer-events:none}
.ml-n{position:absolute;top:0;width:40px;height:44px;opacity:0;filter:drop-shadow(0 0 10px rgba(180,220,255,.7));will-change:transform}
.ml-n svg{width:100%;height:100%}
.ml-n.got{animation:ml-got .3s ease-out forwards}
.ml-n.miss{opacity:.25!important;filter:grayscale(1)}
@keyframes ml-got{to{opacity:0;scale:1.8}}
.ml-pop{position:absolute;inset:0;pointer-events:none}
.ml-pp{position:absolute;top:66%;transform:translateX(-50%);font-size:15px;font-weight:900;animation:ml-pp .7s ease-out forwards;white-space:nowrap}
.ml-pp.p{color:#ffd34d}.ml-pp.g{color:#9fe6ff}
@keyframes ml-pp{from{opacity:1;translate:0 0}to{opacity:0;translate:0 -36px}}
.ml-start{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(14,9,22,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:0 24px;text-align:center}
.ml-start .hw-btn{margin:0;max-width:240px}
.ml-start small{font-size:12px;font-weight:700;color:#a596b4}
.ml-r{font-size:15px;font-weight:800;line-height:1.7;margin:0 0 6px}
.ml-r b{color:#ffbb4d}
/* 꽃길 안내 */
.ms{position:relative;margin:14px auto 0;border-radius:18px;overflow:hidden;border:1px solid #33243f;width:max-content;max-width:100%}
.ms canvas{display:block;touch-action:none}
.ms-ink{position:absolute;left:12px;right:12px;bottom:10px;height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;pointer-events:none}
.ms-ink i{display:block;height:100%;background:linear-gradient(90deg,#ff7a1a,#ffbb4d)}
@media (prefers-reduced-motion:reduce){.mw-flags svg,.mw-go,.mw-pn.lit .mw-bl,#mbFire path{animation:none!important}}

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
  ROUND = Number(cfg.round) === 2 ? 2 : 1;
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
    if(!firstStats && ROUND > 1 && prevT < coopGoal() && stats.total >= coopGoal()) ticker('반 전체 꽃등이 모두 밝혀졌어요!');
    else if(!firstStats && stats.ranked > prev && stats.ranked !== myRank())
      ticker(ROUND > 1 ? `방금 누군가 촛불 네 개를 모두 밝혔어요 · 남은 간식 ${left()}개` : `방금 누군가 다섯 개를 모두 깼어요 · 남은 간식 ${left()}개`);
    firstStats = false;
    paintCard(); paintSpace();
  }, () => {});
  retryPending().then(refreshPieces);
  addEventListener('hashchange', onHash);
  setTimeout(onHash, 900);           // 링크(#halloween)로 들어온 경우
}
export function update(config){
  if(!started){ if(A && config && config.on) start(A, config); return; }   // 껐다가 다시 켠 경우
  if((Number(config && config.round) === 2 ? 2 : 1) !== ROUND){           // 관리자가 1일차 ↔ 2일차를 바꿈
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
  const sub = r ? (r <= prizes() ? `선착순 ${r}번째! 간식 당첨` : `${KN()} 개 모두 클리어 · 참여상`) : (d.size ? `${d.size}/${N} 클리어 · 이어서 도전하기` : `미션 ${N}개 · 1개만 깨도 참여상`);
  c.innerHTML = `<span class="bats">${ROUND > 1 ? SVG.flag('#ff4f9a', 1) + SVG.flag('#2ec4b6', 0) + SVG.flag('#ff9f1c', 1) : SVG.bat + SVG.bat}</span><span class="pk">${ROUND > 1 ? SVG.mari : SVG.pumpkin()}</span>
    <span class="txt"><b>${TITLE()}</b><small>${sub}</small><span class="hw-dots">${STAGES.map(s => `<i class="${d.has(s.id) ? 'on' : ''}"></i>`).join('')}</span></span>
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
    if(sb){ LS.set('snd', !sndOn()); spaceEl.querySelectorAll('.hw-snd').forEach(b => b.innerHTML = sndOn() ? SVG.snd : SVG.mute); sfx('tap');
      if(!sndOn()) ambientOff(); else if($('.mw', spaceEl)) ambientOn(); return; }
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
function closeSpace(instant){
  if(!spaceEl) return;
  stopMission(); ambientOff();
  const el = spaceEl; spaceEl = null;
  if(!instant) sfx('leave');
  const end = () => { el.remove(); document.documentElement.classList.remove('hw-lock'); if(!document.querySelector('.sheet.on')) document.body.style.overflow = ''; };
  if(instant || reduce){ end(); return; }
  el.classList.remove('entering'); el.classList.add('leaving');
  setTimeout(end, 440);
  paintCard();
}
const scroller = () => spaceEl && spaceEl.querySelector('.hw-scroll');
function view(html, cls = 'hw-in'){
  const s = scroller(); if(!s) return null;
  s.classList.toggle('mw-mode', cls.includes('mw-view'));
  if(!cls.includes('mw-view')) ambientOff();
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
    const res = await send({ num: sel, key, stage:'' });
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
    C2.innerHTML = `<div class="hd">반 전체 꽃등<small><b>${Math.min(t, g)}</b> / ${g}</small></div><div class="bar"><div class="fill" style="--p:${Math.min(100, t / g * 100)}%"></div></div>
      <p>${full ? (cfg.coopPrize ? `목표 달성! ${esc(cfg.coopPrize)}` : '목표 달성! 반 전체 보너스가 열렸어요.') : `반 친구들이 깬 미션 수를 모두 모아요. ${g}개를 채우면 반 전체 보너스!`}</p>`; }
  if(B){ const d = stats.dist || []; B.innerHTML = [...Array(STAGES.length)].map((_, i) => STAGES.length - i).filter(k => d[k]).map(k => `<span>${k}개 클리어 <b>${d[k]}명</b></span>`).join('') || '<span>아직 아무도 깨지 못했어요. 첫 번째가 돼 보세요</span>'; }
  if(M){ const r = myRank(), n = done().size;
    M.innerHTML = r ? `<div class="hw-mine">${r <= prizes() ? `선착순 <b>${r}번째</b>로 ${KN()} 개를 모두 깼어요! 간식 당첨이에요.` : `${KN()} 개를 모두 깼어요(${r}번째). 아쉽게 간식은 마감됐지만 참여상을 받아요.`}</div>`
      : n ? `<div class="hw-mine">미션 ${n}개 클리어 · 참여상 확보! ${KN()} 개를 모두 깨면 선착순 간식에 도전할 수 있어요.</div>` : ''; }
}

/* 관리자: 선착순 인원, 번호 설정, 명단 */
async function paintAdmin(){
  const box = $('#hwAdmin'); if(!box) return;
  box.innerHTML = `<div class="hw-admin"><h4>관리자</h4>
    <div class="ln"><span>진행 중: <b style="color:#ffb070">${ROUND}일차 · ${TITLE()}</b></span><button class="sm" id="hwRd">${ROUND > 1 ? '1일차로 되돌리기' : '2일차 열기'}</button></div>
    <div class="ln"><span>선착순 간식 인원 (${ROUND}일차)</span><input id="hwPz" type="number" min="0" max="60" value="${prizes()}"><button class="sm" id="hwPzS">저장</button></div>
    <div class="ln"><span>마지막 번호 / 없는 번호</span><input id="hwMax" type="number" min="1" max="60" value="${Number(cfg.max) || 35}" style="width:60px"><input id="hwSkip" value="${(cfg.skip || []).join(',')}" style="width:80px" placeholder="예: 7,21"><button class="sm" id="hwNumS">저장</button></div>
    <div class="ln"><span>번호 옮기기<br><small style="font-weight:700;color:#a596b4">잘못 고른 번호를 바로잡아요</small></span><input id="hwMvA" type="number" min="1" max="60" placeholder="원래" style="width:60px"><input id="hwMvB" type="number" min="1" max="60" placeholder="바꿀" style="width:60px"><button class="sm" id="hwMvS">옮기기</button></div>
    ${ROUND > 1 ? `<div class="ln"><span>반 전체 꽃등 목표 / 보너스</span><input id="hwCg" type="number" min="1" max="300" value="${coopGoal()}" style="width:64px"><input id="hwCp" maxlength="30" value="${esc(cfg.coopPrize || '')}" placeholder="예: 반 전체 사탕" style="width:110px"><button class="sm" id="hwCgS">저장</button></div>` : ''}
    <div class="ln" style="margin-top:16px"><span>명단</span><button class="sm" data-rr="1">1일차</button><button class="sm" data-rr="2">2일차</button><button class="sm" id="hwCsv">파일로 저장</button></div>
    <div id="hwList" class="hw-p">명단 불러오는 중…</div></div>`;
  const save = async data => { try{ await A.fs.setDoc(A.fs.doc(A.db, A.C('config'), 'event'), data, { merge:true }); A.toast('저장했어요'); }catch{ A.toast('저장하지 못했어요'); } };
  $('#hwPzS').onclick = () => save({ [ROUND > 1 ? 'prizes' + ROUND : 'prizes']: Math.max(0, Math.min(60, Number($('#hwPz').value) || 0)) });
  $('#hwRd').onclick = async () => {
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
  ambientOff();
  ({ dark: mDark, soup: mSoup, scale: mScale, lantern: mLantern, cipher: mCipher, bread: mBread, paper: mPaperCut, bell: mBell, spirit: mSpirit })[id]();
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
    if(r) A.note(r <= prizes() ? `선착순 ${r}번째!` : `${KN()} 개 모두 클리어!`,
      r <= prizes() ? '간식 당첨이에요. 반장·부반장에게 받으러 오세요.' : `${r}번째로 깼어요. 간식은 마감됐지만 참여상을 받아요.`);
    else A.note(`${KN()} 개 모두 클리어!`, '기록을 보내는 중이에요. 인터넷이 연결되면 순번이 정해져요.');
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
    <p class="hw-rules">이 비밀은 너만 알고 있어 줘. 반장·부반장에게 <b>"${place}다"</b>고 말하면 상품을 받아요. 명단에 이미 기록돼 있어요.</p>`;
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
    go.disabled = true; go.textContent = '달이 듣는 중…';
    const res = await send({ num: m.num, key: m.key, answer: v });
    go.disabled = false; go.textContent = R2 ? '제단에 말하기' : '달에게 말하기';
    if(res && res.ok && res.hidden){
      LS.set(rk('hidden'), res.hidden); sfx('secret'); bats(); burst(innerWidth / 2, innerHeight / 3);
      $('#hwHidBody', root).innerHTML = okHTML(res.hidden);
    }else if(res && res.wrong){
      sfx('wrong'); inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
      A.toast(res.left > 0 ? (res.left <= 5 ? `${R2 ? '촛불이 흔들려요' : '달이 고개를 저어요'} · 남은 기회 ${res.left}번` : '달이 고개를 저어요') : '오늘은 달이 더 이상 대답하지 않아요');
    }else if(res && res.locked){ A.note('아직이에요', `미션 ${KN()} 개를 모두 깬 뒤에 다시 와 보세요.`); }
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

/* ══════════════════ 2일차 · 금잔화 마을 ══════════════════
   목록 대신 가로로 걷는 마을. 빵집 → 종이 공방 → 종탑 → 묘지 → 우리 반 제단
   미션은 모두 손으로 하는 방식(문지르기·누르고 버티기·오려 그리기·박자·흩뿌리기)이고 별 1~3개 */

/* ── 소리: 기타(카플러스-스트롱)·종·생활 소리 ── */
const ksCache = new Map();
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
function pluck(freq, at = 0, vol = .1){
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
  s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(c.currentTime + Math.max(0, at));
}
const strum = (midis, at = 0, vol = .08, gap = .026) => midis.forEach((m, i) => pluck(NOTE(m), at + i * gap, vol));
function bell(freq, at = 0, vol = .12){
  [[1, 1, 2.2], [2.0, .42, 1.5], [2.76, .28, 1.1], [5.4, .14, .6], [8.93, .07, .35]]
    .forEach(([r, g, d]) => tone(freq * r, d, { vol: vol * g, at, attack:.003 }));
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

/* 마을 배경음: 작은 기타 아르페지오 + 바람 */
let ambT = 0, ambWind = null;
function ambientOn(){
  if(ambT || !sndOn()) return;
  const c = au(); if(!c) return;
  const prog = [[45, 57, 60, 64], [50, 57, 62, 65], [52, 56, 59, 64], [45, 57, 60, 64]];   // Am · Dm · E · Am
  const pat = [0, 2, 1, 3, 2, 1];
  let bar = 0, beat = 0;
  ambT = setInterval(() => {
    if(!sndOn() || document.hidden) return;
    const ch = prog[bar % 4], i = pat[beat % 6];
    pluck(NOTE(ch[i] + 12), 0, beat % 6 === 0 ? .045 : .03);
    if(beat % 6 === 0) pluck(NOTE(ch[0]), 0, .05);
    if(++beat % 6 === 0) bar++;
  }, 340);
  try{
    if(!noiseBuf){ noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const ch = noiseBuf.getChannelData(0); for(let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(.0001, c.currentTime); g.gain.linearRampToValueAtTime(.018, c.currentTime + 2);
    lfo.frequency.value = .13; lg.gain.value = .01; lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    ambWind = { src, lfo, g };
  }catch{}
}
function ambientOff(){
  clearInterval(ambT); ambT = 0;
  if(ambWind){ const { src, lfo, g } = ambWind; ambWind = null; try{ const t = actx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(.0001, t + .4); src.stop(t + .45); lfo.stop(t + .45); }catch{} }
}

/* ── 마을 그림 ── */
const WIN = (x, y, w, h) => `<rect class="w" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><path class="wf" d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}"/>`;
const PLACE_SVG = {
  bread: () => `<svg viewBox="0 0 240 220" class="mw-b" aria-hidden="true">
    <rect x="30" y="74" width="180" height="146" fill="#25a99e"/><rect x="30" y="74" width="180" height="10" fill="#1d8a81"/>
    <path d="M20 74h200l-14-26H34z" fill="#167a72"/>
    <rect x="58" y="22" width="124" height="28" rx="6" fill="#f6e7cf"/><text x="120" y="41" text-anchor="middle" font-size="13" font-weight="900" fill="#c2410c" letter-spacing="1.2">PANADERÍA</text>
    <path d="M38 102h164l-9 20H47z" fill="#ff4f9a"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${47 + i * 19.5} 122l${i % 2 ? -2 : 2}-20h9.7l${i % 2 ? 2 : -2} 20z" fill="#f6e7cf" opacity=".85"/>`).join('')}
    ${WIN(46, 134, 56, 44)}${WIN(138, 134, 56, 44)}
    <g class="mw-in"><ellipse cx="62" cy="168" rx="11" ry="7" fill="#e9a85c"/><ellipse cx="86" cy="169" rx="9" ry="6" fill="#d9822b"/><ellipse cx="166" cy="168" rx="12" ry="7" fill="#e9a85c"/></g>
    <path class="dr" d="M104 220v-58a16 16 0 0132 0v58z"/><circle cx="130" cy="194" r="2" fill="#ffd36b"/>
    <circle cx="36" cy="210" r="10" fill="#ff9f1c"/><circle cx="204" cy="210" r="10" fill="#ff9f1c"/><circle cx="36" cy="210" r="4" fill="#d9601a"/><circle cx="204" cy="210" r="4" fill="#d9601a"/></svg>`,
  paper: () => `<svg viewBox="0 0 240 220" class="mw-b" aria-hidden="true">
    <rect x="34" y="64" width="172" height="156" fill="#e8467f"/><path d="M24 64h192l-20-30H44z" fill="#7c3aed"/>
    <rect x="62" y="12" width="116" height="26" rx="6" fill="#f6e7cf"/><text x="120" y="30" text-anchor="middle" font-size="12" font-weight="900" fill="#7c3aed" letter-spacing="1">PAPEL PICADO</text>
    <path d="M34 82q43 16 86 0t86 0" stroke="#f6e7cf" stroke-width="1" fill="none" opacity=".6"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${40 + i * 21} ${84 + (i % 2) * 3}h16v14l-8 5-8-5z" fill="${['#ffd34d', '#2ec4b6', '#ff9f1c', '#f6e7cf'][i % 4]}"/>`).join('')}
    ${WIN(48, 120, 50, 50)}${WIN(142, 120, 50, 50)}
    <g class="mw-in"><path d="M58 132h30v22l-15 8-15-8z" fill="#ffd34d" opacity=".85"/><path d="M152 132h30v22l-15 8-15-8z" fill="#2ec4b6" opacity=".85"/></g>
    <path class="dr" d="M102 220v-56a18 18 0 0136 0v56z"/></svg>`,
  bell: () => `<svg viewBox="0 0 240 220" class="mw-b" aria-hidden="true">
    <rect x="70" y="66" width="100" height="154" fill="#efdcbc"/><rect x="62" y="58" width="116" height="12" rx="3" fill="#d9c09a"/>
    <path d="M82 58V28a38 38 0 0176 0v30z" fill="#efdcbc"/><path d="M96 58V36a24 24 0 0148 0v22z" class="w"/>
    <g class="mw-bl"><path d="M120 36c-9 0-12 7-12 13v6h24v-6c0-6-3-13-12-13z" fill="#ffbf3c"/><circle cx="120" cy="57" r="2.6" fill="#ffbf3c"/></g>
    <path d="M112 4h16l-8-8z" fill="#ff9f1c"/><circle cx="120" cy="4" r="3" fill="#ff9f1c"/>
    ${WIN(86, 92, 26, 36)}${WIN(128, 92, 26, 36)}
    <circle cx="120" cy="150" r="14" fill="#f6e7cf" stroke="#c9a97a" stroke-width="3"/><path d="M120 141v9l6 4" stroke="#7a5a30" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path class="dr" d="M104 220v-36a16 16 0 0132 0v36z"/>
    <rect x="30" y="150" width="40" height="70" fill="#2ec4b6"/><rect x="170" y="164" width="44" height="56" fill="#ff9f1c"/>${WIN(40, 166, 20, 22)}${WIN(182, 178, 20, 20)}</svg>`,
  spirit: () => `<svg viewBox="0 0 240 220" class="mw-b" aria-hidden="true">
    <path d="M40 220V90a80 80 0 01160 0v130h-26V96a54 54 0 00-108 0v124z" fill="#5b4b72"/>
    <rect x="70" y="20" width="100" height="24" rx="6" fill="#f6e7cf"/><text x="120" y="37" text-anchor="middle" font-size="12" font-weight="900" fill="#5b4b72" letter-spacing="1.4">PANTEÓN</text>
    <path d="M66 96a54 54 0 01108 0v124H66z" class="w" opacity=".55"/>
    <g fill="#3b2f48"><path d="M80 220v-30a12 12 0 0124 0v30z"/><path d="M136 220v-38a13 13 0 0126 0v38z"/><path d="M108 220v-22a9 9 0 0118 0v22z"/></g>
    <g class="mw-in">${[[86, 214], [100, 216], [140, 214], [156, 215], [118, 217]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#ff9f1c"/>`).join('')}</g>
    ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${10 + i * 6} 220v-40" stroke="#3b2f48" stroke-width="2"/><path d="M${206 + i * 6} 220v-40" stroke="#3b2f48" stroke-width="2"/>`).join('')}
    <path d="M8 182h38M204 182h36" stroke="#3b2f48" stroke-width="2"/></svg>`
};
const hillsURL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 160"><path d="M0 160V96q60-50 130-20t120-6 140 10 110-30 100 30v80z" fill="#2a1e3d"/><path d="M0 160v-34q80-30 170 0t150-8 150 6 130-6v42z" fill="#21182f"/>
    ${[40, 160, 300, 470, 540].map((x, i) => `<rect x="${x}" y="${108 - i % 2 * 8}" width="${16 + i % 3 * 6}" height="${40 + i % 2 * 8}" fill="#1b1427"/><rect x="${x + 5}" y="${116 - i % 2 * 8}" width="4" height="5" fill="#ffbf5a" opacity=".55"/>`).join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

let lastCleared = null, worldScrollKeep = null;
function showWorld(){
  const m = me(); if(!m) return showPick();
  ambientOn();
  const d = done(), stars = LS.get(rk('stars')) || {}, just = lastCleared; lastCleared = null;
  const firstOpen = !LS.get(rk('intro'));
  const placeHTML = (s, i) => {
    const lit = d.has(s.id) && s.id !== just;
    return `<section class="mw-pn${lit ? ' lit' : ''}" data-s="${s.id}" data-k="${i}">
      <div class="mw-glow"></div>
      <div class="mw-plate"><span class="mw-k">${i + 1} · ${s.kind}</span><b>${s.name}</b><small>${s.line}</small>
        <div class="mw-st">${[0, 1, 2].map(k => `<i class="${k < (stars[s.id] || 0) && lit ? 'on' : ''}">★</i>`).join('')}</div></div>
      <i class="mw-lamp"><svg viewBox="0 0 24 120" aria-hidden="true"><path d="M11 30h2v90h-2z" fill="#3a2a50"/><path d="M6 18h12l-2 14H8z" fill="#2a1f38"/><rect x="8" y="20" width="8" height="10" rx="1" fill="#ffd36b"/><path d="M5 18l7-6 7 6z" fill="#3a2a50"/></svg></i>
      <div class="mw-bd">${PLACE_SVG[s.id]()}${s.id === 'bread' ? '<span class="mw-smoke"><i></i><i></i><i></i></span>' : ''}${s.id === 'spirit' ? `<span class="mw-gh a">${SVG.ghost}</span><span class="mw-gh b">${SVG.ghost}</span>` : ''}</div>
      <button class="mw-go" data-s="${s.id}">${d.has(s.id) ? '다시 하기' : '들어가기'}</button>
      <div class="mw-path${lit ? ' on' : ''}"></div>
    </section>`;
  };
  const root = view(`<div class="mw-top">${topbar('금잔화 마을', `<span class="hw-chip">${m.num}번</span>`)}</div>
    <div class="mw">
      <div class="mw-sky"><i class="mw-moon"></i></div>
      <div class="mw-far" id="mwFar" style="background-image:${hillsURL}"></div>
      <div class="mw-flags" id="mwFlags">${[...Array(40)].map((_, i) => SVG.flag(['#ff4f9a', '#ff9f1c', '#2ec4b6', '#b07cff', '#ffd34d'][i % 5], i)).join('')}</div>
      <div class="mw-sc" id="mwSc"><div class="mw-tr">
        ${STAGES.map(placeHTML).join('')}
        <section class="mw-pn mw-alt" data-k="${STAGES.length}">
          <div class="mw-plate"><b>우리 반 제단</b><small>내가 준비한 것들이 제단에 놓이고, 반 친구들이 깬 미션마다 금잔화가 한 송이씩 피어요</small></div>
          <div class="mw-ofr" id="mwOfr">
            <div class="mw-fl" id="mwFl"></div>
            <div class="mw-it it-flags${d.has('paper') ? ' on' : ''}">${[...Array(7)].map((_, i) => SVG.flag(['#ff4f9a', '#2ec4b6', '#ff9f1c', '#ffd34d'][i % 4], i)).join('')}</div>
            <span class="mw-it it-bread${d.has('bread') ? ' on' : ''}">${MI_ICON.bread}</span>
            <span class="mw-it it-bell${d.has('bell') ? ' on' : ''}">${MI_ICON.bell}</span>
            <div class="mw-it it-path${d.has('spirit') ? ' on' : ''}">${[...Array(9)].map(() => '<i></i>').join('')}</div>
            <div class="hw-lanterns hw-candles" id="hwCandles">${STAGES.map((s, i) => `<span class="ln${d.has(s.id) ? ' on' : ''}" data-s="${s.id}" data-i="${i}">${SVG.candle(d.has(s.id))}</span>`).join('')}</div>
            <svg class="mw-tiers" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true"><path d="M30 20h240v24H30z" fill="#ff4f9a"/><path d="M14 44h272v34H14z" fill="#ff9f1c"/><path d="M0 78h300v42H0z" fill="#2ec4b6"/>
              <path d="M30 44l12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8M14 78l13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8 13 8 13-8" fill="none" stroke="#f6e7cf" stroke-width="2" opacity=".7"/></svg>
          </div>
          <div class="hw-coop" id="hwCoop"></div>
          <div class="mw-info"><span>남은 선착순 간식</span><b id="mwLeft"></b></div>
          <div id="hwMine"></div>
        </section>
      </div></div>
      <div class="mw-hud"><button class="mw-hb" id="mwBook">기록장 <b>${d.size}/${STAGES.length}</b></button>${A.isMain() ? '<button class="mw-hb" id="mwAdm">관리자</button>' : ''}</div>
      <div class="mw-pts">${[...Array(6)].map((_, i) => `<i style="left:${8 + i * 16}%;--d:${11 + i % 3 * 4}s;--dl:${-i * 2.3}s"></i>`).join('')}</div>
      <nav class="mw-map" id="mwDots">${[...STAGES.map(s => s.id), 'altar'].map((id, i) => `<button data-k="${i}" class="${id === 'altar' ? (d.size === STAGES.length ? 'lit' : '') : d.has(id) && id !== just ? 'lit' : ''}" aria-label="${id === 'altar' ? '우리 반 제단' : st(id).name}">${id === 'altar' ? SVG.mari : MI_ICON[id]}</button>`).join('<b></b>')}</nav>
    </div>`, 'mw-view');
  bindBack(root, () => A.back());
  const sc = $('#mwSc', root), far = $('#mwFar', root), flags = $('#mwFlags', root), dots = [...root.querySelectorAll('#mwDots button')];
  const pns = [...root.querySelectorAll('.mw-pn')];
  let raf2 = 0, lastK = -1;
  const onScroll = () => {
    if(raf2) return;
    raf2 = requestAnimationFrame(() => {
      raf2 = 0;
      const x = sc.scrollLeft;
      far.style.transform = `translate3d(${-x * .18}px,0,0)`;
      flags.style.transform = `translate3d(${-x * .55}px,0,0)`;
      const mid = x + sc.clientWidth / 2;
      let k = 0, best = 1e9;
      pns.forEach((p, i) => { const c = p.offsetLeft + p.offsetWidth / 2, dd = Math.abs(c - mid); if(dd < best){ best = dd; k = i; } });
      if(k !== lastK){ lastK = k; dots.forEach((dt, i) => dt.classList.toggle('on', i === k)); if(lastK >= 0 && !reduce) sfx('petal'); }
    });
  };
  sc.addEventListener('scroll', onScroll, { passive:true });
  const goTo = (k, smooth = true) => { const p = pns[k]; if(p) sc.scrollTo({ left: p.offsetLeft + p.offsetWidth / 2 - sc.clientWidth / 2, behavior: smooth && !reduce ? 'smooth' : 'auto' }); };
  dots.forEach((dt, i) => dt.onclick = () => goTo(i));
  root.querySelectorAll('.mw-go').forEach(b => b.onclick = () => {
    const pn = b.closest('.mw-pn'); sfx('door');
    if(!reduce) pn.querySelector('.mw-bd').animate([{ transform:'scale(1)', opacity:1 }, { transform:'scale(1.18)', opacity:.0 }], { duration:260, easing:'cubic-bezier(.65,0,.35,1)', fill:'forwards' });
    setTimeout(() => openMission(b.dataset.s), reduce ? 0 : 230);
  });
  $('#mwBook', root).onclick = () => showBook();
  const adm = $('#mwAdm', root); if(adm) adm.onclick = () => showAdminView();
  bindCandles($('#hwCandles', root));
  paintSpace();
  // 처음 위치: 방금 깬 곳 → 다음 할 곳, 아니면 첫 미완료 장소
  const firstTodo = STAGES.findIndex(s => !d.has(s.id));
  const startK = just ? STAGES.findIndex(s => s.id === just) : (worldScrollKeep ?? (firstTodo < 0 ? STAGES.length : firstTodo));
  worldScrollKeep = null;
  requestAnimationFrame(() => { goTo(startK, false); onScroll(); });
  if(just){
    const pn = pns[startK];
    setTimeout(() => {
      if(!pn.isConnected) return;
      pn.classList.add('lit'); pn.querySelector('.mw-path').classList.add('on'); sfx('light');
      const mb = root.querySelector(`#mwDots button[data-k="${startK}"]`); if(mb) mb.classList.add('lit');
      const [bx, by] = centerOf(pn.querySelector('.mw-bd')); sparks(bx, by, { n:22, dist:120, shape:'petal', size:7, colors:['#ff9f1c', '#ffbb4d', '#ff4f9a'] });
      const st2 = (LS.get(rk('stars')) || {})[just] || 0;
      pn.querySelectorAll('.mw-st i').forEach((s, i) => { if(i < st2) setTimeout(() => s.classList.add('on'), 250 + i * 160); });
    }, 450);
    setTimeout(() => {
      if(!pn.isConnected) return;
      const next = STAGES.findIndex(s => !done().has(s.id));
      goTo(next < 0 ? STAGES.length : next);
      ghostSay(next < 0 ? '제단이 다 채워졌어! 길 끝의 우리 반 제단으로 가 보자' : `${st(just).got}! 다음은 ${STAGES[next].kind}(으)로`);
      if(!reduce) sfx('whoosh');
    }, 1700);
  }else if(firstOpen){
    LS.set(rk('intro'), 1);
    if(!reduce){
      const ov = document.createElement('div'); ov.className = 'mw-intro';
      ov.innerHTML = `<div><span class="mi">${SVG.mari}</span><small>DÍA DE MUERTOS</small><h3>금잔화 마을</h3><p>오늘 밤 영혼들이 돌아오는데<br>우리 반 제단이 텅 비어 있어요.<br>마을 네 곳을 돌며 제단을 채워 주세요</p></div>`;
      document.body.appendChild(ov); sfx('fanfare');
      setTimeout(() => ov.classList.add('out'), 3000); setTimeout(() => ov.remove(), 3700);
    }
    setTimeout(() => ghostSay('제단을 채우려면 네 가지가 필요해. 옆으로 밀며 마을을 돌아보자!'), reduce ? 300 : 3600);
  }
}
function paintWorld(){
  const L = $('#mwLeft'); if(L){ const n = left(); L.textContent = n ? `${n}개` : '마감'; L.classList.toggle('hot', n > 0 && n <= 3); }
  const F = $('#mwFl'); if(!F) return;
  const g = coopGoal(), t = Math.min(stats.total || 0, g);
  const have = F.children.length;
  if(have > t){ F.innerHTML = ''; }
  for(let i = F.children.length; i < t; i++){
    // 단(段)을 따라 꽃이 차례로 자리 잡음 (같은 순서라 모두의 화면에서 같은 모양)
    const row = i % 3, col = Math.floor(i / 3), cols = Math.ceil(g / 3);
    const x = 6 + ((col + (row % 2) * .5) / cols) * 88, y = [10, 42, 76][row] + ((i * 37) % 9) - 4;
    const f = document.createElement('i'); f.className = 'mw-f'; f.style.left = x + '%'; f.style.top = y + '%';
    f.style.setProperty('--s', (.8 + ((i * 53) % 5) / 10).toFixed(2)); f.innerHTML = SVG.mari;
    if(have && !reduce){ f.classList.add('new'); sfx('petal'); }
    F.appendChild(f);
  }
}
function showBook(){
  const d = done();
  const root = view(`${topbar('비밀 기록장', `<span class="hw-chip">${d.size} / ${STAGES.length}</span>`)}
    <p class="hw-q">미션을 깰 때마다 망자의 날 이야기가 한 장씩 모여요. 눌러서 다시 읽을 수 있어요.</p>
    <div class="hw-book"><div class="sl">${STAGES.map((s, i) => d.has(s.id)
      ? `<button class="hw-slot2 got" data-s="${s.id}" style="--r:${[-2, 1.5, -1, 2][i]}deg"><i>${CARDS[s.id].n}</i><span>${CARDS[s.id].t}</span></button>`
      : `<span class="hw-slot2" data-s="${s.id}"><i>${CARDS[s.id].n}</i></span>`).join('')}</div></div>`, 'hw-stage hw-in');
  bindBack(root, () => showHome());
  root.querySelectorAll('.hw-slot2.got').forEach(b => b.onclick = () => showCard(b.dataset.s));
}
function showAdminView(){
  const root = view(`${topbar('관리자')}<div id="hwAdmin"></div>`, 'hw-stage hw-in');
  bindBack(root, () => { worldScrollKeep = STAGES.length; showHome(); });
  paintAdmin();
}

/* ── 공통 효과: 불꽃·꽃잎·밀가루 ── */
function sparks(x, y, { n = 14, colors = ['#ffd34d', '#ff9f1c', '#ff4f9a', '#2ec4b6'], dist = 70, size = 6, shape = 'dot', dur = 700, up = 0 } = {}){
  if(reduce) return;
  for(let i = 0; i < n; i++){
    const e = document.createElement('i'); e.className = 'fx ' + shape;
    e.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${shape === 'petal' ? size * 1.4 : size}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(e);
    const a = Math.random() * 6.283, d = dist * (.45 + Math.random() * .75), r = Math.random() * 360;
    e.animate([{ transform:`translate(-50%,-50%) rotate(${r}deg) scale(1)`, opacity:1 },
      { transform:`translate(calc(-50% + ${(Math.cos(a) * d).toFixed(1)}px),calc(-50% + ${(Math.sin(a) * d - up).toFixed(1)}px)) rotate(${r + 200}deg) scale(.25)`, opacity:0 }],
      { duration: dur * (.7 + Math.random() * .6), easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards' }).onfinish = () => e.remove();
  }
}
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const MI_ICON = {
  bread: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="38" rx="24" ry="16" fill="#e9a85c"/><path d="M14 34q18-8 36 0M32 22v32" stroke="#c8732b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="6" fill="#d9822b"/></svg>`,
  paper: `<svg viewBox="0 0 64 64"><path d="M10 8h44v40l-5 6-5-6-5 6-5-6-5 6-5-6-5 6-4-6z" fill="#ff4f9a"/><path d="M32 16l6 8-6 8-6-8zM18 22a3 3 0 106 0 3 3 0 00-6 0M40 22a3 3 0 106 0 3 3 0 00-6 0" fill="#150f1e"/></svg>`,
  bell: `<svg viewBox="0 0 64 64"><path d="M32 8c-14 0-18 12-18 22v10l-6 8h48l-6-8V30c0-10-4-22-18-22z" fill="#ffbf3c"/><circle cx="32" cy="52" r="5" fill="#ff9f1c"/><path d="M24 18q8-6 16 0" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/></svg>`,
  spirit: `<svg viewBox="0 0 48 56">${SVG.ghost.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`
};
const HAND = `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M14 22V8a4 4 0 018 0v12l1-1a4 4 0 017 1 4 4 0 016 3v10c0 7-5 13-12 13h-3c-5 0-8-2-11-6l-6-9a3.5 3.5 0 015-5l5 5z" fill="#fff" stroke="#241a30" stroke-width="2" stroke-linejoin="round"/></svg>`;
const HOWTO = {
  bread:  { g:'rub',   why:'영혼이 먹을 음식이 제단에 있어야 해요', steps:['반죽을 <b>빙글빙글 문질러</b> 매끈하게', '버튼을 <b>눌렀다 뗐다</b> 하며 바늘을 금빛 칸에', '빵 색이 <b>주문서 칸</b>에 들어오면 <b>꺼내기!</b>'], stars:['딱 알맞게', '주문대로', '완성'] },
  paper:  { g:'draw',  why:'제단과 거리를 깃발로 꾸며야 해요', steps:['<b>주문 무늬</b>를 먼저 확인', '접힌 종이에 손가락으로 <b>구멍을 그려</b> 오리기', '깃발 <b>2장</b> 완성 (둘째 장은 네 번 접기!)'], stars:['평균 76%', '평균 62%', '통과'] },
  bell:   { g:'tap',   why:'종소리로 영혼들에게 돌아올 시간을 알려요', steps:['유령이 <b>금빛 선에 닿는 순간</b> 그 줄을 톡', '마지막엔 <b>두 줄을 동시에</b> 치는 화음도 있어요', '<b>70%</b> 넘게 맞히면 통과'], stars:['90% 이상', '80% 이상', '70% 이상'] },
  spirit: { g:'swipe', why:'금잔화 향이 영혼을 집까지 안내해요', steps:['영혼 옆에서 제단까지 <b>손가락으로 꽃길</b> 그리기', '분홍빛 <b>장난꾸러기 영혼</b>은 자꾸 딴 데로 새요', '영혼 <b>6명</b>을 모두 데려오면 통과'], stars:['50초 안에', '80초 안에', '완료'] }
};
function howTo(id, go){
  const h = HOWTO[id], s2 = st(id), best = (LS.get(rk('stars')) || {})[id] || 0;
  const ov = document.createElement('div'); ov.className = 'mi-ov';
  ov.innerHTML = `<div class="mi-card">
      <div class="mi-demo g-${h.g}"><span class="mi-ic">${MI_ICON[id]}</span><svg class="mi-tr" viewBox="0 0 120 90"><path d="M30 20L60 8L90 20L80 62L40 62Z"/></svg><span class="mi-hand">${HAND}</span><i class="mi-r"></i></div>
      <small class="mi-k">${s2.kind}</small><h3>${s2.name}</h3><p class="mi-why">${h.why}</p>
      <ol>${h.steps.map(t => `<li>${t}</li>`).join('')}</ol>
      <div class="mi-st">${h.stars.map((t, i) => `<div><span>${'★'.repeat(3 - i)}<em>${'★'.repeat(i)}</em></span>${t}</div>`).join('')}</div>
      ${best ? `<p class="mi-best">내 최고 기록 <span>${'★'.repeat(best)}<em>${'★'.repeat(3 - best)}</em></span></p>` : ''}
      <button class="hw-btn" id="miGo">시작하기</button><button class="mi-back" id="miBk">마을로 돌아가기</button></div>`;
  spaceEl.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('on'));
  sfx('flip');
  const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 280); };
  ov.querySelector('#miGo').onclick = () => { sfx('whoosh'); close(); setTimeout(() => { if(mission && mission.id === id) go(); }, 200); };
  ov.querySelector('#miBk').onclick = () => { close(); stopMission(); showHome(); };
  const prevCleanup = mission.cleanup;
  mission.cleanup = () => { ov.remove(); if(prevCleanup) prevCleanup(); };
  mission.howto = ov;
}

/* 미션 공통: 결과는 별 1~3개 */
function saveStars(id, n){ const st2 = LS.get(rk('stars')) || {}; if(!st2[id] || st2[id] < n){ st2[id] = n; LS.set(rk('stars'), st2); } }
function canvasFit(cv, w, h){ const r = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.width = w + 'px'; cv.style.height = h + 'px'; const x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return x; }

/* ───────── 1. 망자의 빵: 문질러 빚고, 누르고 버텨 굽기 ───────── */
function mBread(){
  const s = st('bread');
  let phase = 'knead', dist = 0, lastSq = 0, temp = 22, bake = 0, burns = 0, early = 0, holding = false, over = 0, raf = 0, prev = 0, gold = [62, 78], crk = 0, hum = null;
  const ORDERS = [{ name:'노릇노릇하게', lo:.55, hi:.74, c:'#e0a050' }, { name:'진한 갈색으로', lo:.78, hi:.95, c:'#a85a20' }];
  const order = { ...ORDERS[rnd(2)] };
  const lumps = [...Array(5)].map(() => ({ a: 6 + Math.random() * 10, k: 2 + rnd(4), p: Math.random() * 6.28 }));
  const root = view(`${stageHead(s, '<span class="hw-chip" id="mbStep">1 / 2 · 반죽</span>')}
    <p class="hw-q" id="mbQ">반죽을 <b>빙글빙글 문질러</b> 매끈하게 빚어 주세요.</p>
    <div class="mb-st" id="mbSt">
      <svg class="mb-d" id="mbD" viewBox="-110 -110 220 220" aria-label="반죽">
        <ellipse cx="0" cy="92" rx="84" ry="10" fill="rgba(0,0,0,.35)"/>
        <path id="mbP" fill="#f3d9a8" stroke="#e2bf86" stroke-width="3"/>
        <g id="mbDeco" opacity="0"><path d="M-62 -6q31-14 62 0t62 0" stroke="#c8732b" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M-6 -62q14 31 0 62t0 62" stroke="#c8732b" stroke-width="11" fill="none" stroke-linecap="round"/>
          ${[[-64, -6], [64, -6], [-6, -64], [-6, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#c8732b"/>`).join('')}<circle cx="0" cy="-2" r="14" fill="#d9822b"/>
          ${[...Array(18)].map(() => `<circle cx="${(Math.random() - .5) * 120}" cy="${(Math.random() - .5) * 120}" r="1.6" fill="#fff" opacity=".8"/>`).join('')}</g>
      </svg>
      <div class="mb-ov" id="mbOv" hidden>
        <svg viewBox="0 0 260 230" class="mb-oven" aria-hidden="true">
          <path d="M20 220V96a110 90 0 01220 0v124z" fill="#7a3b2e"/><path d="M20 220V96a110 90 0 01220 0" fill="none" stroke="#5c2b22" stroke-width="8"/>
          ${[...Array(9)].map((_, i) => `<path d="M${30 + i * 25} ${120 - Math.abs(4 - i) * 6}h18" stroke="#5c2b22" stroke-width="3"/>`).join('')}
          <path d="M60 220v-74a70 56 0 01140 0v74z" fill="#1a0f0c"/>
          <g id="mbFire">${[0, 1, 2, 3, 4].map(i => `<path class="fl${i}" d="M${82 + i * 24} 218c-9-10-7-22 0-34 7 12 9 24 0 34z" fill="${i % 2 ? '#ffbf3c' : '#ff7a1a'}"/>`).join('')}</g>
          <ellipse id="mbBun" cx="130" cy="176" rx="40" ry="20" fill="#f3d9a8"/>
          <path d="M98 172q32-10 64 0M130 158v30" stroke="#c8732b" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>
        </svg>
        <div class="mb-g"><svg viewBox="-110 -110 220 120" aria-hidden="true">
          <path d="M-90 0a90 90 0 01180 0" stroke="#2b2236" stroke-width="18" fill="none"/>
          <path id="mbZone" stroke="#ffbf3c" stroke-width="18" fill="none"/>
          <path id="mbHot" stroke="#ff3d5a" stroke-width="18" fill="none"/>
          <g id="mbNd"><path d="M0 0L-4 -2L-84 0L-4 2z" fill="#f6eee4"/><circle r="7" fill="#f6eee4"/></g></svg>
          <div class="mb-tl" id="mbT">22°</div></div>
      </div>
    </div>
    <div class="mb-order" id="mbOrd" hidden><span class="sw" style="background:${order.c}"></span><span>주문서 <b>${order.name}</b> 구워 주세요</span></div>
    <div class="mb-bar"><b class="mb-win" id="mbWin"></b><i id="mbBar"></i><span id="mbPct">0%</span></div>
    <div class="mb-ctl" id="mbCtl" hidden><button class="mb-hold" id="mbHold"><span>꾹 눌러 불 키우기</span></button><button class="mb-out" id="mbOut">꺼내기</button></div>`, 'hw-stage hw-in');
  backToHome(root);
  const P = $('#mbP', root), D = $('#mbD', root), bar = $('#mbBar', root);
  const blob = (k, pull = { x:0, y:0 }) => {
    const pts = [];
    for(let i = 0; i < 64; i++){
      const a = i / 64 * Math.PI * 2;
      let r = 74; lumps.forEach(L => r += Math.sin(a * L.k + L.p) * L.a * (1 - k));
      r += (Math.cos(a) * pull.x + Math.sin(a) * pull.y) * .12;
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * .86).toFixed(1)}`);
    }
    P.setAttribute('d', 'M' + pts.join('L') + 'Z');
  };
  blob(0);
  let rub = null;
  D.addEventListener('pointerdown', e => { if(phase !== 'knead') return; rub = { x:e.clientX, y:e.clientY }; D.setPointerCapture(e.pointerId); D.classList.add('press'); e.preventDefault(); });
  D.addEventListener('pointermove', e => {
    if(!rub || phase !== 'knead') return;
    const dx = e.clientX - rub.x, dy = e.clientY - rub.y, dd = Math.hypot(dx, dy);
    rub = { x:e.clientX, y:e.clientY };
    dist += Math.min(dd, 60);
    const k = Math.min(1, dist / 1800);
    blob(k, { x:dx * 6, y:dy * 6 });
    bar.style.width = (k * 100) + '%';
    if(dist - lastSq > 130){ lastSq = dist; sfx('squish'); sparks(e.clientX, e.clientY, { n:5, dist:30, size:9, shape:'puff', dur:600, up:14 }); }
    $('#mbPct', root).textContent = Math.round(k * 100) + '%';
    if(k >= 1) kneaded();
  });
  const endRub = () => { rub = null; D.classList.remove('press'); if(phase === 'knead') blob(Math.min(1, dist / 1800)); };
  ['pointerup', 'pointercancel'].forEach(n => D.addEventListener(n, endRub));
  const kneaded = () => {
    phase = 'shape'; rub = null; blob(1); D.classList.remove('press');
    sfx('light'); { const [x2, y2] = centerOf(D); sparks(x2, y2, { n:18, dist:110, shape:'petal' }); }
    $('#mbDeco', root).animate([{ opacity:0, transform:'scale(.6)' }, { opacity:1, transform:'scale(1)' }], { duration:500, easing:'cubic-bezier(.34,1.56,.64,1)', fill:'forwards' });
    $('#mbQ', root).innerHTML = '반죽 완성! 뼈 모양 장식을 올렸어요. 이제 오븐으로…';
    setTimeout(startBake, 1300);
  };
  const arc = (a0, a1) => { const p = v => { const t = Math.PI * (1 - v / 100); return `${(Math.cos(t) * 90).toFixed(1)} ${(-Math.sin(t) * 90).toFixed(1)}`; }; return `M${p(a0)}A90 90 0 0 1 ${p(a1)}`; };
  const drawZones = () => { $('#mbZone', root).setAttribute('d', arc(gold[0], gold[1])); $('#mbHot', root).setAttribute('d', arc(90, 100)); };
  const startBake = () => {
    if(!mission) return;
    phase = 'bake'; D.style.display = 'none'; $('#mbOv', root).hidden = false; $('#mbCtl', root).hidden = false; $('#mbOrd', root).hidden = false;
    { const w = $('#mbWin', root); w.style.left = (order.lo / 1.05 * 100) + '%'; w.style.width = ((order.hi - order.lo) / 1.05 * 100) + '%'; }
    $('#mbStep', root).textContent = '2 / 2 · 굽기'; bar.style.width = '0%';
    $('#mbQ', root).innerHTML = '누르면 불이 세지고 떼면 약해져요. 금빛 칸에서 구워지다가 <b>주문서 칸에 들어오면 꺼내기!</b>';
    drawZones();
    hum = startHum();
    prev = performance.now(); raf = requestAnimationFrame(loop);
  };
  const hold = $('#mbHold', root);
  const on = e => { holding = true; hold.classList.add('on'); e.preventDefault(); }, off = () => { holding = false; hold.classList.remove('on'); };
  hold.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => hold.addEventListener(n, off));
  hold.addEventListener('contextmenu', e => e.preventDefault());
  const lerpC = (a, b, t) => { const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A2 = h(a), B = h(b); return '#' + A2.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  let burntUntil = 0;
  const loop = now => {
    if(!mission || mission.id !== 'bread') return;
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    temp += (holding ? 34 : -22) * dt + Math.sin(now / 430) * 7 * dt;
    temp = Math.max(18, Math.min(104, temp));
    const inGold = temp >= gold[0] && temp <= gold[1], hotter = temp > gold[1];
    // 금빛 칸에서 천천히, 그보다 뜨거우면 빨리 구워짐 (그래서 주문서 칸을 지나치기 쉬움)
    if((inGold || hotter) && now > burntUntil){ bake += dt / (hotter ? 1.4 : 2.4); if((crk += dt) > (hotter ? .16 : .28)){ crk = 0; sfx('crackle'); } }
    over = temp > 90 ? over + dt : Math.max(0, over - dt * 2);
    if(over > .75) burnNow(now, '앗, 불이 너무 세서 빵이 탔어요! 새 반죽으로 다시');
    else if(bake >= 1.05 && now > burntUntil) burnNow(now, '너무 오래 구워서 탔어요! 주문서 칸에서 꺼내야 해요');
    $('#mbNd', root).setAttribute('transform', `rotate(${(temp / 100 * 180).toFixed(1)})`);
    $('#mbT', root).textContent = Math.round(temp * 2.4) + '°';
    $('#mbT', root).className = 'mb-tl' + (inGold ? ' gold' : temp > 90 ? ' hot' : '');
    $('#mbBun', root).setAttribute('fill', now < burntUntil ? '#2d1a12' : bake < .85 ? lerpC('#f3d9a8', '#cf7a26', bake / .85) : lerpC('#cf7a26', '#6e3714', Math.min(1, (bake - .85) / .2)));
    $('#mbBun', root).setAttribute('ry', (20 + Math.min(1, bake) * 6).toFixed(1));
    const ready = bake >= order.lo && bake <= order.hi;
    $('#mbOv', root).classList.toggle('gold', inGold && now > burntUntil);
    $('#mbOut', root).classList.toggle('ready', ready);
    $('#mbPct', root).textContent = ready ? '지금!' : Math.round(Math.min(1.05, bake) / 1.05 * 100) + '%';
    $('#mbFire', root).style.transform = `scaleY(${(.55 + temp / 100 * .8).toFixed(2)})`;
    bar.style.width = (Math.min(1.05, bake) / 1.05 * 100) + '%';
    if(hum) hum(temp);
    raf = requestAnimationFrame(loop);
  };
  const burnNow = (now, msg) => {
    burns++; over = 0; bake = 0; temp = 55; burntUntil = now + 900; sfx('burnt');
    { const [x2, y2] = centerOf($('#mbBun', root)); sparks(x2, y2, { n:14, dist:60, size:16, shape:'puff smoke', dur:1200, up:70 }); }
    A.toast(msg, 2000);
    if(!reduce) $('#mbOv', root).animate([{ transform:'translateX(-5px)' }, { transform:'translateX(5px)' }, { transform:'none' }], { duration:260 });
  };
  $('#mbOut', root).onclick = () => {
    if(phase !== 'bake') return;
    if(bake < order.lo){ early++; sfx('thunk'); A.toast(bake < .3 ? '아직 반죽 그대로예요! 더 구워요' : '아직 덜 익었어요. 조금만 더!', 1500); return; }
    if(bake > order.hi){ burnNow(performance.now(), '주문보다 너무 진하게 구워졌어요. 다시 구워요!'); return; }
    phase = 'done'; cancelAnimationFrame(raf); if(hum){ hum(null); hum = null; }
    const mid = (order.lo + order.hi) / 2, close = Math.abs(bake - mid) <= (order.hi - order.lo) / 4;
    const n = Math.max(1, Math.min(3, (close ? 3 : 2) - burns - (early > 1 ? 1 : 0))); saveStars('bread', n);
    { const [x2, y2] = centerOf($('#mbBun', root)); sparks(x2, y2, { n:22, dist:110 }); }
    win('bread', `주문대로 ${order.name} 구운 망자의 빵이 제단에 올라갔어요`, n);
  };
  mission.cleanup = () => { cancelAnimationFrame(raf); if(hum){ hum(null); hum = null; } };
  howTo('bread', () => hints([
    { at:40, text: '반죽은 빙글빙글 문지르고, 오븐은 눌렀다 뗐다 하며 바늘을 금빛 칸에 붙잡아 둬', fn: null },
    { at:80, text:'금빛 칸과 주문서 칸을 넓혀 줄게. 천천히!', fn: () => { gold = [55, 84]; order.lo -= .05; order.hi += .05; if(phase === 'bake'){ drawZones(); const w = $('#mbWin', root); w.style.left = (order.lo / 1.05 * 100) + '%'; w.style.width = ((order.hi - order.lo) / 1.05 * 100) + '%'; } } }
  ]));
}
function startHum(){                     // 오븐 소리: 온도에 따라 높아지는 웅웅 소리
  const c = au(); if(!c) return null;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = .0001;
  o.connect(f); f.connect(g); g.connect(master); o.start();
  g.gain.linearRampToValueAtTime(.022, c.currentTime + .3);
  return t => {
    if(t === null){ try{ g.gain.linearRampToValueAtTime(.0001, c.currentTime + .2); o.stop(c.currentTime + .25); }catch{} return; }
    o.frequency.setTargetAtTime(48 + t * 1.3, c.currentTime, .05);
  };
}

/* ───────── 2. 파펠 피카도: 주문받은 무늬로 깃발 2장 오리기 ─────────
   1장: 반 접기 '해골 얼굴'(눈 + 코)  2장: 네 번 접기 '금잔화 꽃'(꽃술 + 꽃잎 4장) */
function cutOrder(kind){
  const poly = (cx, cy, r, n, rot = 0) => [...Array(n)].map((_, i) => { const a = rot + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const j = (a, b) => a + Math.random() * (b - a);
  if(kind === 'half'){
    const ey = j(.3, .38), er = j(.075, .09), ex = j(.27, .32), ny = j(.56, .62), nh = j(.07, .085);
    return { kind, name:'해골 얼굴', polys:[ poly(ex, ey, er, 28), [[.5, ny - nh * .6], [.5 - nh * .75, ny - nh * .6], [.5, ny + nh]] ] };
  }
  const cr = j(.1, .13), pr = j(.07, .085), pd = j(.24, .29);
  const corner = [[.5, .5], ...[...Array(13)].map((_, i) => { const a = Math.PI + i / 12 * Math.PI / 2; return [.5 + Math.cos(a) * cr, .5 + Math.sin(a) * cr]; })];
  return { kind, name:'금잔화 꽃', polys:[ corner, poly(pd, pd, pr, 4) ] };
}
function mPaperCut(){
  const s = st('paper');
  const SHEETS = ['half', 'quarter'], scores = [];
  let si = 0, order, cuts = [], cur = null, lastSn = 0, guide = false, pass = .5, unfolded = false, W, Hh, VM;
  const root = view(`${stageHead(s, '<span class="hw-chip" id="mpN">1 / 2</span>')}
    <p class="hw-q" id="mpQ"></p>
    <div class="mp-row">
      <div class="mp-tg"><small id="mpTn">주문 무늬</small><canvas id="mpT"></canvas></div>
      <div class="mp-wrap" id="mpZ"><span class="mp-sc" id="mpSc"><svg viewBox="0 0 32 32"><circle cx="8" cy="24" r="5" fill="none" stroke="#f6eee4" stroke-width="2.5"/><circle cx="24" cy="24" r="5" fill="none" stroke="#f6eee4" stroke-width="2.5"/><path d="M11 20L26 3M21 20L6 3" stroke="#f6eee4" stroke-width="2.5" stroke-linecap="round"/></svg></span>
        <canvas id="mpC"></canvas><canvas id="mpU" class="mp-un"></canvas></div>
    </div>
    <p class="mp-res" id="mpR"></p>
    <div class="hw-row2"><button class="hw-btn ghost" id="mpB">되돌리기</button><button class="hw-btn" id="mpGo">펼치기</button></div>`, 'hw-stage hw-in');
  backToHome(root);
  const Z = $('#mpZ', root), C = $('#mpC', root), U = $('#mpU', root), T = $('#mpT', root), SC = $('#mpSc', root);
  const tx = canvasFit(T, 64, 64);
  let cx, ux;
  const COLORS = ['#ff4f9a', '#2ec4b6'], HOLE = '#150f1e';
  const mirrors = k => k === 'half' ? [[0, 0]] .concat([[1, 0]]) : [[0, 0], [1, 0], [0, 1], [1, 1]];   // [x뒤집기, y뒤집기]
  const pathPoly = (x, p, sx, sy, fx = 0, fy = 0) => { x.beginPath(); p.forEach(([u, v], i) => { const X = (fx ? 1 - u : u) * sx, Y = (fy ? 1 - v : v) * sy; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); };
  const setup = () => {
    order = cutOrder(SHEETS[si]); cuts = []; cur = null; unfolded = false;
    VM = order.kind === 'half' ? 1 : .5;
    W = Math.min(Math.round(innerWidth * (order.kind === 'half' ? .4 : .38)), order.kind === 'half' ? 180 : 170);
    Hh = Math.round(W * VM * 2);
    cx = canvasFit(C, W, Hh); ux = canvasFit(U, W * 2, Math.round(Hh / VM));
    Z.style.width = W * 2 + 'px'; Z.style.height = Math.round(Hh / VM) + 'px';
    Z.classList.remove('open', 'q'); if(order.kind !== 'half') Z.classList.add('q');
    $('#mpN', root).textContent = `${si + 1} / 2`;
    $('#mpTn', root).textContent = `주문: ${order.name}`;
    $('#mpQ', root).innerHTML = order.kind === 'half'
      ? '반으로 접은 종이예요. 노란 점선이 접힌 선. 손가락으로 <b>구멍 모양을 그리면</b> 오려져요.'
      : '이번엔 <b>네 번 겹치게</b> 접었어요. 오른쪽과 아래 점선이 모두 접힌 선이라, 펼치면 구멍이 <b>4배</b>가 돼요.';
    $('#mpR', root).textContent = ''; $('#mpGo', root).textContent = '펼치기'; $('#mpB', root).disabled = false;
    tx.fillStyle = COLORS[si % 2]; tx.fillRect(0, 0, 64, 64); tx.fillStyle = HOLE;
    order.polys.forEach(p => mirrors(order.kind).forEach(([fx, fy]) => { pathPoly(tx, p, 64, 64, fx, fy); tx.fill(); }));
    draw();
  };
  const draw = () => {
    cx.clearRect(0, 0, W, Hh);
    cx.fillStyle = COLORS[si % 2]; cx.fillRect(0, 0, W, Hh);
    cx.globalAlpha = .08; cx.fillStyle = '#fff'; for(let y = 0; y < Hh; y += 6) cx.fillRect(0, y, W, 1); cx.globalAlpha = 1;
    const sx = W * 2, sy = Hh / VM;
    if(guide){ cx.setLineDash([5, 4]); cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 2; order.polys.forEach(p => { pathPoly(cx, p, sx, sy); cx.stroke(); }); cx.setLineDash([]); }
    cx.fillStyle = HOLE;
    cuts.forEach(p => { pathPoly(cx, p, sx, sy); cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1.5; cx.stroke(); });
    if(cur && cur.length > 1){ cx.strokeStyle = '#ffd34d'; cx.lineWidth = 2.5; cx.setLineDash([6, 4]); cx.beginPath(); cur.forEach(([u, v], i) => i ? cx.lineTo(u * sx, v * sy) : cx.moveTo(u * sx, v * sy)); cx.stroke(); cx.setLineDash([]); }
    cx.strokeStyle = 'rgba(255,211,77,.95)'; cx.setLineDash([6, 5]); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(W - 1, 0); cx.lineTo(W - 1, Hh);
    if(order.kind !== 'half'){ cx.moveTo(0, Hh - 1); cx.lineTo(W, Hh - 1); }
    cx.stroke(); cx.setLineDash([]);
  };
  const uv = e => { const r = C.getBoundingClientRect(); return [Math.min(.62, Math.max(-.04, (e.clientX - r.left) / r.width * .5)), Math.min(VM + .12, Math.max(-.04, (e.clientY - r.top) / r.height * VM))]; };
  const moveSc = (e, ang) => { const r = Z.getBoundingClientRect(); SC.style.transform = `translate(${e.clientX - r.left - 4}px,${e.clientY - r.top - 28}px) rotate(${ang || 0}deg)`; };
  Z.addEventListener('pointerdown', e => { if(unfolded) return; Z.setPointerCapture(e.pointerId); cur = [uv(e)]; lastSn = 0; SC.classList.add('on'); moveSc(e); e.preventDefault(); });
  Z.addEventListener('pointermove', e => {
    if(!cur) return;
    const p = uv(e), q = cur[cur.length - 1], dd = Math.hypot((p[0] - q[0]) * W * 2, (p[1] - q[1]) * Hh / VM);
    if(dd < 3) return;
    cur.push(p); lastSn += dd; moveSc(e, Math.atan2((p[1] - q[1]) * Hh / VM, (p[0] - q[0]) * W * 2) * 57.3 + 90);
    if(lastSn > 34){ lastSn = 0; sfx('snip'); }
    draw();
  });
  const endCut = () => {
    if(!cur) return;
    let len = 0; for(let i = 1; i < cur.length; i++) len += Math.hypot((cur[i][0] - cur[i - 1][0]) * W * 2, (cur[i][1] - cur[i - 1][1]) * Hh / VM);
    if(len > 36 && cur.length > 4){ cuts.push(cur); if(cuts.length > 6) cuts.shift(); sfx('snip'); }
    cur = null; SC.classList.remove('on'); draw();
  };
  ['pointerup', 'pointercancel'].forEach(n => Z.addEventListener(n, endCut));
  const mask = polys => {
    const G = 48, o = document.createElement('canvas'); o.width = G / 2; o.height = Math.round(G * VM);
    const x = o.getContext('2d'); x.fillStyle = '#fff';
    polys.forEach(p => { x.beginPath(); p.forEach(([u, v], i) => i ? x.lineTo(u * G, v * G) : x.moveTo(u * G, v * G)); x.closePath(); x.fill(); });
    const d = x.getImageData(0, 0, o.width, o.height).data, m = new Uint8Array(o.width * o.height);
    for(let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    return m;
  };
  const score = () => { const a = mask(order.polys), b = mask(cuts); let I = 0, Un = 0; for(let i = 0; i < a.length; i++){ I += a[i] & b[i]; Un += a[i] | b[i]; } return Un ? I / Un : 0; };
  const fold = () => { unfolded = false; Z.classList.remove('open'); $('#mpGo', root).textContent = '펼치기'; $('#mpB', root).disabled = false; $('#mpR', root).textContent = ''; };
  $('#mpB', root).onclick = () => { if(unfolded) return; cuts.pop(); sfx('tap'); draw(); };
  $('#mpGo', root).onclick = () => {
    if(unfolded) return fold();
    if(!cuts.length) return A.toast('먼저 종이에 손가락으로 구멍 모양을 그려 주세요', 1800);
    unfolded = true;
    // 접힌 조각을 거울처럼 이어 붙여 펼친 종이를 그림
    const FW = W * 2, FH = Math.round(Hh / VM);
    ux.clearRect(0, 0, FW, FH);
    mirrors(order.kind).forEach(([fx, fy]) => { ux.save(); ux.translate(fx ? FW : 0, fy ? FH : 0); ux.scale(fx ? -1 : 1, fy ? -1 : 1); ux.drawImage(C, 0, 0, W, Hh); ux.restore(); });
    Z.classList.add('open'); sfx('unfold');
    $('#mpGo', root).textContent = '다시 접기'; $('#mpB', root).disabled = true;
    const sc = score(), pct = Math.round(sc * 100);
    setTimeout(() => {
      if(!mission || mission.id !== 'paper' || !unfolded) return;
      const R = $('#mpR', root);
      const countUp = el => { const t1 = performance.now(); const f = now => { const k = Math.min(1, (now - t1) / 650); el.textContent = Math.round(pct * (1 - Math.pow(1 - k, 3))) + '%'; if(k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
      if(sc >= pass){
        R.innerHTML = `주문과 <b>0%</b> 닮았어요!`; R.className = 'mp-res ok'; countUp(R.querySelector('b'));
        { const [x2, y2] = centerOf(Z); sparks(x2, y2, { n:26, dist:150, size:8, shape:'sq', colors:['#ff4f9a', '#2ec4b6', '#ff9f1c', '#ffd34d', '#b07cff'] }); }
        scores.push(sc);
        if(si === 0){
          sfx('light');
          setTimeout(() => { if(mission && mission.id === 'paper'){ si = 1; setup(); A.toast('깃발 한 장 완성! 이번엔 네 번 접은 종이예요', 2000); } }, 1500);
        }else{
          const avg = (scores[0] + scores[1]) / 2, n = avg >= .76 ? 3 : avg >= .62 ? 2 : 1; saveStars('paper', n);
          setTimeout(() => win('paper', `해골 얼굴과 금잔화 꽃 깃발이 제단 위에 걸렸어요 · 평균 ${Math.round(avg * 100)}%`, n), 900);
        }
      }else{
        R.innerHTML = `주문과 <b>0%</b> 닮았어요. ${Math.round(pass * 100)}%를 넘기면 통과! 다시 접어서 고쳐 볼까요?`; R.className = 'mp-res'; countUp(R.querySelector('b'));
        sfx('thunk');
      }
    }, 650);
  };
  setup();
  howTo('paper', () => hints([
    { at:40, text:'종이 위에 주문 모양을 점선으로 그려 둘게. 그 선을 따라 오려 봐', fn: () => { guide = true; draw(); } },
    { at:80, text:'기준을 조금 낮춰 줄게. 펼치기를 눌러 봐!', fn: () => { pass = .38; } }
  ]));
  root._dbg = { order: () => order, cuts: () => cuts, score, sheet: () => si };
}

/* ───────── 3. 영혼의 종: 유령 박자에 맞춰 종 치기 ───────── */
const BELL_SONG = [   // [박, 음] — 직접 만든 짧은 선율 (가단조, 104BPM)
  [0, 69], [1, 72], [2, 76], [3, 72], [4, 74], [5, 77], [6, 81], [6.5, 77], [7, 74],
  [8, 76], [9, 80], [10, 83], [11, 80], [12, 81], [12.5, 76], [13, 72], [14, 69], [15, 72],
  [16, 74], [17, 77], [18, 81], [19, 77], [20, 76], [20.5, 80], [21, 83], [22, 80],
  [24, 69, 0], [24, 81, 2], [25, 76], [26, 72, 0], [26, 80, 2], [27, 76], [28, 69, 0], [28, 81, 2]
];
function mBell(){
  const s = st('bell');
  const BPM = 112, B = 60 / BPM, LEAD = 2.4;
  let easy = false, playing = false, raf = 0, notes = [], t0 = 0, audio0 = 0, sched = 0, hits = 0, perfect = 0, combo = 0, best = 0, tries = 0, need = .7;
  const pitches = [...new Set(BELL_SONG.map(n => n[1]))].sort((a, b) => a - b);
  const laneOf = p => Math.min(2, Math.floor(pitches.indexOf(p) / pitches.length * 3));
  const root = view(`${stageHead(s, '<span class="hw-chip" id="mlC">콤보 0</span>')}
    <p class="hw-q">유령이 <b>금빛 선에 닿는 순간</b> 그 줄을 톡!</p>
    <div class="ml" id="mlF">
      ${[0, 1, 2].map(i => `<div class="ml-ln" data-l="${i}"><div class="ml-bell"><svg viewBox="0 0 60 60"><path d="M30 6c-14 0-18 12-18 22v10l-6 8h48l-6-8V28c0-10-4-22-18-22z" fill="${['#ff9f1c', '#ff4f9a', '#2ec4b6'][i]}"/><circle cx="30" cy="50" r="5" fill="#ffd36b"/><path d="M22 16q8-6 16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/></svg></div></div>`).join('')}
      <div class="ml-line"></div><div class="ml-notes" id="mlN"></div><div class="ml-pop" id="mlP"></div>
      <div class="ml-prog"><i id="mlPg"></i></div>
      <div class="ml-start" id="mlS" hidden><button class="hw-btn" id="mlGo">시작</button><small>소리를 켜면 더 재밌어요</small></div>
    </div>`, 'hw-stage hw-in');
  backToHome(root);
  const F = $('#mlF', root), N = $('#mlN', root), lanes = [...root.querySelectorAll('.ml-ln')];
  const travel = () => easy ? 2.2 : 1.7, win2 = () => easy ? .2 : .15, perf = () => easy ? .09 : .075;
  const clock = () => (performance.now() - t0) / 1000;
  const pop = (text, l, cls) => { const p = document.createElement('b'); p.className = 'ml-pp ' + cls; p.textContent = text; p.style.left = (l * 33.33 + 16.66) + '%'; $('#mlP', root).appendChild(p); setTimeout(() => p.remove(), 700); };
  const start = () => {
    tries++; playing = true; hits = 0; perfect = 0; combo = 0; best = 0;
    $('#mlS', root).hidden = true;
    N.innerHTML = '';
    notes = BELL_SONG.map(([b, p, ln]) => { const el = document.createElement('i'); el.className = 'ml-n'; el.innerHTML = SVG.ghost; N.appendChild(el); return { t: LEAD + b * B, p, l: ln ?? laneOf(p), el, done:false }; });
    t0 = performance.now(); const c = au(); audio0 = c ? c.currentTime : 0;
    // 카운트인 + 반주(기타) 미리 예약
    if(c){
      [0, 1].forEach(i => pluck(NOTE(57), LEAD - (2 - i) * B, .08));
      const prog = [[45, 57, 64], [50, 57, 65], [52, 56, 64], [45, 57, 64]];
      for(let b = 0; b <= 28; b++){ const ch = prog[Math.floor(b / 8) % 4]; pluck(NOTE(ch[0]), LEAD + b * B, b % 2 ? .035 : .06); if(b % 2 === 0) strum(ch.slice(1).map(m => m + 12), LEAD + b * B + B / 2, .025, .02); }
    }
    raf = requestAnimationFrame(loop);
  };
  const H = () => F.clientHeight, lineY = () => H() * .8;
  const loop = () => {
    if(!mission || mission.id !== 'bell' || !playing) return;
    const now = clock(), ly = lineY();
    notes.forEach(n => {
      if(n.done) return;
      const dt = n.t - now;
      if(dt > travel() + .2){ n.el.style.opacity = 0; return; }
      const y = ly - dt / travel() * ly;
      n.el.style.opacity = 1;
      n.el.style.transform = `translate3d(-50%,${(y - 22).toFixed(1)}px,0)`;
      n.el.style.left = (n.l * 33.33 + 16.66) + '%';
      if(dt < -win2()){ n.done = true; n.el.classList.add('miss'); combo = 0; $('#mlC', root).textContent = '콤보 0'; $('#mlC', root).classList.remove('fire'); lanes[n.l].classList.add('bad'); setTimeout(() => lanes[n.l].classList.remove('bad'), 180); setTimeout(() => n.el.remove(), 300); }
    });
    $('#mlPg', root).style.width = Math.min(100, Math.max(0, (now - LEAD) / (notes[notes.length - 1].t - LEAD) * 100)) + '%';
    if(now > notes[notes.length - 1].t + 1){ return finish(); }
    raf = requestAnimationFrame(loop);
  };
  lanes.forEach(L => L.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(!playing) return;
    const l = +L.dataset.l, now = clock();
    let hit = null, bd = 9;
    notes.forEach(n => { if(!n.done && n.l === l){ const d2 = Math.abs(n.t - now); if(d2 < bd){ bd = d2; hit = n; } } });
    L.classList.remove('ring'); void L.offsetWidth; L.classList.add('ring');
    if(hit && bd <= win2()){
      hit.done = true; hits++; combo++; best = Math.max(best, combo);
      const isP = bd <= perf(); if(isP) perfect++;
      bell(NOTE(hit.p), 0, .13);
      hit.el.classList.add('got'); setTimeout(() => hit.el.remove(), 320);
      pop(isP ? '완벽!' : '좋아', l, isP ? 'p' : 'g');
      $('#mlC', root).textContent = `콤보 ${combo}`; $('#mlC', root).classList.toggle('fire', combo >= 5);
      { const [x2, y2] = centerOf(L.querySelector('.ml-bell')); sparks(x2, y2 - 10, { n: isP ? 12 : 7, dist: isP ? 60 : 40, colors:[['#ff9f1c', '#ffd34d'], ['#ff4f9a', '#ffd34d'], ['#2ec4b6', '#ffd34d']][l] }); }
    }else sfx('thunk');
  }));
  const finish = () => {
    playing = false; cancelAnimationFrame(raf);
    const rate = hits / notes.length, pct = Math.round(rate * 100);
    if(rate >= need){
      const n = rate >= .9 ? 3 : rate >= .78 ? 2 : 1; saveStars('bell', n);
      return win('bell', `${notes.length}개 중 ${hits}개 · 최고 콤보 ${best} · 종소리가 마을에 울려 퍼져요`, n);
    }
    sfx('thunk');
    $('#mlS', root).hidden = false;
    $('#mlS', root).innerHTML = `<p class="ml-r">${notes.length}개 중 <b>${hits}개</b> (${pct}%)<br>${Math.round(need * 100)}% 이상이면 통과예요</p>
      <button class="hw-btn" id="mlGo">다시 울리기</button>${tries >= 1 && !easy ? '<button class="hw-btn ghost" id="mlEz">느리게 하기</button>' : ''}`;
    $('#mlGo', root).onclick = start;
    const ez = $('#mlEz', root); if(ez) ez.onclick = () => { easy = true; start(); };
  };
  $('#mlGo', root).onclick = start;
  mission.cleanup = () => { playing = false; cancelAnimationFrame(raf); };
  howTo('bell', () => { start(); hints([
    { at:40, text:'기타 반주의 쿵 소리에 맞춰 눌러 봐. 박자가 일정해!', fn: null },
    { at:80, text:'통과 기준을 낮추고, 느리게 하기도 열어 둘게', fn: () => { need = .55; } }
  ]); });
  root._dbg = { notes: () => notes, clock };
}

/* ───────── 4. 꽃길 안내: 꽃잎을 흩뿌려 길 잃은 영혼을 제단으로 ───────── */
function mSpirit(){
  const s = st('spirit');
  const Wd = Math.min(innerWidth - 32, 520), Ht = Math.min(Math.round(Wd * 1.15), innerHeight - 260);
  let raf = 0, prev = 0, petals = [], seq = 0, drawing = null, ink = 1, saved = 0, R = 78, altarR = 34, tStart = performance.now(), lastPt = 0, ended = false;
  const TOTAL = 6;
  const altar = { x: Wd * .84, y: Ht * .52 };
  const stones = [];
  for(let tries = 0; stones.length < 3 && tries < 200; tries++){
    const o = { x: Wd * (.3 + Math.random() * .4), y: Ht * (.15 + Math.random() * .7), r: 16 + Math.random() * 8 };
    if(stones.every(q => Math.hypot(q.x - o.x, q.y - o.y) > 70) && Math.hypot(o.x - altar.x, o.y - altar.y) > 80) stones.push(o);
  }
  const spawn = (i, imp = false) => ({ x: Wd * (.08 + Math.random() * .1), y: Ht * (.12 + i / (TOTAL - 1) * .76), vx:0, vy:0, ph: Math.random() * 6, st:'lost', a:1, follow:false, imp });
  const spirits = [0, 1, 2].map(spawn);
  const root = view(`${stageHead(s, '<span class="hw-chip" id="msC"></span>')}
    <p class="hw-q">영혼 근처에서 손가락을 끌어 <b>제단까지 꽃길</b>을 그려 주세요. 꽃잎은 금방 시들어요.</p>
    <div class="ms" id="msW"><canvas id="msCv"></canvas><div class="ms-ink"><i id="msInk"></i></div></div>`, 'hw-stage hw-in');
  backToHome(root);
  const cv = $('#msCv', root), x = canvasFit(cv, Wd, Ht);
  const cnt = () => { $('#msC', root).innerHTML = [...Array(TOTAL)].map((_, i) => `<i class="${i < saved ? 'on' : ''}">${SVG.ghost}</i>`).join(''); };
  cnt();
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * Wd, y: (e.clientY - r.top) / r.height * Ht }; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drawing = pos(e); e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if(!drawing) return;
    const p = pos(e), dd = Math.hypot(p.x - drawing.x, p.y - drawing.y);
    if(dd < 13 || ink <= 0) return;
    const steps = Math.floor(dd / 13);
    for(let i = 1; i <= steps && ink > 0; i++){
      const t = i / steps; petals.push({ x: drawing.x + (p.x - drawing.x) * t, y: drawing.y + (p.y - drawing.y) * t, seq: ++seq, life: 5, rot: Math.random() * 6.28, hue: rnd(3) });
      ink = Math.max(0, ink - 1 / 110);
    }
    drawing = p;
    const now = performance.now(); if(now - lastPt > 70){ lastPt = now; sfx('petal'); }
  });
  ['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { drawing = null; }));

  const glow = (X, Y, r, c) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 6.29); x.fill(); };
  const loop = now => {
    if(!mission || mission.id !== 'spirit') return;
    const dt = Math.min(.05, (now - prev) / 1000 || 0); prev = now;
    if(!drawing) ink = Math.min(1, ink + dt * .16);
    petals.forEach(p => p.life -= dt); petals = petals.filter(p => p.life > 0);
    spirits.forEach(sp => {
      if(sp.st === 'saved'){ sp.a = Math.max(0, sp.a - dt * 2); sp.x += (altar.x - sp.x) * dt * 6; sp.y += (altar.y - sp.y) * dt * 6; return; }
      let tgt = null, ts = -1;
      for(const p of petals){ const d2 = Math.hypot(p.x - sp.x, p.y - sp.y); if(d2 < R && p.seq > ts){ ts = p.seq; tgt = p; } }
      let dx = 0, dy = 0, spd = 22;
      if(tgt){ dx = tgt.x - sp.x; dy = tgt.y - sp.y; spd = 92; if(sp.imp){ const a2 = Math.sin(now / 260 + sp.ph) * .7, c2 = Math.cos(a2), s2 = Math.sin(a2); [dx, dy] = [dx * c2 - dy * s2, dx * s2 + dy * c2]; } if(!sp.follow){ sp.follow = true; tone(660, .3, { vol:.03, to:880, attack:.05 }); } }
      else{ sp.follow = false; sp.ph += dt * (1 + Math.random()); dx = Math.cos(sp.ph); dy = Math.sin(sp.ph * 1.3); if(sp.imp){ spd = 46; dx -= .6; } }
      const dl = Math.hypot(dx, dy) || 1;
      sp.vx += (dx / dl * spd - sp.vx) * Math.min(1, dt * 3.2); sp.vy += (dy / dl * spd - sp.vy) * Math.min(1, dt * 3.2);
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      stones.forEach(o => { const d2 = Math.hypot(sp.x - o.x, sp.y - o.y), m = o.r + 10; if(d2 < m){ sp.x = o.x + (sp.x - o.x) / d2 * m; sp.y = o.y + (sp.y - o.y) / d2 * m; } });
      sp.x = Math.max(10, Math.min(Wd - 10, sp.x)); sp.y = Math.max(10, Math.min(Ht - 10, sp.y));
      sp.tr = sp.tr || []; sp.tr.push([sp.x, sp.y]); if(sp.tr.length > 14) sp.tr.shift();
      if(Math.hypot(sp.x - altar.x, sp.y - altar.y) < altarR + 8){
        sp.st = 'saved'; saved++; cnt();
        { const r2 = cv.getBoundingClientRect(), k2 = r2.width / Wd; sparks(r2.left + altar.x * k2, r2.top + altar.y * k2, { n:16, dist:70, shape:'petal', size:7, colors:['#ff9f1c', '#ffbb4d', '#ff4f9a'] }); }
        bell(NOTE([72, 76, 79, 83, 84][Math.min(4, saved - 1)]), 0, .12);
        if(saved >= TOTAL && !ended){
          ended = true; const sec = (performance.now() - tStart) / 1000;
          const n = sec < 50 ? 3 : sec < 80 ? 2 : 1; saveStars('spirit', n);
          setTimeout(() => win('spirit', `영혼 ${TOTAL}명이 모두 꽃길을 따라 제단에 도착했어요`, n), 600);
        }
      }
    });
    // 그리기
    x.clearRect(0, 0, Wd, Ht);
    const bg = x.createLinearGradient(0, 0, 0, Ht); bg.addColorStop(0, '#1a1228'); bg.addColorStop(1, '#120c1c'); x.fillStyle = bg; x.fillRect(0, 0, Wd, Ht);
    x.fillStyle = 'rgba(255,255,255,.035)'; for(let i = 0; i < 40; i++){ x.fillRect((i * 97) % Wd, (i * 53) % Ht, 2, 2); }
    // 무덤(출발)
    for(let i = 0; i < 3; i++){ const gx = Wd * .07, gy = Ht * (.22 + i * .28); x.fillStyle = '#2a2036'; x.beginPath(); x.moveTo(gx - 14, gy + 20); x.lineTo(gx - 14, gy - 4); x.arc(gx, gy - 4, 14, Math.PI, 0); x.lineTo(gx + 14, gy + 20); x.fill(); }
    // 묘비(장애물)
    stones.forEach(o => { x.fillStyle = '#3b2f48'; x.beginPath(); x.moveTo(o.x - o.r, o.y + o.r); x.lineTo(o.x - o.r, o.y - o.r * .2); x.arc(o.x, o.y - o.r * .2, o.r, Math.PI, 0); x.lineTo(o.x + o.r, o.y + o.r); x.fill(); x.strokeStyle = '#5b4b72'; x.lineWidth = 2; x.beginPath(); x.moveTo(o.x, o.y - o.r * .6); x.lineTo(o.x, o.y + o.r * .3); x.moveTo(o.x - o.r * .35, o.y - o.r * .25); x.lineTo(o.x + o.r * .35, o.y - o.r * .25); x.stroke(); });
    // 제단
    glow(altar.x, altar.y, altarR * 2.6, 'rgba(255,159,28,.35)');
    x.fillStyle = '#ff4f9a'; x.fillRect(altar.x - 30, altar.y + 4, 60, 12); x.fillStyle = '#ff9f1c'; x.fillRect(altar.x - 36, altar.y + 16, 72, 14);
    for(let i = 0; i < 3; i++){ const cx2 = altar.x - 16 + i * 16; x.fillStyle = '#f6e7cf'; x.fillRect(cx2 - 3, altar.y - 12, 6, 16); glow(cx2, altar.y - 16, 9, 'rgba(255,211,107,.9)'); }
    x.strokeStyle = 'rgba(255,191,60,.35)'; x.setLineDash([4, 5]); x.beginPath(); x.arc(altar.x, altar.y, altarR + 8, 0, 6.29); x.stroke(); x.setLineDash([]);
    // 꽃잎
    petals.forEach(p => { x.save(); x.globalAlpha = Math.min(1, p.life / 1.5); x.translate(p.x, p.y); x.rotate(p.rot + now / 2000); x.fillStyle = ['#ff9f1c', '#ffbb4d', '#ff7a1a'][p.hue]; x.beginPath(); x.ellipse(0, 0, 5, 3.2, 0, 0, 6.29); x.fill(); x.restore(); });
    // 영혼
    spirits.forEach(sp => {
      if(sp.a <= 0) return;
      if(sp.tr && sp.st !== 'saved') sp.tr.forEach(([tx2, ty2], i) => { x.globalAlpha = i / sp.tr.length * .35; x.fillStyle = sp.follow ? '#ffd9a0' : '#bfe3ff'; x.beginPath(); x.arc(tx2, ty2 + 4, 2 + i / sp.tr.length * 4, 0, 6.29); x.fill(); });
      x.save(); x.globalAlpha = sp.a;
      glow(sp.x, sp.y, 26, sp.imp ? 'rgba(255,120,190,.55)' : sp.follow ? 'rgba(255,220,150,.55)' : 'rgba(170,220,255,.45)');
      const bob = Math.sin(now / 300 + sp.ph) * 2;
      x.fillStyle = sp.imp ? '#ffd0e6' : '#f4eefb'; x.beginPath(); x.arc(sp.x, sp.y - 3 + bob, 9, Math.PI, 0); x.lineTo(sp.x + 9, sp.y + 8 + bob);
      for(let k = 0; k < 3; k++) x.lineTo(sp.x + 6 - k * 6, sp.y + (k % 2 ? 11 : 6) + bob);
      x.lineTo(sp.x - 9, sp.y + 8 + bob); x.closePath(); x.fill();
      x.fillStyle = '#241a30'; x.beginPath(); x.arc(sp.x - 3, sp.y - 3 + bob, 1.6, 0, 6.29); x.arc(sp.x + 3, sp.y - 3 + bob, 1.6, 0, 6.29); x.fill();
      x.restore();
    });
    $('#msInk', root).style.width = (ink * 100) + '%';
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);      // 시작 카드 뒤에서 영혼들이 미리 떠다님
  mission.cleanup = () => { ended = true; cancelAnimationFrame(raf); };
  howTo('spirit', () => {
    tStart = performance.now();
    setTimeout(() => { if(!ended){ spirits.push(spawn(3)); spirits.push(spawn(4)); } }, 4000);
    setTimeout(() => { if(!ended){ spirits.push(spawn(5, true)); ghostSay('어? 장난꾸러기 영혼이 나왔어! 분홍빛 영혼은 자꾸 딴 데로 새'); } }, 8000);
    hints([
      { at:40, text:'영혼 바로 옆에서 시작해서 제단까지 끊지 말고 쭉 그어 봐', fn: null },
      { at:80, text:'꽃잎 향을 더 진하게 해 줄게. 멀리서도 따라올 거야', fn: () => { R = 130; altarR = 52; } }
    ]);
  });
  root._dbg = { spirits, altar, Wd, Ht };
}
