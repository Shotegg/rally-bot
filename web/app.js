const $ = selector => document.querySelector(selector);
let apiBase = sessionStorage.getItem('rallyApiBase') || '';
let token = sessionStorage.getItem('rallyDashboardToken') || '';
let data;

$('#api-url').value = apiBase;
$('#api-token').value = token;

function setStatus(message, error = false) {
  const status = $('#status');
  status.textContent = message;
  status.style.color = error ? '#ff9c9c' : '#9de5b1';
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function seconds(value) { return Number.isFinite(value) ? `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, '0')}s` : '—'; }
function formatCountdown(milliseconds) { const total = Math.max(0, Math.ceil(milliseconds / 1000)); return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function parseCountdown(value) { const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(String(value).trim()); return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null; }

function render() {
  $('#own-kingdom').textContent = data.ownKingdomId;
  $('#own-kingdom-import').textContent = data.ownKingdomId;
  $('#default-target').innerHTML = '<option value="">None</option>' + data.targets.map(t => `<option>${t.target}</option>`).join('');
  $('#lists').innerHTML = [['Allies', data.allies], ['Enemies', data.enemies]].map(([title, creators]) => `<section class="panel list"><h2>${title} <span class="muted">(${creators.length})</span></h2>${creators.length ? creators.map(creator => `<article class="row"><strong>${creator.name}</strong><span>${creator.player_id || '—'}</span><span>${creator.discord_user_id ? `@${creator.discord_user_id}` : 'no Discord link'}</span><span>${creator.coord_x ?? '—'}, ${creator.coord_y ?? '—'}</span><span class="timings">${data.targets.map(t => `${t.target}: ${seconds(creator.timings[t.target])}`).join(' · ')}</span><button data-edit='${encodeURIComponent(JSON.stringify(creator))}' class="secondary">Edit</button><button data-delete="${creator.side}|${creator.name}" class="secondary">Delete</button></article>`).join('') : '<p class="muted">No players yet.</p>'}</section>`).join('');
  $('#lists').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editCreator(JSON.parse(decodeURIComponent(button.dataset.edit)))));
  $('#lists').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteCreator(button.dataset.delete)));
  ['creator-panel','import-panel','lists'].forEach(id => $(`#${id}`).hidden = false);
}

async function load() { data = await request('/api/dashboard'); render(); setStatus('Connected.'); }

function editCreator(creator) {
  const form = $('#creator-form');
  ['side','name','displayName','playerId','discordUserId','coordinates','petBonusPercent','bufferSec','defaultTarget'].forEach(key => { const field = form.elements[key]; const value = ({ displayName:creator.display_name, playerId:creator.player_id, discordUserId:creator.discord_user_id, coordinates:creator.coord_x == null ? '' : `${creator.coord_x},${creator.coord_y}`, petBonusPercent:creator.pet_bonus_percent, bufferSec:creator.buffer_sec, defaultTarget:creator.default_target })[key] ?? creator[key]; field.value = value ?? ''; });
  const active = creator.pets_until > Date.now(); form.petsActive.checked = active; form.petCountdown.value = active ? formatCountdown(creator.pets_until - Date.now()) : '02:00:00';
  form.enabled.checked = creator.enabled; form.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function deleteCreator(value) {
  const [side, name] = value.split('|'); if (!confirm(`Delete ${name}?`)) return;
  try { await request('/api/creators', { method:'DELETE', body:JSON.stringify({side,name}) }); await load(); }
  catch (error) { setStatus(error.message, true); }
}

$('#connection-form').addEventListener('submit', async event => {
  event.preventDefault(); apiBase = $('#api-url').value.replace(/\/$/, ''); token = $('#api-token').value;
  sessionStorage.setItem('rallyApiBase', apiBase); sessionStorage.setItem('rallyDashboardToken', token);
  try { await load(); } catch (error) { setStatus(error.message, true); }
});

$('#creator-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); body.enabled = form.enabled.checked;
  const countdown = parseCountdown(form.petCountdown.value); if (form.petsActive.checked && countdown === null) return setStatus('Pet countdown must be HH:MM:SS.', true);
  body.petsUntil = form.petsActive.checked ? Date.now() + countdown * 1000 : 0;
  try { await request('/api/creators', { method:'PUT', body:JSON.stringify(body) }); form.reset(); form.petBonusPercent.value = '30'; form.petCountdown.value = '02:00:00'; form.bufferSec.value = '0'; form.enabled.checked = true; await load(); }
  catch (error) { setStatus(error.message, true); }
});
$('#clear-creator').addEventListener('click', () => { const form = $('#creator-form'); form.reset(); form.petBonusPercent.value = '30'; form.petCountdown.value = '02:00:00'; form.bufferSec.value = '0'; form.enabled.checked = true; });
$('#opponent-kingdom').value = localStorage.getItem('rallyOpponentKingdom') || '';
$('#opponent-kingdom').addEventListener('change', event => localStorage.setItem('rallyOpponentKingdom', event.target.value));
if (apiBase && token) load().catch(error => setStatus(error.message, true));
