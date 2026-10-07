/* board.js — живая доска стратегии: свободное перетаскивание кусочков/шестерёнок,
   соединения между ними и стикеры-комментарии. Presenter-only инструмент. */
(function () {
  'use strict';

  /* ============ THEME TOGGLE (тот же паттерн, что на основной странице) ============ */
  (function themeInit() {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;
    let dark = window.matchMedia('(prefers-color-scheme:dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    function render() {
      toggle.setAttribute('aria-label', 'Переключить на ' + (dark ? 'светлую' : 'тёмную') + ' тему');
      toggle.innerHTML = dark
        ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    render();
    toggle.addEventListener('click', () => {
      dark = !dark;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      render();
    });
  })();

  /* ============ SEED DATA — 6 контуров + их исходные связи ============ */
  const SEED_PIECES = [
    { id: 'market', label: 'Market Intelligence', color: 'var(--color-accent)', x: 260, y: 160 },
    { id: 'decision', label: 'Forecast & Decision', color: 'var(--color-warning)', x: 680, y: 160 },
    { id: 'hcp', label: 'HCP & Pharmacy Identity', color: 'var(--color-gold)', x: 1100, y: 240 },
    { id: 'callcenter', label: 'Call Center & Research', color: 'var(--color-cyan)', x: 1100, y: 560 },
    { id: 'engagement', label: 'Engagement & Execution', color: 'var(--color-primary)', x: 680, y: 640 },
    { id: 'content', label: 'HCP Portal & Content', color: 'var(--color-success)', x: 260, y: 520 },
  ];
  const SEED_LINKS = [
    ['market', 'decision'], ['decision', 'hcp'],
    ['hcp', 'callcenter'], ['callcenter', 'decision'], ['callcenter', 'engagement'],
    ['decision', 'engagement'], ['engagement', 'content'],
    ['content', 'hcp'], ['content', 'market'], ['engagement', 'decision'],
  ];
  const SWATCH_COLORS = [
    'var(--color-accent)', 'var(--color-primary)', 'var(--color-gold)',
    'var(--color-cyan)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)',
  ];

  function cloneSeed() {
    return {
      pieces: SEED_PIECES.map((p) => Object.assign({}, p)),
      links: SEED_LINKS.map((l) => l.slice()),
      notes: [],
    };
  }

  let state = cloneSeed();
  let nextPieceId = 1;
  let nextNoteId = 1;
  let connectMode = false;
  let connectSource = null;

  // Состояние доски живёт только в памяти на время сессии — без сохранения между
  // перезагрузками, чтобы доска надёжно работала в любом окружении показа.
  function saveState() {}

  /* ============ DOM refs ============ */
  const canvas = document.getElementById('boardCanvas');
  const piecesLayer = document.getElementById('boardPieces');
  const notesLayer = document.getElementById('boardNotes');
  const linksSvg = document.getElementById('boardLinks');
  const hintEl = document.getElementById('boardHint');
  const modal = document.getElementById('pieceModal');
  const nameInput = document.getElementById('pieceNameInput');
  const swatchesEl = document.getElementById('pieceColorSwatches');

  let selectedColor = SWATCH_COLORS[0];

  /* ============ RENDER ============ */
  function pieceById(id) {
    return state.pieces.find((p) => p.id === id);
  }

  function renderAll() {
    renderPieces();
    renderNotes();
    renderLinks();
    saveState();
  }

  function renderPieces() {
    piecesLayer.innerHTML = '';
    state.pieces.forEach((piece) => {
      const el = document.createElement('div');
      el.className = 'board-piece';
      el.dataset.id = piece.id;
      el.style.left = piece.x + 'px';
      el.style.top = piece.y + 'px';
      el.style.setProperty('--piece-color', piece.color);
      if (connectSource === piece.id) el.classList.add('is-connect-source');
      el.innerHTML = `
        <span class="board-piece__label">${escapeHtml(piece.label)}</span>
        <button type="button" class="board-piece__remove" aria-label="Удалить кусочек" data-remove-piece="${piece.id}">✕</button>
      `;
      piecesLayer.appendChild(el);
      makeDraggable(el, piece, renderLinks);
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove-piece]')) return;
        if (!connectMode) return;
        handlePieceClickForConnect(piece.id);
      });
    });
    piecesLayer.querySelectorAll('[data-remove-piece]').forEach((btn) => {
      btn.addEventListener('click', () => removePiece(btn.dataset.removePiece));
    });
  }

  function renderNotes() {
    notesLayer.innerHTML = '';
    state.notes.forEach((note) => {
      const el = document.createElement('div');
      el.className = 'board-note';
      el.dataset.id = note.id;
      el.style.left = note.x + 'px';
      el.style.top = note.y + 'px';
      el.innerHTML = `
        <button type="button" class="board-note__remove" aria-label="Удалить стикер" data-remove-note="${note.id}">✕</button>
        <textarea class="board-note__text" placeholder="Комментарий...">${escapeHtml(note.text)}</textarea>
      `;
      notesLayer.appendChild(el);
      const textarea = el.querySelector('textarea');
      textarea.addEventListener('input', () => {
        note.text = textarea.value;
        saveState();
      });
      textarea.addEventListener('pointerdown', (e) => e.stopPropagation());
      makeDraggable(el, note, null, true);
    });
    notesLayer.querySelectorAll('[data-remove-note]').forEach((btn) => {
      btn.addEventListener('click', () => removeNote(btn.dataset.removeNote));
    });
  }

  function resolveColorToHex(cssVarExpr) {
    // reads the actual computed color for a `var(--token)` string so SVG gradient stops
    // (which need real values, not always live var() in every renderer) paint correctly.
    const probe = document.createElement('span');
    probe.style.color = cssVarExpr;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved || '#0f766e';
  }

  function renderLinks() {
    linksSvg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    linksSvg.appendChild(defs);
    state.links.forEach((link, i) => {
      const from = pieceById(link[0]);
      const to = pieceById(link[1]);
      if (!from || !to) return;
      const fromCenter = { x: from.x + 88, y: from.y + 48 };
      const toCenter = { x: to.x + 88, y: to.y + 48 };
      const gradId = 'boardGrad' + i;
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.setAttribute('x1', fromCenter.x); grad.setAttribute('y1', fromCenter.y);
      grad.setAttribute('x2', toCenter.x); grad.setAttribute('y2', toCenter.y);
      const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', resolveColorToHex(from.color));
      const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', resolveColorToHex(to.color));
      grad.appendChild(s1); grad.appendChild(s2);
      defs.appendChild(grad);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromCenter.x); line.setAttribute('y1', fromCenter.y);
      line.setAttribute('x2', toCenter.x); line.setAttribute('y2', toCenter.y);
      line.setAttribute('stroke', `url(#${gradId})`);
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('class', 'board-link');
      line.style.pointerEvents = 'stroke';
      line.addEventListener('click', () => {
        if (!connectMode) return;
        state.links.splice(i, 1);
        renderAll();
      });
      linksSvg.appendChild(line);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ============ DRAG ============ */
  function makeDraggable(el, model, onMove) {
    let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.tagName === 'TEXTAREA') return;
      dragging = true;
      el.classList.add('is-dragging');
      el.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      origX = model.x; origY = model.y;
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      model.x = Math.max(0, origX + dx);
      model.y = Math.max(0, origY + dy);
      el.style.left = model.x + 'px';
      el.style.top = model.y + 'px';
      if (onMove) onMove();
    });
    function stop(e) {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      saveState();
    }
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  }

  /* ============ ACTIONS ============ */
  function removePiece(id) {
    state.pieces = state.pieces.filter((p) => p.id !== id);
    state.links = state.links.filter((l) => l[0] !== id && l[1] !== id);
    if (connectSource === id) connectSource = null;
    renderAll();
  }

  function removeNote(id) {
    state.notes = state.notes.filter((n) => n.id !== id);
    renderAll();
  }

  function handlePieceClickForConnect(id) {
    if (!connectSource) {
      connectSource = id;
      renderPieces();
      return;
    }
    if (connectSource === id) {
      connectSource = null;
      renderPieces();
      return;
    }
    const a = connectSource, b = id;
    const existingIdx = state.links.findIndex(
      (l) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a)
    );
    if (existingIdx >= 0) {
      state.links.splice(existingIdx, 1);
    } else {
      state.links.push([a, b]);
    }
    connectSource = null;
    renderAll();
  }

  function randomOffset() {
    return Math.round(Math.random() * 160 - 80);
  }

  function addNote() {
    const note = {
      id: 'note-' + nextNoteId++,
      text: '',
      x: 300 + randomOffset() + 400,
      y: 300 + randomOffset(),
    };
    state.notes.push(note);
    renderAll();
    requestAnimationFrame(() => {
      const el = notesLayer.querySelector(`[data-id="${note.id}"] textarea`);
      if (el) el.focus();
    });
  }

  function openPieceModal() {
    nameInput.value = '';
    selectedColor = SWATCH_COLORS[0];
    swatchesEl.innerHTML = '';
    SWATCH_COLORS.forEach((color) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'board-swatch' + (color === selectedColor ? ' is-selected' : '');
      sw.style.background = color;
      sw.addEventListener('click', () => {
        selectedColor = color;
        swatchesEl.querySelectorAll('.board-swatch').forEach((s) => s.classList.remove('is-selected'));
        sw.classList.add('is-selected');
      });
      swatchesEl.appendChild(sw);
    });
    modal.hidden = false;
    nameInput.focus();
  }

  function closePieceModal() {
    modal.hidden = true;
  }

  function confirmAddPiece() {
    const label = nameInput.value.trim();
    if (!label) {
      nameInput.focus();
      return;
    }
    state.pieces.push({
      id: 'piece-' + nextPieceId++,
      label,
      color: selectedColor,
      x: 500 + randomOffset(),
      y: 300 + randomOffset(),
    });
    closePieceModal();
    renderAll();
  }

  function toggleConnectMode(btn) {
    connectMode = !connectMode;
    connectSource = null;
    btn.dataset.toggle = String(connectMode);
    hintEl.classList.toggle('is-connecting', connectMode);
    hintEl.textContent = connectMode
      ? 'Режим «Соединить» включён — кликните по двум кусочкам, чтобы провести связь, ещё раз по паре — чтобы убрать. Клик по линии тоже удаляет её.'
      : 'Перетаскивайте кусочки, добавляйте новые, включайте режим «Соединить» и кликайте по двум кусочкам, чтобы провести или убрать связь. Комментарии — на стикерах, которые можно двигать и редактировать.';
    renderPieces();
  }

  function resetBoard() {
    if (!window.confirm('Сбросить доску к исходным шести контурам и их связям? Все добавленные кусочки, связи и стикеры будут удалены.')) return;
    state = cloneSeed();
    connectSource = null;
    renderAll();
  }

  /* ============ WIRE UP ============ */
  document.querySelector('[data-action="add-piece"]').addEventListener('click', openPieceModal);
  document.querySelector('[data-action="add-note"]').addEventListener('click', addNote);
  document.querySelector('[data-action="connect-mode"]').addEventListener('click', (e) => toggleConnectMode(e.currentTarget));
  document.querySelector('[data-action="reset"]').addEventListener('click', resetBoard);
  document.querySelector('[data-action="cancel-piece"]').addEventListener('click', closePieceModal);
  document.querySelector('[data-action="confirm-piece"]').addEventListener('click', confirmAddPiece);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmAddPiece();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePieceModal();
  });

  renderAll();
})();
