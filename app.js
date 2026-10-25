(() => {
  const { parseExport, analyze, growthByMonth } = window.IGParse;
  const STORE = 'ig-follower-analyzer:snapshots';

  const TABS = [
    { id: 'notBack', label: "Don't follow you back", hint: 'People you follow who do not follow you back.' },
    { id: 'fans', label: 'Fans', hint: "People who follow you but you don't follow back." },
    { id: 'mutuals', label: 'Mutuals', hint: 'You follow each other.' },
    { id: 'lost', label: 'Lost followers', hint: 'Followers present in your last saved snapshot but gone now (unfollowed you or deactivated).' },
    { id: 'gained', label: 'New followers', hint: 'Followers added since your last saved snapshot.' },
    { id: 'unfollowed', label: 'Unfollowed by you', hint: 'Profiles you recently unfollowed (from the export).' },
    { id: 'pending', label: 'Pending requests', hint: 'Follow requests you sent that are still pending.' },
  ];

  const $ = (id) => document.getElementById(id);
  const state = { result: null, tab: 'notBack', query: '', previous: null };

  // ---- saved snapshots (only used to detect who left between two uploads)
  const loadSnaps = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; }
  };
  const saveSnaps = (snaps) => {
    try { localStorage.setItem(STORE, JSON.stringify(snaps.slice(-10))); } catch (e) { /* storage unavailable */ }
  };

  // ---- file handling
  async function handleFiles(fileList) {
    const files = [...fileList];
    const data = { followers: [], following: [], unfollowed: [], pending: [] };
    let used = 0;
    for (const f of files) {
      if (!/\.(json|html?)$/i.test(f.name)) continue;
      const parsed = parseExport(f.name, await f.text());
      if (parsed) { data[parsed.kind].push(...parsed.users); used++; }
    }
    if (!data.followers.length || !data.following.length) {
      const missing = [!data.followers.length && 'followers_1.json', !data.following.length && 'following.json'].filter(Boolean);
      return status(`Missing ${missing.join(' and ')}. Select the files from connections/followers_and_following/.`, true);
    }
    status(`Read ${used} file${used === 1 ? '' : 's'}.`);

    const snaps = loadSnaps();
    const previous = snaps.length ? snaps[snaps.length - 1] : null;
    state.result = analyze(data, previous);
    state.previous = previous;

    // Only store a new snapshot when the follower set actually changed.
    const { lost, gained } = state.result.lists;
    if (!previous || lost.length || gained.length) {
      saveSnaps([...snaps, { date: new Date().toISOString(), followers: state.result.followers.map((u) => u.username) }]);
    }

    state.tab = 'notBack';
    state.query = '';
    $('search').value = '';
    render();
  }

  function status(msg, isErr) {
    const el = $('status');
    el.textContent = msg;
    el.className = 'status' + (isErr ? ' err' : '');
  }

  // ---- rendering
  function visibleTabs() {
    const l = state.result.lists;
    return TABS.filter((t) => {
      if (t.id === 'lost' || t.id === 'gained') return state.previous !== null;
      if (t.id === 'unfollowed' || t.id === 'pending') return l[t.id].length > 0;
      return true;
    });
  }

  function render() {
    const { stats, followers, lists } = state.result;
    $('results').hidden = false;

    const tiles = [
      [stats.followers, 'Followers'],
      [stats.following, 'Following'],
      [lists.notBack.length, "Don't follow back"],
      [lists.fans.length, 'Fans'],
      [Math.round(stats.followBackRate * 100) + '%', 'Of your follows follow you back'],
      [stats.ratio.toFixed(2), 'Followers / following'],
    ];
    $('stats').replaceChildren(...tiles.map(([v, label]) => {
      const d = document.createElement('div');
      d.className = 'stat';
      const b = document.createElement('b'); b.textContent = v;
      const s = document.createElement('span'); s.textContent = label;
      d.append(b, s);
      return d;
    }));

    renderGrowth(growthByMonth(followers));

    const tabs = visibleTabs();
    if (!tabs.some((t) => t.id === state.tab)) state.tab = tabs[0].id;
    $('tabs').replaceChildren(...tabs.map((t) => {
      const b = document.createElement('button');
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === state.tab));
      b.textContent = `${t.label} (${lists[t.id].length})`;
      b.onclick = () => { state.tab = t.id; render(); };
      return b;
    }));
    renderList();
  }

  function renderGrowth(months) {
    const el = $('growth');
    el.parentElement.hidden = months.length === 0;
    const max = Math.max(1, ...months.map((m) => m.count));
    el.replaceChildren(...months.map((m) => {
      const d = document.createElement('div');
      d.className = 'bar';
      d.title = `${m.month}: ${m.count}`;
      const n = document.createElement('span'); n.textContent = m.count || '';
      const i = document.createElement('i'); i.style.height = (m.count / max) * 80 + '%';
      const l = document.createElement('span'); l.textContent = m.month.slice(5);
      d.append(n, i, l);
      return d;
    }));
  }

  function currentRows() {
    const tab = TABS.find((t) => t.id === state.tab);
    const q = state.query.trim().toLowerCase();
    return {
      tab,
      rows: state.result.lists[tab.id].filter((u) => u.username.toLowerCase().includes(q)),
    };
  }

  function renderList() {
    const { tab, rows } = currentRows();
    let hint = tab.hint;
    if ((tab.id === 'lost' || tab.id === 'gained') && state.previous) {
      hint += ` Compared with snapshot from ${new Date(state.previous.date).toLocaleDateString()}.`;
    }
    $('hint').textContent = hint;

    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nobody here.';
      return $('list').replaceChildren(li);
    }
    $('list').replaceChildren(...rows.map((u) => {
      const li = document.createElement('li');
      const av = document.createElement('div'); av.className = 'avatar'; av.textContent = u.username[0].toUpperCase();
      const a = document.createElement('a');
      a.href = 'https://www.instagram.com/' + encodeURIComponent(u.username);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = u.username;
      li.append(av, a);
      if (u.timestamp) {
        const s = document.createElement('small');
        s.textContent = new Date(u.timestamp * 1000).toLocaleDateString();
        li.append(s);
      }
      return li;
    }));
  }

  // ---- actions
  $('search').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });

  $('copy').onclick = async () => {
    const { rows } = currentRows();
    try { await navigator.clipboard.writeText(rows.map((u) => u.username).join('\n')); status(`Copied ${rows.length} usernames.`); }
    catch (e) { status('Copy not available in this browser.', true); }
  };

  $('csv').onclick = () => {
    const { tab, rows } = currentRows();
    const csv = 'username,profile,date\n' + rows.map((u) =>
      [u.username, 'https://www.instagram.com/' + u.username, u.timestamp ? new Date(u.timestamp * 1000).toISOString().slice(0, 10) : ''].join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${tab.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  $('clear').onclick = () => {
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    state.previous = null;
    if (state.result) { state.result.lists.lost = state.result.lists.gained = null; render(); }
    status('Saved snapshots cleared.');
  };

  // ---- inputs
  $('pickFiles').onchange = (e) => handleFiles(e.target.files);
  $('pickFolder').onchange = (e) => handleFiles(e.target.files);

  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => {
    const items = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (!items.length) return handleFiles(e.dataTransfer.files);
    const files = [];
    const walk = async (entry) => {
      if (entry.isFile) files.push(await new Promise((res, rej) => entry.file(res, rej)));
      else if (entry.isDirectory) {
        const reader = entry.createReader();
        let batch;
        do {
          batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          for (const child of batch) await walk(child);
        } while (batch.length);
      }
    };
    for (const entry of items) await walk(entry);
    handleFiles(files);
  });
})();
