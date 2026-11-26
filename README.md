# S-Now — Primeira Rodada de Ajustes

Aplicativo mobile minimalista em **React Native**, **TypeScript** e **Expo (development build)** para diagnóstico de cobertura e integridade de rádio Wi-Fi (**Samsung Galaxy A55 5G - Android 14 / One UI 6**).

---

## 1. Ajustes Realizados

### 1.1 Registro Automático no Heatmap
- Ao concluir um diagnóstico com sucesso, se houver coordenadas de localização válidas, o ponto é automaticamente adicionado ao Heatmap e persistido no armazenamento local com a chave `diagnosticId`.
- Eliminada a necessidade de intervenção manual ou toque em botões para inserir a medição na planta.

### 1.2 Mapeamento Caminhando (Sessão Contínua)
- Criada a funcionalidade de **Iniciar/Encerrar Sessão de Mapeamento**:
  - Utiliza `Location.watchPositionAsync` em alta precisão.
  - Aguarda a precisão estabilizar ($\le 18\text{m}$ em ambiente interno) antes de aceitar uma nova medição.
  - Exige deslocamento real mínimo de 3 metros (calculado via fórmula de Haversine) em relação ao ponto anterior para evitar registros duplicados ou flutuação estática (*drift*).
  - Feedback visual em tempo real:
    - 🟡 *Aguardando estabilização do GPS (±X m)...*
    - 🟢 *Mapeando — Caminhe pelo ambiente...*
    - 🔵 *Ponto X registrado com sucesso!*
  - **Incerteza do GPS no Heatmap:** O raio do halo de calor no canvas SVG varia proporcionalmente à precisão métrica daquele ponto (`uncertaintyRadius`), indicando visualmente a margem de erro da amostragem.

### 1.3 Redesenho da Home
- Removido o excesso de cartões com dados de métricas (eliminando o aspecto de dashboard convencional).
- Composição refinada e espaçosa:
  - Foco absoluto no botão central com o radar pulsante sutil (`PulseRadar`).
  - Após a primeira análise: uma pílula discreta indicando a última rede/horário e apenas as duas opções essenciais: **Histórico** e **Heatmap**.

### 1.4 Identidade Visual Rigorosa
- Off-white: `#F5F5F2`
- Grafite: `#24282D`
- Azul acinzentado: `#477A9B` (destaque primário)
- Laranja terroso: `#BD7653` (destaque secundário suave)
- Cinza suave: `#D9DAD6`
- Branco: `#FFFFFF`
- Cores da escala RF mantidas exclusivamente nos pontos e legendas técnicas do Heatmap.

### 1.5 Espaçamento e Safe Area no Android
- Corrigida a sobreposição com a barra de status e o recorte da câmera frontal (*punch-hole* do Galaxy A55).
- Todos os cabeçalhos e telas utilizam `Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + 12 : 8` de padding superior.
- Botão "Voltar" integrado com toque expandido (`hitSlop`) e navegação nativa do Android via hardware (*hardwareBackPress*).

### 1.6 Ícones Minimalistas de Traço Fino
- Substituídos emojis e círculos decorativos pesados por uma biblioteca vetorial própria em SVG ([src/components/Icons.tsx](file:///home/vinicios/Documentos/projetos/Testes/src/components/Icons.tsx)).
- Ícones com espessura de 1.6 a 1.8px (estilo Apple SF Symbols / Feather), proporções equilibradas e sutis.

---

## 2. APK Standalone Release Gerado

- **[sinal-wifi-standalone.apk](file:///home/vinicios/Documentos/projetos/Testes/apks/sinal-wifi-standalone.apk)** (82 MB)
  - Compilação Android nativa assinada (`assembleRelease`) com Hermes, C++ JSI, munim-wifi, expo-location e react-native-svg integrados.
  - Pronto para instalar diretamente no Galaxy A55 5G via `adb install -r apks/sinal-wifi-standalone.apk` ou pelo app *Meus Arquivos*.

---

## 3. Limitações e Pontos para Validação no Aparelho Físico

1. **Atenuação e Precisão do GPS Indoor no Galaxy A55:**
   - Em cômodos internos sem janelas, a precisão do GPS pode oscilar entre $\pm 15\text{m}$ e $\pm 30\text{m}$. A sessão de mapeamento informa visualmente esse estado na tela. Se a precisão demorar a atingir menos de 18m, caminhe próximo a janelas ou portas durante a inicialização para acelerar a aquisição dos satélites (TTFF).
2. **Wi-Fi Scan Throttling do Android:**
   - O Android 14 limita varreduras de primeiro plano a 4 vezes a cada 2 minutos. Durante o mapeamento caminhando, o app utiliza um intervalo conservador entre medições para não esgotar a cota permitida pelo sistema operacional.
