const { ingestWaterServiceAreas } = require('./_lib/hi-ingest');

function authorized(event) {
  const expected = globalThis.Netlify?.env?.get('HI_INGEST_SECRET');
  const supplied = event.headers?.['x-ingest-secret'] || event.headers?.['X-Ingest-Secret'];
  return Boolean(expected && supplied && supplied === expected);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  if (!authorized(event)) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  try {
    const result = await ingestWaterServiceAreas();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, source: 'pbc_water_service_areas', ...result }),
    };
  } catch (err) {
    console.error('hi-ingest-pbc-water failed', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'ingestion_failed', message: String(err?.message || err) }),
    };
  }
};
