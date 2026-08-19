const { ingestWaterServiceAreas } = require('./_lib/hi-ingest');

exports.handler = async (event) => {
  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'method_not_allowed' }) };
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
