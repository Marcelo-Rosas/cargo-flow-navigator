/**
 * Google Maps Integration
 * - Geocoding: CEP → Coordenadas
 * - Validation: Validar CEPs brasileiros
 */

export interface GeocodeResult {
  valid: boolean;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  city_uf?: string;
  country?: string;
  error?: string;
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Validar e geocodificar CEP usando Google Geocoding API
 * Retorna coordenadas e endereço formatado
 *
 * @param cep - CEP no formato XXXXX-XXX ou XXXXXXXX
 * @returns GeocodeResult com coordenadas e endereço
 */
export async function validateAndGeocodeCep(cep: string): Promise<GeocodeResult> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[google-maps] VITE_GOOGLE_MAPS_API_KEY not configured');
    return {
      valid: false,
      error: 'Google Maps API não configurado. Verifique .env.local',
    };
  }

  // Remove non-digits and validate length
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    return {
      valid: false,
      error: 'CEP deve ter 8 dígitos',
    };
  }

  // Format: XXXXX-XXX
  const formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', `${formattedCep}, Brazil`);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      console.error('[google-maps] API Error:', data.error_message);
      return {
        valid: false,
        error: `Erro na API: ${data.error_message}`,
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return {
        valid: false,
        error: `CEP ${formattedCep} não encontrado`,
      };
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return {
        valid: false,
        error: `CEP não localizado (${data.status})`,
      };
    }

    const result = data.results[0];
    const location = result.geometry.location;
    const addressComponents = result.address_components || [];

    // Extract city, state, country
    const cityComponent = addressComponents.find((c: AddressComponent) =>
      c.types.includes('administrative_area_level_2')
    );
    const stateComponent = addressComponents.find((c: AddressComponent) =>
      c.types.includes('administrative_area_level_1')
    );
    const countryComponent = addressComponents.find((c: AddressComponent) =>
      c.types.includes('country')
    );

    const city = cityComponent?.long_name ?? '';
    const state = stateComponent?.short_name ?? '';
    const country = countryComponent?.long_name ?? 'Brazil';

    // Format city_uf as "City - ST"
    const city_uf = state ? `${city} - ${state}` : city;

    console.log(`[google-maps] ✅ CEP ${formattedCep} → ${city_uf}`, {
      lat: location.lat,
      lng: location.lng,
    });

    return {
      valid: true,
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: result.formatted_address,
      city_uf,
      country,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('[google-maps] Fetch error:', errorMessage);
    return {
      valid: false,
      error: `Erro ao validar CEP: ${errorMessage}`,
    };
  }
}

/**
 * Carregar Google Maps Script dinamicamente
 * Útil para evitar loading duplo
 */
export async function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Se já carregou, resolve imediatamente
    if (window.google?.maps) {
      resolve();
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Google Maps API Key not configured'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=routes`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('[google-maps] 📍 Maps Script loaded');
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
    };

    document.body.appendChild(script);
  });
}

/**
 * Validar múltiplos CEPs em paralelo
 * Útil para validação em lote (composição com vários CEPs)
 */
export async function validateMultipleCeps(ceps: string[]): Promise<Record<string, GeocodeResult>> {
  const results: Record<string, GeocodeResult> = {};

  // Usar Promise.all para paralelismo
  const promises = ceps.map(async (cep) => {
    const result = await validateAndGeocodeCep(cep);
    results[cep] = result;
  });

  await Promise.all(promises);
  return results;
}

/**
 * Debounce para validação em tempo real
 * Evita múltiplas chamadas à API enquanto usuário digita
 */
export function createCepValidator(delay: number = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    validate: async (cep: string, callback: (result: GeocodeResult) => void) => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        const result = await validateAndGeocodeCep(cep);
        callback(result);
      }, delay);
    },
    cancel: () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}
