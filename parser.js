// Parsing and analysis of Instagram "Download your information" exports.
// Works in the browser (window.IGParse) and in Node (module.exports) so it can be tested.
(function (root) {
  const LIST_KEYS = {
    relationships_followers: 'followers',
    relationships_following: 'following',
    relationships_unfollowed_users: 'unfollowed',
    relationships_permanent_follow_requests: 'pending',
    relationships_follow_requests_sent: 'pending',
  };

  // Instagram names the files followers_1.json, following.json,
  // recently_unfollowed_profiles.json, pending_follow_requests.json (.json or .html).
  function kindFromName(name) {
    const n = name.toLowerCase();
    if (/^recently_unfollowed_profiles\.(json|html?)$/.test(n)) return 'unfollowed';
    if (/^pending_follow_requests\.(json|html?)$/.test(n)) return 'pending';
    if (/^following\.(json|html?)$/.test(n)) return 'following';
    if (/^followers(_\d+)?\.(json|html?)$/.test(n)) return 'followers';
    return null; // e.g. following_hashtags.json must not be mistaken for following.json
  }

  function usersFromJson(json) {
    let entries = json;
    let kind = null;
    if (!Array.isArray(json) && json && typeof json === 'object') {
      const key = Object.keys(json).find((k) => Array.isArray(json[k]));
      if (!key) return { kind: null, users: [] };
      entries = json[key];
      kind = LIST_KEYS[key] || null;
    }
    const users = [];
    for (const e of entries) {
      const sd = e && e.string_list_data && e.string_list_data[0];
      // Older exports put the handle in string_list_data[0].value, newer ones in title.
      const username = (sd && sd.value) || (e && e.title) || '';
      if (!username) continue;
      users.push({
        username,
        href: (sd && sd.href) || 'https://www.instagram.com/' + username,
        timestamp: (sd && sd.timestamp) || null,
      });
    }
    return { kind, users };
  }

  function usersFromHtml(html) {
    const re = /<a\s[^>]*href="https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([^/"?#]+)[^"]*"[^>]*>/gi;
    const users = [];
    let m;
    while ((m = re.exec(html))) {
      users.push({
        username: m[1],
        href: 'https://www.instagram.com/' + m[1],
        timestamp: null,
      });
    }
    return users;
  }

  // Returns { kind, users } or null when the file isn't a recognised export file.
  function parseExport(name, text) {
    const byName = kindFromName(name);
    if (/\.html?$/i.test(name)) {
      return byName ? { kind: byName, users: usersFromHtml(text) } : null;
    }
    let json;
    try { json = JSON.parse(text); } catch (e) { return null; }
    const parsed = usersFromJson(json);
    const kind = byName || parsed.kind;
    return kind && parsed.users.length ? { kind, users: parsed.users } : null;
  }

  const key = (u) => u.username.toLowerCase();

  function dedupe(users) {
    const map = new Map();
    for (const u of users) if (!map.has(key(u))) map.set(key(u), u);
    return [...map.values()];
  }

  function analyze({ followers = [], following = [], unfollowed = [], pending = [] }, previous) {
    followers = dedupe(followers);
    following = dedupe(following);
    const followerSet = new Set(followers.map(key));
    const followingSet = new Set(following.map(key));

    const notBack = following.filter((u) => !followerSet.has(key(u)));
    const fans = followers.filter((u) => !followingSet.has(key(u)));
    const mutuals = following.filter((u) => followerSet.has(key(u)));

    let lost = null;
    let gained = null;
    if (previous) {
      const prevSet = new Set(previous.followers.map((n) => n.toLowerCase()));
      lost = previous.followers
        .filter((n) => !followerSet.has(n.toLowerCase()))
        .map((username) => ({ username, href: 'https://www.instagram.com/' + username, timestamp: null }));
      gained = followers.filter((u) => !prevSet.has(key(u)));
    }

    return {
      lists: { notBack, fans, mutuals, lost, gained, unfollowed: dedupe(unfollowed), pending: dedupe(pending) },
      stats: {
        followers: followers.length,
        following: following.length,
        mutuals: mutuals.length,
        followBackRate: following.length ? mutuals.length / following.length : 0,
        ratio: following.length ? followers.length / following.length : 0,
      },
      followers,
      following,
    };
  }

  // Followers gained per month (from the follow timestamps in followers_N.json).
  function growthByMonth(followers, months = 12) {
    const counts = new Map();
    for (const u of followers) {
      if (!u.timestamp) continue;
      const d = new Date(u.timestamp * 1000);
      const k = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    if (!counts.size) return [];
    const keys = [...counts.keys()].sort();
    const out = [];
    let [y, m] = keys[keys.length - 1].split('-').map(Number);
    for (let i = 0; i < months; i++) {
      const k = y + '-' + String(m).padStart(2, '0');
      out.unshift({ month: k, count: counts.get(k) || 0 });
      if (--m === 0) { m = 12; y--; }
    }
    return out;
  }

  const api = { kindFromName, parseExport, analyze, growthByMonth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IGParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
