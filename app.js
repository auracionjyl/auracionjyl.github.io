const state = { figures: [], progress: null, module: 'All', family: 'all', subject: 'all', search: '', visible: 24 };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const pct = (value, total) => total ? Math.round(value / total * 1000) / 10 : 0;
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

async function init() {
  try {
    const [progressResponse, figuresResponse] = await Promise.all([fetch('data/progress.json'), fetch('data/figures.json')]);
    if (!progressResponse.ok || !figuresResponse.ok) throw new Error('Snapshot files could not be loaded.');
    state.progress = await progressResponse.json();
    state.figures = await figuresResponse.json();
    renderOverview(); renderSubjects(); renderFreshness(); buildFilters(); renderGallery(); bindEvents();
  } catch (error) {
    $('#gallery').innerHTML = `<div class="empty-state"><strong>Snapshot unavailable</strong><p>${esc(error.message)} Open this page through a local web server or GitHub Pages.</p></div>`;
    $('#result-count').textContent = 'Unable to load results';
  }
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
    return `<tr>
      <td><strong>${esc(subject.subject)}</strong></td>
      <td>${subject.processed} / ${subject.blocks}<div class="cell-caption">${subject.raw} raw found</div></td>
      <td class="progress-cell"><strong>${processPercent}%</strong><div class="mini-meter"><span style="width:${processPercent}%"></span></div></td>
      <td class="progress-cell review"><strong>${subject.review_percent}%</strong><div class="mini-meter"><span style="width:${subject.review_percent}%"></span></div><div class="cell-caption">${subject.pages_viewed} / ${subject.pages_total} pages</div></td>
      <td>${subject.segments_excluded.toLocaleString()}</td>
      <td><span class="badge ${status[1]}">${status[0]}</span></td>
    </tr>`;
  }).join('');
}

function renderFreshness() {
  $('#freshness-grid').innerHTML = state.progress.metrics.map(metric => `<article class="freshness-card">
    <span class="badge ${metric.fresh ? '' : 'pending'}">${metric.fresh ? 'Up to date' : 'Refresh needed'}</span>
    <h4>${esc(metric.group.replace('_', ' '))}</h4>
    <p>${plural(metric.rows, 'row')}</p>
    <p>${esc(metric.freshness)}</p>
  </article>`).join('');
}

function buildFilters() {
  const modules = ['All', ...new Set(state.figures.map(item => item.module))];
  $('#module-tabs').innerHTML = modules.map(module => `<button type="button" data-module="${esc(module)}" class="${module === 'All' ? 'active' : ''}">${esc(module)}</button>`).join('');
  const families = [...new Set(state.figures.map(item => item.family))].sort((a,b) => a.localeCompare(b));
  $('#family-filter').insertAdjacentHTML('beforeend', families.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''));
  const subjects = [...new Set(state.figures.map(item => item.subject))].sort((a,b) => a.localeCompare(b));
  $('#subject-filter').insertAdjacentHTML('beforeend', subjects.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''));
}

function filteredFigures() {
  const query = state.search.trim().toLowerCase();
  return state.figures.filter(item =>
    (state.module === 'All' || item.module === state.module) &&
    (state.family === 'all' || item.family === state.family) &&
    (state.subject === 'all' || item.subject === state.subject) &&
    (!query || `${item.title} ${item.subject} ${item.family} ${item.module}`.toLowerCase().includes(query))
  );
}

function renderGallery() {
  const figures = filteredFigures();
  const shown = figures.slice(0, state.visible);
  $('#result-count').textContent = `${figures.length.toLocaleString()} figure${figures.length === 1 ? '' : 's'} found`;
  $('#gallery').innerHTML = shown.length ? shown.map((item, index) => `<button class="figure-card" type="button" data-index="${index}">
    <span class="figure-thumb"><img src="${esc(item.path)}" alt="${esc(item.title)}" loading="lazy" width="${item.width}" height="${item.height}"></span>
    <span class="figure-info"><span class="meta">${esc(item.module)} · ${esc(item.family)}</span><h3>${esc(item.title)}</h3><p>${esc(item.subject)} · ${item.width} × ${item.height}</p></span>
  </button>`).join('') : '<div class="empty-state"><strong>No matching figures</strong><p>Try clearing one or more filters.</p></div>';
  const loadMore = $('#load-more');
  loadMore.hidden = shown.length >= figures.length;
  loadMore.textContent = `Show more (${figures.length - shown.length} remaining)`;
  document.querySelectorAll('.figure-card').forEach((card, index) => card.addEventListener('click', () => openFigure(shown[index])));
}

function resetVisibleAndRender() { state.visible = 24; renderGallery(); }

function bindEvents() {
  $('#module-tabs').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    state.module = button.dataset.module;
    document.querySelectorAll('#module-tabs button').forEach(item => item.classList.toggle('active', item === button));
    resetVisibleAndRender();
  });
  $('#family-filter').addEventListener('change', event => { state.family = event.target.value; resetVisibleAndRender(); });
  $('#subject-filter').addEventListener('change', event => { state.subject = event.target.value; resetVisibleAndRender(); });
  $('#search-input').addEventListener('input', event => { state.search = event.target.value; resetVisibleAndRender(); });
  $('#load-more').addEventListener('click', () => { state.visible += 24; renderGallery(); });
  $('#clear-filters').addEventListener('click', () => {
    state.module = 'All'; state.family = 'all'; state.subject = 'all'; state.search = '';
    $('#family-filter').value = 'all'; $('#subject-filter').value = 'all'; $('#search-input').value = '';
    document.querySelectorAll('#module-tabs button').forEach(item => item.classList.toggle('active', item.dataset.module === 'All'));
    resetVisibleAndRender();
  });
  const dialog = $('#figure-dialog');
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}

function openFigure(item) {
  $('#dialog-image').src = item.path; $('#dialog-image').alt = item.title;
  $('#dialog-module').textContent = `${item.module} · ${item.family} · ${item.subject}`;
  $('#dialog-title').textContent = item.title;
  $('#dialog-source').textContent = item.source;
  $('#dialog-open').href = item.path;
  $('#figure-dialog').showModal();
}

init();
