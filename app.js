// ===== 공통 유틸 =====
var $ = function(id) { return document.getElementById(id); };
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

// ===== 데이터 저장소: localStorage (users / profiles / currentUser) =====
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

/** profiles: 프로필 객체 배열. 예전 형식({사용자id: 데이터})이면 자동 변환 */
function allProfiles() {
  var a = load('profiles', []);
  if (!Array.isArray(a)) {
    var tid = parseInt(localStorage.getItem('selectedTemplate'), 10) || 1;
    a = Object.keys(a).map(function(k) { return { id: uid(), userId: k, title: '내 프로필', templateId: tid, data: a[k], created: Date.now(), updated: Date.now() }; });
    save('profiles', a);
  }
  return a;
}
function putProfile(p) {
  var all = allProfiles(), i = all.findIndex(function(x) { return x.id === p.id; });
  p.updated = Date.now();
  if (i < 0) all.push(p); else all[i] = p;
  save('profiles', all);
}
function listProfiles(userId) {
  return allProfiles().filter(function(p) { return p.userId === userId; }).sort(function(x, y) { return x.created - y.created; });
}
function newProfileObj(userId, title) {
  return { id: uid(), userId: userId, title: title, templateId: 1, data: {}, created: Date.now(), updated: Date.now() };
}

// ===== 세션 =====
function getUser() { return load('currentUser', null); }
function setUser(u) { save('currentUser', u); }
function checkLogin() { if (!getUser()) location.href = 'login.html'; }
function doLogout() { localStorage.removeItem('currentUser'); location.href = 'index.html'; }

/** 현재 프로필(없으면 자동 생성) */
var cpPromise;
function currentProfile() { return cpPromise || (cpPromise = loadCurrent()); }
async function loadCurrent() {
  var u = getUser(); if (!u) return null;
  var list = listProfiles(u.id);
  if (!list.length) { list = [newProfileObj(u.id, '내 프로필')]; putProfile(list[0]); }
  var p = list.filter(function(x) { return x.id === u.profileId; })[0] || list[0];
  if (u.profileId !== p.id) { u.profileId = p.id; setUser(u); }
  if (p.theme == null) {   // 예전 형식: templateId 2~6 = 색상, 7·8 = 다른 레이아웃
    var o = p.templateId;
    if (o >= 2 && o <= 6) { p.theme = o; p.templateId = 1; }
    else if (o === 7 || o === 8) { p.theme = 1; p.templateId = o - 5; }
    else p.theme = 1;
    putProfile(p);
  }
  return p;
}

// ===== 인증 =====
function doRegister() {
  var name = $('regName').value.trim(), email = $('regEmail').value.trim(), pw = $('regPw').value, msg = $('registerMsg');
  if (!name || !email || !pw) { msg.textContent = '모든 항목을 입력하세요'; return; }
  var users = load('users', []);
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) { msg.textContent = '이미 존재하는 이메일이에요'; return; }
  }
  var user = { id: uid(), name: name, email: email, pw: pw };
  users.push(user); save('users', users);
  var p = newProfileObj(user.id, '내 프로필'); putProfile(p);
  setUser({ id: user.id, name: user.name, profileId: p.id });
  location.href = 'index.html';
}

function doLogin() {
  var email = $('loginEmail').value.trim(), pw = $('loginPw').value, msg = $('loginMsg');
  var user = load('users', []).filter(function(u) { return u.email === email && u.pw === pw; })[0];
  if (!user) { msg.textContent = '이메일 또는 비밀번호가 맞지 않아요'; return; }
  setUser({ id: user.id, name: user.name });
  location.href = 'index.html';
}

function showTab(tab) {
  $('login').style.display = tab === 'login' ? 'block' : 'none';
  $('register').style.display = tab === 'register' ? 'block' : 'none';
  var btns = document.querySelectorAll('.tab-btn');
  btns[0].classList.toggle('active', tab === 'login');
  btns[1].classList.toggle('active', tab === 'register');
}

