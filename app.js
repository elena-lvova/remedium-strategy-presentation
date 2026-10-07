/* app.js — интерактивность страницы Ремедиум */
(function () {
  'use strict';

  /* ============ THEME TOGGLE ============ */
  (function themeInit() {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;
    let dark = window.matchMedia('(prefers-color-scheme:dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    function render() {
      toggle.setAttribute('aria-label', 'Переключить на ' + (dark ? 'светлую' : 'тёмную') + ' тему');
      toggle.innerHTML = dark
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    render();
    toggle.addEventListener('click', () => {
      dark = !dark;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      render();
    });
  })();

  /* ============ MOBILE NAV ============ */
  (function navInit() {
    const burger = document.querySelector('[data-nav-burger]');
    const mobile = document.querySelector('[data-nav-mobile]');
    burger.addEventListener('click', () => {
      const open = mobile.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    mobile.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        mobile.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      })
    );
  })();

  /* ============ SCROLL HEADER SHADOW ============ */
  (function headerScroll() {
    const header = document.getElementById('topnav');
    let last = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      last = y;
    }, { passive: true });
  })();

  /* ============ HUB (путь клиента + прямой доступ к контурам) ============ */
  const hubNodesEl = document.getElementById('hubNodes');
  const journeyRoot = document.getElementById('journeyRoot');
  const hubLinkNetwork = document.getElementById('hubLinkNetwork');

  let activeNodeId = null;
  const hubPositions = [
    { left: 50, top: 7 },
    { left: 86, top: 29 },
    { left: 86, top: 71 },
    { left: 50, top: 93 },
    { left: 14, top: 71 },
    { left: 14, top: 29 },
  ];

  function nodeById(id) { return HUB_NODES.find((n) => n.id === id); }

  function buildHubList() {
    HUB_NODES.forEach((node, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'hub-node';
      item.dataset.id = node.id;
      item.setAttribute('role', 'listitem');
      item.style.left = `${hubPositions[i].left}%`;
      item.style.top = `${hubPositions[i].top}%`;
      item.style.setProperty('--node-color', node.color);
      item.innerHTML = `
        <span class="hub-node__dot" style="background:${node.color}"></span>
        <span class="hub-node__idx">${node.index}</span>
        <span class="hub-node__label">${node.title}</span>
        <span class="hub-node__tag">${node.tagline}</span>
      `;
      item.addEventListener('click', () => openDrill(node.id));
      item.addEventListener('mouseenter', () => setHubFocus(node.id));
      item.addEventListener('focus', () => setHubFocus(node.id));
      item.addEventListener('mouseleave', clearHubFocus);
      item.addEventListener('blur', clearHubFocus);
      hubNodesEl.appendChild(item);
    });
  }

  function buildHubLinks() {
    if (!hubLinkNetwork) return;
    const positionById = Object.fromEntries(HUB_NODES.map((node, index) => [node.id, hubPositions[index]]));
    const pointToward = (from, to, distance) => {
      const dx = to.left - from.left;
      const dy = to.top - from.top;
      const length = Math.hypot(dx, dy) || 1;
      return { x: from.left + dx / length * distance, y: from.top + dy / length * distance };
    };
    HUB_LINKS.forEach((link, index) => {
      const from = positionById[link.from];
      const to = positionById[link.to];
      if (!from || !to) return;
      const start = pointToward(from, to, 12);
      const end = pointToward(to, from, 12);
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const bend = index % 2 === 0 ? 3.2 : -3.2;
      const control = {
        x: midpoint.x - dy / length * bend,
        y: midpoint.y + dx / length * bend,
      };
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
      path.setAttribute('class', 'hub-line');
      path.setAttribute('data-from', link.from);
      path.setAttribute('data-to', link.to);
      path.setAttribute('marker-end', 'url(#hubArrow)');
      hubLinkNetwork.appendChild(path);
    });
  }

  function setHubFocus(id) {
    const related = new Set([id]);
    HUB_LINKS.forEach((link) => {
      if (link.from === id) related.add(link.to);
      if (link.to === id) related.add(link.from);
    });
    hubNodesEl.querySelectorAll('.hub-node').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.id === id);
      node.classList.toggle('is-related', node.dataset.id !== id && related.has(node.dataset.id));
      node.classList.toggle('is-dimmed', !related.has(node.dataset.id));
    });
    hubLinkNetwork?.querySelectorAll('.hub-line').forEach((line) => {
      const active = line.dataset.from === id || line.dataset.to === id;
      line.classList.toggle('is-active', active);
      line.classList.toggle('is-dimmed', !active);
      line.setAttribute('marker-end', active ? 'url(#hubArrowActive)' : 'url(#hubArrow)');
    });
  }

  function clearHubFocus() {
    hubNodesEl.querySelectorAll('.hub-node').forEach((node) => {
      node.classList.remove('is-active', 'is-related', 'is-dimmed');
    });
    hubLinkNetwork?.querySelectorAll('.hub-line').forEach((line) => {
      line.classList.remove('is-active', 'is-dimmed');
      line.setAttribute('marker-end', 'url(#hubArrow)');
    });
  }

  function buildJourney() {
    JOURNEY_STAGES.forEach((stage, i) => {
      const card = document.createElement('article');
      card.className = 'journey-stage' + (i === 0 ? ' is-open' : '');
      card.dataset.id = stage.id;

      const contoursHtml = stage.contours.map((c) => {
        const node = nodeById(c.id);
        if (!node) return '';
        return `
          <button class="journey-contour" type="button" data-id="${node.id}" style="--node-color:${node.color}">
            <span class="journey-contour__dot" style="background:${node.color}"></span>
            <span class="journey-contour__body">
              <span class="journey-contour__title">${node.index} · ${node.title}</span>
              <span class="journey-contour__note">${c.note}</span>
            </span>
            <svg class="journey-contour__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        `;
      }).join('');

      card.innerHTML = `
        <button class="journey-stage__head" type="button" aria-expanded="${i === 0 ? 'true' : 'false'}">
          <span class="journey-stage__num">${stage.index}</span>
          <span class="journey-stage__headtext">
            <span class="journey-stage__question">«${stage.question}»</span>
            <span class="journey-stage__answer">${stage.answer}</span>
          </span>
          <svg class="journey-stage__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="journey-stage__body">
          <div class="journey-stage__bodyinner">
            <p class="journey-stage__summary">${stage.summary}</p>
            <div class="journey-stage__contours">${contoursHtml}</div>
          </div>
        </div>
      `;

      const head = card.querySelector('.journey-stage__head');
      head.addEventListener('click', () => {
        const open = card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });
      card.querySelectorAll('.journey-contour').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          setHubActive(btn.dataset.id);
          openDrill(btn.dataset.id);
        });
      });

      journeyRoot.appendChild(card);

      if (i < JOURNEY_STAGES.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'journey-connector';
        connector.innerHTML = '<svg width="16" height="28" viewBox="0 0 16 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v20M2 16l6 8 6-8"/></svg>';
        journeyRoot.appendChild(connector);
      }
    });
  }

  function setHubActive(id) {
    activeNodeId = id;
    hubNodesEl.querySelectorAll('.hub-node').forEach((el) => el.classList.toggle('is-active', el.dataset.id === id));
    journeyRoot.querySelectorAll('.journey-contour').forEach((el) => el.classList.toggle('is-active', el.dataset.id === id));
  }

  /* ============ DRILL-DOWN PANEL ============ */
  const drillPanel = document.getElementById('drillPanel');
  const drillIndex = document.getElementById('drillIndex');
  const drillTitle = document.getElementById('drillTitle');
  const drillSummary = document.getElementById('drillSummary');
  const drillStoryNav = document.getElementById('drillStoryNav');
  const drillStory = document.getElementById('drillStory');
  const drillBody = document.getElementById('drillBody');
  const drillConnections = document.getElementById('drillConnections');
  const drillAxesGrid = document.getElementById('drillAxesGrid');
  const drillPrevBtn = document.getElementById('drillPrev');
  const drillNextBtn = document.getElementById('drillNext');
  let lastFocused = null;

  function renderAxes(node) {
    drillAxesGrid.innerHTML = '';
    if (!node.axes) return;
    AXIS_LABELS.forEach((axis) => {
      const text = node.axes[axis.key];
      if (!text) return;
      const card = document.createElement('div');
      card.className = 'axis-card';
      card.innerHTML = `
        <p class="axis-card__label">${axis.label}</p>
        <p class="axis-card__hint">${axis.hint}</p>
        <p class="axis-card__text">${text}</p>
      `;
      drillAxesGrid.appendChild(card);
    });
  }

  function renderStory(node) {
    drillStoryNav.innerHTML = '';
    drillStory.innerHTML = '';

    node.story.forEach((step, i) => {
      const id = `story-${node.id}-${i}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'drill-story-nav__btn';
      button.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span>${step.label}`;
      button.addEventListener('click', () => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      drillStoryNav.appendChild(button);

      const section = document.createElement('section');
      section.className = 'story-step';
      section.id = id;
      section.style.setProperty('--story-color', node.color);
      section.innerHTML = `
        <div class="story-step__rail" aria-hidden="true">
          <span class="story-step__number">${String(i + 1).padStart(2, '0')}</span>
        </div>
        <div class="story-step__content">
          <p class="story-step__label">${step.label}</p>
          <h4 class="story-step__title">${step.title}</h4>
          <p class="story-step__lead">${step.lead}</p>
          <ul>${step.items.map((item) => `<li>${item}</li>`).join('')}</ul>
        </div>`;
      drillStory.appendChild(section);
    });
  }

  function renderDrillSection(sec) {
    const block = document.createElement('div');
    block.className = 'drill-block';
    let html = '<div class="drill-block__head"><h5 class="drill-block__heading">' + sec.heading + '</h5>';
    if (sec.badge) html += `<span class="drill-block__badge">${sec.badge}</span>`;
    html += '</div>';
    if (sec.subheading) html += `<p class="drill-block__sub">${sec.subheading}</p>`;
    if (sec.items && sec.items.length) {
      html += '<ul>' + sec.items.map((it) => `<li>${it}</li>`).join('') + '</ul>';
    }
    if (sec.note) html += `<p class="drill-block__note">${sec.note}</p>`;
    if (sec.quote) html += `<p class="drill-block__quote">${sec.quote}</p>`;
    block.innerHTML = html;
    return block;
  }

  function openDrill(id) {
    const node = nodeById(id);
    if (!node) return;
    lastFocused = document.activeElement;
    setHubActive(id);

    drillIndex.textContent = 'Контур ' + node.index + ' / 06';
    drillTitle.textContent = node.title;
    drillSummary.textContent = node.summary;

    renderStory(node);
    renderAxes(node);

    drillBody.innerHTML = '';
    node.sections.forEach((sec) => drillBody.appendChild(renderDrillSection(sec)));

    drillConnections.innerHTML = '';
    const outLinks = HUB_LINKS.filter((l) => l.from === id);
    const inLinks = HUB_LINKS.filter((l) => l.to === id);
    outLinks.forEach((l) => {
      const to = nodeById(l.to);
      const row = document.createElement('div');
      row.className = 'drill-conn';
      row.innerHTML = `<span class="drill-conn__dir">→ ${to.title}</span><span class="drill-conn__text"><strong>${l.label}.</strong> ${l.text}</span>`;
      drillConnections.appendChild(row);
    });
    inLinks.forEach((l) => {
      const from = nodeById(l.from);
      const row = document.createElement('div');
      row.className = 'drill-conn';
      row.innerHTML = `<span class="drill-conn__dir">← ${from.title}</span><span class="drill-conn__text"><strong>${l.label}.</strong> ${l.text}</span>`;
      drillConnections.appendChild(row);
    });

    drillPanel.classList.add('is-open');
    drillPanel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    drillPanel.scrollTop = 0;
    const sheet = drillPanel.querySelector('.drill__sheet');
    if (sheet) sheet.scrollTop = 0;
    requestAnimationFrame(() => {
      drillPanel.querySelector('.drill__close').focus();
    });
  }

  drillPrevBtn.addEventListener('click', () => {
    const idx = HUB_NODES.findIndex((n) => n.id === activeNodeId);
    if (idx === -1) return;
    const prevIdx = (idx - 1 + HUB_NODES.length) % HUB_NODES.length;
    openDrill(HUB_NODES[prevIdx].id);
  });
  drillNextBtn.addEventListener('click', () => {
    const idx = HUB_NODES.findIndex((n) => n.id === activeNodeId);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % HUB_NODES.length;
    openDrill(HUB_NODES[nextIdx].id);
  });

  function closeDrill() {
    drillPanel.classList.remove('is-open');
    drillPanel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeNodeId = null;
    setHubActive(null);
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('[data-drill-close]').forEach((el) => el.addEventListener('click', closeDrill));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drillPanel.classList.contains('is-open')) closeDrill();
  });

  /* ============ ASSETS GRID ============ */
  function buildAssets() {
    const grid = document.getElementById('assetsGrid');
    ASSETS.forEach((a) => {
      const node = nodeById(a.node);
      const card = document.createElement('article');
      card.className = 'asset-card';
      card.innerHTML = `
        <div class="asset-card__head">
          <span class="asset-card__name">${a.name}</span>
          <span class="asset-card__node" style="color:${node.color}">${node.short}</span>
        </div>
        <div class="asset-card__row">
          <p class="asset-card__label">Наличие</p>
          <p class="asset-card__have">${a.have}</p>
        </div>
        <div class="asset-card__row">
          <p class="asset-card__label">Что уже можно развивать</p>
          <p class="asset-card__grow">${a.grow}</p>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  /* ============ PACKAGES ============ */
  function buildPackages() {
    const grid = document.getElementById('packagesGrid');
    PACKAGES.forEach((pkg, i) => {
      const card = document.createElement('article');
      card.className = 'package-card';
      const bodyId = 'pkg-body-' + i;
      card.innerHTML = `
        <button class="package-card__btn" aria-expanded="false" aria-controls="${bodyId}">
          <span class="package-card__name">${pkg.name}</span>
          <span class="package-card__audience">${pkg.audience}</span>
          <span class="package-card__toggle-row">
            <span class="package-card__hint">${pkg.steps.length} компонент${pkg.steps.length > 4 ? 'ов' : (pkg.steps.length > 1 ? 'а' : '')} состава</span>
            <svg class="package-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
          </span>
        </button>
        <div class="package-card__body" id="${bodyId}">
          <div class="package-card__steps">
            ${pkg.steps.map((s, idx) => `<span class="package-step"><span class="package-step__num">${idx + 1}</span>${s}</span>`).join('')}
          </div>
          ${pkg.note ? `<p class="package-card__note">${pkg.note}</p>` : ''}
        </div>
      `;
      const btn = card.querySelector('.package-card__btn');
      btn.addEventListener('click', () => {
        const open = card.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
      grid.appendChild(card);
    });
  }

  /* ============ GOVERNMENT ============ */
  function buildGov() {
    const list = document.getElementById('govList');
    GOV_PRODUCTS.forEach((text, i) => {
      const li = document.createElement('li');
      li.className = 'gov-item';
      li.innerHTML = `<span class="gov-item__num">${String(i + 1).padStart(2, '0')}</span><span>${text}</span>`;
      list.appendChild(li);
    });
  }

  /* ============ PARTICIPANT FEEDBACK + ORGANIZER SUMMARY ============ */
  const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:5000'
    : '__PORT_5000__';
  const FEEDBACK_AXES = [
    { key: 'product', title: 'Продукт', prompt: 'Что добавить из того, что есть? Как ещё можно развивать? Что лишнее?' },
    { key: 'value', title: 'Клиентская ценность', prompt: 'На какой запрос может ещё отвечать или, наоборот, не отвечает? Какие есть комментарии по монетизации?' },
    { key: 'synergy', title: 'Синергии между направлениями', prompt: 'Что не будет работать, а что, наоборот, можно связать?' },
    { key: 'general', title: 'Общие мысли и комментарии', prompt: 'Другие замечания, вопросы и предложения.' },
  ];
  let activeFeedbackId = HUB_NODES[0].id;
  const feedbackDrafts = Object.fromEntries(HUB_NODES.map((node) => [
    node.id,
    Object.fromEntries(FEEDBACK_AXES.map((axis) => [axis.key, ''])),
  ]));

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    }[char]));
  }

  function captureFeedbackDraft() {
    document.querySelectorAll('[data-feedback-axis]').forEach((field) => {
      feedbackDrafts[activeFeedbackId][field.dataset.feedbackAxis] = field.value;
    });
  }

  function renderFeedbackForm(id) {
    activeFeedbackId = id;
    const node = nodeById(id);
    document.getElementById('feedbackIndex').textContent = `Направление ${node.index} / 06`;
    document.getElementById('feedbackTitle').textContent = node.title;
    document.getElementById('feedbackStatus').textContent = '';
    document.getElementById('feedbackFields').innerHTML = FEEDBACK_AXES.map((axis) => `
      <label class="feedback-field">
        <span class="feedback-field__title">${axis.title}</span>
        <span class="feedback-field__prompt">${axis.prompt}</span>
        <textarea data-feedback-axis="${axis.key}" data-testid="textarea-${axis.key}-${id}" maxlength="4000" placeholder="Введите комментарий">${escapeHtml(feedbackDrafts[id][axis.key])}</textarea>
      </label>
    `).join('');
    document.querySelectorAll('.feedback-tab').forEach((tab) => {
      const active = tab.dataset.id === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function buildFeedback() {
    const tabs = document.getElementById('feedbackTabs');
    HUB_NODES.forEach((node) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'feedback-tab';
      tab.dataset.id = node.id;
      tab.dataset.testid = `button-feedback-tab-${node.id}`;
      tab.style.setProperty('--node-color', node.color);
      tab.innerHTML = `<span>${node.index}</span>${node.short}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.addEventListener('click', () => {
        captureFeedbackDraft();
        renderFeedbackForm(node.id);
      });
      tabs.appendChild(tab);
    });
    renderFeedbackForm(activeFeedbackId);

    document.getElementById('feedbackForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      captureFeedbackDraft();
      const participant = document.getElementById('participantName').value.trim();
      const role = document.getElementById('participantRole').value.trim();
      const status = document.getElementById('feedbackStatus');
      const button = event.currentTarget.querySelector('[type="submit"]');
      status.textContent = '';
      button.disabled = true;
      button.textContent = 'Сохраняем…';
      try {
        const response = await fetch(`${API_BASE}/api/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant, role, directionId: activeFeedbackId, answers: feedbackDrafts[activeFeedbackId] }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Не удалось сохранить.');
        status.textContent = 'Сохранено';
        status.className = 'feedback-form__status is-success';
        document.querySelector(`.feedback-tab[data-id="${activeFeedbackId}"]`)?.classList.add('is-saved');
      } catch (error) {
        status.textContent = error.message;
        status.className = 'feedback-form__status is-error';
      } finally {
        button.disabled = false;
        button.textContent = 'Сохранить заметки по направлению';
      }
    });
  }

  async function loadSummary() {
    const key = document.getElementById('summaryKey').value;
    const message = document.getElementById('summaryMessage');
    message.textContent = 'Загружаем…';
    try {
      const response = await fetch(`${API_BASE}/api/summary`, { headers: { 'X-Admin-Key': key } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось загрузить сводку.');
      renderSummary(result.responses, result.organizerNotes || {});
      message.textContent = '';
      document.getElementById('summaryContent').hidden = false;
    } catch (error) {
      message.textContent = error.message;
      document.getElementById('summaryContent').hidden = true;
    }
  }

  function renderSummary(responses, organizerNotes) {
    const participants = new Set(responses.map((item) => item.participantKey));
    document.getElementById('summaryCount').textContent = `${participants.size} участник(ов) · ${responses.length} заполненных направлений`;
    document.getElementById('summaryList').innerHTML = HUB_NODES.map((node) => {
      const rows = responses.filter((item) => item.directionId === node.id);
      return `
        <article class="summary-direction" style="--node-color:${node.color}">
          <header><span>${node.index}</span><h3>${escapeHtml(node.title)}</h3><b>${rows.length}</b></header>
          <div class="summary-axes">
            ${FEEDBACK_AXES.map((axis) => {
              const comments = rows.filter((row) => row.answers && row.answers[axis.key]);
              return `
                <section class="summary-axis">
                  <h4>${axis.title}</h4>
                  ${comments.length ? comments.map((row) => `
                    <div class="summary-comment">
                      <p>${escapeHtml(row.answers[axis.key])}</p>
                      <span>${escapeHtml(row.participant)}${row.role ? ` · ${escapeHtml(row.role)}` : ''}</span>
                    </div>
                  `).join('') : '<p class="summary-empty">Комментариев пока нет</p>'}
                  <label class="organizer-note">
                    <span>Заметка организатора</span>
                    <textarea data-organizer-note="${node.id}:${axis.key}" placeholder="Добавьте вывод, решение или вопрос">${escapeHtml(organizerNotes[node.id] && organizerNotes[node.id][axis.key])}</textarea>
                    <button type="button" data-save-note="${node.id}:${axis.key}">Сохранить заметку</button>
                  </label>
                </section>`;
            }).join('')}
          </div>
        </article>`;
    }).join('');
    document.querySelectorAll('[data-save-note]').forEach((button) => {
      button.addEventListener('click', async () => {
        const [directionId, axis] = button.dataset.saveNote.split(':');
        const text = document.querySelector(`[data-organizer-note="${directionId}:${axis}"]`).value;
        button.disabled = true;
        button.textContent = 'Сохраняем…';
        try {
          const response = await fetch(`${API_BASE}/api/organizer-notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Key': document.getElementById('summaryKey').value },
            body: JSON.stringify({ directionId, axis, text }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Ошибка');
          button.textContent = 'Сохранено';
        } catch (error) {
          button.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function buildSummary() {
    document.getElementById('summaryLoad').addEventListener('click', loadSummary);
    document.getElementById('summaryRefresh').addEventListener('click', loadSummary);
    document.getElementById('summaryExport').addEventListener('click', async () => {
      const button = document.getElementById('summaryExport');
      button.disabled = true;
      button.textContent = 'Готовим файл…';
      try {
        const response = await fetch(`${API_BASE}/api/export.csv`, {
          headers: { 'X-Admin-Key': document.getElementById('summaryKey').value },
        });
        if (!response.ok) throw new Error('Не удалось подготовить выгрузку.');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'remedium-comments.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        document.getElementById('summaryMessage').textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Скачать для Excel (.csv)';
      }
    });
    document.getElementById('summaryKey').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') loadSummary();
    });
  }

  /* ============ INVEST MATRIX ============ */
  function buildInvest() {
    const table = document.getElementById('investTable');
    BUILD_BUY_PARTNER.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'invest-row';
      el.dataset.priority = row.priority;
      el.innerHTML = `
        <span class="invest-row__area">${row.area}</span>
        <span class="invest-row__decision">${row.decision}</span>
        <span class="invest-row__priority" data-p="${row.priority}">${PRIORITY_LABELS[row.priority]}</span>
      `;
      table.appendChild(el);
    });

    const filters = document.getElementById('investFilters');
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      filters.querySelectorAll('.chip').forEach((c) => { c.classList.remove('is-active'); c.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const p = btn.dataset.priority;
      table.querySelectorAll('.invest-row').forEach((row) => {
        row.classList.toggle('is-hidden', p !== 'all' && row.dataset.priority !== p);
      });
    });
  }

  /* ============ TEAM ============ */
  function buildTeam() {
    document.getElementById('teamFrontTitle').textContent = TEAMS.front.title;
    const frontList = document.getElementById('teamFrontList');
    TEAMS.front.items.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      frontList.appendChild(li);
    });

    document.getElementById('teamPlatformTitle').textContent = TEAMS.platform.title;
    const grid = document.getElementById('teamPlatformGrid');
    TEAMS.platform.items.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'team-platform-card';
      card.innerHTML = `<p class="team-platform-card__name">${t.name}</p><p class="team-platform-card__desc">${t.desc}</p>`;
      grid.appendChild(card);
    });
  }

  /* ============ ROADMAP ============ */
  function buildRoadmap() {
    const tabsEl = document.getElementById('roadmapTabs');
    const panelsEl = document.getElementById('roadmapPanels');
    const progressEl = document.getElementById('roadmapProgress');

    ROADMAP.forEach((phase, i) => {
      const tab = document.createElement('button');
      tab.className = 'roadmap-tab' + (i === 0 ? ' is-active' : '');
      tab.type = 'button';
      tab.textContent = phase.label;
      tab.dataset.id = phase.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      tab.addEventListener('click', () => activatePhase(phase.id));
      tabsEl.appendChild(tab);

      const panel = document.createElement('div');
      panel.className = 'roadmap-panel' + (i === 0 ? ' is-active' : '');
      panel.dataset.id = phase.id;
      panel.innerHTML = phase.items.map((item, idx) => `
        <div class="roadmap-item"><span class="roadmap-item__num">${String(idx + 1).padStart(2, '0')}</span>${item}</div>
      `).join('');
      panelsEl.appendChild(panel);
    });

    function activatePhase(id) {
      const index = ROADMAP.findIndex((p) => p.id === id);
      tabsEl.querySelectorAll('.roadmap-tab').forEach((t) => {
        const active = t.dataset.id === id;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      panelsEl.querySelectorAll('.roadmap-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.id === id));
      progressEl.style.width = ((index + 1) / ROADMAP.length) * 100 + '%';
    }
  }

  /* ============ FINAL: APPROVALS + ANSWERS + GEARS ============ */
  function buildFinal() {
    const grid = document.getElementById('approveGrid');
    APPROVALS.forEach((a, i) => {
      const card = document.createElement('div');
      card.className = 'approve-card';
      card.innerHTML = `<p class="approve-card__num">${String(i + 1).padStart(2, '0')}</p><p class="approve-card__title">${a.title}</p><p class="approve-card__text">${a.text}</p>`;
      grid.appendChild(card);
    });

    const dl = document.getElementById('finalAnswers');
    FINAL_ANSWERS.forEach((f) => {
      const wrap = document.createElement('div');
      wrap.className = 'final-answer';
      wrap.innerHTML = `<dt>${f.q}</dt><dd>${f.a}</dd>`;
      dl.appendChild(wrap);
    });

    buildFinalGears();
  }

  function buildFinalGears() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const group = document.getElementById('finalGearsGroup');
    const positions = [
      { x: 300, y: 300, r: 90, teeth: 14 },
      { x: 120, y: 170, r: 46, teeth: 10 },
      { x: 480, y: 170, r: 46, teeth: 10 },
      { x: 120, y: 430, r: 46, teeth: 10 },
      { x: 480, y: 430, r: 46, teeth: 10 },
      { x: 300, y: 90, r: 34, teeth: 8 },
    ];

    function gearPath(cx, cy, r, teeth) {
      const inner = r * 0.72;
      const toothH = r * 0.22;
      let d = '';
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * 2 * Math.PI;
        const a1 = ((i + 0.5) / teeth) * 2 * Math.PI;
        const a2 = ((i + 1) / teeth) * 2 * Math.PI;
        const p0 = { x: cx + inner * Math.cos(a0), y: cy + inner * Math.sin(a0) };
        const p1 = { x: cx + (r + toothH) * Math.cos(a0 + 0.05), y: cy + (r + toothH) * Math.sin(a0 + 0.05) };
        const p2 = { x: cx + (r + toothH) * Math.cos(a1), y: cy + (r + toothH) * Math.sin(a1) };
        const p3 = { x: cx + inner * Math.cos(a2 - 0.05), y: cy + inner * Math.sin(a2 - 0.05) };
        d += `${i === 0 ? 'M' : 'L'} ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} `;
      }
      d += 'Z';
      return d;
    }

    positions.forEach((g, i) => {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', gearPath(g.x, g.y, g.r, g.teeth));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', i === 0 ? 'var(--color-cyan)' : 'color-mix(in oklab, white 35%, transparent)');
      path.setAttribute('stroke-width', i === 0 ? '2' : '1.4');
      path.style.transformOrigin = `${g.x}px ${g.y}px`;
      path.style.animation = `spin-gear ${i === 0 ? 22 : 14 + i * 2}s linear infinite ${i % 2 === 0 ? 'normal' : 'reverse'}`;
      group.appendChild(path);

      const hole = document.createElementNS(svgNS, 'circle');
      hole.setAttribute('cx', g.x); hole.setAttribute('cy', g.y); hole.setAttribute('r', g.r * 0.28);
      hole.setAttribute('fill', 'none');
      hole.setAttribute('stroke', i === 0 ? 'var(--color-cyan)' : 'color-mix(in oklab, white 35%, transparent)');
      hole.setAttribute('stroke-width', '1.2');
      group.appendChild(hole);
    });

    const style = document.createElement('style');
    style.textContent = '@keyframes spin-gear { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { #finalGearsGroup path { animation: none !important; } }';
    document.head.appendChild(style);
  }

  /* ============ INIT ============ */
  buildJourney();
  buildHubList();
  buildHubLinks();
  buildAssets();
  buildPackages();
  buildGov();
  buildFeedback();
  buildSummary();
})();
