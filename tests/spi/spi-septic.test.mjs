import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  assembleSeptic,
  classifyServiceStatus,
  gradeFor,
  CONFIDENCE,
} = require('../../netlify/functions/_lib/spi-septic.js');

// ── fixtures ───────────────────────────────────────────────────────────────

function config({ sewer = {}, water = {} } = {}) {
  const live = (over) => ({
    status: 'live',
    endpoint: 'https://gis.example.gov/FeatureServer/0/query',
    coverage: 'countywide',
    provider: 'Example County Utilities',
    label: 'Example service areas',
    outFields: '*',
    map: {},
    ...over,
  });
  return {
    boundaryMeters: 75,
    defaultLayer: null,
    layers: {
      'palm-beach': {
        name: 'Palm Beach',
        sewer: sewer === null ? { status: 'planned', endpoint: null } : live(sewer),
        water: water === null ? { status: 'planned', endpoint: null } : live(water),
      },
    },
  };
}

const loadWith = (cfg) => async () => cfg;

// Distinguishes the point-intersect query from the 75 m proximity probe.
function fetcher({ intersect = [], nearby = [], onError } = {}) {
  return async (_endpoint, params) => {
    if (onError) throw new Error(onError);
    if (params.distance) return { features: nearby };
    return { features: intersect };
  };
}

const AT = { lon: -80.15, lat: 26.65, countySlug: 'palm-beach' };

// ── tests ──────────────────────────────────────────────────────────────────

describe('spi-septic: service status', () => {
  it('reads planned and proposed polygons as not-yet-service', () => {
    for (const v of ['Planned', 'PROPOSED', 'Future Phase', 'Phase 3', 'Under Construction']) {
      assert.equal(classifyServiceStatus(v), 'planned', v);
    }
  });

  it('reads existing service', () => {
    for (const v of ['Existing', 'ACTIVE', 'In Service', 'Complete']) {
      assert.equal(classifyServiceStatus(v), 'existing', v);
    }
  });

  it('returns unknown for blank or unrecognized values', () => {
    assert.equal(classifyServiceStatus(''), 'unknown');
    assert.equal(classifyServiceStatus(null), 'unknown');
    assert.equal(classifyServiceStatus('Zone 4'), 'unknown');
  });
});

describe('spi-septic: grades', () => {
  it('maps confidence onto the published grades', () => {
    assert.equal(gradeFor(0.97), 'verified');
    assert.equal(gradeFor(CONFIDENCE.INSIDE), 'high');
    assert.equal(gradeFor(CONFIDENCE.OUTSIDE), 'moderate');
    assert.equal(gradeFor(0.4), 'low');
    assert.equal(gradeFor(0), 'unknown');
  });
});

describe('spi-septic: inside a service area', () => {
  it('reports sewer for a point inside an existing sewer area', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({
        intersect: [{ attributes: { NAME: 'Central Service Area', STATUS: 'Existing' } }],
      }),
    });

    assert.equal(group.status, 'live');
    assert.equal(group.data.wastewater.value, 'sewer');
    assert.equal(group.data.wastewater.confidence, CONFIDENCE.INSIDE);
    assert.equal(group.data.wastewater.grade, 'high');
    assert.equal(group.data.wastewater.basis, 'inside_service_area');
    assert.match(group.data.wastewater.explanation, /Central Service Area/);
    assert.equal(group.data.wastewater.source.provider, 'Example County Utilities');
  });

  it('reports municipal water on the water axis', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ intersect: [{ attributes: { NAME: 'Water District 1' } }] }),
    });
    assert.equal(group.data.waterSource.value, 'municipal');
    assert.equal(group.data.waterSource.basis, 'inside_service_area');
  });

  it('treats a polygon with no status field as existing service', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ intersect: [{ attributes: { NAME: 'Unlabelled Area' } }] }),
    });
    assert.equal(group.data.wastewater.value, 'sewer');
  });
});

