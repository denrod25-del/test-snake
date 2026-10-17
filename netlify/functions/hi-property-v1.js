const { requireShopApiKey, json } = require('./_lib/shop-auth');
const { resolveProperty } = require('./_lib/home-intelligence');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
  const auth = await requireShopApiKey(event);
  if (auth.error) return auth.error;

  try {
    const q = event.queryStringParameters || {};
    const property = await resolveProperty({ parcelId: q.parcel_id, address: q.address });
    if (!property) return json(404, { error: { code: 'PROPERTY_NOT_FOUND', message: 'No matching property found.' } });

    return json(200, {
      data: {
        property_id: property.id,
        parcel_id: property.parcel_id,
        address: {
          formatted: property.site_address,
          city: property.city,
          municipality: property.municipality,
          state: property.state,
          zip: property.postal_code,
        },
        property: {
          year_built: property.actual_year_built,
          effective_year_built: property.effective_year_built,
          property_use: property.property_use_description,
          living_area_sqft: property.living_area_sqft,
          acres: property.acres,
          residential_units: property.residential_units,
          building_count: property.building_count,
        },
        valuation: {
          market_value: property.market_value,
          assessed_value: property.assessed_value,
          taxable_value: property.taxable_value,
        },
        last_sale: {
          date: property.last_sale_date,
          price: property.last_sale_price,
        },
      },
      meta: {
        api_version: 'v1',
        source_key: property.source_key,
        source_updated_at: property.source_updated_at,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err?.code === 'AMBIGUOUS_PROPERTY' || err?.message === 'AMBIGUOUS_PROPERTY') {
      return json(409, { error: { code: 'AMBIGUOUS_PROPERTY', message: 'Multiple properties matched the supplied address.' } });
    }
    console.error('hi-property-v1', err);
    return json(500, { error: { code: 'INTERNAL_ERROR' } });
  }
};
