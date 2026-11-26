export const colors = {
  // Identidade Noturna S-Now
  background: '#070B14',      // Azul-marinho muito escuro como base
  backgroundSecondary: '#0C1220',
  surface: '#101827',         // Superfície de cards
  surfaceGlass: 'rgba(16, 24, 39, 0.72)', // Liquid Glass translúcido
  surfaceGlassBorder: 'rgba(255, 255, 255, 0.09)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.04)',

  // Cores de Apoio e Destaque
  teal: '#1B384A',            // Azul-petróleo como apoio
  tealLight: '#2A556B',
  accent: '#C86237',          // Laranja queimado como destaque
  accentLight: '#E07748',
  primary: '#2D7296',         // Azul instrumental

  // Textos e Tipografia
  textPrimary: '#F1F5F9',     // Branco puro / gelo
  textSecondary: '#94A3B8',   // Cinza suave
  textTertiary: '#64748B',    // Cinza escuro discreto
  border: 'rgba(255, 255, 255, 0.08)',
  borderMuted: 'rgba(255, 255, 255, 0.04)',

  // Estados Funcionais
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0EA5E9',

  // Cores de Qualidade do Sinal (RF) - Exclusivas da escala técnica
  signalScale: {
    excellent: '#10B981', // Verde: Excelente (>= -50 dBm)
    good: '#06B6D4',      // Ciano: Bom (-51 a -60 dBm)
    fair: '#EAB308',      // Amarelo: Intermediário (-61 a -70 dBm)
    weak: '#F97316',      // Laranja: Fraco (-71 a -80 dBm)
    critical: '#EF4444',  // Vermelho: Muito fraco (< -80 dBm)
  },
};

export function getSignalColor(rssi?: number | null): string {
  if (rssi === undefined || rssi === null) return colors.textTertiary;
  if (rssi >= -50) return colors.signalScale.excellent;
  if (rssi >= -60) return colors.signalScale.good;
  if (rssi >= -70) return colors.signalScale.fair;
  if (rssi >= -80) return colors.signalScale.weak;
  return colors.signalScale.critical;
}

export function getSignalLabel(rssi?: number | null): string {
  if (rssi === undefined || rssi === null) return 'Sem Sinal';
  if (rssi >= -50) return 'Excelente';
  if (rssi >= -60) return 'Bom';
  if (rssi >= -70) return 'Intermediário';
  if (rssi >= -80) return 'Fraco';
  return 'Muito Fraco';
}
