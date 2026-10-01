const { requireShopApiKey, json } = require('./_lib/shop-auth');
const { resolveProperty, sb } = require('./_lib/home-intelligence');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
  const auth = await requireShopApiKey(event);
  if (auth.error) return auth.error;

  try {
    const q = event.queryStringParameters || {};
    const property = await resolveProperty({ parcelId: q.parcel_id, address: q.address });
    if (!property) return json(404, { error: { code: 'PROPERTY_NOT_FOUND' } });

    let query = sb()
      .from('hi_permits')
      .select('*')
      .eq('property_id', property.id)
      .order('issue_date', { ascending: false })
      .limit(Math.min(Number(q.limit) || 100, 500));

    if (q.trade) query = query.eq('trade', String(q.trade).toLowerCase());
    if (q.system) query = query.eq('system', String(q.system).toLowerCase());

    const { data, error } = await query;
    if (error) throw error;

    return json(200, {
      data: (data || []).map(p => ({
        permit_id: p.id,
        permit_number: p.source_permit_number,
        trade: p.trade,
        system: p.system,
        action: p.action,
        description: p.work_description,
        application_date: p.application_date,
        issued_date: p.issue_date,
        final_date: p.final_date,
        status: p.status,
        declared_value: p.declared_value,
        contractor: {
          license_number: p.contractor_license,
          name: p.contractor_name,
        },
        classification_confidence: p.classification_confidence,
        source_key: p.source_key,
      })),
      meta: {
        api_version: 'v1',
        property_id: property.id,
        parcel_id: property.parcel_id,
        count: data?.length || 0,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('hi-permits-v1', err);
    return json(500, { error: { code: 'INTERNAL_ERROR' } });
  }
};
