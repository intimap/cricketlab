import test from "node:test";
import assert from "node:assert/strict";
import { TEAMS, TEAM_IDS } from "../src/sim/team-list.js";
import { TEAM_SKINS } from "../src/render/skins.js";

test("every team fields an XI with a keeper and five bowlers, and has its kit", () => {
  assert.deepEqual(TEAM_IDS, ["AUS", "ENG", "NZ", "SA", "IND", "PAK", "SL", "WI"]);
  for (const id of TEAM_IDS) {
    const team = TEAMS[id]();
    assert.equal(team.abbr, id);
    assert.equal(team.players.length, 11, id);
    assert.equal(team.players.filter((p) => p.keeper).length, 1, `${id} keeper`);
    assert.ok(team.players.filter((p) => p.bowl).length >= 5, `${id} bowlers`);
    assert.equal(new Set(team.players.map((p) => p.name)).size, 11, `${id} names`);
    assert.ok(
      team.players.every((p) => p.name.length <= 20),
      `${id} names fit the team sheet`,
    );
    assert.ok(TEAM_SKINS[id]?.odi, `${id} coloured kit`);
  }
});
