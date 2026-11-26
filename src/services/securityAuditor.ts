import type { CurrentNetworkInfo, WifiNetwork } from 'munim-wifi';
import type { WifiSecurityAudit } from '../types/snow';

/**
 * Audita a segurança da rede Wi-Fi efetivamente conectada utilizando os metadados
 * fornecidos pelo Android via munim-wifi (securityType e capabilities do AP).
 * Não promete detectar invasões ou vulnerabilidades não verificáveis.
 */
export function auditWifiSecurity(
  connectedNetwork: CurrentNetworkInfo | null,
  nearbyNetworks: WifiNetwork[]
): WifiSecurityAudit {
  if (
    !connectedNetwork ||
    !connectedNetwork.ssid ||
    connectedNetwork.ssid === '<unknown ssid>'
  ) {
    return {
      classification: 'indisponivel',
      label: 'Indisponível',
      isOpen: false,
      protocol: 'Indisponível',
      encryption: null,
      authentication: null,
      warnings: ['Sem conexão Wi-Fi ativa para auditar segurança.'],
      recommendations: [],
    };
  }

  // Busca o mesmo BSSID ou SSID na varredura complementar para ler capabilities detalhadas
  const matchedScan = nearbyNetworks.find(
    (n) =>
      (connectedNetwork.bssid && n.bssid === connectedNetwork.bssid) ||
      n.ssid === connectedNetwork.ssid
  );

  const secType = connectedNetwork.securityType ?? matchedScan?.securityType ?? 'unknown';
  const caps = matchedScan?.capabilities ?? '';
  const capsUpper = caps.toUpperCase();

  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 1. Rede Aberta (sem criptografia)
  if (secType === 'open') {
    warnings.push(
      'Rede Wi-Fi aberta sem criptografia na camada de enlace. O tráfego local pode ser interceptado por terceiros próximos.'
    );
    recommendations.push(
      'Evite acessar serviços bancários ou inserir senhas sem VPN nesta rede. Se for sua rede doméstica, ative WPA2-AES ou WPA3.'
    );
    return {
      classification: 'fraca',
      label: 'Proteção fraca',
      isOpen: true,
      protocol: 'Aberta (Sem senha)',
      encryption: 'Nenhuma',
      authentication: 'Aberta',
      rawCapabilities: caps || undefined,
      warnings,
      recommendations,
    };
  }

  // 2. WEP (obsoleto e inseguro)
  if (secType === 'wep' || capsUpper.includes('WEP')) {
    warnings.push(
      'A rede utiliza o padrão legado WEP, considerado obsoleto e vulnerável a quebra rápida de chave.'
    );
    recommendations.push(
      'Atualize imediatamente a segurança do roteador para WPA2-AES (CCMP) ou WPA3.'
    );
    return {
      classification: 'fraca',
      label: 'Proteção fraca',
      isOpen: false,
      protocol: 'WEP (Legado)',
      encryption: 'RC4 (Frágil)',
      authentication: 'WEP',
      rawCapabilities: caps || undefined,
      warnings,
      recommendations,
    };
  }

  // 3. WPA1 exclusivo ou presença de TKIP (cifra obsoleta)
  const hasWpa2 = capsUpper.includes('WPA2') || capsUpper.includes('RSN') || secType === 'wpa2';
  const hasWpa3 = capsUpper.includes('SAE') || secType === 'wpa3';
  const hasTkip = capsUpper.includes('TKIP');
  const hasCcmp = capsUpper.includes('CCMP') || capsUpper.includes('AES');
  const hasWps = capsUpper.includes('WPS');

  if (capsUpper.includes('WPA-PSK') && !hasWpa2 && !hasWpa3) {
    warnings.push(
      'A rede opera apenas com WPA1 (TKIP), padrão antigo suscetível a ataques conhecidos.'
    );
    recommendations.push(
      'Configure o roteador para operar em modo WPA2-PSK (AES/CCMP) ou WPA3.'
    );
    return {
      classification: 'fraca',
      label: 'Proteção fraca',
      isOpen: false,
      protocol: 'WPA1 (Legado)',
      encryption: 'TKIP',
      authentication: 'PSK',
      rawCapabilities: caps || undefined,
      warnings,
      recommendations,
    };
  }

  // 4. WPA3 / OWE / Enterprise / Passpoint
  if (hasWpa3) {
    if (hasWps) {
      warnings.push('WPS detectado no ponto de acesso; recomenda-se desativar WPS se não estiver em uso.');
    }
    return {
      classification: 'boa',
      label: 'Boa proteção',
      isOpen: false,
      protocol: hasWpa2 ? 'WPA2/WPA3 (Transição)' : 'WPA3',
      encryption: hasCcmp ? 'AES-CCMP / GCMP' : 'AES',
      authentication: 'SAE',
      rawCapabilities: caps || undefined,
      warnings,
      recommendations:
        warnings.length > 0
          ? ['Desative o WPS nas configurações do roteador para endurecer a segurança física do AP.']
          : ['Padrão moderno ativo. Mantenha o firmware do roteador atualizado e utilize senha forte.'],
    };
  }

  if (secType === 'owe') {
    return {
      classification: 'boa',
      label: 'Boa proteção',
      isOpen: false,
      protocol: 'OWE (Enhanced Open)',
      encryption: 'AES-CCMP',
      authentication: 'Criptografia oportunista',
      rawCapabilities: caps || undefined,
      warnings: [],
      recommendations: ['Rede pública com criptografia individualizada ativa (OWE).'],
    };
  }

  if (secType === 'enterprise' || secType === 'passpoint') {
    return {
      classification: 'boa',
      label: 'Boa proteção',
      isOpen: false,
      protocol: secType === 'passpoint' ? 'Passpoint (Hotspot 2.0)' : 'WPA2/WPA3-Enterprise',
      encryption: hasCcmp ? 'AES-CCMP' : 'AES',
      authentication: '802.1X / EAP',
      rawCapabilities: caps || undefined,
      warnings: [],
      recommendations: ['Autenticação corporativa 802.1X detectada.'],
    };
  }

  // 5. WPA2 (verifica se TKIP ou WPS estão presentes)
  if (hasWpa2) {
    if (hasTkip) {
      warnings.push(
        'Modo misto com TKIP habilitado. O uso de TKIP reduz a segurança e pode limitar a velocidade máxima do Wi-Fi.'
      );
      recommendations.push(
        'No roteador, altere a criptografia de "TKIP+AES" para apenas "AES (CCMP)" ou ative WPA3.'
      );
      return {
        classification: 'atencao',
        label: 'Atenção',
        isOpen: false,
        protocol: 'WPA2 (Modo Misto)',
        encryption: 'TKIP + AES',
        authentication: 'PSK',
        rawCapabilities: caps || undefined,
        warnings,
        recommendations,
      };
    }

    if (hasWps) {
      warnings.push(
        'WPS (Wi-Fi Protected Setup) anunciado pelo roteador. O PIN do WPS pode ser um vetor de tentativa de acesso.'
      );
      recommendations.push('Desative o recurso WPS no painel administrativo do roteador.');
      return {
        classification: 'atencao',
        label: 'Atenção',
        isOpen: false,
        protocol: 'WPA2-PSK',
        encryption: 'AES-CCMP',
        authentication: 'PSK (com WPS)',
        rawCapabilities: caps || undefined,
        warnings,
        recommendations,
      };
    }

    return {
      classification: 'boa',
      label: 'Boa proteção',
      isOpen: false,
      protocol: 'WPA2-PSK',
      encryption: 'AES-CCMP',
      authentication: 'PSK',
      rawCapabilities: caps || undefined,
      warnings: [],
      recommendations: [
        'Criptografia WPA2-AES ativa. Caso seu roteador e dispositivos suportem, considere habilitar WPA3.',
      ],
    };
  }

  // 6. Tipo de segurança não reportado pelo sistema
  warnings.push(
    'O sistema operacional não informou completamente os parâmetros de criptografia desta rede.'
  );
  return {
    classification: 'atencao',
    label: 'Atenção',
    isOpen: false,
    protocol: 'Não identificado',
    encryption: null,
    authentication: null,
    rawCapabilities: caps || undefined,
    warnings,
    recommendations: ['Confirme nas configurações do roteador se o modo está definido como WPA2-AES ou WPA3.'],
  };
}
