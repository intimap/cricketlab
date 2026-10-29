import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { context, choose } from './reference_matcher.mjs';

const repo = process.argv[2];
if (!repo) throw new Error('Usage: node tools/check_repo.mjs /absolute/path/to/cricketlab');
const root = new URL('../', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const entries = Object.fromEntries(['ball_calls', 'commentator_lines', 'match_context'].map(bank => [bank, read(`${bank}.json`).entries]));
const load = name => import(pathToFileURL(path.resolve(repo, 'src/sim', name)).href);
const { Match } = await load('match.js');
const { Rng } = await load('rng.js');
const { australia, england } = await load('teams.js');
const { PITCH_TYPES } = await load('conditions.js');
const speakers = ['bunnings', 'lorry', 'grog'];
const scenarios = [];
const transcript = [];
let checkedBalls = 0;
let packCalls = 0;
let fallbacks = 0;
let optionalCalls = 0;
let textSeed = 987654321;
const textRng = () => ((textSeed = (Math.imul(textSeed, 1664525) + 1013904223) >>> 0) / 4294967296);

function run(pitch, seed, usePack) {
  const m = new Match(australia(), england(), pitch, 30, new Rng(seed), 'bat');
  const outcomes = [];
  const history = {ball_calls: [], commentator_lines: [], match_context: []};
  const remember = (bank, pick, ball) => history[bank].push({id: pick.entry.id, repeat_group: pick.entry.repeat_group, ball});
  let ball = 0;
  while (!m.inn.isOver) {
    const { rec } = m.simBall();
    outcomes.push([rec.legal, rec.total, rec.runsBat, rec.extra, rec.wicket, rec.contact, rec.shotName]);
    if (usePack) {
      checkedBalls++;
      const before = m.rng.state;
      const names = {b: m.inn.bat[rec.wicket ? rec.wicket.batter : rec.striker].p.short, w: m.inn.bowl[rec.bowler].p.short};
      const ctx = context(rec, names);
      const primary = choose(entries.ball_calls, ctx, {ball, history: history.ball_calls, rng: textRng});
      const duty = speakers[rec.over % speakers.length];
      const calls = [{speaker: duty, text: primary?.text ?? rec.call, source: primary?.entry.id ?? 'existing factual call'}];
      if (primary) { packCalls++; remember('ball_calls', primary, ball); } else fallbacks++;
      let bank = 'match_context';
      let next = choose(entries[bank], ctx, {speaker: duty, ball, history: history[bank], rng: textRng, allowCooldownRelaxation: false});
      if (!next && textRng() < 0.15) {
        bank = 'commentator_lines';
        next = choose(entries[bank], ctx, {speaker: duty, ball, history: history[bank], rng: textRng, allowCooldownRelaxation: false});
      }
      if (next) {
        optionalCalls++;
        calls.push({speaker: duty, text: next.text, source: next.entry.id});
        remember(bank, next, ball);
      }
      assert.equal(m.rng.state, before, 'Content selection advanced match RNG');
      for (const call of calls) assert(!/\{[a-z]+\}|undefined|NaN/.test(call.text));
      if (transcript.length < 60 || (next?.entry.category === 'fifty' && transcript.length < 64)) {
        transcript.push({pitch, seed, over: `${rec.over}.${rec.ball}`, call: rec.call, calls});
      }
    }
    ball++;
  }
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
  return {balls: ball, runs: m.inn.runs, wickets: m.inn.wkts, match_rng_state: m.rng.state, fingerprint};
}

for (const pitch of Object.keys(PITCH_TYPES)) {
  for (const seed of [17, 43]) {
    const plain = run(pitch, seed, false);
    const content = run(pitch, seed, true);
    assert.deepEqual(content, plain, `Game outcome changed for ${pitch}/${seed}`);
    scenarios.push({pitch, seed, ...content});
  }
}
const report = {
  status: 'passed', mode: 'Standalone content selector exercised on real simulation records; not integrated UI',
  scenarios, completed_balls_checked: checkedBalls, primary_pack_calls: packCalls,
  existing_factual_fallbacks: fallbacks, optional_calls: optionalCalls,
  primary_pack_coverage_percent: Number((100 * packCalls / checkedBalls).toFixed(1)),
  simulation_unchanged_with_probe: true,
  note: 'This comparison verifies the standalone probe does not alter the simulation. Repeat it after the actual integration.'
};
const qaURL = new URL('QA_REPORT.json', root);
const qa = fs.existsSync(qaURL) ? read('QA_REPORT.json') : {};
qa.repository_probe = report;
fs.writeFileSync(qaURL, JSON.stringify(qa, null, 2) + '\n');
const md = [
  '# Offline candidate commentary transcript', '',
  'These are real simulated ball records passed through this pack\'s standalone selector. They illustrate candidate wording; the game has not been modified and this is not a recording or play-test of its commentary box.', '',
  'The plain factual call is shown so the exact runs, extras and dismissal remain visible. The examples use existing game player names from the inspected repository.', '',
];
for (const row of transcript) {
  md.push(`## ${row.pitch}, seed ${row.seed}, ball ${row.over}`, '', `Facts: ${row.call}`, '');
  for (const call of row.calls) md.push(`- **${call.speaker}:** ${call.text}`);
  md.push('');
}
fs.writeFileSync(new URL('SAMPLE_TRANSCRIPT.md', root), md.join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