describe('spi-septic: outside every service area', () => {
  it('infers septic and well when the layers are countywide', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ intersect: [], nearby: [] }),
    });

    assert.equal(group.data.wastewater.value, 'septic');
    assert.equal(group.data.wastewater.confidence, CONFIDENCE.OUTSIDE);
    assert.equal(group.data.wastewater.grade, 'moderate');
    assert.equal(group.data.wastewater.basis, 'outside_service_area');
    assert.equal(group.data.waterSource.value, 'well');
    assert.deepEqual(group.data.flags, []);
  });

  it('refuses to infer septic when the layer is not countywide', async () => {
    // The failure mode that would burn a lender: a partial layer's silence is
    // not evidence of anything.
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config({ sewer: { coverage: 'partial' } })),
      fetchFn: fetcher({ intersect: [] }),
    });

    assert.equal(group.data.wastewater.value, 'unknown');
    assert.equal(group.data.wastewater.basis, 'no_data');
    assert.equal(group.data.wastewater.confidence, 0);
    assert.match(group.data.wastewater.explanation, /only part of the county/);
  });

  it('refuses to infer when coverage is unspecified', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config({ sewer: { coverage: 'unknown' } })),
      fetchFn: fetcher({ intersect: [] }),
    });
    assert.equal(group.data.wastewater.value, 'unknown');
  });

  it('discounts confidence and flags a parcel near a service boundary', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ intersect: [], nearby: [{ attributes: { NAME: 'Central' } }] }),
    });

    assert.equal(group.data.wastewater.value, 'septic');
    assert.equal(
      group.data.wastewater.confidence,
      Number((CONFIDENCE.OUTSIDE - CONFIDENCE.BOUNDARY_PENALTY).toFixed(3))
    );
    assert.ok(group.data.flags.includes('near_service_boundary'));
  });
});

describe('spi-septic: planned expansions', () => {
  it('does not count a planned polygon as existing service', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({
        intersect: [{ attributes: { NAME: 'North Expansion', STATUS: 'Proposed' } }],
      }),
    });

    assert.equal(group.data.wastewater.value, 'septic');
    assert.equal(group.data.wastewater.basis, 'outside_service_area');
    assert.ok(group.data.flags.includes('planned_service_expansion'));
  });

  it('prefers an existing polygon when both overlap the point', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({
        intersect: [
          { attributes: { NAME: 'North Expansion', STATUS: 'Planned' } },
          { attributes: { NAME: 'Central Service Area', STATUS: 'Existing' } },
        ],
      }),
    });
    assert.equal(group.data.wastewater.value, 'sewer');
    assert.match(group.data.wastewater.explanation, /Central Service Area/);
  });
});

describe('spi-septic: unavailable paths', () => {
  it('needs a centroid', async () => {
    const group = await assembleSeptic({ countySlug: 'palm-beach', loadJsonFn: loadWith(config()) });
    assert.equal(group.status, 'unavailable');
    assert.match(group.message, /centroid/);
  });

  it('reports coming-soon for a county with no live layer', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config({ sewer: null, water: null })),
      fetchFn: fetcher({}),
    });
    assert.equal(group.status, 'coming-soon');
    assert.equal(group.data, null);
  });

  it('reports coming-soon for an unregistered county', async () => {
    const group = await assembleSeptic({
      lon: -80.1,
      lat: 26.6,
      countySlug: 'nowhere',
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({}),
    });
    assert.equal(group.status, 'coming-soon');
  });

  it('surfaces a registry load failure without throwing', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: async () => {
        throw new Error('registry missing');
      },
    });
    assert.equal(group.status, 'unavailable');
    assert.equal(group.message, 'registry missing');
  });

  it('degrades to no_data when the GIS query fails', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ onError: 'ArcGIS 503' }),
    });
    assert.equal(group.status, 'live');
    assert.equal(group.data.wastewater.basis, 'no_data');
    assert.match(group.data.wastewater.explanation, /ArcGIS 503/);
  });

  it('keeps the answer when only the proximity probe fails', async () => {
    let call = 0;
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: async (_e, params) => {
        call += 1;
        if (params.distance) throw new Error('probe blew up');
        return { features: [] };
      },
    });

    assert.equal(group.data.wastewater.value, 'septic');
    assert.equal(group.data.wastewater.confidence, CONFIDENCE.OUTSIDE);
    assert.ok(!group.data.flags.includes('near_service_boundary'));
    assert.ok(call > 1);
  });

  it('always carries the verification note', async () => {
    const group = await assembleSeptic({
      ...AT,
      loadJsonFn: loadWith(config()),
      fetchFn: fetcher({ intersect: [] }),
    });
    assert.match(group.data.verification, /county health department/);
  });
});

describe('spi-septic: shipped registry', () => {
  it('never marks a layer live without an endpoint, or countywide without being live', async () => {
    const registry = require('../../data/signals/septic-layers.json');
    for (const [slug, entry] of Object.entries(registry.layers)) {
      for (const axis of ['sewer', 'water']) {
        const layer = entry[axis];
        assert.ok(layer, `${slug}.${axis} missing`);
        if (layer.status === 'live') {
          assert.ok(layer.endpoint, `${slug}.${axis} is live with no endpoint`);
        }
        if (layer.coverage === 'countywide') {
          assert.equal(layer.status, 'live', `${slug}.${axis} claims countywide but is not live`);
        }
      }
    }
  });
});
