/**
 * Calcula a distância entre duas coordenadas geográficas usando a fórmula de Haversine
 * @param lat1 Latitude do ponto 1
 * @param lon1 Longitude do ponto 1
 * @param lat2 Latitude do ponto 2
 * @param lon2 Longitude do ponto 2
 * @returns Distância em metros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distância em metros

  return Math.round(distance);
}

/**
 * Verifica se o usuário está dentro do raio permitido de um local
 * @param userLat Latitude do usuário
 * @param userLon Longitude do usuário
 * @param locationLat Latitude do local
 * @param locationLon Longitude do local
 * @param radius Raio permitido em metros
 * @returns true se está dentro do raio, false caso contrário
 */
export function isWithinRadius(
  userLat: number,
  userLon: number,
  locationLat: number,
  locationLon: number,
  radius: number
): boolean {
  const distance = calculateDistance(userLat, userLon, locationLat, locationLon);
  console.log(`📍 Distância calculada: ${distance}m (raio permitido: ${radius}m)`);
  return distance <= radius;
}

/**
 * Obtém a localização atual do usuário
 * @returns Promise com as coordenadas {latitude, longitude} ou erro
 */
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada pelo seu navegador'));
      return;
    }

    console.log('📍 Solicitando localização do usuário...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Localização obtida:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error('❌ Erro ao obter localização:', error);
        let message = 'Erro ao obter localização';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = '⛔ Permissão de localização negada. Por favor, permita o acesso nas configurações do navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = '📍 Localização indisponível. Verifique se o GPS está ativado.';
            break;
          case error.TIMEOUT:
            message = '⏱️ Tempo esgotado ao obter localização. Tente novamente.';
            break;
        }
        
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}
