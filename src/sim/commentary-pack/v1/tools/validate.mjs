import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { context, matches, render, choose } from './reference_matcher.mjs';

const root = new URL('../', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const banks = ['ball_calls', 'commentator_lines', 'match_context'];
const payloads = Object.fromEntries(banks.map(bank => [bank, read(`${bank}.json`)]));
const examples = read('examples.json').cases;
const allowedPaths = new Set(Object.keys(read('field_mapping.json').paths));
const keys = ['id', 'category', 'speaker', 'requires', 'text', 'repeat_group', 'weight', 'priority', 'cooldown_balls'];
const placeholders = new Set(['b', 'w', 'f', 'r', 's', 'n', 'k']);
const ids = new Set();
const texts = new Map();
const witnessed = new Set();
const counts = {};
const categories = {};
const primitive = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
let maxTemplate = 0;
let maxExpanded = 0;
let renderChecks = 0;

// These checks implement the constraints used by schema.json, without a game dependency.
for (const [bank, payload] of Object.entries(payloads)) {
  assert.deepEqual(Object.keys(payload).sort(), ['schema_version', 'pack_id', 'pack_version', 'bank', 'entries'].sort());
  assert.equal(payload.bank, bank);
  assert.equal(payload.schema_version, '1.0.0');
  assert.equal(payload.pack_version, '1.0.0');
  assert.equal(payload.pack_id, 'cricketlab-commentary-ordinary-v1');
  assert(Array.isArray(payload.entries) && payload.entries.length > 0);
  counts[bank] = payload.entries.length;
  categories[bank] = {};
  for (const entry of payload.entries) {
    assert.deepEqual(Object.keys(entry).sort(), [...keys].sort(), entry.id);
    assert(/^clab\.v1\.[a-zA-Z0-9_.]+$/.test(entry.id));
    assert(!ids.has(entry.id), `Duplicate ID ${entry.id}`);
    ids.add(entry.id);
    assert(typeof entry.category === 'string' && entry.category.length > 0);
    assert(['neutral', 'bunnings', 'lorry', 'grog'].includes(entry.speaker));
    assert(bank === 'ball_calls' ? entry.speaker === 'neutral' : entry.speaker !== 'neutral');
    assert(typeof entry.text === 'string' && entry.text.length > 0 && entry.text.length <= 150, entry.id);
    assert(/^[\x20-\x7e]+$/.test(entry.text), `Unsupported template character ${entry.id}`);
    assert(typeof entry.repeat_group === 'string' && entry.repeat_group.length > 0);
    assert(typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight > 0);
    assert(Number.isInteger(entry.priority) && entry.priority >= 0 && entry.priority <= 100);
    assert(Number.isInteger(entry.cooldown_balls) && entry.cooldown_balls >= 0);
    assert(entry.requires && typeof entry.requires === 'object' && !Array.isArray(entry.requires));
    assert(Object.keys(entry.requires).length > 0);
    for (const [path, condition] of Object.entries(entry.requires)) {
      assert(allowedPaths.has(path), `Undocumented field ${path}`);
      if (primitive(condition)) continue;
      assert(condition && typeof condition === 'object' && !Array.isArray(condition));
      assert(Object.keys(condition).length > 0);
      for (const [op, value] of Object.entries(condition)) {
        assert(['in', 'not_in', 'gte', 'gt', 'lte', 'lt', 'truthy'].includes(op));
        if (op === 'in' || op === 'not_in') assert(Array.isArray(value) && value.length > 0 && value.every(primitive));
        else if (op === 'truthy') assert.equal(typeof value, 'boolean');
        else assert(typeof value === 'number' && Number.isFinite(value));
      }
    }
    const tokens = [...entry.text.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);
    for (const token of tokens) assert(placeholders.has(token), `Unknown token ${token}`);
    assert(!/[{}]/.test(entry.text.replace(/\{[^{}]+\}/g, '')), `Unbalanced token ${entry.id}`);
    const normal = entry.text.toLowerCase().replace(/[^a-z0-9{}]+/g, ' ').trim();
    assert(!texts.has(normal), `Duplicate wording: ${entry.id} and ${texts.get(normal)}`);
    texts.set(normal, entry.id);
    maxTemplate = Math.max(maxTemplate, entry.text.length);
    categories[bank][entry.category] = (categories[bank][entry.category] ?? 0) + 1;
  }
}

for (const test of examples) {
  const ctx = context(test.record, test.names);
  const matched = {};
  for (const bank of banks) {
    matched[bank] = payloads[bank].entries.filter(entry => matches(entry, ctx));
    for (const entry of matched[bank]) {
      witnessed.add(entry.id);
      for (const names of [test.names, { b: 'A VERY LONG BATTER NAME', w: 'A LONG BOWLER NAME' }]) {
        const text = render(entry, context(test.record, names));
        assert(!/[{}]/.test(text), `Unresolved token ${entry.id}`);
        assert(!/undefined|null|NaN/.test(text), `Bad value ${entry.id}`);
        assert(/^[\x20-\x7e]+$/.test(text));
        maxExpanded = Math.max(maxExpanded, text.length);
        renderChecks++;
      }
    }
    for (const forbidden of test.excluded_categories) {
      assert(!matched[bank].some(e => e.category === forbidden), `Forbidden ${forbidden} for ${test.id}`);
    }
  }
  const selected = choose(payloads.ball_calls.entries, ctx, { rng: () => 0.25 });
  assert.equal(selected?.entry.category ?? null, test.expected_primary_category, test.id);
  const contextKinds = [...new Set(matched.match_context.map(e => e.category))];
  assert.deepEqual(contextKinds, test.expected_context_category ? [test.expected_context_category] : [], `Context ${test.id}`);
}
assert.equal(witnessed.size, ids.size, `Unwitnessed templates: ${[...ids].filter(id => !witnessed.has(id)).join(', ')}`);

// Missing facts never satisfy even a negative predicate. No coercion from null/strings.
const fake = requires => ({ requires });
assert.equal(matches(fake({'rec.absent': null}), {rec: {}}), false);
assert.equal(matches(fake({'rec.absent': {not_in: ['x']}}), {rec: {}}), false);
assert.equal(matches(fake({'rec.absent': {truthy: false}}), {rec: {}}), false);
assert.equal(matches(fake({'rec.value': false}), {rec: {value: 0}}), false);
assert.equal(matches(fake({'rec.value': {gte: 0}}), {rec: {value: null}}), false);
assert.equal(matches(fake({'rec.value': {gte: 0}}), {rec: {value: '2'}}), false);
assert.equal(matches(fake({'rec.value': {gte: 0, lt: 2}}), {rec: {value: 1}}), true);
assert.equal(matches(fake({'rec.value': {gte: 0, lt: 2}}), {rec: {value: 2}}), false);
assert.equal(matches(fake({'facts.swing_abs_m': {gte: 0.15}}), context({movement: {swing: -0.2}})), true);
assert.equal(matches(fake({'facts.swing_abs_m': {gte: 0.15}}), context({movement: {swing: null}})), false);

const zero = examples.find(e => e.id === 'context_droppedOn');
const zeroCtx = context(zero.record, zero.names);
const zeroEntry = payloads.match_context.entries.find(e => e.category === 'droppedOn' && /\{n\}/.test(e.text));
assert(render(zeroEntry, zeroCtx).includes('0'), 'Dropped-on-zero must retain numeric zero');
assert.throws(() => render({id: 'missing', text: '{b}'}, context({}, {})), /Missing placeholder/);

// Repeated primary calls use the whole specific bank before relaxing a line cooldown.
const one = examples.find(e => e.id === 'drive_for_one');
const oneCtx = context(one.record, one.names);
const history = [];
for (let ball = 0; ball < 12; ball++) {
  const pick = choose(payloads.ball_calls.entries, oneCtx, {ball, history, rng: () => 0.13});
  assert.equal(pick.entry.category, 'drive_single');
  history.push({id: pick.entry.id, repeat_group: pick.entry.repeat_group, ball});
}
assert.equal(new Set(history.slice(0, 8).map(h => h.id)).size, 8);
assert.equal(history[8].id, history[0].id);
const reactions = payloads.commentator_lines.entries;
const reactionHistory = reactions.filter(e => e.category === 'single' && e.speaker === 'bunnings').map(e => ({id: e.id, repeat_group: e.repeat_group, ball: 1}));
assert.equal(choose(reactions, oneCtx, {speaker: 'bunnings', ball: 2, history: reactionHistory, rng: () => 0.2, allowCooldownRelaxation: false}), null);

const result = {
  status: 'passed', counts, total_templates: ids.size,
  categories: Object.fromEntries(banks.map(bank => [bank, Object.keys(categories[bank]).length])),
  synthetic_fixtures: examples.length, witnessed_templates: witnessed.size,
  placeholder_render_checks: renderChecks, max_template_characters: maxTemplate,
  max_expanded_characters_in_long_name_fixtures: maxExpanded,
  checks: ['Unique IDs and normalised wording', 'Schema-contract structure and ASCII text', 'Known field paths and operators',
    'Positive and negative completed-ball fixtures', 'Every template has a positive witness', 'Zero and missing placeholders',
    'Missing-versus-null and strict numeric matching', 'Specificity and repetition cooldown behaviour'],
  limits: ['No game integration has been performed', 'Expanded character checks do not verify the browser layout']
};
fs.writeFileSync(new URL('QA_REPORT.json', root), JSON.stringify({content_validation: result}, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
