const test = require('node:test');
const assert = require('node:assert');
const { parseExport, analyze, growthByMonth, kindFromName } = require('./parser');

const entry = (value, ts) => ({ title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + value, value, timestamp: ts }] });
const titled = (title, ts) => ({ title, media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/_u/' + title, timestamp: ts }] });

test('kindFromName', () => {
  assert.equal(kindFromName('followers_1.json'), 'followers');
  assert.equal(kindFromName('following.json'), 'following');
  assert.equal(kindFromName('recently_unfollowed_profiles.json'), 'unfollowed');
  assert.equal(kindFromName('pending_follow_requests.html'), 'pending');
  assert.equal(kindFromName('profile.json'), null);
});

test('parses followers array (handle in value) and following object (handle in title)', () => {
  const f = parseExport('followers_1.json', JSON.stringify([entry('Ana', 1700000000), entry('bob', 1700000001)]));
  assert.equal(f.kind, 'followers');
  assert.deepEqual(f.users.map((u) => u.username), ['Ana', 'bob']);
  const g = parseExport('following.json', JSON.stringify({ relationships_following: [titled('ana', 1), titled('carl', 2)] }));
  assert.equal(g.kind, 'following');
  assert.deepEqual(g.users.map((u) => u.username), ['ana', 'carl']);
});

test('parses html export', () => {
  const html = '<a target="_blank" href="https://www.instagram.com/dave">dave</a><a href="https://www.instagram.com/_u/eve/">eve</a>';
  const r = parseExport('following.html', html);
  assert.deepEqual(r.users.map((u) => u.username), ['dave', 'eve']);
});

test('ignores unrelated or invalid files', () => {
  assert.equal(parseExport('other.json', '{"a":1}'), null);
  assert.equal(parseExport('followers_1.json', 'not json'), null);
});

test('analyze splits lists case-insensitively', () => {
  const followers = [{ username: 'Ana' }, { username: 'bob' }];
  const following = [{ username: 'ana' }, { username: 'carl' }];
  const r = analyze({ followers, following });
  assert.deepEqual(r.lists.notBack.map((u) => u.username), ['carl']);
  assert.deepEqual(r.lists.fans.map((u) => u.username), ['bob']);
  assert.deepEqual(r.lists.mutuals.map((u) => u.username), ['ana']);
  assert.equal(r.stats.followBackRate, 0.5);
  assert.equal(r.lists.lost, null);
});

test('analyze diffs against previous snapshot', () => {
  const r = analyze(
    { followers: [{ username: 'bob' }, { username: 'zed' }], following: [] },
    { followers: ['bob', 'Ana'] },
  );
  assert.deepEqual(r.lists.lost.map((u) => u.username), ['Ana']);
  assert.deepEqual(r.lists.gained.map((u) => u.username), ['zed']);
});

test('growthByMonth buckets by month and fills gaps', () => {
  const ts = (iso) => Date.parse(iso) / 1000;
  const g = growthByMonth([{ timestamp: ts('2026-03-10') }, { timestamp: ts('2026-03-11') }, { timestamp: ts('2026-01-05') }], 3);
  assert.deepEqual(g, [{ month: '2026-01', count: 1 }, { month: '2026-02', count: 0 }, { month: '2026-03', count: 2 }]);
});
