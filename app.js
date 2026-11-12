const state = {
  figures: [], progress: null, module: 'Core metrics', family: '', subject: '',
  search: '', selectedPath: '', current: null
};
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const pct = (value, total) => total ? Math.round(value / total * 1000) / 10 : 0;
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const sortText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const MODULES = {
  'Core metrics': { family: 'Level', subject: 'Subject', description: 'Individual and group metric figures' },
  'Drift': { family: 'Analysis', subject: 'Subject / overview', description: 'Diffusion, lag, direction, and examples' },
  'PSD': { family: 'Analysis', subject: 'Subject', description: 'Spectrum analyses and controls' },
  'AOI': { family: 'Subject / group', subject: '', description: 'Fixation and landing summaries' }
};

async function init() {
  try {
    let figures;
    if (window.READING_META_SNAPSHOT) {
      state.progress = window.READING_META_SNAPSHOT.progress;
      figures = window.READING_META_SNAPSHOT.figures;
    } else {
      const [progressResponse, figuresResponse] = await Promise.all([fetch('data/progress.json'), fetch('data/figures.json')]);
      if (!progressResponse.ok || !figuresResponse.ok) throw new Error('Snapshot files could not be loaded.');
      state.progress = await progressResponse.json();
      figures = await figuresResponse.json();
    }
    state.figures = figures.map(item => ({ ...item, browserSubject: browserSubject(item) }));
    renderOverview(); renderSubjects(); renderFreshness(); buildModuleTabs(); bindEvents(); selectModule(state.module);
  } catch (error) {
    $('#figure-preview').innerHTML = `<div class="empty-state"><strong>Snapshot unavailable</strong><p>${esc(error.message)} Open this page through a local web server.</p></div>`;
    $('#result-count').textContent = 'Unavailable';
  }
}

function browserSubject(item) {
  if (item.module === 'AOI') return item.family;
  if (item.module !== 'Drift') return item.subject;
  const file = item.path.split('/').pop().replace(/\.webp$/i, '');
  const token = file.split('_')[0];
  if (/^(overview|example|group)$/i.test(token)) return 'Group / overview';
  return token.toUpperCase();
}

function renderOverview() {
  const { totals, subjects, metrics, generated } = state.progress;
  const processing = pct(totals.processed_blocks, totals.expected_blocks);
  const reviewed = pct(totals.pages_viewed, totals.pages_total);
  const fresh = metrics.filter(metric => metric.fresh).length;
  $('#generated-at').textContent = generated;
  $('#processing-percent').textContent = `${processing}%`;
  $('#processing-meter').style.width = `${processing}%`;
  $('#processing-caption').textContent = `${totals.processed_blocks} of ${totals.expected_blocks} registered blocks`;
  $('#review-percent').textContent = `${reviewed}%`;
  $('#review-meter').style.width = `${reviewed}%`;
  $('#review-caption').textContent = `${totals.pages_viewed.toLocaleString()} of ${totals.pages_total.toLocaleString()} pages reviewed`;
  $('#subject-total').textContent = subjects.length;
  $('#figure-total').textContent = state.figures.length;
  $('#fresh-total').textContent = `${fresh}/${metrics.length}`;
  const cards = [
    [totals.raw_blocks, 'Raw blocks found', `${totals.expected_blocks} expected from registry`],
    [totals.processed_blocks, 'Processed blocks', `${processing}% processing coverage`],
    [`${reviewed}%`, 'Pages reviewed', `${totals.pages_viewed.toLocaleString()} decisions recorded`],
    [state.figures.length, 'Published figures', 'Across PSD, AOI, drift, and core metrics']
  ];
  $('#summary-cards').innerHTML = cards.map(([number, title, detail]) => `<article class="summary-card"><span class="number">${esc(number)}</span><h3>${esc(title)}</h3><p>${esc(detail)}</p></article>`).join('');
}

function renderSubjects() {
  $('#subject-rows').innerHTML = state.progress.subjects.map(subject => {
    const processPercent = pct(subject.processed, subject.blocks);
    const status = subject.clean ? ['Ready', ''] : subject.review_percent >= 100 ? ['Review complete', ''] : ['In progress', 'pending'];
    return `<tr><td><strong>${esc(subject.subject)}</strong></td><td>${subject.processed} / ${subject.blocks}<div class="cell-caption">${subject.raw} raw found</div></td>
      <td class="progress-cell"><strong>${processPercent}%</strong><div class="mini-meter"><span style="width:${processPercent}%"></span></div></td>
      <td class="progress-cell review"><strong>${subject.review_percent}%</strong><div class="mini-meter"><span style="width:${subject.review_percent}%"></span></div><div class="cell-caption">${subject.pages_viewed} / ${subject.pages_total} pages</div></td>
      <td>${subject.segments_excluded.toLocaleString()}</td><td><span class="badge ${status[1]}">${status[0]}</span></td></tr>`;
  }).join('');
}

function renderFreshness() {
  $('#freshness-grid').innerHTML = state.progress.metrics.map(metric => `<article class="freshness-card"><span class="badge ${metric.fresh ? '' : 'pending'}">${metric.fresh ? 'Up to date' : 'Refresh needed'}</span><h4>${esc(metric.group.replace('_', ' '))}</h4><p>${plural(metric.rows, 'row')}</p><p>${esc(metric.freshness)}</p></article>`).join('');
}

