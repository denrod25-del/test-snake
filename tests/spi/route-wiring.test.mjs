import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('SPI route wiring', () => {
  it('netlify.toml redirects /api/property to property-briefing', () => {
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    assert.match(toml, /from\s*=\s*"\/api\/property"/);
    assert.match(toml, /to\s*=\s*"\/\.netlify\/functions\/property-briefing"/);
  });

  it('property-briefing function file exists', () => {
    assert.ok(
      fs.existsSync(path.join(root, 'netlify/functions/property-briefing.js'))
    );
  });
});
