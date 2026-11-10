const $ = selector => document.querySelector(selector);
let apiBase = sessionStorage.getItem('rallyApiBase') || '';
let token = sessionStorage.getItem('rallyDashboardToken') || '';
let data;
let preview = [];

$('#api-url').value = apiBase;
$('#api-token').value = token;

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}
function setStatus(message, error = false) {
  const status = $('#status'); status.textContent = message; status.style.color = error ? '#ff9c9c' : '#9de5b1';
}
async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
function seconds(value) { return Number.isFinite(value) ? `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, '0')}s` : '—'; }
function formatCountdown(milliseconds) { const total = Math.max(0, Math.ceil(milliseconds / 1000)); return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function parseCountdown(value) { const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(String(value).trim()); return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null; }
function payload(value) { return encodeURIComponent(JSON.stringify(value)); }
function readPayload(value) { return JSON.parse(decodeURIComponent(value)); }

function counterButtons(creator) {
  return data.targets.map(({ target }) => `<label class="counter"><input type="checkbox" data-counter="${payload({ name: creator.name, target })}" ${creator.counter_targets?.[target] ? 'checked' : ''}>${escapeHtml(target.replace(' Turret', ''))}</label>`).join('');
}
function enemyAllies(creator) {
  if (!data.allies.length) return '<span class="muted">No allies to select.</span>';
  return `<details class="enemy-allies"><summary>Counter allies (${creator.enemy_allies?.length || 0})</summary>${data.allies.map(ally => `<label class="counter"><input type="checkbox" data-enemy="${payload({ enemy: creator.name, ally: ally.name })}" ${creator.enemy_allies?.includes(ally.name) ? 'checked' : ''}>${escapeHtml(ally.name)}</label>`).join('')}</details>`;
}
function creatorRow(creator) {
  const control = creator.side === 'ally' ? `<div class="counters"><span>Counter targets:</span>${counterButtons(creator)}</div>` : enemyAllies(creator);
  return `<article class="row"><strong>${escapeHtml(creator.name)}</strong><span>${escapeHtml(creator.player_id || '—')}</span><span>${creator.discord_user_id ? `@${escapeHtml(creator.discord_user_id)}` : 'no Discord link'}</span><span>${creator.coord_x ?? '—'}, ${creator.coord_y ?? '—'}</span><span class="timings">${data.targets.map(t => `${escapeHtml(t.target)}: ${seconds(creator.timings[t.target])}`).join(' · ')}</span><div>${control}</div><button data-edit="${payload(creator)}" class="secondary">Edit</button><button data-delete="${payload({ side: creator.side, name: creator.name })}" class="secondary">Delete</button></article>`;
}
function render() {
  $('#own-kingdom').textContent = data.ownKingdomId;
  $('#own-kingdom-import').textContent = data.ownKingdomId;
  $('#mystic-kingdom').value ||= data.ownKingdomId;
  $('#default-target').innerHTML = '<option value="">None</option>' + data.targets.map(t => `<option>${escapeHtml(t.target)}</option>`).join('');
  $('#lists').innerHTML = [['Allies', data.allies], ['Enemies', data.enemies]].map(([title, creators]) => `<section class="panel list"><h2>${title} <span class="muted">(${creators.length})</span></h2>${creators.length ? creators.map(creatorRow).join('') : '<p class="muted">No players yet.</p>'}</section>`).join('');
  $('#lists').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editCreator(readPayload(button.dataset.edit))));
  $('#lists').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteCreator(readPayload(button.dataset.delete))));
  $('#lists').querySelectorAll('[data-counter]').forEach(input => input.addEventListener('change', () => saveCounter({ side: 'ally', ...readPayload(input.dataset.counter), enabled: input.checked })));
  $('#lists').querySelectorAll('[data-enemy]').forEach(input => input.addEventListener('change', () => saveEnemyAllies(readPayload(input.dataset.enemy))));
  ['creator-panel', 'import-panel', 'lists'].forEach(id => $(`#${id}`).hidden = false);
}
async function load() { data = await request('/api/dashboard'); render(); setStatus('Connected.'); }
function editCreator(creator) {
  const form = $('#creator-form');
  const values = { side: creator.side, name: creator.name, displayName: creator.display_name, playerId: creator.player_id, discordUserId: creator.discord_user_id, coordinates: creator.coord_x == null ? '' : `${creator.coord_x},${creator.coord_y}`, petBonusPercent: creator.pet_bonus_percent, bufferSec: creator.buffer_sec, defaultTarget: creator.default_target };
  Object.entries(values).forEach(([key, value]) => { form.elements[key].value = value ?? ''; });
  const active = creator.pets_until > Date.now(); form.petsActive.checked = active; form.petCountdown.value = active ? formatCountdown(creator.pets_until - Date.now()) : '02:00:00'; form.enabled.checked = creator.enabled;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function deleteCreator(value) {
  if (!confirm(`Delete ${value.name}?`)) return;
  try { await request('/api/creators', { method: 'DELETE', body: JSON.stringify(value) }); await load(); } catch (error) { setStatus(error.message, true); }
}
async function saveCounter(value) {
  try { await request('/api/counters', { method: 'PUT', body: JSON.stringify(value) }); await load(); } catch (error) { setStatus(error.message, true); }
}
async function saveEnemyAllies(value) {
  const boxes = [...document.querySelectorAll('[data-enemy]')].filter(input => readPayload(input.dataset.enemy).enemy === value.enemy && input.checked);
  try { await request('/api/counters', { method: 'PUT', body: JSON.stringify({ side: 'enemy', name: value.enemy, allies: boxes.map(input => readPayload(input.dataset.enemy).ally) }) }); await load(); } catch (error) { setStatus(error.message, true); }
}
function resetCreator() {
  const form = $('#creator-form'); form.reset(); form.petBonusPercent.value = '30'; form.petCountdown.value = '02:00:00'; form.bufferSec.value = '0'; form.enabled.checked = true;
}
function renderPreview(result) {
  preview = result.candidates || [];
  const box = $('#mystic-preview');
  if (!preview.length) { box.innerHTML = `<p class="muted">No Mystic Trial players returned for that kingdom.${result.diagnostic ? ` ${escapeHtml(result.diagnostic)}` : ''}</p>`; return; }
  box.innerHTML = `<p class="hint">Kingdom ${escapeHtml(result.kingdomId)} · select players to import. Coordinates with “stale” may be up to one hour old.</p><form id="import-selected"><div class="preview-list">${preview.map((player, index) => `<label class="preview-row"><input type="checkbox" name="player" value="${index}" checked><strong>${escapeHtml(player.name)}</strong><span>ID ${escapeHtml(player.playerId)}</span><span>${player.coordX ?? '—'}, ${player.coordY ?? '—'}</span><span>${player.fresh === false ? 'stale' : 'fresh / unknown'}</span></label>`).join('')}</div><button>Import selected as ${$('#mystic-side').value === 'ally' ? 'Allies' : 'Enemies'}</button></form>`;
  $('#import-selected').addEventListener('submit', importSelected);
}
async function importSelected(event) {
  event.preventDefault();
  const selected = [...new FormData(event.currentTarget).getAll('player')].map(index => preview[Number(index)]).filter(Boolean);
  if (!selected.length) return setStatus('Select at least one player.', true);
  const button = event.currentTarget.querySelector('button'); button.disabled = true; button.textContent = 'Importing…';
  try {
    const result = await request('/api/mightpulse/import', { method: 'POST', body: JSON.stringify({ side: $('#mystic-side').value, candidates: selected }) });
    const detail = result.skipped?.length ? ` Skipped: ${result.skipped.join(', ')}.` : '';
    $('#mystic-preview').insertAdjacentHTML('afterbegin', `<p class="import-result">Imported ${result.saved.length} player(s).${escapeHtml(detail)}</p>`);
    setStatus(`Imported ${result.saved.length} player(s).`);
    await load();
  } catch (error) {
    $('#mystic-preview').insertAdjacentHTML('afterbegin', `<p class="import-error">Import failed: ${escapeHtml(error.message)}</p>`);
    setStatus(error.message, true);
  } finally { button.disabled = false; button.textContent = `Import selected as ${$('#mystic-side').value === 'ally' ? 'Allies' : 'Enemies'}`; }
}

$('#connection-form').addEventListener('submit', async event => { event.preventDefault(); apiBase = $('#api-url').value.replace(/\/$/, ''); token = $('#api-token').value; sessionStorage.setItem('rallyApiBase', apiBase); sessionStorage.setItem('rallyDashboardToken', token); try { await load(); } catch (error) { setStatus(error.message, true); } });
$('#creator-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); body.enabled = form.enabled.checked; const countdown = parseCountdown(form.petCountdown.value); if (form.petsActive.checked && countdown === null) return setStatus('Pet countdown must be HH:MM:SS.', true); body.petsUntil = form.petsActive.checked ? Date.now() + countdown * 1000 : 0; try { await request('/api/creators', { method: 'PUT', body: JSON.stringify(body) }); resetCreator(); await load(); } catch (error) { setStatus(error.message, true); } });
$('#clear-creator').addEventListener('click', resetCreator);
$('#mystic-form').addEventListener('submit', async event => { event.preventDefault(); try { const result = await request(`/api/mightpulse/mystic-trial?kingdomId=${encodeURIComponent($('#mystic-kingdom').value)}`); renderPreview(result); } catch (error) { setStatus(error.message, true); } });
if (apiBase && token) load().catch(error => setStatus(error.message, true));
