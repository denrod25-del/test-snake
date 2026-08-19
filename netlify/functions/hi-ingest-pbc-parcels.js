const { createSupabaseAdminClient } = require('./_lib/config');
const { ingestParcelBatch } = require('./_lib/hi-ingest');

exports.handler = async (event) => {
  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    const sb = createSupabaseAdminClient();
    const qs = event.queryStringParameters || {};
    const requestedSize = Number(qs.pageSize || 250);
    const pageSize = Math.max(1, Math.min(Number.isFinite(requestedSize) ? requestedSize : 250, 1000));

    let offset;
    if (qs.offset != null) {
      offset = Math.max(0, Number(qs.offset) || 0);
    } else {
      const { data } = await sb
        .from('hi_ingestion_cursors')
        .select('cursor_value, completed')
        .eq('source_key', 'pbc_parcels')
        .maybeSingle();
      if (data?.completed && qs.restart !== '1') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, source: 'pbc_parcels', completed: true, message: 'Initial parcel sync already completed. Pass restart=1 to begin again.' }),
        };
      }
      offset = qs.restart === '1' ? 0 : Number(data?.cursor_value || 0);
    }

    const result = await ingestParcelBatch({ offset, pageSize });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, source: 'pbc_parcels', ...result }),
    };
  } catch (err) {
    console.error('hi-ingest-pbc-parcels failed', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'ingestion_failed', message: String(err?.message || err) }),
    };
  }
};
