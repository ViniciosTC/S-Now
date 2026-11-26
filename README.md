<div align="center">
  <img src="./assets/Logo.jpg" alt="S-Now Logo" width="110" style="border-radius: 22px;" />

  # S-Now

  **Diagnóstico de Rede Wi-Fi, Qualidade de Internet, Auditoria de Segurança e Heatmap RF**

  [![React Native](https://img.shields.io/badge/React%20Native-0.88.1-2D7296?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-SDK%2058-070B14?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Android](https://img.shields.io/badge/Platform-Android-10B981?style=flat-square&logo=android&logoColor=white)](./apks/sinal-wifi-standalone.apk)
  [![License: MIT](https://img.shields.io/badge/License-MIT-C86237?style=flat-square)](./LICENSE)

  [**Assista à Apresentação em Vídeo (YouTube Shorts)**](https://youtube.com/shorts/_omI99oMm9w?si=m0VPct4ILrFPvAVl) • [**Baixar APK Standalone**](./apks/sinal-wifi-standalone.apk)

</div>

---

## Sobre o Projeto

O **S-Now** é um aplicativo mobile desenvolvido em **React Native**, **TypeScript** e **Expo** para diagnosticar, monitorar e mapear a saúde real da sua conexão Wi-Fi e Internet diretamente no Android.

Diferente de medidores genéricos que exibem apenas uma velocidade isolada, o S-Now separa **qualidade do enlace Wi-Fi (RF)** e **qualidade da Internet (latência, jitter, perda de pacotes e throughput)**, audita a segurança da rede conectada, monitora a estabilidade em tempo real durante atividades específicas (como jogos e chamadas) e gera um **Heatmap de cobertura** do ambiente.

> **Demonstração em vídeo:** Confira o app rodando em dispositivo físico no [YouTube Shorts](https://youtube.com/shorts/_omI99oMm9w?si=m0VPct4ILrFPvAVl).

---

## Principais Funcionalidades

### 1. Motor de Diagnóstico Analítico (`diagnosticEngine`)
- **Separação de Dimensões:** Avalia separadamente a qualidade do **Wi-Fi** e a qualidade da **Internet**, gerando pontuação (0 a 100), nível de confiança e classificação (`Excelente`, `Estável`, `Atenção` ou `Crítica`).
- **Métricas de Rede Real:** Coleta múltiplas amostras de RSSI, variação de sinal, frequência/canal, padrão Wi-Fi, link speed (TX/RX), IP, gateway, DNS e interferência co-canal com redes próximas.
- **Sondas de Internet (`networkProber`):** Executa sondas reais de latência HTTP e DNS (`1.1.1.1`, `cloudflare.com`, `dns.google`), calcula **jitter**, **perda de pacotes (%)** e estima a **velocidade de download (Mbps)**.
- **Causas e Recomendações:** Traduz os dados técnicos em diagnóstico objetivo com causas prováveis e ações práticas.

### 2. Auditoria de Segurança Wi-Fi (`securityAuditor`)
- Analisa `securityType` e `capabilities` do ponto de acesso conectado via módulo nativo (`munim-wifi`).
- Classifica a proteção da rede (`Boa proteção`, `Atenção`, `Proteção fraca` ou `Indisponível`), identificando redes abertas, WEP, WPA1/TKIP, WPA2-AES (CCMP), WPA3 (SAE) e exposição de WPS, com alertas e recomendações claras.

### 3. Monitoramento Contínuo por Atividade (`activityMonitor`)
- Monitora a conexão em tempo real para cenários como **Jogos Online**, **Chamadas de Vídeo/Voz**, **Streaming de Vídeo** e **Navegação Geral**.
- Suporta execução em **segundo plano (Android Foreground Service)** via `expo-task-manager` e `expo-location` (`SNOW_ACTIVITY_MONITOR_TASK`).
- Registra latência média e máxima, jitter, perda de pacotes, interrupções, estabilidade (%) e RSSI médio, gerando um relatório completo ao final da sessão.

### 4. Heatmap de Cobertura & Mapeamento Caminhando
- **Canvas SVG Interativo:** Plota os pontos coletados com gradientes radiais na escala técnica RF:
  - `>= -50 dBm` Excelente | `-51 a -60 dBm` Bom | `-61 a -70 dBm` Intermediário | `-71 a -80 dBm` Fraco | `< -80 dBm` Muito Fraco.
- **Mapeamento Caminhando (Sessão Contínua):** Utiliza `Location.watchPositionAsync` em alta precisão, aguarda a estabilização do GPS e exige deslocamento mínimo calculado pela **fórmula de Haversine** para evitar registros duplicados por *drift* estático.
- **Amostragem Estabilizada de GPS (`gpsSampler`):** Combina múltiplas leituras por média ponderada pelo inverso da variância (`1 / accuracy²`).

### 5. Histórico & Análise de Padrões por Horário (`patternAnalyzer`)
- Agrupa diagnósticos por período (`Hoje`, `Ontem`, `Esta semana`, `Anteriores`) e exibe relatórios detalhados de cada medição.
- Identifica automaticamente padrões recorrentes de instabilidade por faixa de horário (**Madrugada**, **Manhã**, **Tarde**, **Noite**) ao cruzar diagnósticos e monitoramentos ao longo dos dias.

---

## Interface & Identidade Visual

O S-Now adota uma **Identidade Noturna** pensada para leitura rápida de telemetria em qualquer ambiente:
- **Base & Superfícies:** Azul-marinho profundo (`#070B14`) com cards em estilo *Liquid Glass* (`#101827` translúcido).
- **Destaques:** Laranja queimado (`#C86237`) e azul instrumental (`#2D7296`).
- **Componentes Customizados:** `Waveform` animado, `PulseRadar`, gráficos de sinal (`SignalChart`) e biblioteca própria de ícones vetoriais em SVG (`Icons.tsx`).

---

## Tecnologias Utilizadas

| Categoria | Tecnologia / Biblioteca |
| :--- | :--- |
| **Core** | React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3` |
| **Plataforma** | Expo SDK `~58.0.26` (Development Build / Android Native) |
| **Wi-Fi Nativo** | `munim-wifi` `^0.7.1`, `react-native-nitro-modules` `^0.37.2` |
| **Localização & Background** | `expo-location` `~58.0.22`, `expo-task-manager` `~58.0.14` |
| **Gráficos & Vetores** | `react-native-svg` `15.16.0` |
| **Persistência Local** | `@react-native-async-storage/async-storage` `2.2.0` |

---

## Estrutura do Projeto

```text
S-Now/
├── App.tsx                       # Orquestração de telas, estado global e BackHandler
├── app.json                      # Configuração Expo, permissões e plugins nativos
├── apks/
│   └── sinal-wifi-standalone.apk # Build standalone Android pronto para instalação
└── src/
    ├── components/               # Accordion, Button, Card, ConditionBadge, Header, Icons, PulseRadar, SignalChart, Waveform
    ├── screens/                  # Home, Diagnostico, Resultado, Monitoramento, Heatmap, Historico, Detalhes, Configuracoes
    ├── services/
    │   ├── activityMonitor.ts    # Monitoramento contínuo em foreground e background
    │   ├── diagnosticEngine.ts   # Motor analítico de Wi-Fi + Internet + Causas
    │   ├── gpsSampler.ts         # Amostragem estabilizada de GPS (1 / accuracy²)
    │   ├── networkProber.ts      # Sondas HTTP/DNS, jitter, packet loss e download
    │   ├── patternAnalyzer.ts    # Análise temporal de instabilidade por horário
    │   ├── securityAuditor.ts    # Auditoria de protocolos e criptografia Wi-Fi
    │   └── storage.ts            # Persistência local via AsyncStorage
    ├── theme/
    │   └── colors.ts             # Paleta Noturna S-Now e escala RF
    └── types/
        └── snow.ts               # Tipagens TypeScript do domínio
```

---

## Como Executar ou Instalar

### Opção 1 — Instalar o APK Standalone (Android)
O APK compilado em modo release já está disponível no repositório:

```bash
adb install -r apks/sinal-wifi-standalone.apk
```
Ou transfira o arquivo [`apks/sinal-wifi-standalone.apk`](./apks/sinal-wifi-standalone.apk) para o seu aparelho Android e instale diretamente.

### Opção 2 — Rodar em Desenvolvimento
> **Nota:** Como o app utiliza módulos nativos (`munim-wifi`, `react-native-nitro-modules` e Foreground Service do `expo-location`), é necessário usar um **Development Build** (`expo run:android`), e não o Expo Go padrão.

```bash
# 1. Clone o repositório
git clone https://github.com/ViniciosTC/S-Now.git
cd S-Now

# 2. Instale as dependências
npm install

# 3. Compile e execute no Android conectado (ou emulador)
npx expo run:android
```

---

## Considerações de Plataforma (Android)

- **Permissões:** A leitura de SSID/BSSID, varredura de redes próximas e o mapeamento de cobertura exigem permissão de **Localização** (e localização em segundo plano durante o monitoramento contínuo).
- **Wi-Fi Scan Throttling:** O Android limita varreduras ativas de redes próximas em primeiro plano; o app respeita esse limite sem travar o diagnóstico da rede conectada.
- **Precisão GPS Indoor:** Em ambientes fechados, a precisão do GPS pode variar; o módulo `gpsSampler` filtra leituras imprecisas e exibe a margem de incerteza diretamente no Heatmap.

---

## Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.

---

<div align="center">
  Desenvolvido por <a href="https://github.com/ViniciosTC"><strong>ViniciosTC</strong></a>
</div>