// ===== 템플릿 (구조는 공통, 색은 CSS .profile-t1~t6) =====
/** 예전 형식(career1~3)도 항목 배열로 변환 */
function itemsOf(p) {
  if (Array.isArray(p.items)) return p.items;
  return [1, 2, 3].map(function(n) { return { title: p['career' + n + 'Title'], desc: p['career' + n + 'Desc'] }; })
    .filter(function(x) { return x.title || x.desc; });
}
function safeUrl(u) { return u ? (/^https?:\/\//.test(u) ? u : 'https://' + u) : ''; }

function buildProfile(cls, p) {
  var url = safeUrl(p.github);
  var skills = (p.skills || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  var cards = itemsOf(p).map(function(it, i) {
    var l = safeUrl(it.link);
    return '<div class="p-card">' +
      (it.image ? '<img class="p-card-img" src="' + esc(it.image) + '" alt="">' : '') +
      '<div class="p-card-title">' + esc(it.title || '경험 ' + (i + 1)) + '</div>' +
      (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') +
      (l ? '<a class="p-link" href="' + esc(l) + '" target="_blank" rel="noopener">링크 열기</a>' : '') +
    '</div>';
  }).join('');
  return '<div class="profile profile-' + cls + '">' +
    '<div class="p-hero"><div class="p-hero-left">' +
      (p.photo ? '<img src="' + esc(p.photo) + '" class="p-photo" alt="">' : '') +
      '<h1>' + esc(p.title || '안녕하세요!') + '</h1><p>' + esc(p.name || '이름을 입력하세요') + '의 프로필이에요</p>' +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">GitHub 바로가기</a>' : '') +
    '</div><div class="p-hero-right"><h2>' + esc(p.name || '이름') + '</h2>' +
      (p.birth ? '<p>' + esc(p.birth) + '</p>' : '') + (p.mobile ? '<p>' + esc(p.mobile) + '</p>' : '') +
      (p.instagram ? '<p>@' + esc(p.instagram) + '</p>' : '') +
    '</div></div><div class="p-section">' +
      (p.bio ? '<h3>소개</h3><p class="p-about">' + esc(p.bio) + '</p>' : '') +
      (skills.length ? '<h3>기술 스택</h3><div class="p-chips">' + skills.map(function(x) { return '<span class="p-chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
      (cards ? '<h3>경험·포트폴리오</h3><div class="p-card-grid">' + cards + '</div>' : '') +
    '</div></div>';
}


/** 레이아웃이 다른 템플릿 ① 사이드 노트: 왼쪽 프로필 칼럼 + 오른쪽 내용 */
function buildSide(cls, p) {
  var url = safeUrl(p.github);
  var skills = (p.skills || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  var rows = itemsOf(p).map(function(it, i) {
    var l = safeUrl(it.link);
    return '<div class="ps-row">' + (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '') +
      '<div><b>' + esc(it.title || '경험 ' + (i + 1)) + '</b>' + (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') +
      (l ? '<a class="p-link" href="' + esc(l) + '" target="_blank" rel="noopener">링크 열기</a>' : '') + '</div></div>';
  }).join('');
  return '<div class="profile profile-' + cls + ' layout-side">' +
    '<aside class="ps-side">' + (p.photo ? '<img src="' + esc(p.photo) + '" class="p-photo" alt="">' : '') +
      '<h2>' + esc(p.name || '이름') + '</h2>' +
      (p.mobile ? '<div class="ps-line">' + esc(p.mobile) + '</div>' : '') + (p.birth ? '<div class="ps-line">' + esc(p.birth) + '</div>' : '') +
      (p.instagram ? '<div class="ps-line">@' + esc(p.instagram) + '</div>' : '') +
      (url ? '<a class="ps-link" href="' + esc(url) + '" target="_blank" rel="noopener">GitHub</a>' : '') +
      (skills.length ? '<h4>기술·강점</h4><div class="p-chips">' + skills.map(function(x) { return '<span class="p-chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
    '</aside><main class="ps-main"><h1>' + esc(p.title || '안녕하세요!') + '</h1>' +
      (p.bio ? '<p class="p-about">' + esc(p.bio) + '</p>' : '') +
      (rows ? '<h3>경험·포트폴리오</h3>' + rows : '') + '</main></div>';
}

/** 레이아웃이 다른 템플릿 ② 갤러리 포트폴리오: 가운데 소개 + 큼직한 작업물이 좌우로 번갈아 */
function buildGallery(cls, p) {
  var url = safeUrl(p.github);
  var skills = (p.skills || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  var works = itemsOf(p).map(function(it, i) {
    var l = safeUrl(it.link);
    return '<div class="pg-work">' +
      (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '<div class="pg-ph">' + ('0' + (i + 1)).slice(-2) + '</div>') +
      '<div><h3>' + esc(it.title || '작업 ' + (i + 1)) + '</h3>' + (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') +
      (l ? '<a class="p-link" href="' + esc(l) + '" target="_blank" rel="noopener">링크 열기</a>' : '') + '</div></div>';
  }).join('');
  var meta = [p.name, p.mobile, p.instagram ? '@' + p.instagram : ''].filter(Boolean).map(esc).join('  ·  ');
  return '<div class="profile profile-' + cls + ' layout-gallery"><header class="pg-head">' +
    (p.photo ? '<img src="' + esc(p.photo) + '" class="p-photo" alt="">' : '') +
    '<h1>' + esc(p.title || '안녕하세요!') + '</h1><div class="pg-meta">' + (meta || '이름을 입력하세요') + '</div>' +
    (p.bio ? '<p class="p-about">' + esc(p.bio) + '</p>' : '') +
    (skills.length ? '<div class="p-chips">' + skills.map(function(x) { return '<span class="p-chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
    (url ? '<a class="p-link" href="' + esc(url) + '" target="_blank" rel="noopener">GitHub</a>' : '') +
    '</header><section class="pg-works">' + works + '</section></div>';
}

// ----- 레이아웃 공통 조각 -----
function chipsHtml(p) {
  var sk = (p.skills || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  return sk.length ? '<div class="p-chips">' + sk.map(function(x) { return '<span class="p-chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '';
}
function linkHtml(it) { var l = safeUrl(it.link); return l ? '<a class="p-link" href="' + esc(l) + '" target="_blank" rel="noopener">링크 열기</a>' : ''; }
function photoHtml(p) { return p.photo ? '<img src="' + esc(p.photo) + '" class="p-photo" alt="">' : ''; }
function imgHtml(it, c) { return it.image ? '<img class="' + c + '" src="' + esc(it.image) + '" alt="">' : ''; }
function metaList(p) { return [p.mobile, p.birth, p.instagram ? '@' + p.instagram : ''].filter(Boolean).map(esc); }
function aboutHtml(p) { return p.bio ? '<p class="p-about">' + esc(p.bio) + '</p>' : ''; }
function numOf(i) { return ('0' + (i + 1)).slice(-2); }
function wrap(cls, lay, inner) { return '<div class="profile profile-' + cls + ' lay-' + lay + '">' + inner + '</div>'; }
function descHtml(it) { return it.desc ? '<p>' + esc(it.desc) + '</p>' : ''; }

/** ④ 타임라인: 세로선을 따라 경험이 이어져요 */
function buildTimeline(cls, p) {
  var li = itemsOf(p).map(function(it, i) {
    return '<li><span class="pt-dot"></span><div class="pt-card">' + imgHtml(it, 'pt-img') + '<b>' + esc(it.title || '경험 ' + (i + 1)) + '</b>' + descHtml(it) + linkHtml(it) + '</div></li>';
  }).join('');
  return wrap(cls, 'timeline', '<header class="pt-head">' + photoHtml(p) + '<div><h1>' + esc(p.title || '안녕하세요!') + '</h1><p>' +
    [esc(p.name || '이름')].concat(metaList(p)).join('  ·  ') + '</p></div></header>' + aboutHtml(p) + chipsHtml(p) + (li ? '<ol class="pt-list">' + li + '</ol>' : ''));
}

/** ⑤ 벤토 보드: 크기가 다른 타일로 정보를 모아 보여줘요 */
function buildBento(cls, p) {
  var tiles = itemsOf(p).map(function(it, i) {
    return '<div class="pb-tile pb-item">' + imgHtml(it, 'pb-bg') + '<div class="pb-cap"><b>' + esc(it.title || '경험 ' + (i + 1)) + '</b>' + descHtml(it) + linkHtml(it) + '</div></div>';
  }).join('');
  return wrap(cls, 'bento', '<div class="pb-grid"><div class="pb-tile pb-intro"><h1>' + esc(p.title || '안녕하세요!') + '</h1>' + aboutHtml(p) + '</div>' +
    '<div class="pb-tile pb-who">' + photoHtml(p) + '<div><b>' + esc(p.name || '이름') + '</b><span>' + metaList(p).join('<br>') + '</span></div></div>' +
    (chipsHtml(p) ? '<div class="pb-tile pb-skill">' + chipsHtml(p) + '</div>' : '') + tiles + '</div>');
}

/** ⑥ 매거진: 큰 타이포와 번호 매긴 목록 */
function buildMag(cls, p) {
  var rows = itemsOf(p).map(function(it, i) {
    return '<div class="pm-row"><span class="pm-no">' + numOf(i) + '</span><div><b>' + esc(it.title || '경험 ' + (i + 1)) + '</b>' + descHtml(it) + linkHtml(it) + '</div>' + imgHtml(it, 'pm-img') + '</div>';
  }).join('');
  return wrap(cls, 'mag', '<header class="pm-head"><div class="pm-kicker">' + esc(p.name || '이름') + '</div><h1>' + esc(p.title || '안녕하세요!') + '</h1>' +
    '<div class="pm-cols">' + (aboutHtml(p) || '<p class="p-about"></p>') + '<div>' + photoHtml(p) + '<div class="pm-meta">' + metaList(p).join('<br>') + '</div></div></div></header>' + chipsHtml(p) + rows);
}

/** ⑦ 터미널: 개발자 느낌의 명령어 화면 */
function buildTerm(cls, p) {
  var out = itemsOf(p).map(function(it, i) {
    return '<div class="pe-out"><span class="pe-k">' + esc(it.title || '경험 ' + (i + 1)) + '</span> ' + (it.desc ? '<span class="pe-v">' + esc(it.desc) + '</span> ' : '') + (safeUrl(it.link) ? '<a href="' + esc(safeUrl(it.link)) + '" target="_blank" rel="noopener">↗ 링크</a>' : '') + '</div>';
  }).join('');
  return wrap(cls, 'term', '<div class="pe-bar"><i></i><i></i><i></i><span>mai — profile.sh</span></div><div class="pe-body">' + photoHtml(p) +
    '<div class="pe-cmd">$ whoami</div><div class="pe-out">' + esc(p.name || '이름') + ' — ' + esc(p.title || '안녕하세요!') + '</div>' +
    (metaList(p).length ? '<div class="pe-cmd">$ contact</div><div class="pe-out">' + metaList(p).join('<br>') + '</div>' : '') +
    (p.bio ? '<div class="pe-cmd">$ cat about.txt</div><div class="pe-out">' + esc(p.bio) + '</div>' : '') +
    (chipsHtml(p) ? '<div class="pe-cmd">$ ls skills/</div>' + chipsHtml(p) : '') + (out ? '<div class="pe-cmd">$ ls works/</div>' + out : '') + '<div class="pe-cmd">$ _</div></div>');
}

/** ⑧ 폴라로이드: 사진첩에 붙인 듯한 카드 */
function buildPolaroid(cls, p) {
  var cards = itemsOf(p).map(function(it, i) {
    return '<figure class="pp-card">' + (it.image ? imgHtml(it, 'pp-img') : '<div class="pp-img pp-ph">' + numOf(i) + '</div>') +
      '<figcaption><b>' + esc(it.title || '경험 ' + (i + 1)) + '</b>' + descHtml(it) + linkHtml(it) + '</figcaption></figure>';
  }).join('');
  return wrap(cls, 'polaroid', '<header class="pp-head">' + photoHtml(p) + '<h1>' + esc(p.title || '안녕하세요!') + '</h1><p>' +
    [esc(p.name || '이름')].concat(metaList(p)).join('  ·  ') + '</p>' + aboutHtml(p) + chipsHtml(p) + '</header><div class="pp-board">' + cards + '</div>');
}

/** ⑨ 링크 모음: 한 줄짜리 버튼 목록 (SNS 링크 페이지 느낌) */
function buildLinks(cls, p) {
  var gh = safeUrl(p.github);
  var items = itemsOf(p).concat(gh ? [{ title: 'GitHub', link: gh }] : []);
  var btns = items.map(function(it, i) {
    var l = safeUrl(it.link), inner = imgHtml(it, 'pl-img') + '<span><b>' + esc(it.title || '링크 ' + (i + 1)) + '</b>' + (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span>';
    return l ? '<a class="pl-btn" href="' + esc(l) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="pl-btn">' + inner + '</div>';
  }).join('');
  return wrap(cls, 'links', '<div class="pl-col">' + photoHtml(p) + '<h1>' + esc(p.name || '이름') + '</h1><p class="pl-sub">' + esc(p.title || '안녕하세요!') + '</p>' + aboutHtml(p) + chipsHtml(p) + btns + '</div>');
}

// ----- 색상 테마 6종 (CSS .profile-t1~t6) × 레이아웃 9종 -----
var THEMES = [
  { id: 1, name: '마이 퍼플', c: '#7d2ae8' }, { id: 2, name: '미드나잇', c: '#1f1b30' }, { id: 3, name: '피치 팝', c: '#ff5c8a' },
  { id: 4, name: '민트 프레시', c: '#00b894' }, { id: 5, name: '오션 블루', c: '#1e6fd9' }, { id: 6, name: '레몬 팝', c: '#ffa94d' }
];
function themeOf(id) { return THEMES.filter(function(x) { return x.id === (id || 1); })[0] || THEMES[0]; }
function mk(id, name, desc, fn) { return { id: id, name: name, preview: desc, render: function(p, th) { return fn('t' + (th || 1), p); } }; }
const templates = [
  mk(1, '히어로', '큰 배너 + 카드', buildProfile),
  mk(2, '사이드 노트', '왼쪽 프로필 + 오른쪽 내용', buildSide),
  mk(3, '갤러리', '큼직한 작업물 중심', buildGallery),
  mk(4, '타임라인', '세로선으로 이어지는 경험', buildTimeline),
  mk(5, '벤토 보드', '크기가 다른 타일 모음', buildBento),
  mk(6, '매거진', '큰 타이포 + 번호 목록', buildMag),
  mk(7, '터미널', '개발자 명령어 화면', buildTerm),
  mk(8, '폴라로이드', '사진첩 같은 카드', buildPolaroid),
  mk(9, '링크 모음', '한 줄 버튼 링크 페이지', buildLinks)
];
function svgImg(a, b) {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="400" height="250" fill="url(#g)"/></svg>');
}
var SAMPLE = { title: '안녕하세요!', name: '김마이', birth: '2000.01.01', mobile: '010-1234-5678', instagram: 'my_profile', github: 'github.com/mai',
  bio: '만드는 걸 좋아하는 디자이너 지망생이에요.', skills: 'HTML, CSS, JavaScript, Figma',
  items: [
    { title: '졸업 작품', desc: '웹 디자인과 프론트엔드', link: 'example.com', image: svgImg('#21afc0', '#7d2ae8') },
    { title: '프로젝트', desc: '프로필 페이지 제작', image: svgImg('#ff9a3d', '#ff5c8a') },
    { title: '관심 분야', desc: 'UI/UX, 브랜딩' }
  ] };
var tplSel = 1, themeSel = 1;

// ===== 템플릿 선택 페이지 (사이드바 + 미리보기 그리드) =====
async function renderTemplates() {
  if (!$('templateGrid')) return;
  var p = await currentProfile();
  tplSel = p.templateId || 1; themeSel = p.theme || 1;
  await renderProfileBar();
  drawTemplates();
}
function drawTemplates() {
  $('catList').innerHTML = THEMES.map(function(th) {
    return '<button class="cat-item' + (th.id === themeSel ? ' active' : '') + '" onclick="setTheme(' + th.id + ')"><span><i class="sw" style="background:' + th.c + '"></i>' + th.name + '</span></button>';
  }).join('');
  $('templateGrid').innerHTML = templates.map(function(t) {
    return '<div class="tpl-card' + (t.id === tplSel ? ' selected' : '') + '" onclick="selectTemplate(' + t.id + ')">' +
      '<div class="tpl-thumb"><div class="tpl-scale">' + t.render(SAMPLE, themeSel) + '</div></div>' +
      '<div class="tpl-info"><b>' + t.name + '</b><span>' + t.preview + '</span></div></div>';
  }).join('');
  fitThumbs();
}
function fitThumbs() {
  var th = document.querySelectorAll('.tpl-thumb');
  for (var i = 0; i < th.length; i++) {
    var s = th[i].clientWidth / 1000;
    th[i].firstChild.style.transform = 'scale(' + s + ')';
    th[i].style.height = Math.round(th[i].clientWidth * 0.78) + 'px';
  }
}
window.addEventListener('resize', fitThumbs);
async function selectTemplate(id) {
  var p = await currentProfile();
  p.templateId = id; putProfile(p);
  tplSel = id; drawTemplates();
}
async function setTheme(id) {
  var p = await currentProfile();
  p.theme = id; putProfile(p);
  themeSel = id; drawTemplates();
}
function goToEdit() { location.href = 'edit.html'; }

// ===== 프로필 여러 개 관리 =====
async function renderProfileBar() {
  var sel = $('profileSelect'); if (!sel) return;
  var cur = await currentProfile(), list = await listProfiles(getUser().id);
  sel.innerHTML = list.map(function(p) { return '<option value="' + p.id + '"' + (p.id === cur.id ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('');
  if ($('profileTitle')) $('profileTitle').value = cur.title;
}
function switchProfile(id) { var u = getUser(); u.profileId = id; setUser(u); location.reload(); }
async function newProfile() {
  var u = getUser(), n = (await listProfiles(u.id)).length;
  var p = newProfileObj(u.id, '프로필 ' + (n + 1)); await putProfile(p);
  u.profileId = p.id; setUser(u); location.reload();
}
async function deleteProfile() {
  var u = getUser(), list = await listProfiles(u.id);
  if (list.length < 2) { alert('프로필이 하나뿐이라 삭제할 수 없어요'); return; }
  if (!confirm('이 프로필을 삭제할까요?')) return;
  save('profiles', allProfiles().filter(function(p) { return p.id !== u.profileId; }));
  u.profileId = list.filter(function(p) { return p.id !== u.profileId; })[0].id; setUser(u); location.reload();
}

// ===== 프로필 저장 / 불러오기 / 렌더링 =====
var FIELDS = ['title','name','birth','mobile','bio','github','instagram','skills'];
var editItems = [];

/** 이미지는 긴 변 max(px) JPEG로 줄여 저장 */
function readPhoto(file, max) {
  max = max || 480;
  return new Promise(function(res) {
    var r = new FileReader();
    r.onload = function() {
      var im = new Image();
      im.onload = function() {
        var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = im.width * s; c.height = im.height * s;
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = function() { res(r.result); };
      im.src = r.result;
    };
    r.onerror = function() { res(''); };
    r.readAsDataURL(file);
  });
}

// ----- 경험·포트폴리오 항목 (제목 / 설명 / 링크 / 이미지) -----
function itemHtml(it, i) {
  return '<div class="item-card">' +
    '<div class="item-head"><b>경험 ' + (i + 1) + '</b><button class="item-del" onclick="removeItem(' + i + ')">삭제</button></div>' +
    '<input type="text" placeholder="제목 (예: 졸업 작품, 인턴십)" value="' + esc(it.title) + '" oninput="editItems[' + i + '].title=this.value">' +
    '<textarea placeholder="설명" oninput="editItems[' + i + '].desc=this.value">' + esc(it.desc) + '</textarea>' +
    '<input type="text" placeholder="링크 (포트폴리오, 노션, 깃허브 등)" value="' + esc(it.link) + '" oninput="editItems[' + i + '].link=this.value">' +
    '<label class="file-label">이미지 추가<input type="file" accept="image/*" onchange="pickItemImage(' + i + ',this)"></label>' +
    (it.image ? '<img class="item-thumb" src="' + esc(it.image) + '" alt=""><button class="btn-sub" onclick="clearItemImage(' + i + ')">이미지 삭제</button>' : '') +
  '</div>';
}
function renderItems() { $('items').innerHTML = editItems.map(itemHtml).join(''); }
function addItem() { editItems.push({ title: '', desc: '', link: '', image: '' }); renderItems(); }
function removeItem(i) { editItems.splice(i, 1); renderItems(); }
async function pickItemImage(i, el) { if (el.files[0]) { editItems[i].image = await readPhoto(el.files[0], 900); renderItems(); } }
function clearItemImage(i) { editItems[i].image = ''; renderItems(); }

async function saveProfile() {
  try {
    var p = await currentProfile();
    if (!p) { location.href = 'login.html'; return; }
    var data = {};
    FIELDS.forEach(function(f) { data[f] = $(f).value || ''; });
    var file = $('photo') && $('photo').files[0];
    data.photo = file ? await readPhoto(file) : (p.data.photo || '');
    data.items = editItems.filter(function(x) { return x.title || x.desc || x.link || x.image; });
    p.data = data;
    p.title = $('profileTitle').value.trim() || p.title;
    putProfile(p);
    alert('저장되었습니다!');
    location.href = 'profile.html';
  } catch (e) {
    alert('저장에 실패했어요: ' + e.message);
  }
}

async function loadProfile() {
  var p = await currentProfile(); if (!p) return;
  FIELDS.forEach(function(f) { if ($(f) && p.data[f]) $(f).value = p.data[f]; });
  editItems = itemsOf(p.data).map(function(x) { return { title: x.title || '', desc: x.desc || '', link: x.link || '', image: x.image || '' }; });
  if (!editItems.length) editItems.push({ title: '', desc: '', link: '', image: '' });
  renderItems();
  if (p.data.photo && $('photoPrev')) { $('photoPrev').src = p.data.photo; $('photoPrev').style.display = 'block'; }
  var t = templates.filter(function(x) { return x.id === p.templateId; })[0] || templates[0];
  if ($('tplName')) $('tplName').textContent = t.name + ' · ' + themeOf(p.theme).name;
}

async function renderProfile() {
  var p = await currentProfile();
  if (!p) { location.href = 'login.html'; return; }
  var t = templates.filter(function(x) { return x.id === p.templateId; })[0] || templates[0];
  if ($('profileOutput')) $('profileOutput').innerHTML = t.render(p.data, p.theme);
}


// ===== 상단 메뉴(로그인 상태별 우측 버튼) =====
function renderNav() {
  var cur = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function(a) { if (a.getAttribute('href') === cur) a.classList.add('on'); });
  var el = $('navAuth'); if (!el) return;
  el.innerHTML = getUser()
    ? '<a href="#" onclick="doLogout();return false">로그아웃</a><a class="btn-nav" href="myprofiles.html">내 프로필</a>'
    : '<a href="login.html">로그인</a><a class="btn-nav" href="login.html#register">회원가입</a>';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav); else renderNav();

// ===== 내 프로필 (사이드바 목록 + 미리보기 + 수정) =====
function tplOf(id) { return templates.filter(function(x) { return x.id === id; })[0] || templates[0]; }
async function renderMyProfiles() {
  var u = getUser(), cur = await currentProfile(), list = listProfiles(u.id);
  $('mineList').innerHTML = list.map(function(p) {
    return '<button class="mine-item' + (p.id === cur.id ? ' active' : '') + '" onclick="selectMine(\'' + p.id + '\')"><b>' + esc(p.title) + '</b><span>' +
      tplOf(p.templateId).name + ' · ' + themeOf(p.theme).name + ' · ' + new Date(p.updated).toLocaleDateString('ko-KR') + '</span></button>';
  }).join('');
  $('mineTitle').textContent = cur.title;
  $('mineMeta').textContent = tplOf(cur.templateId).name + ' · ' + themeOf(cur.theme).name;
  $('mineOutput').innerHTML = tplOf(cur.templateId).render(cur.data, cur.theme);
}
function selectMine(id) { var u = getUser(); u.profileId = id; setUser(u); cpPromise = null; renderMyProfiles(); }
function editMine() { location.href = 'edit.html'; }
function changeTemplateMine() { location.href = 'template.html'; }
async function renameMine() {
  var p = await currentProfile(), n = prompt('프로필 이름', p.title);
  if (n && n.trim()) { p.title = n.trim(); putProfile(p); renderMyProfiles(); }
}

// ===== 홈: 겹쳐 놓은 템플릿 콜라주 =====
function renderCollage() {
  var el = $('collage'); if (!el) return;
  el.innerHTML = [[1, 1], [5, 4], [8, 3]].map(function(x) {
    var t = tplOf(x[0]);
    return '<div class="tpl-card" onclick="location.href=\'template.html\'"><div class="tpl-thumb"><div class="tpl-scale">' + t.render(SAMPLE, x[1]) + '</div></div>' +
      '<div class="tpl-info"><b>' + t.name + '</b><span>' + t.preview + '</span></div></div>';
  }).join('');
  fitThumbs();
}