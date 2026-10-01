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

    const { data, error } = await sb()
      .from('hi_opportunity_scores')
      .select('*')
      .eq('property_id', property.id)
      .order('score', { ascending: false });
    if (error) throw error;

    return json(200, {
      data: {
        property_id: property.id,
        parcel_id: property.parcel_id,
        opportunities: (data || []).map(o => ({
          type: o.opportunity_type,
          score: o.score,
          confidence: o.confidence,
          classification: o.classification,
          evidence: o.factors || [],
          model_version: o.model_version,
          calculated_at: o.calculated_at,
        })),
      },
      meta: {
        api_version: 'v1',
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('hi-opportunities-v1', err);
    return json(500, { error: { code: 'INTERNAL_ERROR' } });
  }
};