function buildModuleTabs() {
  $('#module-tabs').innerHTML = Object.entries(MODULES).map(([module, meta]) => {
    const count = state.figures.filter(item => item.module === module).length;
    return `<button type="button" role="tab" aria-selected="false" data-module="${esc(module)}"><span>${esc(module)}</span><small>${count}</small><em>${esc(meta.description)}</em></button>`;
  }).join('');
}

function moduleFigures() { return state.figures.filter(item => item.module === state.module); }

function selectModule(module) {
  state.module = module;
  state.search = '';
  $('#search-input').value = '';
  document.querySelectorAll('#module-tabs button').forEach(button => {
    const active = button.dataset.module === module;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const meta = MODULES[module];
  $('#family-label').textContent = meta.family;
  $('#subject-label').textContent = meta.subject || 'Subject';
  $('#subject-control').hidden = !meta.subject;
  const families = [...new Set(moduleFigures().map(item => item.family))]
    .filter(value => module !== 'AOI' || value.toLowerCase() === 'group')
    .sort(sortText);
  state.family = families[0] || '';
  fillSelect($('#family-filter'), families, state.family);
  updateSubjects();
}

function fillSelect(select, values, selected) {
  select.innerHTML = values.map(value => `<option value="${esc(value)}">${esc(displayName(value))}</option>`).join('');
  if (values.includes(selected)) select.value = selected;
}

function displayName(value) {
  if (value === 'group') return 'Group';
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function updateSubjects() {
  const familyItems = moduleFigures().filter(item => item.family === state.family);
  const subjects = [...new Set(familyItems.map(item => item.browserSubject))].sort((a, b) => {
    if (a.includes('Group')) return -1; if (b.includes('Group')) return 1; return sortText(a, b);
  });
  state.subject = subjects.includes(state.subject) ? state.subject : (subjects[0] || '');
  fillSelect($('#subject-filter'), subjects, state.subject);
  state.selectedPath = '';
  renderFigureList();
}

function selectedSet() {
  const query = state.search.trim().toLowerCase();
  return moduleFigures().filter(item => item.family === state.family &&
    (!MODULES[state.module].subject || item.browserSubject === state.subject) &&
    (!query || `${item.title} ${item.family} ${item.browserSubject}`.toLowerCase().includes(query))
  ).sort((a, b) => sortText(a.title, b.title));
}

function renderFigureList() {
  const figures = selectedSet();
  if (!figures.some(item => item.path === state.selectedPath)) state.selectedPath = figures[0]?.path || '';
  $('#result-count').textContent = figures.length;
  $('#figure-list').innerHTML = figures.length ? figures.map(item => `<button type="button" role="option" aria-selected="${item.path === state.selectedPath}" data-path="${esc(item.path)}" class="${item.path === state.selectedPath ? 'active' : ''}"><strong>${esc(item.title)}</strong><span>${item.width} × ${item.height}</span></button>`).join('') : '<div class="list-empty">No matching figures</div>';
  document.querySelectorAll('#figure-list button').forEach(button => button.addEventListener('click', () => selectFigure(button.dataset.path)));
  selectFigure(state.selectedPath, false);
}

function selectFigure(path, rerenderList = true) {
  state.selectedPath = path;
  state.current = state.figures.find(item => item.path === path) || null;
  if (rerenderList) {
    document.querySelectorAll('#figure-list button').forEach(button => {
      const active = button.dataset.path === path;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }
  const item = state.current;
  const preview = $('#figure-preview');
  if (!item) {
    preview.classList.add('is-empty'); $('#preview-title').textContent = 'No figure selected';
    $('#preview-module').textContent = state.module; $('#preview-detail').textContent = '';
    $('#preview-image').removeAttribute('src'); $('#preview-image').alt = '';
    $('#preview-image-button').style.removeProperty('aspect-ratio');
    $('#preview-source').textContent = ''; $('#preview-expand').disabled = true; return;
  }
  preview.classList.remove('is-empty'); $('#preview-expand').disabled = false;
  $('#preview-module').textContent = `${item.module} · ${displayName(item.family)} · ${item.browserSubject}`;
  $('#preview-title').textContent = item.title;
  $('#preview-detail').textContent = `${item.width} × ${item.height} px`;
  $('#preview-image-button').style.aspectRatio = `${item.width} / ${item.height}`;
  $('#preview-image').src = item.path; $('#preview-image').alt = item.title;
  $('#preview-source').textContent = item.source;
}

function bindEvents() {
  $('#module-tabs').addEventListener('click', event => { const button = event.target.closest('button'); if (button) selectModule(button.dataset.module); });
  $('#family-filter').addEventListener('change', event => { state.family = event.target.value; state.subject = ''; updateSubjects(); });
  $('#subject-filter').addEventListener('change', event => { state.subject = event.target.value; state.selectedPath = ''; renderFigureList(); });
  $('#search-input').addEventListener('input', event => { state.search = event.target.value; state.selectedPath = ''; renderFigureList(); });
  $('#preview-expand').addEventListener('click', () => state.current && openFigure(state.current));
  $('#preview-image-button').addEventListener('click', () => state.current && openFigure(state.current));
  const dialog = $('#figure-dialog');
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}

function openFigure(item) {
  $('#dialog-image').src = item.path; $('#dialog-image').alt = item.title;
  $('#dialog-module').textContent = `${item.module} · ${displayName(item.family)} · ${item.browserSubject}`;
  $('#dialog-title').textContent = item.title; $('#dialog-source').textContent = item.source;
  $('#dialog-open').href = item.path; $('#figure-dialog').showModal();
}

init();
