// SWE Academy app engine
(() => {
  'use strict';

  const STORE_KEY = 'swe-academy:v3';

  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const SEGMENT_BLOCKS = 5;

  const state = {
    completed: new Set(),
    challengesDone: new Set(),
    projectStepsDone: new Set(),
    openModules: new Set(),
    currentModuleId: null,
    currentLessonId: null,
    currentView: 'lessons',
    currentProjectId: null,
    currentStepId: null,
    currentCheatId: null,
    currentCapstoneModule: null,
    currentChallengeId: null,
    notes: {},
    xp: 0,
    streak: { count: 0, lastDay: null, monthKey: '', freezesLeft: 1 },
    fc: {},
    onboardingDone: false,
    learnGoal: 'steady30',
    learnerName: '',
    lessonSeg: {},
    badgesUnlocked: new Set(),
    capstoneItems: new Set(),
    reviewCountTotal: 0,
  };

  function load() {
    let raw = localStorage.getItem(STORE_KEY);
    if (!raw) raw = localStorage.getItem('swe-academy:v2');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      state.completed       = new Set(data.completed || []);
      state.challengesDone  = new Set(data.challengesDone || []);
      state.projectStepsDone = new Set(data.projectStepsDone || []);
      state.openModules     = new Set(data.openModules || []);
      state.currentModuleId = data.currentModuleId || null;
      state.currentLessonId = data.currentLessonId || null;
      state.currentView     = data.currentView || 'lessons';
      state.notes           = data.notes || {};
      state.xp              = data.xp || 0;
      state.fc              = data.fc || {};
      state.onboardingDone = !!data.onboardingDone;
      state.learnGoal      = data.learnGoal || 'steady30';
      state.learnerName    = data.learnerName || '';
      state.lessonSeg      = data.lessonSeg || {};
      state.badgesUnlocked = new Set(data.badgesUnlocked || []);
      state.capstoneItems  = new Set(data.capstoneItems || []);
      state.reviewCountTotal = data.reviewCountTotal || 0;
      const st = data.streak || {};
      state.streak = {
        count: st.count || 0,
        lastDay: st.lastDay || null,
        monthKey: st.monthKey || '',
        freezesLeft: st.freezesLeft !== undefined ? st.freezesLeft : 1,
      };
    } catch (_) {}
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      completed: [...state.completed],
      challengesDone: [...state.challengesDone],
      projectStepsDone: [...state.projectStepsDone],
      openModules: [...state.openModules],
      currentModuleId: state.currentModuleId,
      currentLessonId: state.currentLessonId,
      currentView: state.currentView,
      notes: state.notes,
      xp: state.xp,
      streak: state.streak,
      fc: state.fc,
      onboardingDone: state.onboardingDone,
      learnGoal: state.learnGoal,
      learnerName: state.learnerName,
      lessonSeg: state.lessonSeg,
      badgesUnlocked: [...state.badgesUnlocked],
      capstoneItems: [...state.capstoneItems],
      reviewCountTotal: state.reviewCountTotal,
    }));
  }

  // ---------- Helpers ----------
  function key(moduleId, lessonId) { return `${moduleId}/${lessonId}`; }
  function totalLessons() { return CURRICULUM.reduce((s, m) => s + m.lessons.length, 0); }
  function completedInModule(mod) { return mod.lessons.filter(l => state.completed.has(key(mod.id, l.id))).length; }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function findLessonAdjacent(direction) {
    const flat = [];
    CURRICULUM.forEach(m => m.lessons.forEach(l => flat.push({ moduleId: m.id, lessonId: l.id })));
    const idx = flat.findIndex(x => x.moduleId === state.currentModuleId && x.lessonId === state.currentLessonId);
    if (idx < 0) return null;
    const ni = idx + direction;
    if (ni < 0 || ni >= flat.length) return null;
    return flat[ni];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }

  function daysBetween_iso(aISO, bISO) {
    return Math.round((new Date(bISO) - new Date(aISO)) / 86400000);
  }

  function badgeSnapshot() {
    return {
      completed: state.completed,
      challengesDone: state.challengesDone,
      projectStepsDone: state.projectStepsDone,
      streak: state.streak,
      capstoneItems: state.capstoneItems,
      reviewCountTotal: state.reviewCountTotal,
    };
  }

  function unlockBadges() {
    if (typeof BADGES === 'undefined') return;
    const snap = badgeSnapshot();
    let any = false;
    for (const b of BADGES) {
      if (state.badgesUnlocked.has(b.id)) continue;
      try {
        if (b.test(snap)) {
          state.badgesUnlocked.add(b.id);
          any = true;
          showToast(`Badge: ${b.icon} ${b.title}`);
        }
      } catch (_) {}
    }
    if (any) save();
  }

  function getNextIncompleteLesson() {
    for (const m of CURRICULUM) {
      for (const l of m.lessons) {
        if (!state.completed.has(key(m.id, l.id))) return { moduleId: m.id, lessonId: l.id, title: l.title, moduleTitle: m.title };
      }
    }
    return null;
  }

  function getFirstUnsolvedChallenge() {
    return CHALLENGES.find(c => !state.challengesDone.has(c.id)) || null;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Bump ?v when sw.js CACHE name changes — avoids serving an old frozen worker indefinitely.
    navigator.serviceWorker.register('./sw.js?v=v4').then(reg => reg.update()).catch(() => {});
  }

  // ---------- XP / Streak ----------
  function awardXp(amount, label) {
    state.xp += amount;
    bumpStreak();
    save();
    unlockBadges();
    showToast(`+${amount} XP${label ? ' · ' + label : ''}`);
    renderSidebar();
  }

  function bumpStreak() {
    const today = todayStr();
    const monthKey = today.slice(0, 7);
    if (state.streak.monthKey !== monthKey) {
      state.streak.monthKey = monthKey;
      state.streak.freezesLeft = 1;
    }
    if (state.streak.lastDay === today) return;

    if (!state.streak.lastDay) {
      state.streak.count = 1;
      state.streak.lastDay = today;
      return;
    }

    const diff = daysBetween_iso(state.streak.lastDay, today);
    if (diff === 1) {
      state.streak.count += 1;
      state.streak.lastDay = today;
      return;
    }
    if (diff === 2 && state.streak.freezesLeft > 0 && state.streak.count > 0) {
      state.streak.freezesLeft -= 1;
      state.streak.lastDay = today;
      showToast('Streak grace: you skipped one day — kept your streak (1× per month).');
      return;
    }
    state.streak.count = 1;
    state.streak.lastDay = today;
  }

  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'xp-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /** Stops clicks on #home / #learn from stealing taps meant for modals when stacking is weird across browsers/PWA shells. */
  function syncModalAppBlock() {
    const appEl = $('#app');
    if (!appEl) return;
    const obEl = $('#onboardingOverlay');
    const certEl = $('#certOverlay');
    const obOpen = obEl && obEl.hidden === false;
    const certOpen = certEl && certEl.hidden === false;
    appEl.style.pointerEvents = obOpen || certOpen ? 'none' : '';
  }

  // ---------- Home ----------
  function renderHome() {
    $('#todayReviewBtn').hidden = dueFlashcards().length === 0;
    const tf = buildTodayFocus();
    const host = $('#todayPanelHost');
    if (host) {
      host.innerHTML = tf.html;
      $$('[data-today-idx]', host).forEach(el => {
        const i = +el.dataset.todayIdx;
        el.onclick = () => { try { tf.pick[i].fn(); } catch (_) {} };
      });
      const eg = $('#editGoalQuick');
      if (eg) eg.onclick = () => { if (window.__openOnboarding) window.__openOnboarding(); };
    }

    const grid = $('#moduleGrid');
    grid.innerHTML = CURRICULUM.map((m, i) => {
      const total = m.lessons.length;
      const done = completedInModule(m);
      return `
        <div class="home-card" data-module="${m.id}">
          <div class="hc-icon" style="background: ${m.color}22; color: ${m.color}; border: 1px solid ${m.color}55;">${m.icon}</div>
          <h3 class="hc-title">${i + 1}. ${m.title}</h3>
          <p class="hc-desc">${m.desc}</p>
          <div class="hc-meta">
            <span>${total} lessons</span>
            <span>${done}/${total} complete</span>
          </div>
        </div>
      `;
    }).join('');
    $$('.home-card', grid).forEach(card => {
      card.addEventListener('click', () => openModule(card.dataset.module, true));
    });

    const total = totalLessons();
    const done = state.completed.size;
    const pct = total ? Math.round(done / total * 100) : 0;
    const due = dueFlashcards().length;
    $('#homeStats').innerHTML = `
      <div><strong style="color:#fff">${total}</strong> lessons</div>
      <div><strong style="color:#fff">${done}</strong> complete</div>
      <div><strong style="color:#fff">${pct}%</strong> overall</div>
      <div><strong style="color:#fff">${state.xp}</strong> XP</div>
      <div><strong style="color:#fff">${state.streak.count}</strong>🔥 streak</div>
      <div><strong style="color:#86efac">${due}</strong> cards due</div>
    `;

    $('#resumeBtn').hidden = !(state.currentModuleId && state.currentLessonId);

    renderBadgesStrip();
    renderCommunityHost();

    $('#todayReviewBtn').onclick = () => { showLearn(); switchView('review'); };
    $('#openCapstonesBtn').onclick = () => {
      state.currentCapstoneModule = null;
      save();
      showLearn();
      switchView('capstones');
    };
    $('#openCertBtn').onclick = () => {
      fillCertificate();
      $('#certOverlay').hidden = false;
      syncModalAppBlock();
    };
    $('#certCloseBtn').onclick = () => { $('#certOverlay').hidden = true; syncModalAppBlock(); };
    $('#certPrintBtn').onclick = () => window.print();

    $('#openGoalsBtn').onclick = () => { if (window.__openOnboarding) window.__openOnboarding(); };

    $$('.he-card').forEach(c => {
      c.onclick = () => {
        showLearn();
        switchView(c.dataset.go);
      };
    });

    unlockBadges();
    syncModalAppBlock();
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    const total = totalLessons();
    const done = state.completed.size;
    const pct = total ? (done / total * 100) : 0;
    $('#overallFill').style.width = `${pct}%`;
    $('#overallPct').textContent = `${Math.round(pct)}%`;
    $('#xpVal').textContent = state.xp;

    const sr = `${state.streak.count > 0
      ? `<span class="streak-pill">🔥 ${state.streak.count}-day streak</span>`
      : `<span style="color:var(--text-faint);font-size:12px;">Earn XP to start a streak</span>`}`
      + `<span style="color:var(--text-faint);font-size:11px;margin-left:8px;">· Grace: ${state.streak.freezesLeft}/mo</span>`;
    $('#streakRow').innerHTML = sr;

    $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === state.currentView));
    $('#modulesNav').innerHTML = renderSidebarBody();
    bindSidebarBody();
  }

  function renderSidebarBody() {
    const v = state.currentView;
    if (v === 'lessons') {
      return CURRICULUM.map((m, i) => {
        const isOpen = state.openModules.has(m.id);
        const completed = completedInModule(m);
        const total = m.lessons.length;
        return `
          <div class="module-item ${isOpen ? 'open' : ''}" data-module="${m.id}">
            <div class="module-head" data-toggle>
              <span class="module-dot" style="background: ${m.color}"></span>
              <span class="module-name">${i + 1}. ${m.title}</span>
              <span class="module-pct">${completed}/${total}</span>
              <span class="module-toggle">▶</span>
            </div>
            <ul class="lessons-list">
              ${m.lessons.map(l => {
                const isDone = state.completed.has(key(m.id, l.id));
                const isActive = state.currentModuleId === m.id && state.currentLessonId === l.id;
                return `
                  <li class="lesson-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}"
                      data-module="${m.id}" data-lesson="${l.id}">
                    <span class="lesson-check">${isDone ? '✓' : ''}</span>
                    <span>${l.title}</span>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        `;
      }).join('');
    }
    if (v === 'practice') {
      const grouped = {};
      CHALLENGES.forEach(c => { (grouped[c.topic] ||= []).push(c); });
      return Object.entries(grouped).map(([topic, list]) => `
        <div class="module-item open">
          <div class="module-head">
            <span class="module-dot" style="background: var(--accent)"></span>
            <span class="module-name">${topicLabel(topic)}</span>
            <span class="module-pct">${list.filter(c => state.challengesDone.has(c.id)).length}/${list.length}</span>
          </div>
          <ul class="lessons-list">
            ${list.map(c => `
              <li class="lesson-item ${state.challengesDone.has(c.id) ? 'done' : ''} ${(state.currentChallengeId === c.id) ? 'active' : ''}"
                  data-challenge="${c.id}">
                <span class="lesson-check">${state.challengesDone.has(c.id) ? '✓' : ''}</span>
                <span>${c.title}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('');
    }
    if (v === 'projects') {
      return PROJECTS.map(p => {
        const isOpen = state.currentProjectId === p.id;
        const done = p.steps.filter(s => state.projectStepsDone.has(`${p.id}/${s.id}`)).length;
        return `
          <div class="module-item ${isOpen ? 'open' : ''}" data-project="${p.id}">
            <div class="module-head" data-pj-toggle>
              <span class="module-dot" style="background:${p.color}"></span>
              <span class="module-name">${p.title.replace(/^Project\s*\d+\s*—\s*/, '')}</span>
              <span class="module-pct">${done}/${p.steps.length}</span>
              <span class="module-toggle">▶</span>
            </div>
            <ul class="lessons-list">
              ${p.steps.map(s => `
                <li class="lesson-item ${state.projectStepsDone.has(`${p.id}/${s.id}`) ? 'done' : ''} ${(state.currentStepId === s.id && state.currentProjectId === p.id) ? 'active' : ''}"
                    data-project="${p.id}" data-step="${s.id}">
                  <span class="lesson-check">${state.projectStepsDone.has(`${p.id}/${s.id}`) ? '✓' : ''}</span>
                  <span>${s.title}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }).join('');
    }
    if (v === 'cheats') {
      return `
        <div class="module-item open">
          <div class="module-head">
            <span class="module-dot" style="background:var(--c-foundation)"></span>
            <span class="module-name">Reference</span>
          </div>
          <ul class="lessons-list">
            ${CHEATSHEETS.map(c => `
              <li class="lesson-item ${state.currentCheatId === c.id ? 'active' : ''}" data-cheat="${c.id}">
                <span class="lesson-check"></span>
                <span>${c.title}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    if (v === 'review') {
      const due = dueFlashcards().length;
      const total = FLASHCARDS.length;
      return `
        <div class="module-item open">
          <div class="module-head">
            <span class="module-dot" style="background:var(--accent-2)"></span>
            <span class="module-name">Spaced repetition</span>
          </div>
          <ul class="lessons-list" style="padding: 8px 12px; list-style:none; color: var(--text-dim); font-size: 13px;">
            <li style="padding:8px;background:rgba(236,72,153,0.08);border-radius:8px;margin-bottom:8px;border-left:3px solid #ec4899;">
              <strong style="color:#fff">Due today: ${due}</strong> · Open <em>Today's focus</em> on home to review first.
            </li>
            <li style="padding:4px 0;">Total cards: <strong style="color:#fff">${total}</strong></li>
            <li style="padding:4px 0;">Scheduled in your deck: <strong style="color:#fff">${Object.keys(state.fc).length}</strong></li>
          </ul>
        </div>
      `;
    }
    if (v === 'capstones' && typeof CAPSTONES !== 'undefined') {
      return `
        <div class="module-item open">
          <div class="module-head">
            <span class="module-dot" style="background:#ec4899"></span>
            <span class="module-name">Ship something real</span>
          </div>
          <ul class="lessons-list">
            ${CAPSTONES.map(c => {
              const tot = c.checklist.length;
              const n = c.checklist.filter(x => state.capstoneItems.has(`${c.moduleId}/${x.id}`)).length;
              const mt = (CURRICULUM.find(m => m.id === c.moduleId) || {}).title || c.moduleId;
              return `
                <li class="lesson-item ${state.currentCapstoneModule === c.moduleId ? 'active' : ''}" data-capstone-mod="${c.moduleId}">
                  <span class="lesson-check">${n === tot && tot ? '✓' : ''}</span>
                  <span>${escapeHtml(mt)} capstone</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;
    }
    return '';
  }

  function topicLabel(t) {
    return ({ js: 'JavaScript', algo: 'Algorithms', bug: 'Find the Bug', api: 'APIs', db: 'Databases' })[t] || t;
  }

  function bindSidebarBody() {
    const nav = $('#modulesNav');
    nav.onclick = (e) => {
      const head = e.target.closest('[data-toggle]');
      const lessonItem = e.target.closest('[data-lesson]');
      const challengeItem = e.target.closest('[data-challenge]');
      const cheatItem = e.target.closest('[data-cheat]');
      const stepItem = e.target.closest('[data-step]');
      const pjToggle = e.target.closest('[data-pj-toggle]');

      if (head) {
        const moduleId = head.parentElement.dataset.module;
        if (state.openModules.has(moduleId)) state.openModules.delete(moduleId);
        else state.openModules.add(moduleId);
        save();
        renderSidebar();
      } else if (pjToggle) {
        const id = pjToggle.parentElement.dataset.project;
        state.currentProjectId = state.currentProjectId === id ? null : id;
        save();
        renderSidebar();
      } else if (lessonItem) {
        openLesson(lessonItem.dataset.module, lessonItem.dataset.lesson);
      } else if (challengeItem) {
        openChallenge(challengeItem.dataset.challenge);
      } else if (cheatItem) {
        openCheat(cheatItem.dataset.cheat);
      } else if (stepItem) {
        openProjectStep(stepItem.dataset.project, stepItem.dataset.step);
      } else if (e.target.closest('[data-capstone-mod]')) {
        const capItem = e.target.closest('[data-capstone-mod]');
        openCapstoneModule(capItem.dataset.capstoneMod);
      }
    };

    $$('.nav-tab').forEach(tab => {
      tab.onclick = () => switchView(tab.dataset.view);
    });
  }

  // ---------- View switching ----------
  function switchView(view) {
    state.currentView = view;
    save();
    renderSidebar();
    if (view === 'lessons') {
      if (state.currentModuleId && state.currentLessonId) renderLesson(state.currentModuleId, state.currentLessonId);
      else renderViewIntro('Lessons', 'Pick a module from the sidebar to start.');
    } else if (view === 'practice') {
      renderPractice();
    } else if (view === 'projects') {
      renderProjects();
    } else if (view === 'cheats') {
      renderCheats();
    } else if (view === 'review') {
      renderReview();
    } else if (view === 'capstones') {
      renderCapstonesView();
    }
  }

  function renderViewIntro(title, sub) {
    $('#content').innerHTML = `
      <header class="view-header">
        <h1 class="view-title">${title}</h1>
        <p class="view-sub">${sub}</p>
      </header>
    `;
  }

  function goalLabel(g) {
    return ({ casual10: '~10 min / day', steady30: '~30 min / day', job12: 'Job track (~12 mo)' })[g] || g;
  }

  function buildTodayFocus() {
    const dueN = dueFlashcards().length;
    const next = getNextIncompleteLesson();
    const ch = getFirstUnsolvedChallenge();
    const goal = state.learnGoal || 'steady30';
    const rows = [];
    rows.push({
      icon: '🧠',
      title: dueN ? `${dueN} flashcard${dueN === 1 ? '' : 's'} due (spaced repetition)` : 'Flashcards caught up — tap to open Review',
      sub: 'Due cards always show first — better than a gimmick streak.',
      fn: () => { showLearn(); switchView('review'); },
    });
    if (next) {
      rows.push({
        icon: '📖', title: next.title, sub: next.moduleTitle,
        fn: () => openLesson(next.moduleId, next.lessonId),
      });
    }
    if ((goal === 'steady30' || goal === 'job12') && ch) {
      rows.push({
        icon: '⚡', title: `Challenge: ${ch.title}`, sub: 'Auto-graded in Practice',
        fn: () => { showLearn(); openChallenge(ch.id); },
      });
    }
    if (goal === 'job12' && typeof CAPSTONES !== 'undefined') {
      for (const c of CAPSTONES) {
        const miss = c.checklist.find(it => !state.capstoneItems.has(`${c.moduleId}/${it.id}`));
        if (miss) {
          rows.push({
            icon: '✅', title: 'Capstone checklist', sub: miss.label.slice(0, 100) + (miss.label.length > 100 ? '…' : ''),
            fn: () => { showLearn(); switchView('capstones'); openCapstoneModule(c.moduleId); },
          });
          break;
        }
      }
    }
    const maxRows = goal === 'casual10' ? 2 : 4;
    const pick = rows.slice(0, maxRows);
    const html = `
      <div class="today-panel">
        <div class="tp-head">
          <div>
            <div class="tp-title">Today's focus — due review first</div>
            <div class="tp-pill">${goalLabel(goal)}${state.learnerName ? ` · Hi, <strong style="color:#e8eaf2">${escapeHtml(state.learnerName)}</strong>` : ''}</div>
          </div>
          <button type="button" class="btn-copy" id="editGoalQuick">Edit goal</button>
        </div>
        <div class="tp-row">
          ${pick.map((r, i) => `
            <div class="today-action" data-today-idx="${i}">
              <span class="ta-icon">${r.icon}</span>
              <div><div class="ta-k">${escapeHtml(r.title)}</div><div class="ta-d">${escapeHtml(r.sub)}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return { html, pick };
  }

  function renderCommunityHost() {
    const host = $('#communityHost');
    if (!host || typeof COMMUNITY === 'undefined') return;
    const cm = COMMUNITY.byModule || {};
    host.innerHTML = `
      <h3>${escapeHtml(COMMUNITY.label || 'Community')}</h3>
      <p>${COMMUNITY.blurb || ''}</p>
      <p style="font-size:13px;margin-bottom:12px;">
        <a href="${COMMUNITY.hub.url}" target="_blank" rel="noopener" style="color:#a78bfa;">${escapeHtml(COMMUNITY.hub.label)}</a>
      </p>
      <div class="comm-grid">
        ${CURRICULUM.map(m => {
          const li = cm[m.id] || COMMUNITY.hub;
          return `<a href="${li.url}" target="_blank" rel="noopener">${escapeHtml(m.title)} · ${escapeHtml(li.label)}</a>`;
        }).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-faint);margin-top:12px;margin-bottom:0;">Replace URLs in community.js with your Discord invite or repo Discussions — no lock-in.</p>
    `;
  }

  function renderBadgesStrip() {
    const el = $('#badgesStrip');
    if (!el || typeof BADGES === 'undefined') return;
    el.innerHTML = BADGES.map(b => `
      <span class="badge-chip ${state.badgesUnlocked.has(b.id) ? 'unlocked' : ''}" title="${escapeHtml(b.desc)}">${b.icon} ${escapeHtml(b.title)}</span>
    `).join('');
  }

  function openCapstoneModule(moduleId) {
    state.currentCapstoneModule = moduleId;
    state.currentView = 'capstones';
    save();
    showLearn();
    renderSidebar();
    renderCapstoneDetail(moduleId);
  }

  function renderCapstonesView() {
    if (state.currentCapstoneModule && typeof CAPSTONES !== 'undefined') {
      renderCapstoneDetail(state.currentCapstoneModule);
      return;
    }
    renderCapstonesHub();
  }

  function renderCapstonesHub() {
    if (typeof CAPSTONES === 'undefined') return renderViewIntro('Capstones', 'No capstone data.');
    $('#content').innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Job-signal capstones</h1>
        <p class="view-sub">Each module ends with checklist items employers can verify in GitHub — not in a walled garden. Check boxes as you ship; copy the README template into your repo.</p>
      </header>
      <div class="list-grid" style="margin-top:8px;">
        ${CAPSTONES.map(c => {
          const tot = c.checklist.length;
          const n = c.checklist.filter(x => state.capstoneItems.has(`${c.moduleId}/${x.id}`)).length;
          const mt = (CURRICULUM.find(m => m.id === c.moduleId) || {}).title || c.moduleId;
          return `
            <div class="list-card ${n === tot ? 'done' : ''}" data-open-cap="${c.moduleId}">
              <span class="lc-tag" style="background:#ec489922;color:#ec4899;">CAPSTONE</span>
              <div>
                <div class="lc-title">${escapeHtml(mt)}</div>
                <div class="lc-desc">${escapeHtml(c.title)}</div>
              </div>
              <div class="lc-meta">${n}/${tot}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    $$('[data-open-cap]').forEach(el => { el.onclick = () => openCapstoneModule(el.dataset.openCap); });
  }

  function renderCapstoneDetail(moduleId) {
    const c = CAPSTONES.find(x => x.moduleId === moduleId);
    if (!c) return renderCapstonesHub();
    const mt = (CURRICULUM.find(m => m.id === c.moduleId) || {}).title || moduleId;
    $('#content').innerHTML = `
      <header class="view-header">
        <div class="lesson-crumbs">Capstone · ${escapeHtml(mt)}</div>
        <h1 class="view-title">${escapeHtml(c.title)}</h1>
        <p class="view-sub cap-intro">${c.intro}</p>
        <button type="button" class="nav-btn" id="capBackHub">← All capstones</button>
      </header>
      <div class="rubric" style="margin-bottom:20px;">
        <h4>Checklist (checked items save locally)</h4>
        <div style="padding:8px 16px 16px;">
          ${c.checklist.map(item => {
            const ck = `${c.moduleId}/${item.id}`;
            const idSafe = ck.replace(/[^a-zA-Z0-9]/g, '_');
            const on = state.capstoneItems.has(ck);
            return `
              <div class="cap-check">
                <input type="checkbox" id="ck-${idSafe}" data-cap-ck="${escapeHtml(ck)}" ${on ? 'checked' : ''} />
                <label for="ck-${idSafe}">${escapeHtml(item.label)}</label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <h3 style="font-size:16px;margin-bottom:8px;">Portfolio README template</h3>
      <p style="color:var(--text-dim);font-size:14px;">Copy into your repo as <code>README.md</code> and replace placeholders.</p>
      <div class="readme-copy" id="readmeTemplate">${escapeHtml(c.portfolioReadme)}</div>
      <button type="button" class="btn-copy" id="copyReadmeBtn">Copy to clipboard</button>
    `;
    $('#capBackHub').onclick = () => { state.currentCapstoneModule = null; save(); renderSidebar(); renderCapstonesHub(); };
    $$('input[data-cap-ck]').forEach(inp => {
      inp.onchange = () => {
        const k = inp.dataset.capCk;
        if (inp.checked) state.capstoneItems.add(k);
        else state.capstoneItems.delete(k);
        save(); unlockBadges(); renderSidebar();
      };
    });
    $('#copyReadmeBtn').onclick = async () => {
      try {
        await navigator.clipboard.writeText(c.portfolioReadme);
        showToast('README template copied');
      } catch (_) { showToast('Copy blocked — select text manually'); }
    };
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function fillCertificate() {
    const name = state.learnerName || 'Learner';
    const total = totalLessons();
    const pct = total ? Math.round(state.completed.size / total * 100) : 0;
    $('#certBody').innerHTML = `
      <h1>Certificate of progress</h1>
      <p class="cert-sub">SWE Academy — self-directed full-stack roadmap</p>
      <div class="cert-name">${escapeHtml(name)}</div>
      <p class="cert-stats">
        Completed <strong>${state.completed.size}</strong> / ${total} lessons (${pct}%)<br/>
        ${state.challengesDone.size} coding challenges solved · streak ${state.streak.count} days<br/>
        ${state.badgesUnlocked.size} badges · ${state.capstoneItems.size} capstone checks<br/>
        <span style="font-size:12px;color:#666">${new Date().toLocaleDateString()}</span>
      </p>
      <p class="cert-sub" style="font-size:13px;color:#555;">This is not an accredited diploma. Pair with public repos and capstones.</p>
    `;
  }

  function setupOnboarding() {
    const ov = $('#onboardingOverlay');
    const goals = [
      { id: 'casual10', t: '~10 minutes / day', d: 'Spaced cards + bite lesson. Low pressure.' },
      { id: 'steady30', t: '~30 minutes / day', d: 'Lessons + practice. Default balance.' },
      { id: 'job12', t: 'Job-ready track', d: 'Adds capstone nudges + more challenges in Today panel.' },
    ];
    const grid = $('#goalGrid');
    const dismissWelcome = () => {
      ov.hidden = true;
      if (!state.onboardingDone) {
        state.onboardingDone = true;
        save();
      }
      syncModalAppBlock();
    };
    const renderGoals = () => {
      grid.innerHTML = goals.map(g => `
        <button type="button" class="goal-opt ${state.learnGoal === g.id ? 'selected' : ''}" data-goal="${g.id}">
          <strong>${g.t}</strong>${g.d}
        </button>
      `).join('');
      $$('.goal-opt', grid).forEach(btn => {
        btn.onclick = () => { state.learnGoal = btn.dataset.goal; renderGoals(); };
      });
    };
    const show = () => {
      $('#obName').value = state.learnerName || '';
      renderGoals();
      ov.hidden = false;
      syncModalAppBlock();
    };
    const hide = () => {
      ov.hidden = true;
      syncModalAppBlock();
    };
    ov.addEventListener('click', (e) => {
      if (e.target === ov) dismissWelcome();
    });
    const obClose = $('#obClose');
    if (obClose) obClose.onclick = () => dismissWelcome();
    $('#obSave').onclick = () => {
      state.learnerName = ($('#obName').value || '').trim() || state.learnerName;
      state.onboardingDone = true;
      save(); hide(); renderHome();
    };
    $('#obSkip').onclick = () => { dismissWelcome(); };
    window.__openOnboarding = show;
  }

  // ---------- Lesson view ----------
  function renderLesson(moduleId, lessonId) {
    const mod = CURRICULUM.find(m => m.id === moduleId);
    const lesson = mod && mod.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    const lessonKey = key(moduleId, lessonId);
    const isDone = state.completed.has(lessonKey);
    const resources = (RESOURCES[lessonKey] || []);

    const root = $('#content');
    root.innerHTML = `
      <header class="lesson-header">
        <div class="lesson-crumbs">${mod.title} · Lesson ${mod.lessons.indexOf(lesson) + 1} of ${mod.lessons.length}</div>
        <h1 class="lesson-title">${lesson.title}</h1>
        <p class="lesson-desc">${lesson.desc || ''}</p>
      </header>
      <div id="lessonBody"></div>
      ${resources.length ? `<div id="lessonResources"></div>` : ''}
      <div id="lessonNotes"></div>
      <div class="lesson-nav">
        <button class="nav-btn" id="prevBtn">← Previous</button>
        <button class="nav-btn ${isDone ? 'done' : 'primary'}" id="doneBtn">${isDone ? '✓ Completed' : 'Mark complete (+10 XP)'}</button>
        <button class="nav-btn" id="nextBtn">Next →</button>
      </div>
    `;
    const body = $('#lessonBody');
    body.innerHTML = '';
    const blocks = lesson.blocks;
    const segCount = Math.max(1, Math.ceil(blocks.length / SEGMENT_BLOCKS));
    if (isDone) state.lessonSeg[lessonKey] = segCount - 1;
    let segIdx = state.lessonSeg[lessonKey];
    if (segIdx == null || segIdx < 0) segIdx = 0;
    if (segIdx > segCount - 1) segIdx = segCount - 1;

    const bar = document.createElement('div');
    bar.className = 'segment-bar';
    bar.innerHTML = `
      <div style="font-size:12px;color:var(--text-faint);margin-bottom:8px;">
        Lesson checkpoints · section <strong style="color:#fff">${segIdx + 1}</strong> of ${segCount}
        (${SEGMENT_BLOCKS} blocks per checkpoint — skim or deep-read, your call)
      </div>
      <div class="segment-dots">${Array.from({ length: segCount }, (_, i) =>
        `<span class="segment-dot ${i <= segIdx ? 'on' : ''} ${i === segIdx ? 'curr' : ''}"></span>`
      ).join('')}</div>`;
    body.appendChild(bar);

    for (let s = 0; s <= segIdx; s++) {
      const wrap = document.createElement('div');
      wrap.className = 'lesson-segment';
      const chunk = blocks.slice(s * SEGMENT_BLOCKS, s * SEGMENT_BLOCKS + SEGMENT_BLOCKS);
      chunk.forEach(b => wrap.appendChild(renderBlock(b)));
      if (!isDone && s === segIdx && s < segCount - 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'segment-next';
        btn.textContent = 'Checkpoint — continue to next section →';
        btn.onclick = () => {
          state.lessonSeg[lessonKey] = segIdx + 1;
          save();
          renderLesson(moduleId, lessonId);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        wrap.appendChild(btn);
      }
      body.appendChild(wrap);
    }

    if (typeof CAPSTONES !== 'undefined') {
      const cap = CAPSTONES.find(c => c.moduleId === moduleId);
      if (cap) {
        const band = document.createElement('div');
        band.className = 'jobbox';
        band.style.marginTop = '10px';
        band.innerHTML = `
          <div class="jb-label">Job signal (not course XP)</div>
          <div class="jb-title">Ship work recruiters can click</div>
          <div class="jb-body">This module has a <strong>capstone checklist</strong> and a <strong>README template</strong> — the kind of proof Sololearn/Mimo rarely ask for. Do it when you're ready; it saves locally.</div>
          <button type="button" class="nav-btn primary" style="margin-top:14px;" data-open-mod-cap="${moduleId}">Open capstone →</button>
        `;
        body.appendChild(band);
        $('button[data-open-mod-cap]', band).onclick = () => openCapstoneModule(moduleId);
      }
    }
    if (resources.length) {
      const r = document.createElement('div');
      r.className = 'resources-block';
      r.innerHTML = `
        <h4>Go deeper — curated resources</h4>
        <ul>
          ${resources.map(x => `
            <li><a href="${x.url}" target="_blank" rel="noopener">
              <span class="res-tag">${x.kind}</span>
              <span>${x.label}</span>
            </a></li>
          `).join('')}
        </ul>
      `;
      $('#lessonResources').replaceWith(r);
    }

    // Notes box
    const noteRoot = document.createElement('div');
    noteRoot.className = 'notes-block';
    const noteVal = state.notes[lessonKey] || '';
    noteRoot.innerHTML = `
      <h4>Your notes (saved automatically)</h4>
      <textarea placeholder="Write what you learned in your own words. This is the single best thing you can do for retention.">${escapeHtml(noteVal)}</textarea>
      <div class="notes-saved" id="notesSaved"></div>
    `;
    $('#lessonNotes').replaceWith(noteRoot);
    const noteEl = $('textarea', noteRoot);
    let savedIndicator;
    noteEl.addEventListener('input', () => {
      state.notes[lessonKey] = noteEl.value;
      clearTimeout(savedIndicator);
      savedIndicator = setTimeout(() => {
        save();
        $('#notesSaved').textContent = 'Saved.';
        setTimeout(() => { const e = $('#notesSaved'); if (e) e.textContent = ''; }, 1500);
      }, 400);
    });

    const prev = findLessonAdjacent(-1);
    const next = findLessonAdjacent(+1);
    $('#prevBtn').disabled = !prev;
    $('#nextBtn').disabled = !next;
    $('#prevBtn').onclick = () => prev && openLesson(prev.moduleId, prev.lessonId);
    $('#nextBtn').onclick = () => next && openLesson(next.moduleId, next.lessonId);
    $('#doneBtn').onclick = () => {
      const wasDone = state.completed.has(lessonKey);
      const segTot = Math.max(1, Math.ceil(lesson.blocks.length / SEGMENT_BLOCKS));
      if (wasDone) {
        state.completed.delete(lessonKey);
        save();
        unlockBadges();
      } else {
        state.lessonSeg[lessonKey] = segTot - 1;
        state.completed.add(lessonKey);
        awardXp(10, 'lesson complete');
      }
      renderSidebar();
      renderLesson(moduleId, lessonId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Block renderer ----------
  function renderBlock(b) {
    const wrap = document.createElement('div');
    switch (b.type) {
      case 'text':
        wrap.className = 'block text';
        wrap.innerHTML = b.html;
        break;
      case 'callout':
        wrap.className = 'block callout' + (b.tone === 'warn' ? ' warn' : '');
        wrap.innerHTML = `${b.label ? `<span class="tip-label">${b.label}</span>` : ''}<div>${b.html}</div>`;
        break;
      case 'code':
        wrap.className = 'block code';
        wrap.innerHTML = `<div class="lang-tag">${b.lang || 'code'}</div><pre>${escapeHtml(b.code)}</pre>`;
        break;
      case 'play':
        wrap.className = 'block';
        wrap.appendChild(buildPlayground(b));
        break;
      case 'quiz':
        wrap.className = 'block';
        wrap.appendChild(buildQuiz(b));
        break;
      case 'diagram':
        wrap.className = 'block diagram';
        wrap.innerHTML = b.svg + (b.caption ? `<div class="caption">${b.caption}</div>` : '');
        break;
      case 'htmlplay':
        wrap.className = 'block';
        wrap.appendChild(buildHtmlPlay(b));
        break;
      case 'sqlplay':
        wrap.className = 'block';
        wrap.appendChild(buildSqlPlay(b));
        break;
      case 'challenge': {
        const ch = CHALLENGES.find(c => c.id === b.challengeId);
        wrap.className = 'block';
        wrap.appendChild(ch ? buildChallenge(ch) : document.createTextNode('[unknown challenge: ' + b.challengeId + ']'));
        break;
      }
      case 'terminal':
        wrap.className = 'block';
        wrap.appendChild(buildTerminal(b));
        break;
      case 'flashcards':
        wrap.className = 'block';
        wrap.appendChild(buildInlineFlashcards(b));
        break;
      case 'jobbox':
        wrap.className = 'block jobbox';
        wrap.innerHTML = `
          <div class="jb-label">${escapeHtml(b.label || 'On the job')}</div>
          ${b.title ? `<div class="jb-title">${escapeHtml(b.title)}</div>` : ''}
          <div class="jb-body">${b.html}</div>`;
        break;
      case 'rubric':
        wrap.className = 'block rubric';
        wrap.innerHTML = `
          <h4>${escapeHtml(b.title || 'What “good” looks like on a team')}</h4>
          <table>
            ${(b.rows || []).map(([col1, col2]) => `<tr><td>${escapeHtml(col1)}</td><td>${escapeHtml(col2)}</td></tr>`).join('')}
          </table>`;
        break;
      case 'drill-fill':
        wrap.className = 'block';
        wrap.appendChild(buildDrillFill(b));
        break;
      case 'drill-predict':
        wrap.className = 'block';
        wrap.appendChild(buildDrillPredict(b));
        break;
      case 'drill-reorder':
        wrap.className = 'block';
        wrap.appendChild(buildDrillReorder(b));
        break;
      default:
        wrap.textContent = '[unknown block: ' + b.type + ']';
    }
    return wrap;
  }

  function normAns(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function buildDrillFill(b) {
    const root = document.createElement('div');
    root.className = 'drill';
    const inputs = [];
    let line = document.createElement('div');
    line.className = 'drill-fill-line';
    (b.parts || []).forEach(p => {
      if (typeof p === 'string') line.appendChild(document.createTextNode(p));
      else if (p && p.blank) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'drill-blank-input';
        inp.autocomplete = 'off';
        inp.dataset.answer = p.blank;
        if (p.alt) inp.dataset.alt = JSON.stringify(p.alt);
        inputs.push(inp);
        line.appendChild(inp);
      }
    });
    root.innerHTML = `<div class="drill-tag">Micro-drill · fill in</div>`;
    root.appendChild(line);
    const fb = document.createElement('div');
    fb.className = 'drill-feedback';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn primary drill-submit';
    btn.textContent = 'Check answers (+2 XP)';
    btn.onclick = () => {
      let ok = true;
      inputs.forEach(inp => {
        const want = normAns(inp.dataset.answer);
        const alts = inp.dataset.alt ? JSON.parse(inp.dataset.alt).map(normAns) : [];
        const got = normAns(inp.value);
        const pass = got === want || alts.some(a => got === a);
        inp.style.borderColor = pass ? '#22c55e' : '#ef4444';
        if (!pass) ok = false;
      });
      fb.textContent = ok ? '✅ Correct. You remembered the mechanics — not just the slide.' : 'Keep trying — tighten spelling or casing if needed.';
      fb.style.color = ok ? '#86efac' : '#fca5a5';
      if (ok && !root.dataset.done) {
        root.dataset.done = '1';
        awardXp(2, 'micro-drill');
      }
    };
    root.appendChild(btn);
    root.appendChild(fb);
    return root;
  }

  function buildDrillPredict(b) {
    const root = document.createElement('div');
    root.className = 'drill';
    if (!b || !Array.isArray(b.options) || b.options.length === 0 || typeof b.answer !== 'number') {
      root.textContent = '[drill-predict: needs q, options[], and answer index]';
      return root;
    }
    root.innerHTML = `<div class="drill-tag">Micro-drill · predict</div><div class="quiz-q" style="margin-bottom:12px;">${b.q}</div><div class="quiz-opts" data-predict></div><div class="quiz-explain" data-exp></div>`;
    const opts = $('[data-predict]', root);
    const exp = $('[data-exp]', root);
    b.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt';
      btn.textContent = opt;
      btn.onclick = () => {
        if (root.dataset.done) return;
        root.dataset.done = '1';
        const ok = idx === b.answer;
        btn.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) $$('.quiz-opt', root)[b.answer].classList.add('correct');
        $$('.quiz-opt', root).forEach(o => o.classList.add('disabled'));
        exp.innerHTML = (b.why || '') + '';
        exp.classList.add('show');
        if (ok) awardXp(2, 'predict drill');
      };
      opts.appendChild(btn);
    });
    return root;
  }

  function buildDrillReorder(b) {
    const root = document.createElement('div');
    root.className = 'drill';
    const linesInit = [...(b.lines || [])];
    const want = Array.isArray(b.correctOrder) && b.correctOrder.length === linesInit.length
      ? b.correctOrder
      : linesInit.map((_, i) => i);
    /** Fisher-Yates shuffle of positions - build display order random */
    let display = linesInit.map((text, idx) => ({ text, idx }));
    for (let i = display.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [display[i], display[j]] = [display[j], display[i]];
    }
    const listEl = document.createElement('div');
    listEl.className = 'drill-reorder-list';
    root.innerHTML = `<div class="drill-tag">Micro-drill · reorder</div>`;
    const hint = document.createElement('p');
    hint.style.margin = '10px 0';
    hint.style.color = 'var(--text-dim)';
    hint.style.fontSize = '14px';
    hint.textContent = b.intro || 'Put the steps in order (top = first).';

    function renderList() {
      listEl.innerHTML = '';
      display.forEach((row, pos) => {
        const wrap = document.createElement('div');
        wrap.className = 'drill-ro-item';
        wrap.innerHTML = `<span style="flex:1">${escapeHtml(row.text)}</span>`;
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'drill-ro-btn';
        up.textContent = '↑';
        up.disabled = pos === 0;
        up.onclick = () => {
          const t = display[pos - 1]; display[pos - 1] = display[pos]; display[pos] = t;
          renderList();
        };
        const dn = document.createElement('button');
        dn.type = 'button';
        dn.className = 'drill-ro-btn';
        dn.textContent = '↓';
        dn.disabled = pos === display.length - 1;
        dn.onclick = () => {
          const t = display[pos + 1]; display[pos + 1] = display[pos]; display[pos] = t;
          renderList();
        };
        wrap.appendChild(up); wrap.appendChild(dn);
        listEl.appendChild(wrap);
      });
    }
    root.appendChild(hint);
    renderList();
    root.appendChild(listEl);
    const fb = document.createElement('div');
    fb.className = 'drill-feedback';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn primary drill-submit';
    btn.textContent = 'Check order (+2 XP)';
    btn.onclick = () => {
      const seq = display.map(d => d.idx);
      const ok = seq.length === want.length && seq.every((v, i) => v === want[i]);
      fb.textContent = ok ? '✅ Perfect — that sequencing is interview gold.' : 'Not quite — think about what has to happen before the browser renders.';
      fb.style.color = ok ? '#86efac' : '#fca5a5';
      if (ok && !root.dataset.done) {
        root.dataset.done = '1';
        awardXp(2, 'reorder drill');
      }
    };
    root.appendChild(btn);
    root.appendChild(fb);
    return root;
  }

  // ---------- JS Playground ----------
  function buildPlayground(b) {
    const root = document.createElement('div');
    root.className = 'playground';
    root.innerHTML = `
      <div class="pg-head">
        <span>JavaScript Playground</span>
        <button class="pg-run">▶ Run</button>
      </div>
      <textarea class="pg-editor" spellcheck="false"></textarea>
      <div class="pg-out"><span class="muted">Click ▶ Run to execute. (Tip: Ctrl/Cmd+Enter)</span></div>
    `;
    const editor = $('.pg-editor', root);
    const out = $('.pg-out', root);
    editor.value = b.starter || '';
    autoGrow(editor);
    $('.pg-run', root).onclick = () => runJS(editor.value, out);
    editor.addEventListener('keydown', tabHandler);
    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runJS(editor.value, out); }
    });
    return root;
  }

  async function runJS(code, outEl) {
    outEl.innerHTML = '';
    const append = (text, cls = 'log') => {
      const span = document.createElement('span'); span.className = cls;
      span.textContent = text + '\n'; outEl.appendChild(span);
    };
    const fmt = (v) => {
      if (typeof v === 'string') return v;
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    };
    const fakeConsole = {
      log:  (...args) => append(args.map(fmt).join(' '), 'log'),
      info: (...args) => append(args.map(fmt).join(' '), 'log'),
      warn: (...args) => append(args.map(fmt).join(' '), 'log'),
      error:(...args) => append(args.map(fmt).join(' '), 'err'),
    };
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('console', 'fetch', code);
      await fn(fakeConsole, window.fetch.bind(window));
      if (!outEl.children.length) {
        const span = document.createElement('span');
        span.className = 'muted';
        span.textContent = '(no output — try adding console.log(...))';
        outEl.appendChild(span);
      }
    } catch (err) {
      append('Error: ' + (err && err.message ? err.message : String(err)), 'err');
    }
  }

  // ---------- HTML/CSS Playground ----------
  function buildHtmlPlay(b) {
    const root = document.createElement('div');
    root.className = 'htmlplay';
    root.innerHTML = `
      <div class="pg-head">
        <span>HTML / CSS Live Preview</span>
        <button class="pg-run">↻ Refresh preview</button>
      </div>
      <div class="htmlplay-grid">
        <textarea class="pg-editor" spellcheck="false"></textarea>
        <iframe class="htmlplay-iframe" sandbox="allow-scripts" title="preview"></iframe>
      </div>
    `;
    const editor = $('.pg-editor', root);
    const frame = $('.htmlplay-iframe', root);
    editor.value = b.starter || '';
    autoGrow(editor, 280);
    const update = () => { frame.srcdoc = editor.value; };
    update();
    let t;
    editor.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 350); });
    editor.addEventListener('keydown', tabHandler);
    $('.pg-run', root).onclick = update;
    return root;
  }

  // ---------- SQL Playground (sql.js) ----------
  let sqlPromise = null;
  function loadSqlJs() {
    if (sqlPromise) return sqlPromise;
    sqlPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
      script.onload = () => {
        window.initSqlJs({
          locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm'
        }).then(resolve, reject);
      };
      script.onerror = () => reject(new Error('Failed to load sql.js (need internet)'));
      document.head.appendChild(script);
    });
    return sqlPromise;
  }

  function buildSqlPlay(b) {
    const root = document.createElement('div');
    root.className = 'sqlplay';
    root.innerHTML = `
      <div class="pg-head">
        <span>SQL Playground (SQLite)</span>
        <div class="head-actions">
          <button class="pg-action pg-reset">↻ Reset DB</button>
          <button class="pg-run">▶ Run</button>
        </div>
      </div>
      <textarea class="pg-editor" spellcheck="false" style="min-height: 180px;"></textarea>
      <div class="sql-results"><span class="muted">Click ▶ Run to execute. First load downloads SQLite (~700KB).</span></div>
    `;
    const editor = $('.pg-editor', root);
    const out = $('.sql-results', root);
    editor.value = b.starter || '';
    autoGrow(editor, 180);
    editor.addEventListener('keydown', tabHandler);

    let db = null;
    async function ensureDb(reset = false) {
      if (db && !reset) return db;
      const SQL = await loadSqlJs();
      db = new SQL.Database();
      if (b.schema) db.run(b.schema);
      if (b.seed) db.run(b.seed);
      return db;
    }

    async function run() {
      out.innerHTML = '<span class="muted">Running…</span>';
      try {
        const database = await ensureDb();
        const sql = editor.value;
        const results = database.exec(sql);
        if (!results.length) {
          out.innerHTML = '<span class="muted">Query OK — no rows returned.</span>';
          return;
        }
        out.innerHTML = '';
        results.forEach(rs => {
          const t = document.createElement('table');
          t.innerHTML = `
            <thead><tr>${rs.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>${rs.values.map(row => `<tr>${row.map(v => `<td>${v === null ? '<span class="muted">NULL</span>' : escapeHtml(String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
          `;
          out.appendChild(t);
        });
      } catch (err) {
        out.innerHTML = `<span class="err">${escapeHtml(err.message || String(err))}</span>`;
      }
    }

    $('.pg-run', root).onclick = run;
    $('.pg-reset', root).onclick = async () => {
      out.innerHTML = '<span class="muted">Resetting database…</span>';
      try { await ensureDb(true); out.innerHTML = '<span class="ok" style="color:#86efac;">Database reset to original state.</span>'; }
      catch (err) { out.innerHTML = `<span class="err">${escapeHtml(err.message)}</span>`; }
    };
    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    return root;
  }

  // ---------- Quiz ----------
  function buildQuiz(b) {
    const root = document.createElement('div');
    root.className = 'quiz';
    root.innerHTML = `
      <div class="quiz-q">${b.q}</div>
      <div class="quiz-opts"></div>
      <div class="quiz-explain"></div>
    `;
    const optsEl = $('.quiz-opts', root);
    const explain = $('.quiz-explain', root);
    b.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = opt;
      btn.onclick = () => {
        if (root.dataset.answered) return;
        root.dataset.answered = '1';
        const correct = idx === b.answer;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) $$('.quiz-opt', root)[b.answer].classList.add('correct');
        $$('.quiz-opt', root).forEach(o => o.classList.add('disabled'));
        explain.innerHTML = `<strong>${correct ? 'Correct.' : 'Not quite.'}</strong> ${b.why || ''}`;
        explain.classList.add('show');
        if (correct) awardXp(2, 'quiz');
      };
      optsEl.appendChild(btn);
    });
    return root;
  }

  // ---------- Challenge ----------
  function buildChallenge(ch) {
    const root = document.createElement('div');
    root.className = 'challenge';
    root.innerHTML = `
      <div class="ch-prompt"><strong>${ch.isBug ? '🐛 ' : '⚡ '}${ch.title}</strong> — ${ch.prompt}</div>
      <div class="pg-head">
        <span>${ch.isBug ? 'Bug-hunt' : 'Coding challenge'} · function <code style="text-transform:none">${ch.fn}()</code></span>
        <button class="pg-run">▶ Run tests</button>
      </div>
      <textarea class="pg-editor" spellcheck="false"></textarea>
      <div class="tests"></div>
      <div class="ch-summary" id="ch-summary"></div>
    `;
    const editor = $('.pg-editor', root);
    const tests = $('.tests', root);
    const summary = $('.ch-summary', root);
    editor.value = ch.starter;
    autoGrow(editor, 160);
    editor.addEventListener('keydown', tabHandler);

    const renderTests = (results) => {
      tests.innerHTML = ch.tests.map((t, i) => {
        const r = results && results[i];
        const cls = r ? (r.pass ? 'pass' : 'fail') : '';
        const mark = r ? (r.pass ? '✓' : '✕') : '·';
        const argsStr = t.args.map(a => JSON.stringify(a)).join(', ');
        let body = `<code>${ch.fn}(${escapeHtml(argsStr)})</code> &nbsp;→ <code>${escapeHtml(JSON.stringify(t.expect))}</code>`;
        if (r && !r.pass && 'got' in r) body += ` &nbsp;<span style="color:var(--text-faint);">(got <code>${escapeHtml(JSON.stringify(r.got))}</code>)</span>`;
        if (r && r.error) body += ` &nbsp;<span style="color:#fca5a5;">(${escapeHtml(r.error)})</span>`;
        return `
          <div class="test ${cls}">
            <div class="test-mark">${mark}</div>
            <div class="test-body">${body}</div>
          </div>
        `;
      }).join('');
    };
    renderTests();

    const run = () => {
      const code = editor.value;
      let userFn;
      try {
        const wrapped = `${code}; return typeof ${ch.fn} === 'function' ? ${ch.fn} : null;`;
        userFn = new Function(wrapped)();
        if (typeof userFn !== 'function') {
          summary.className = 'ch-summary'; summary.textContent = `❗ Define a function called \`${ch.fn}\`.`;
          renderTests(); return;
        }
      } catch (err) {
        summary.className = 'ch-summary'; summary.textContent = `❗ Syntax error: ${err.message}`;
        renderTests(); return;
      }
      const results = ch.tests.map(t => {
        try {
          const got = userFn.apply(null, t.args.map(deepClone));
          return { pass: deepEqual(got, t.expect), got };
        } catch (err) { return { pass: false, error: err.message || String(err) }; }
      });
      renderTests(results);
      const passing = results.filter(r => r.pass).length;
      const winning = passing === ch.tests.length;
      summary.className = 'ch-summary' + (winning ? ' win' : '');
      summary.textContent = winning
        ? `✅ All ${ch.tests.length} tests passed!`
        : `${passing} / ${ch.tests.length} tests passing.`;
      if (winning && !state.challengesDone.has(ch.id)) {
        state.challengesDone.add(ch.id);
        awardXp(15, 'challenge');
        save();
        renderSidebar();
      }
    };

    $('.pg-run', root).onclick = run;
    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    return root;
  }

  function deepClone(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(deepClone);
    const o = {};
    for (const k of Object.keys(v)) o[k] = deepClone(v[k]);
    return o;
  }

  // ---------- Terminal simulator ----------
  function buildTerminal(b) {
    const root = document.createElement('div');
    root.className = 'terminal-sim';
    root.innerHTML = `
      <div class="term-head"><span class="term-dots"><span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span></span> sandbox terminal · type commands and press Enter</div>
      <div class="term-out"></div>
      <div class="term-input-row"><span class="prompt">$</span><input class="term-input" spellcheck="false" autocomplete="off" /></div>
      <div class="term-tasks"></div>
    `;
    const out = $('.term-out', root);
    const input = $('.term-input', root);
    const tasksEl = $('.term-tasks', root);
    const completed = new Set();

    const renderTasks = () => {
      tasksEl.innerHTML = b.tasks.map(t => `
        <div class="term-task ${completed.has(t.id) ? 'done' : ''}">
          <span class="check"></span>
          <strong>${completed.has(t.id) ? '✓' : '○'}</strong> ${t.desc}
        </div>
      `).join('');
    };
    renderTasks();

    const print = (text, cls = 'out') => {
      const div = document.createElement('div');
      div.className = cls;
      div.textContent = text;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    };
    print('Welcome to the sandbox. Try the git commands you just learned.');

    const handlers = {
      'git init': () => 'Initialized empty Git repository in ./.git/',
      'git status': () => `On branch main\nNothing to commit, working tree clean (or some files modified).`,
      'git log': () => 'commit a1b2c3d (HEAD -> main)\nAuthor: You <you@example.com>\nDate:   Today\n\n    Initial commit',
      'pwd': () => '/sandbox/project',
      'ls': () => 'README.md  src/  package.json',
      'whoami': () => 'student',
      'help': () => 'Try: git init, git status, git add ., git commit -m "msg", git checkout -b feature, git log, ls, pwd, clear',
      'clear': () => { out.innerHTML = ''; return null; },
    };

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const cmd = input.value.trim();
      if (!cmd) return;
      const cmdLine = document.createElement('div');
      cmdLine.innerHTML = `<span class="prompt">$</span> <span class="cmd">${escapeHtml(cmd)}</span>`;
      out.appendChild(cmdLine);
      input.value = '';

      // task matching
      let matched = false;
      b.tasks.forEach(t => {
        if (!completed.has(t.id) && t.match.test(cmd)) {
          completed.add(t.id);
          matched = true;
        }
      });

      // command handling
      let response;
      const exact = handlers[cmd];
      if (exact !== undefined) response = exact();
      else if (/^git\s+add\s+/.test(cmd)) response = '';
      else if (/^git\s+commit\s+-m\s+/.test(cmd)) response = `[main a1b2c3d] ${cmd.match(/-m\s+["'](.+?)["']/)?.[1] || 'commit'}\n 1 file changed, 1 insertion(+)`;
      else if (/^git\s+(checkout\s+-b|switch\s+-c)\s+\S+/.test(cmd)) {
        const name = cmd.split(/\s+/).pop();
        response = `Switched to a new branch '${name}'`;
      } else if (/^git\s+(checkout|switch)\s+\S+/.test(cmd)) response = `Switched to branch '${cmd.split(/\s+/).pop()}'`;
      else if (/^git\s+push/.test(cmd)) response = 'To origin\n   a1b2c3d..d4e5f6a  main -> main';
      else if (/^git\s+pull/.test(cmd)) response = 'Already up to date.';
      else if (/^git\s+branch/.test(cmd)) response = '* main\n  feature';
      else if (/^echo\s+/.test(cmd)) response = cmd.slice(5).replace(/^["']|["']$/g, '');
      else response = `command not found: ${cmd.split(/\s+/)[0]} (try \`help\`)`;

      if (response !== null && response !== undefined && response !== '') print(response, 'out');
      if (matched) renderTasks();
      if (b.tasks.every(t => completed.has(t.id)) && !root.dataset.win) {
        root.dataset.win = '1';
        print('🎉 All tasks complete! +20 XP', 'out');
        awardXp(20, 'terminal exercise');
      }
    });

    setTimeout(() => input.focus(), 50);
    return root;
  }

  // ---------- Inline flashcards ----------
  function buildInlineFlashcards(b) {
    const cards = (b.cardIds || []).map(id => FLASHCARDS.find(c => c.id === id)).filter(Boolean);
    if (!cards.length) return document.createTextNode('');
    const root = document.createElement('div');
    root.className = 'flashcards-inline';
    let i = 0; let flipped = false;
    const update = () => {
      const c = cards[i];
      root.innerHTML = `
        <div class="fc-counter">Flashcard ${i + 1} of ${cards.length}</div>
        <div class="fc-card">${flipped ? `<div class="fc-back">${c.back}</div>` : c.front}</div>
        <div class="fc-actions">
          <button class="fc-btn" data-act="flip">${flipped ? 'Hide answer' : 'Show answer'}</button>
          ${flipped ? `<button class="fc-btn bad" data-act="bad">Forgot</button><button class="fc-btn good" data-act="good">Got it</button>` : ''}
        </div>
      `;
      $$('.fc-btn', root).forEach(btn => {
        btn.onclick = () => {
          const act = btn.dataset.act;
          if (act === 'flip') { flipped = !flipped; update(); }
          if (act === 'bad' || act === 'good') {
            scheduleCard(cards[i].id, act === 'good' ? 4 : 1);
            i = (i + 1) % cards.length; flipped = false; update();
          }
        };
      });
      $('.fc-card', root).onclick = () => { flipped = !flipped; update(); };
    };
    update();
    return root;
  }

  // ---------- Practice view ----------
  function renderPractice() {
    const total = CHALLENGES.length;
    const done = state.challengesDone.size;
    $('#content').innerHTML = `
      <header class="view-header">
        <h1 class="view-title">⚡ Practice arena</h1>
        <p class="view-sub">Auto-graded coding challenges. Pick one from the sidebar, or start with the easiest unsolved below. <strong>${done}/${total}</strong> solved.</p>
      </header>
      <div class="list-grid" id="practiceList"></div>
    `;
    const sorted = [...CHALLENGES].sort((a, b) => {
      const da = state.challengesDone.has(a.id) ? 1 : 0;
      const db = state.challengesDone.has(b.id) ? 1 : 0;
      if (da !== db) return da - db;
      const order = { easy: 0, medium: 1, hard: 2 };
      return order[a.difficulty] - order[b.difficulty];
    });
    const list = $('#practiceList');
    sorted.forEach(c => {
      const card = document.createElement('div');
      card.className = 'list-card' + (state.challengesDone.has(c.id) ? ' done' : '');
      const tagColor = ({ easy: '#22c55e', medium: '#facc15', hard: '#ef4444' })[c.difficulty];
      card.innerHTML = `
        <span class="lc-tag" style="background:${tagColor}22; color:${tagColor};">${c.difficulty}</span>
        <div>
          <div class="lc-title">${c.isBug ? '🐛 ' : ''}${c.title}</div>
          <div class="lc-desc">${topicLabel(c.topic)}</div>
        </div>
        <div class="lc-meta">${state.challengesDone.has(c.id) ? '✓ solved' : ''}</div>
      `;
      card.onclick = () => openChallenge(c.id);
      list.appendChild(card);
    });
  }

  function openChallenge(id) {
    const ch = CHALLENGES.find(c => c.id === id);
    if (!ch) return;
    state.currentChallengeId = id;
    state.currentView = 'practice';
    save();
    renderSidebar();
    $('#content').innerHTML = `
      <header class="view-header">
        <div class="lesson-crumbs">Practice · ${topicLabel(ch.topic)} · ${ch.difficulty}</div>
        <h1 class="view-title">${ch.isBug ? '🐛 ' : '⚡ '}${ch.title}</h1>
      </header>
      <div id="chHost"></div>
      <div class="lesson-nav">
        <button class="nav-btn" id="backBtn">← Back to practice list</button>
      </div>
    `;
    $('#chHost').appendChild(buildChallenge(ch));
    $('#backBtn').onclick = () => switchView('practice');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Projects view ----------
  function renderProjects() {
    $('#content').innerHTML = `
      <header class="view-header">
        <h1 class="view-title">🛠 Build-along projects</h1>
        <p class="view-sub">Step-by-step projects you'll actually finish. Each step is a polished mini-lesson — by the end you'll have a real, deployable app.</p>
      </header>
      <div class="list-grid" id="pjList"></div>
    `;
    const list = $('#pjList');
    PROJECTS.forEach(p => {
      const done = p.steps.filter(s => state.projectStepsDone.has(`${p.id}/${s.id}`)).length;
      const card = document.createElement('div');
      card.className = 'list-card' + (done === p.steps.length ? ' done' : '');
      card.innerHTML = `
        <span class="lc-tag" style="background:${p.color}22;color:${p.color};">${p.icon || '🛠'}</span>
        <div>
          <div class="lc-title">${p.title}</div>
          <div class="lc-desc">${p.desc}</div>
        </div>
        <div class="lc-meta">${done}/${p.steps.length} steps</div>
      `;
      card.onclick = () => openProjectStep(p.id, p.steps[0].id);
      list.appendChild(card);
    });
  }

  function openProjectStep(projectId, stepId) {
    const p = PROJECTS.find(x => x.id === projectId);
    const step = p && p.steps.find(s => s.id === stepId);
    if (!step) return;
    state.currentProjectId = projectId;
    state.currentStepId = stepId;
    state.currentView = 'projects';
    save();
    renderSidebar();
    const idx = p.steps.indexOf(step);
    const stepKey = `${p.id}/${step.id}`;
    const isDone = state.projectStepsDone.has(stepKey);

    $('#content').innerHTML = `
      <header class="lesson-header">
        <div class="lesson-crumbs">${p.title}</div>
        <h1 class="lesson-title">${step.title}</h1>
        <p class="lesson-desc">Step ${idx + 1} of ${p.steps.length}</p>
      </header>
      <div id="lessonBody"></div>
      <div class="lesson-nav">
        <button class="nav-btn" id="prevBtn" ${idx === 0 ? 'disabled' : ''}>← Previous step</button>
        <button class="nav-btn ${isDone ? 'done' : 'primary'}" id="doneBtn">${isDone ? '✓ Step complete' : 'Mark step complete (+15 XP)'}</button>
        <button class="nav-btn" id="nextBtn" ${idx === p.steps.length - 1 ? 'disabled' : ''}>Next step →</button>
      </div>
    `;
    const body = $('#lessonBody');
    step.blocks.forEach(b => body.appendChild(renderBlock(b)));
    $('#prevBtn').onclick = () => idx > 0 && openProjectStep(p.id, p.steps[idx - 1].id);
    $('#nextBtn').onclick = () => idx < p.steps.length - 1 && openProjectStep(p.id, p.steps[idx + 1].id);
    $('#doneBtn').onclick = () => {
      if (state.projectStepsDone.has(stepKey)) state.projectStepsDone.delete(stepKey);
      else { state.projectStepsDone.add(stepKey); awardXp(15, 'project step'); }
      save(); renderSidebar(); openProjectStep(p.id, step.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Cheatsheets view ----------
  function renderCheats() {
    if (!state.currentCheatId) state.currentCheatId = CHEATSHEETS[0].id;
    openCheat(state.currentCheatId);
  }

  function openCheat(id) {
    state.currentCheatId = id;
    state.currentView = 'cheats';
    save();
    renderSidebar();
    const sheet = CHEATSHEETS.find(c => c.id === id);
    if (!sheet) return;
    $('#content').innerHTML = `
      <header class="view-header">
        <div class="lesson-crumbs" style="color:${sheet.color};">Cheatsheet</div>
        <h1 class="view-title">${sheet.title}</h1>
        <p class="view-sub">${sheet.desc}</p>
      </header>
      <div class="cheat-content">
        ${sheet.sections.map(sec => `
          <div class="cheat-section">
            <h3>${sec.heading}</h3>
            <table class="cheat-table">
              ${sec.rows.map(([code, desc]) => `
                <tr><td>${escapeHtml(code)}</td><td>${desc}</td></tr>
              `).join('')}
            </table>
          </div>
        `).join('')}
      </div>
    `;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Spaced repetition (SM-2 simplified) ----------
  function dueFlashcards() {
    const now = Date.now();
    return FLASHCARDS.filter(c => {
      const r = state.fc[c.id];
      if (!r) return true; // never seen
      return r.due <= now;
    });
  }

  function scheduleCard(id, grade) {
    // grade: 1=again, 2=hard, 3=good, 4=easy (mapped from 0-4 SM-2)
    let r = state.fc[id] || { ef: 2.5, interval: 0, due: 0, reps: 0 };
    if (grade < 3) {
      r.reps = 0;
      r.interval = 1; // 1 day
    } else {
      r.reps += 1;
      if (r.reps === 1) r.interval = 1;
      else if (r.reps === 2) r.interval = 3;
      else r.interval = Math.round(r.interval * r.ef);
      r.ef = Math.max(1.3, r.ef + (0.1 - (4 - grade) * (0.08 + (4 - grade) * 0.02)));
      if (grade === 4) r.interval = Math.max(r.interval, 4);
    }
    const now = Date.now();
    r.due = now + r.interval * 86400000;
    state.fc[id] = r;
    save();
  }

  function renderReview() {
    const due = dueFlashcards();
    if (!due.length) {
      $('#content').innerHTML = `
        <header class="view-header">
          <h1 class="view-title">🧠 Daily review</h1>
          <p class="view-sub">Spaced repetition surfaces flashcards right when you're about to forget them.</p>
        </header>
        <div class="review-empty">
          <h3>You're caught up!</h3>
          <p>No cards due right now. Come back tomorrow — or learn new lessons to add cards.</p>
        </div>
      `;
      return;
    }
    let queue = [...due];
    const reviewOne = () => {
      if (!queue.length) {
        $('#content').innerHTML = `
          <div class="review-empty">
            <h3>🎉 All due cards reviewed!</h3>
            <p>Beautiful. You earned XP. See you tomorrow.</p>
          </div>
        `;
        renderSidebar();
        return;
      }
      const c = queue[0];
      let flipped = false;
      const draw = () => {
        $('#content').innerHTML = `
          <header class="view-header">
            <h1 class="view-title">🧠 Review · ${queue.length} card${queue.length === 1 ? '' : 's'} left</h1>
            <p class="view-sub">Try to recall the answer before flipping. Then grade yourself honestly — that's how spaced repetition learns when to show this card next.</p>
          </header>
          <div class="review-card">
            <div class="review-meta">${(c.topic || '').toUpperCase()}</div>
            <div class="review-prompt">${c.front}</div>
            ${flipped ? `
              <div class="review-back">${c.back}</div>
              <div class="review-grade">
                <button class="again" data-g="1">Again (&lt; 1 day)</button>
                <button class="hard" data-g="2">Hard</button>
                <button class="good" data-g="3">Good</button>
                <button class="easy" data-g="4">Easy</button>
              </div>
            ` : `
              <button class="review-show" id="flipBtn">Show answer</button>
            `}
          </div>
        `;
        if (!flipped) $('#flipBtn').onclick = () => { flipped = true; draw(); };
        else $$('.review-grade button').forEach(btn => {
          btn.onclick = () => {
            state.reviewCountTotal += 1;
            scheduleCard(c.id, +btn.dataset.g);
            awardXp(1, 'review');
            queue.shift();
            reviewOne();
          };
        });
      };
      draw();
    };
    reviewOne();
  }

  // ---------- Generic helpers ----------
  function autoGrow(textarea, min = 160) {
    const grow = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(min, textarea.scrollHeight + 4) + 'px';
    };
    setTimeout(grow, 0);
    textarea.addEventListener('input', grow);
  }
  function tabHandler(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
    }
  }

  // ---------- Top-level navigation ----------
  function showHome() { $('#home').hidden = false; $('#learn').hidden = true; renderHome(); }
  function showLearn() { $('#home').hidden = true; $('#learn').hidden = false; }

  function openModule(moduleId, andOpenFirstLesson = false) {
    state.openModules.add(moduleId);
    state.currentView = 'lessons';
    showLearn();
    renderSidebar();
    if (andOpenFirstLesson) {
      const mod = CURRICULUM.find(m => m.id === moduleId);
      if (mod && mod.lessons[0]) openLesson(moduleId, mod.lessons[0].id);
    }
  }

  function openLesson(moduleId, lessonId) {
    state.currentModuleId = moduleId;
    state.currentLessonId = lessonId;
    state.openModules.add(moduleId);
    state.currentView = 'lessons';
    save();
    showLearn();
    renderSidebar();
    renderLesson(moduleId, lessonId);
  }

  // ---------- Boot ----------
  function boot() {
    load();
    setupOnboarding();
    registerServiceWorker();
    const certOverlayEl = $('#certOverlay');
    if (certOverlayEl) {
      certOverlayEl.addEventListener('click', (e) => {
        if (e.target === certOverlayEl) {
          certOverlayEl.hidden = true;
          syncModalAppBlock();
        }
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (certOverlayEl && !certOverlayEl.hidden) {
        certOverlayEl.hidden = true;
        syncModalAppBlock();
        e.preventDefault();
        return;
      }
      const obOv = $('#onboardingOverlay');
      if (obOv && !obOv.hidden) {
        obOv.hidden = true;
        if (!state.onboardingDone) {
          state.onboardingDone = true;
          save();
        }
        syncModalAppBlock();
        e.preventDefault();
      }
    });
    renderHome();
    if (!state.onboardingDone && typeof window.__openOnboarding === 'function') window.__openOnboarding();
    syncModalAppBlock();

    $('#startBtn').onclick = () => {
      const first = CURRICULUM[0];
      openLesson(first.id, first.lessons[0].id);
    };
    $('#resumeBtn').onclick = () => {
      if (state.currentModuleId && state.currentLessonId) openLesson(state.currentModuleId, state.currentLessonId);
    };
    $('#logoBtn').onclick = showHome;
    $('#resetBtn').onclick = () => {
      if (!confirm('Reset all progress, notes, XP, and streak? This cannot be undone.')) return;
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem('swe-academy:v2');
      Object.assign(state, {
        completed: new Set(),
        challengesDone: new Set(),
        projectStepsDone: new Set(),
        openModules: new Set(),
        currentModuleId: null,
        currentLessonId: null,
        currentProjectId: null,
        currentStepId: null,
        currentCheatId: null,
        currentCapstoneModule: null,
        currentChallengeId: null,
        currentView: 'lessons',
        notes: {},
        xp: 0,
        streak: { count: 0, lastDay: null, monthKey: '', freezesLeft: 1 },
        fc: {},
        onboardingDone: false,
        learnGoal: 'steady30',
        learnerName: '',
        lessonSeg: {},
        badgesUnlocked: new Set(),
        capstoneItems: new Set(),
        reviewCountTotal: 0,
      });
      renderSidebar();
      showHome();
    };

    const hash = location.hash.replace(/^#/, '');
    if (hash.includes('/')) {
      const [m, l] = hash.split('/');
      if (CURRICULUM.find(x => x.id === m && x.lessons.some(y => y.id === l))) {
        openLesson(m, l);
        return;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
