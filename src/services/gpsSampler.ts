import * as Location from 'expo-location';

export interface StabilizedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  samplesCount: number;
}

interface RawSample {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Coleta múltiplas leituras de GPS em alta precisão, aguarda estabilização,
 * filtra leituras com baixa precisão (coords.accuracy) e calcula uma posição
 * representativa sem inventar precisão.
 */
export async function sampleStabilizedLocation(options?: {
  maxWaitMs?: number;
  maxSamples?: number;
  maxAcceptableAccuracyMeters?: number;
}): Promise<StabilizedLocation | null> {
  const maxWaitMs = options?.maxWaitMs ?? 8500;
  const maxSamples = options?.maxSamples ?? 5;
  const maxAcceptableAccuracy = options?.maxAcceptableAccuracyMeters ?? 25;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return null;
    }

    return await new Promise<StabilizedLocation | null>((resolve) => {
      const validSamples: RawSample[] = [];
      let subscription: Location.LocationSubscription | null = null;
      let resolved = false;

      const finalize = () => {
        if (resolved) return;
        resolved = true;
        if (subscription) {
          subscription.remove();
          subscription = null;
        }

        if (validSamples.length === 0) {
          resolve(null);
          return;
        }

        // Média ponderada pelo inverso da variância (1 / accuracy^2)
        // Leituras mais precisas têm peso maior na posição representativa
        let weightSum = 0;
        let latSum = 0;
        let lonSum = 0;
        let bestAccuracy = validSamples[0].accuracy;

        for (const s of validSamples) {
          const safeAcc = Math.max(1, s.accuracy);
          const weight = 1 / (safeAcc * safeAcc);
          weightSum += weight;
          latSum += s.latitude * weight;
          lonSum += s.longitude * weight;
          if (s.accuracy < bestAccuracy) {
            bestAccuracy = s.accuracy;
          }
        }

        // Precisão representativa real (mediana das precisões válidas observadas)
        const sortedAcc = [...validSamples]
          .map((s) => s.accuracy)
          .sort((a, b) => a - b);
        const medianAccuracy = sortedAcc[Math.floor(sortedAcc.length / 2)];

        resolve({
          latitude: latSum / weightSum,
          longitude: lonSum / weightSum,
          accuracy: Math.round(medianAccuracy * 10) / 10,
          samplesCount: validSamples.length,
        });
      };

      const timeoutId = setTimeout(finalize, maxWaitMs);

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => {
          const acc = loc.coords.accuracy;
          // Filtra leituras sem precisão ou com baixa precisão
          if (acc !== null && acc !== undefined && acc <= maxAcceptableAccuracy) {
            validSamples.push({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: acc,
            });

            if (validSamples.length >= maxSamples) {
              clearTimeout(timeoutId);
              finalize();
            }
          }
        }
      )
        .then((sub) => {
          if (resolved) {
            sub.remove();
          } else {
            subscription = sub;
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
          finalize();
        });
    });
  } catch {
    return null;
  }
}
