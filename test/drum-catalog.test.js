import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import catalog from '../src/music/sound-catalog.json' with { type: 'json' };

test('custom drum kits are cataloged and point to existing samples', () => {
  for (const id of ['mydrums1', 'mydrums2', 'mydrums3']) {
    const kit = catalog.drum_kit[id];
    assert.ok(kit, `${id} is missing from the drum catalog`);
    for (const file of Object.values(kit.files)) {
      assert.ok(fs.existsSync(path.join('public', 'samples', 'drums', kit.dir, file)), `${id}/${file} is missing`);
    }
  }
});