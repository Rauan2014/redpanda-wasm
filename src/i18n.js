const STORAGE_KEY = 'p3ds.lang';
const SUPPORTED_LANGS = ['pt', 'en'];

const HTML_ENTITIES_RE = /[<>&"']/g;

export function normalizeLang(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('pt')) return 'pt';
  if (value.startsWith('en')) return 'en';
  return null;
}

export function detectInitialLang() {
  if (typeof window !== 'undefined') {
    try {
      const fromQuery = normalizeLang(new URLSearchParams(window.location.search).get('lang'));
      if (fromQuery) return fromQuery;
    } catch {
      // Ignore malformed location search
    }
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const saved = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    } catch {
      // Ignore storage restrictions
    }
  }

  if (typeof navigator !== 'undefined') {
    const candidates =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];
    for (const candidate of candidates) {
      const code = String(candidate || '').trim().toLowerCase();
      if (!code) continue;
      return code.startsWith('pt') ? 'pt' : 'en';
    }
  }

  return 'en';
}

export const TRANSLATIONS = {
  pt: {
    'index.pageTitle': 'Panda3DS Web — Emulador 3DS em WebAssembly',
    'index.srHeading': 'Emulador 3DS WebAssembly — Panda3DS HOME Menu',
    'sobre.pageTitle': 'Panda3DS Web — Documentação, Política de Privacidade, Termos de Uso e Contato',

    'lang.groupAria': 'Seletor de idioma',

    'console.regionAria': 'Console Dual-Screen 3DS',
    'fullscreen.exitBtn': '✕ Sair da Tela Cheia (Esc)',
    'fullscreen.exitAria': 'Sair da tela cheia',
    'fullscreen.enterAria': 'Tela cheia apenas com as telas',
    'fullscreen.enterTitle': 'Tela cheia apenas telas (F)',
    'fullscreen.exitTitle': 'Sair da tela cheia (Esc ou F)',
    'fullscreen.utilityEnter': '⛶ Tela Cheia (Telas)',
    'fullscreen.utilityExit': '✕ Sair Tela Cheia',

    'motion.pauseAria': 'Pausar rotação 3D',
    'motion.resumeAria': 'Retomar rotação 3D',
    'audio.muteAria': 'Silenciar efeitos sonoros',
    'audio.unmuteAria': 'Ativar efeitos sonoros',
    'battery.aria': 'Bateria {percent}%{charging}',
    'battery.charging': ' (carregando)',
    'badge.sabOk': 'SAB OK',
    'badge.noCoi': 'NO COI',

    'canvas.cartridgeAria': 'Banner 3D interativo do cartucho Nintendo 3DS',
    'canvas.topAria': 'Saída de vídeo da Tela Superior do Nintendo 3DS',
    'canvas.bottomAria': 'Tela Tátil Inferior do Nintendo 3DS',

    'controls.shoulderGroupAria': 'Botões de ombro L, ZL, ZR e R',
    'controls.btnLAria': 'Botão L',
    'controls.btnZLAria': 'Botão ZL',
    'controls.btnZRAria': 'Botão ZR',
    'controls.btnRAria': 'Botão R',
    'controls.circlePadTitle': 'Analógico Circle Pad — mova o mouse ou arraste',
    'controls.dpadGroupAria': 'Direcional D-Pad',
    'controls.dpadUpAria': 'Direcional Cima',
    'controls.dpadLeftAria': 'Direcional Esquerda',
    'controls.dpadRightAria': 'Direcional Direita',
    'controls.dpadDownAria': 'Direcional Baixo',
    'controls.abxyGroupAria': 'Botões de ação A B X Y',
    'controls.btnXAria': 'Botão X',
    'controls.btnYAria': 'Botão Y',
    'controls.btnAAria': 'Botão A',
    'controls.btnBAria': 'Botão B',

    'home.gridAria': 'Aplicativos e slots do HOME Menu',
    'home.slotLoadTitle': 'Carregar ROM',
    'home.slotSavesShort': 'Saves',
    'home.slotSavesTitle': 'Gerenciador de Saves',
    'home.slotEmptyShort': 'Vazio',
    'home.slotEmptyTitle': 'Slot Vazio',
    'home.slotEmptyCart': 'SLOT VAZIO',
    'home.dockLoad': 'Carregar .3ds',
    'home.dockOpen': '▶ Abrir',
    'home.dockChoose': '▶ Escolher',
    'home.dockManage': '▶ Gerenciar',
    'home.dockEmpty': 'Vazio',

    'utility.regionAria': 'Controles, saves e status do sistema',
    'utility.mouseModeBtn': '🖱 Direcional Mouse: {mode}',
    'utility.controlsBtn': '🎮 Controle / Teclado',
    'utility.exportSaveBtn': 'Exportar Save',
    'utility.importSaveBtn': 'Importar Save',
    'utility.manageUserBtn': 'Gerenciar /user',
    'utility.supportBtn': '❤ Apoiar (Pix / Ko-fi)',
    'utility.gamepadDisconnected': '🎮 Controle: Conecte um gamepad ou use o teclado',
    'utility.gamepadConnected': '🎮 Controle: {name}',
    'utility.statusInitial': 'Verificando isolamento de origem e ROM demo...',

    'mouseMode.motion': 'Movimento',
    'mouseMode.position': 'Livre',
    'mouseMode.off': 'Desligado',

    'status.readyDemo': 'Pronto • Demo {name} ({kb} KB) carregada • {coi}',
    'status.coiActive': 'crossOriginIsolated ativo (SharedArrayBuffer OK)',
    'status.coiInactive': 'Sem COOP/COEP',
    'status.preloadError': 'Erro ao pré-carregar ROM demo ({url}): {error}',
    'status.romSelected': 'ROM selecionada: {name} ({kb} KB • {serial}{note})',
    'status.romNoteEncrypted': ' • ExeFS criptografada (Panda3DS requer ROM descriptografada)',
    'status.romNoteIcon': ' • Ícone SMDH extraído',
    'status.returnedHome': 'Retornou ao HOME Menu. Saves sincronizados com IDBFS (/user).',
    'status.noRomReady': 'Nenhuma ROM pronta para iniciar.',
    'status.initializing': 'Inicializando Panda3DS para {name}...',
    'status.waitingCore': 'Aguardando núcleo compilado em public/wasm/Panda3DS.js ({reason})',
    'status.launchFailed': 'Falha ao iniciar {name}: {error}',
    'status.encryptedError': 'Arquivo criptografado: o Panda3DS Web não inclui chaves proprietárias. Utilize homebrew (.3dsx) ou backup pessoal descriptografado.',
    'status.coprocError': 'Aplicação incompatível com o interpretador WASM atual (instrução de coprocessador ARM não suportada). Teste o homebrew Block Blast (DEMO).',
    'status.aborted': 'Emulação encerrada: {reason}',
    'status.noSavesToExport': 'Não há arquivos em /user para exportar no momento.',
    'status.exportedSaves': 'Exportado {count} arquivo(s) para {fileName}.',
    'status.exportError': 'Erro ao exportar saves: {error}',
    'status.importedSaves': 'Importado(s) {count} arquivo(s) de save em /user e sincronizado no IDBFS.',
    'status.importError': 'Erro ao importar save: {error}',
    'status.clearedUser': 'Diretório /user no IDBFS limpo.',
    'status.pixCopied': 'Chave Pix ({key}) copiada para a área de transferência.',
    'status.pixFallback': 'Chave Pix: {key}',
    'status.pixSupportFallback': 'Chave Pix para apoio: {key}',

    'emu.noCoiWarn': 'Aviso: crossOriginIsolated está desativado; SharedArrayBuffer pode estar indisponível.',
    'emu.resuming': 'Retomando {name}...',
    'emu.loadingCore': 'Carregando núcleo Panda3DS.js...',
    'emu.httpError': 'HTTP {status} ao buscar /wasm/Panda3DS.js',
    'emu.htmlFallbackError': 'O servidor retornou HTML (fallback) em /wasm/Panda3DS.js — o núcleo WASM ainda não foi compilado em public/wasm/.',
    'emu.wasmLoadFailed': 'Falha ao carregar /wasm/Panda3DS.js: {error}',
    'emu.noModuleFs': 'Module.FS não está exportado no build WebAssembly.',
    'emu.syncingSaves': 'Sincronizando saves (/user <-> IndexedDB)...',
    'emu.idbfsRestoreError': '[IDBFS] Erro ao restaurar /user: {error}',
    'emu.idbfsRestored': '[IDBFS] /user restaurado com sucesso do IndexedDB.',
    'emu.idbfsInitError': 'Erro ao inicializar sistema de arquivos IDBFS: {error}',
    'emu.idbfsSyncError': '[IDBFS] Erro na sincronização: {error}',
    'emu.romWritten': '[FS] ROM gravada em {path} ({bytes} bytes)',
    'emu.running': 'Executando {name}...',
    'emu.emulatorAborted': 'Emulador abortado: {what}',

    'saves.emptyMsg': 'Nenhum arquivo de save encontrado em /user (IDBFS).',
    'saves.downloadBtn': 'Baixar',
    'saves.loadingMsg': 'Carregando saves...',
    'saves.noValidInPackage': 'Nenhum arquivo de save válido encontrado no pacote.',
    'rom.defaultPublisher': 'Homebrew / Backup do Usuário',

    'coreNotice.title': 'Núcleo WebAssembly Panda3DS',
    'coreNotice.closeAria': 'Fechar aviso',
    'coreNotice.confirmBtn': 'Entendi',
    'coreNotice.msg': 'O front-end preparou a ROM "{romName}" ({kb} KB) e verificou o ambiente WebAssembly, mas o núcleo compilado não está presente em /wasm/Panda3DS.js.',
    'coreNotice.coiTrue': 'true (SharedArrayBuffer disponível)',
    'coreNotice.coiFalse': 'false',
    'coreNotice.checkCoi': 'crossOriginIsolated: {status}',
    'coreNotice.checkRom': "ROM pronta para FS.writeFile('/roms/{romName}'): {kb} KB",
    'coreNotice.checkReason': 'Motivo: {reason}',
    'coreNotice.checkHint': 'Gere os artefatos Panda3DS.js, Panda3DS.wasm e Panda3DS.worker.js em public/wasm/ executando scripts/build-wasm.sh (requer fork/patch Emscripten com interpretador ARM11).',

    'saveDialog.title': 'Gerenciador de Saves (/user • IDBFS)',
    'saveDialog.closeAria': 'Fechar gerenciador de saves',
    'saveDialog.descHtml': 'Arquivos persistidos em <code>/user</code> no IndexedDB (<code>IDBFS</code>) são restaurados automaticamente ao iniciar uma ROM.',
    'saveDialog.importBtn': 'Importar (.zip / .sav)',
    'saveDialog.exportBtn': 'Exportar Tudo (.zip)',
    'saveDialog.clearBtn': 'Limpar /user',
    'saveDialog.closeBtn': 'Fechar',

    'controlsDialog.title': 'Controle, Teclado & Direcional com Mouse',
    'controlsDialog.closeAria': 'Fechar configuração de controles',
    'controlsDialog.gamepadNone': 'Nenhum controle conectado. Conecte um controle USB/Bluetooth (Xbox, PlayStation, Switch, 8BitDo) e pressione qualquer botão.',
    'controlsDialog.gamepadConnected': 'Conectado: {id} ({mapping})',
    'controlsDialog.mouseModeLabel': 'Direcional com Mouse (Circle Pad)',
    'controlsDialog.mouseModeMotion': 'Movimento do Mouse (Auto-Centro)',
    'controlsDialog.mouseModePosition': 'Posição Livre (Analógico Contínuo)',
    'controlsDialog.mouseModeOff': 'Desligado (Somente Clique/Arraste)',
    'controlsDialog.gamepadLayoutLabel': 'Layout dos botões A / B / X / Y',
    'controlsDialog.gamepadLayoutXbox': 'Xbox / PlayStation (Botão Inferior = A)',
    'controlsDialog.gamepadLayoutNintendo': 'Posição Nintendo (Botão Direito = A)',
    'controlsDialog.mouseMirrorDpad': 'Espelhar movimento do mouse no D-Pad (jogos 2D/homebrew)',
    'controlsDialog.cpuClockLabel': 'Clock ARM11 (Performance / FPS)',
    'controlsDialog.cpuClock100': '100% (Padrão)',
    'controlsDialog.cpuClock75': '75% (Otimizado)',
    'controlsDialog.cpuClock50': '50% (Modo Rápido — Jogos 2D)',
    'controlsDialog.cpuClock35': '35% (Ultra)',
    'controlsDialog.enableAudio': 'Ativar áudio do emulador (DSP)',
    'controlsDialog.tableCaption': 'Mapeamento de teclas e botões',
    'controlsDialog.thConsole': 'Console 3DS',
    'controlsDialog.thKeyboard': 'Teclado',
    'controlsDialog.thGamepadMouse': 'Gamepad / Mouse',
    'controlsDialog.rowCirclePad': 'Circle Pad (Analógico)',
    'controlsDialog.rowCirclePadGp': 'Analógico Esq. ou Movimento do Mouse',
    'controlsDialog.rowDpad': 'D-Pad (Cruzeta)',
    'controlsDialog.rowDpadKeysHtml': '<code>Setas ↑ ↓ ← →</code>',
    'controlsDialog.rowDpadGp': 'D-Pad do Controle',
    'controlsDialog.rowAbxyKeysHtml': '<code>L K O I</code> ou <code>X Z V C</code>',
    'controlsDialog.rowAbxyGp': 'Botões frontais (ou clique no console)',
    'controlsDialog.rowShoulders': 'L / R e ZL / ZR',
    'controlsDialog.rowShouldersKeysHtml': '<code>Q P</code> e <code>1 0</code>',
    'controlsDialog.rowStartGp': 'Menu / View / Guide (Home)',
    'controlsDialog.rowFullscreen': 'Tela Cheia / Modo Mouse',
    'controlsDialog.rowFullscreenDesc': 'Exibe apenas a tela maior e a menor',
    'controlsDialog.doneBtn': 'Concluir',

    'supportDialog.title': '❤ Apoiar o Projeto (Pix, Ko-fi & Publicidade Limpa)',
    'supportDialog.closeAria': 'Fechar modal de apoio',
    'supportDialog.descHtml': 'O <strong>Panda3DS Web</strong> é mantido sem pop-unders ou anúncios intrusivos que atrapalhem os controles do emulador. Você pode apoiar diretamente o projeto via Pix ou plataformas de financiamento coletivo:',
    'supportDialog.pixLabel': 'Chave Pix (E-mail / Aleatória)',
    'supportDialog.copyPix': '❖ Copiar Pix',
    'supportDialog.pixCopied': '✓ Pix Copiado!',
    'supportDialog.kofiLink': '☕ Apoiar no Ko-fi',
    'supportDialog.githubLink': '★ Repositório Upstream Panda3DS',
    'supportDialog.monetizationHeading': 'Configuração de Monetização (Variáveis de Ambiente):',
    'supportDialog.envPixHtml': '• <code>VITE_PIX_KEY</code> e <code>VITE_KOFI_URL</code>: Define sua chave Pix e link Ko-fi/Sponsors.',
    'supportDialog.envAadsHtml': '• <code>VITE_AADS_UNIT_ID</code>: Ativa banner A-Ads (aprovação imediata, pagamento diário em Cripto, compatível com COEP).',
    'supportDialog.envAdsterraHtml': '• <code>VITE_ADSTERRA_BANNER_URL</code>: Ativa banner Display Nativo (Adsterra / Monetag sem pop-under).',
    'supportDialog.envAdsenseHtml': '• <code>VITE_ADSENSE_CLIENT</code> + <code>VITE_ADSENSE_SLOT</code>: Ativa Google AdSense quando desejado.',
    'supportDialog.closeBtn': 'Fechar',

    'ad.slotAria': 'Publicidade e apoio ao projeto',
    'ad.badge': 'PUBLICIDADE / APOIO AO PROJETO',
    'ad.policyTag': 'Sem Pop-unders • Execução 100% Local',
    'ad.bannerTitle': 'Apoie o Panda3DS Web • Emulação ARM11 100% no Navegador',
    'ad.bannerDesc': 'Projeto independente sem pop-ups invasivos. Apoie via Pix ou Ko-fi para manter o desenvolvimento WebAssembly (ou configure VITE_AADS_UNIT_ID / VITE_ADSTERRA_BANNER_URL).',
    'ad.copyPixBtn': '❖ Copiar Chave Pix',
    'ad.pixCopiedBtn': '✓ Pix Copiado!',
    'ad.kofiSupportBtn': '❤ Ko-fi / Opções de Apoio',
    'ad.statusSupport': 'Slot monetizado em modo Apoio Direto (Pix/Ko-fi) • Compatível com A-Ads, Adsterra/Monetag (Display Nativo) e Google AdSense.',
    'ad.aadsTitle': 'Publicidade A-Ads',
    'ad.aadsStatus': 'Publicidade A-Ads ativa (Unidade #{unitId} • Sem cookies invasivos / Compatível com COEP).',
    'ad.customTitle': 'Publicidade Display Nativo',
    'ad.customStatus': 'Banner Display ativo (Adsterra / Monetag • Isolado sem Pop-unders).',
    'ad.adsenseStatus': 'Publicidade Google AdSense ativa.',

    'doc.sectionAria': 'Documentação técnica, requisitos, perguntas frequentes e aviso legal',
    'doc.aboutTitle': 'Sobre o Panda3DS Web (Emulação ARM11 em WebAssembly)',
    'doc.aboutP1Html': 'O <strong>Panda3DS Web</strong> é uma plataforma educacional e experimental de código aberto que porta o emulador Panda3DS para execução direta no navegador utilizando <strong>WebAssembly (WASM)</strong>, renderização gráfica acelerada por hardware via <strong>WebGL2 (OpenGL ES 3.0)</strong>, síntese de áudio <strong>Web Audio DSP</strong> e sistema de arquivos persistente local com <code>IndexedDB (IDBFS)</code>.',
    'doc.aboutP2Html': 'A interface reproduz a experiência de navegação em duas telas (proporções nativas de <code>400×240</code> na tela superior e <code>320×240</code> na tela tátil inferior) e traz pré-instalado exclusivamente o jogo homebrew open-source <strong>Block Blast</strong> (distribuído no formato <code>.3dsx</code> sob licença permissiva Zlib) para demonstração imediata.',
    'doc.reqTitle': 'Requisitos de Sistema e Guia Rápido de Uso',
    'doc.req1Html': '<strong>Navegadores Compatíveis:</strong> Google Chrome 110+, Microsoft Edge 110+, Mozilla Firefox 115+ ou Safari 16.4+ com aceleração gráfica WebGL2 e suporte a WebAssembly multithread.',
    'doc.req2Html': '<strong>Isolamento de Origem (COOP/COEP):</strong> O indicador <code>SAB OK</code> na barra superior do console confirma que <code>SharedArrayBuffer</code> está ativo para desempenho máximo do interpretador ARM11.',
    'doc.req3Html': '<strong>Formatos Aceitos Localmente:</strong> Aplicações homebrew (<code>.3dsx</code>) e backups pessoais descriptografados (<code>.3ds</code>, <code>.cci</code>, <code>.cxi</code>) carregados diretamente do armazenamento do seu dispositivo.',
    'doc.req4Html': '<strong>Gerenciamento de Saves:</strong> O diretório virtual <code>/user</code> salva o progresso automaticamente no <code>IndexedDB</code> a cada retorno ao HOME Menu, permitindo exportar e importar backups completos em <code>.zip</code>.',

    'faq.heading': 'Perguntas Frequentes (FAQ)',
    'faq.q1Summary': 'Os arquivos selecionados no meu computador ou celular são enviados para algum servidor?',
    'faq.q1AnswerHtml': '<strong>Não.</strong> Toda a leitura de pacotes <code>.3dsx</code>, <code>.3ds</code>, <code>.cci</code>, <code>.cxi</code> e arquivos de salvamento ocorre 100% localmente na memória RAM do seu navegador através da <em>Web File API</em> e do sistema de arquivos virtual do Emscripten (<code>MEMFS</code> / <code>IDBFS</code>). Nenhum binário de jogo é transmitido pela rede.',
    'faq.q2Summary': 'Por que arquivos criptografados não abrem no emulador?',
    'faq.q2AnswerHtml': 'Em respeito às leis de propriedade intelectual e direitos autorais (DMCA / Lei nº 9.610/1998), o Panda3DS Web <strong>não inclui chaves criptográficas proprietárias (AES keys), BIOS ou arquivos de firmware de sistema</strong>. O núcleo executa apenas aplicações homebrew de código aberto (<code>.3dsx</code>) ou dumps pessoais previamente descriptografados pelo próprio titular legítimo do cartucho físico.',
    'faq.q3Summary': 'Como melhorar a performance e a taxa de quadros (FPS) no navegador?',
    'faq.q3AnswerHtml': 'Clique no botão <strong>Controle / Teclado</strong> na barra utilitária e ajuste a opção <strong>Clock ARM11</strong> para <code>75% (Otimizado)</code> ou <code>50% (Modo Rápido — Jogos 2D)</code>. Isso reduz a quantidade de ciclos de CPU emulados por quadro de vídeo, aumentando a fluidez da renderização WebGL2 em notebooks e dispositivos móveis.',
    'faq.q4Summary': 'Como conectar controles Bluetooth/USB ou usar o mouse como analógico?',
    'faq.q4AnswerHtml': 'Basta conectar qualquer controle compatível (Xbox, PlayStation DualShock/DualSense, Switch Pro Controller ou 8BitDo) e pressionar um botão para ativar a <em>Web Gamepad API</em>. Se preferir jogar no mouse e teclado, o botão <strong>Direcional Mouse</strong> permite usar o movimento do cursor para controlar o Circle Pad analógico enquanto clica na tela tátil inferior.',

    'legal.title': 'Aviso Legal e Propriedade Intelectual (Disclaimer)',
    'legal.p1Html': '<strong>1. Declaração de Não Afiliação e Marcas Registradas:</strong> Este projeto e este website são iniciativas independentes de estudo de arquitetura de computadores e compilação WebAssembly, <strong>não possuindo qualquer vínculo, afiliação, patrocínio, licenciamento ou endosso da Nintendo Co., Ltd.</strong> ou de suas subsidiárias. As denominações "Nintendo" e "3DS" são marcas registradas de seus respectivos titulares e são citadas neste site exclusivamente em caráter descritivo e informativo de interoperabilidade técnica.',
    'legal.p2Html': '<strong>2. Política Estrita Contra Pirataria (Zero ROMs Comerciais):</strong> Este software <strong>não inclui, não hospeda, não distribui e não fornece links ou incentivos para download</strong> de ROMs comerciais, ISOs, imagens de cartuchos protegidos, BIOS, NAND, firmwares ou chaves de criptografia. O único arquivo executável distribuído com a página é a demonstração homebrew de código aberto <code>blockblast.3dsx</code>. O usuário é integralmente responsável por utilizar apenas softwares homebrew de livre distribuição ou cópias de backup pessoais obtidas legalmente de sua própria mídia física.',

    'footer.aria': 'Rodapé institucional e links legais',
    'footer.navAria': 'Navegação legal e institucional',
    'footer.aboutLink': 'Sobre & Guia Completo',
    'footer.privacyLink': 'Política de Privacidade & Cookies',
    'footer.termsLink': 'Termos de Uso',
    'footer.contactLink': 'Contato & DMCA',
    'footer.supportBtn': '❤ Apoiar Projeto (Pix / Ko-fi)',
    'footer.copy': 'Panda3DS Web — Emulação educacional client-side em WebAssembly (GPLv3 / Zlib Demo). Não afiliado à Nintendo Co., Ltd.',

    'sobre.h1': 'Panda3DS Web — Guia, Privacidade & Termos Legais',
    'sobre.backBtn': '◀ Voltar para o Emulador',
    'sobre.navAria': 'Índice da página',
    'sobre.navArch': 'Arquitetura Técnica',
    'sobre.navControls': 'Guia de Controles',
    'sobre.navPrivacy': 'Política de Privacidade & Cookies',
    'sobre.navTerms': 'Termos de Uso & Direitos Autorais',
    'sobre.navContact': 'Contato & DMCA',
    'sobre.archTitle': 'Arquitetura Técnica: Emulação ARM11 em WebAssembly',
    'sobre.archIntroHtml': '<strong>Panda3DS Web</strong> é uma portabilidade educacional e experimental de código aberto baseada no projeto <em>Panda3DS</em> (de <code>wheremyfoodat</code>) combinada com um interpretador <strong>ARM11v6K / Thumb / VFPv2 / CP15</strong> compilado para WebAssembly via Emscripten.',
    'sobre.arch1Html': '<strong>Renderização Dual-Screen em WebGL2:</strong> A GPU PICA200 é traduzida para chamadas OpenGL ES 3.0 / WebGL2 e exibida em tempo real nas duas telas do console (<code>400×240</code> na tela superior e <code>320×240</code> na tela tátil inferior).',
    'sobre.arch2Html': '<strong>Armazenamento Persistente IDBFS (<code>/user</code>):</strong> Os arquivos de save gerados durante a execução são sincronizados com o banco de dados local <code>IndexedDB</code> do navegador, permitindo exportar ou importar pacotes <code>.zip</code> e <code>.sav</code> sem depender de servidores externos.',
    'sobre.arch3Html': '<strong>Demonstração Homebrew Licenciada:</strong> A aplicação carrega por padrão exclusivamente o jogo homebrew <em>Block Blast</em> (<code>blockblast.3dsx</code>, distribuído sob licença open-source Zlib), demonstrando a execução de binários <code>.3dsx</code> diretamente no navegador.',
    'sobre.adHeading': 'PUBLICIDADE / APOIO AO PROJETO (ROTA SEM BLOQUEIO COEP)',
    'sobre.controlsTitle': 'Controles: Teclado, Gamepad e Mouse Direcional',
    'sobre.controlsIntroHtml': 'O emulador aceita controles físicos USB e Bluetooth via <em>Web Gamepad API</em> (Xbox, PlayStation DualShock/DualSense, Nintendo Switch Pro Controller, 8BitDo), teclado completo, cliques ou toques na tela inferior e movimento do mouse para simular o Circle Pad analógico.',
    'sobre.tableCaption': 'Referência Completa de Mapeamento',
    'sobre.thCommand': 'Comando do Console',
    'sobre.thKeyboard': 'Teclado',
    'sobre.thGamepadMouse': 'Gamepad / Mouse',
    'sobre.rowAnalog': 'Analógico (Circle Pad)',
    'sobre.rowAnalogGp': 'Analógico Esquerdo ou Movimento do Mouse',
    'sobre.rowDpad': 'D-Pad (Cruzeta Digital)',
    'sobre.rowDpadKeysHtml': '<code>Setas ↑ ↓ ← →</code>',
    'sobre.rowDpadGp': 'Direcional Digital (D-Pad)',
    'sobre.rowAbxy': 'Botões A / B / X / Y',
    'sobre.rowAbxyKeysHtml': '<code>L / K / O / I</code> ou <code>X / Z / V / C</code>',
    'sobre.rowAbxyGp': 'Botões Frontais do Controle ou Clique na UI',
    'sobre.rowShoulders': 'Ombros L / R e Gatilhos ZL / ZR',
    'sobre.rowShouldersKeysHtml': '<code>Q / P</code> e <code>1 / 0</code>',
    'sobre.rowStartGp': 'Start / Select / Botão Guia',
    'sobre.rowFullscreen': 'Tela Cheia (Somente Telas)',
    'sobre.rowFullscreenKeysHtml': '<code>F</code> (<code>Esc</code> para sair)',
    'sobre.rowFullscreenDesc': 'Oculta toda a moldura e exibe apenas as duas telas',

    'sobre.privacyTitle': 'Política de Privacidade e Uso de Cookies (LGPD / GDPR / Cláusula 10 Google AdSense)',
    'sobre.privacy1Heading': '1. Processamento 100% Local (Client-Side)',
    'sobre.privacy1Html': 'O Panda3DS Web opera exclusivamente no navegador do usuário. Todos os arquivos de aplicativos (<code>.3dsx</code>, <code>.3ds</code>, <code>.cci</code>, <code>.cxi</code>) e arquivos de progresso/save (<code>.sav</code>, <code>.dat</code>, <code>.zip</code>) abertos pelo usuário são lidos apenas na memória local (<code>ArrayBuffer</code> / <code>MEMFS</code>) e persistidos no <code>IndexedDB</code> do próprio dispositivo. Nenhum arquivo selecionado pelo usuário é enviado, coletado ou armazenado em servidores externos.',
    'sobre.privacy2Heading': '2. Armazenamento Local (LocalStorage e IndexedDB)',
    'sobre.privacy2Html': 'Utilizamos o <code>localStorage</code> exclusivamente para lembrar suas preferências técnicas locais (como a escala de clock ARM11, o idioma e o estado de ativação do áudio) e o banco <code>IndexedDB</code> para guardar seus arquivos de salvamento em <code>/user</code>. Você pode apagar todos esses dados instantaneamente clicando em <strong>"Limpar /user"</strong> no Gerenciador de Saves ou limpando os dados do site nas configurações do navegador.',
    'sobre.privacy3Heading': '3. Cookies de Terceiros e Publicidade (Google AdSense e Redes Parceiras)',
    'sobre.privacy3IntroHtml': 'Este site pode exibir anúncios fornecidos por redes de publicidade como <strong>A-Ads</strong>, <strong>Adsterra / Monetag</strong> (em formato estrito de banner display nativo) ou <strong>Google AdSense</strong>, além de opções de apoio direto via Pix e Ko-fi:',
    'sobre.privacy3Li1Html': '<strong>Terceiros e Cookie DoubleClick/DART (Cláusula 10):</strong> Terceiros, incluindo o Google, utilizam cookies para veicular anúncios com base nas visitas anteriores do usuário a este website ou a outros websites na Internet.',
    'sobre.privacy3Li2Html': '<strong>Publicidade Personalizada e Como Desativar (Opt-Out):</strong> Com o uso de cookies de publicidade, o Google e seus parceiros podem veicular anúncios para os usuários com base nas visitas feitas a este e a outros sites na Internet. Os usuários podem desativar a publicidade personalizada a qualquer momento acessando as <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Configurações de Anúncios do Google (Ads Settings)</a>.',
    'sobre.privacy3Li3Html': '<strong>Opt-Out Geral de Cookies de Terceiros:</strong> Alternativamente, você pode desativar o uso de cookies de terceiros para publicidade personalizada acessando o portal da Digital Advertising Alliance em <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">www.aboutads.info/choices</a> ou, para residentes na União Europeia, em <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer">www.youronlinechoices.eu</a>.',
    'sobre.privacy4Heading': '4. Direitos do Titular de Dados (LGPD e GDPR)',
    'sobre.privacy4Body': 'Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD) no Brasil e o Regulamento Geral sobre a Proteção de Dados (GDPR) no Espaço Econômico Europeu, informamos que não coletamos dados pessoais identificáveis (como nome, CPF ou cadastro) para uso do emulador. Caso entre em contato por e-mail, seus dados serão utilizados única e exclusivamente para responder à sua solicitação.',

    'sobre.termsTitle': 'Termos de Uso e Aviso de Propriedade Intelectual',
    'sobre.terms1Heading': '1. Isenção de Garantias e Finalidade Educacional',
    'sobre.terms1Html': 'O Panda3DS Web é disponibilizado gratuitamente "no estado em que se encontra" (<em>as-is</em>), com finalidade estritamente educacional, de pesquisa em compilação WebAssembly e preservação de software homebrew.',
    'sobre.terms2Heading': '2. Declaração de Não Afiliação e Uso Descritivo de Marcas',
    'sobre.terms2Html': 'Este projeto não possui vínculo comercial, societário, patrocínio ou endosso da <strong>Nintendo Co., Ltd.</strong> Termos técnicos como "Nintendo 3DS", "3DS", "NCCH", "NCSD" e "SMDH" são utilizados exclusivamente com propósito descritivo de compatibilidade e documentação técnica (<em>nominative fair use</em>).',
    'sobre.terms3Heading': '3. Política Estrita Sobre ROMs, BIOS e Direitos Autorais',
    'sobre.terms3Html': 'Este website <strong>não hospeda, não fornece, não comercializa e não contém links externos</strong> para download de ROMs comerciais, jogos protegidos por direitos autorais, chaves criptográficas (<code>aes_keys.txt</code>), dumps de BIOS ou firmwares proprietários. O usuário compromete-se a carregar apenas softwares homebrew de distribuição livre (como arquivos <code>.3dsx</code> autorizados) ou backups próprios gerados legalmente a partir de seus próprios cartuchos físicos.',

    'sobre.contactTitle': 'Sobre o Mantenedor, Contato & Notificações DMCA',
    'sobre.contact1Html': 'O núcleo original Panda3DS é desenvolvido pela comunidade open-source sob licença GPLv3, e o jogo de demonstração <em>Block Blast</em> (<code>blockblast.3dsx</code>) é um projeto homebrew open-source licenciado sob a licença Zlib.',
    'sobre.contact2Body': 'Para dúvidas técnicas, sugestões, suporte sobre privacidade (LGPD/GDPR) ou notificações formais de propriedade intelectual (DMCA), entre em contato com o administrador responsável:',
    'sobre.contactLiEmailHtml': '<strong>E-mail de Contato e Conformidade Legal:</strong> <a href="mailto:contato@panda3dsweb.dev">contato@panda3dsweb.dev</a>',
    'sobre.contactPixLabel': 'Chave Pix para Apoio ao Projeto:',
    'sobre.contactLiRepoHtml': '<strong>Código-Fonte de Referência (Upstream):</strong> <a href="https://github.com/wheremyfoodat/Panda3DS" target="_blank" rel="noopener noreferrer">github.com/wheremyfoodat/Panda3DS</a>',
    'sobre.footerSpan': 'Panda3DS Web — Projeto educacional WebAssembly baseado em Panda3DS e Azahar DynCom ARM11 Interpreter.',
    'sobre.footerBack': 'Voltar ao Emulador',
  },

  en: {
    'index.pageTitle': 'Panda3DS Web — WebAssembly 3DS Emulator',
    'index.srHeading': 'WebAssembly 3DS Emulator — Panda3DS HOME Menu',
    'sobre.pageTitle': 'Panda3DS Web — Documentation, Privacy Policy, Terms of Use & Contact',

    'lang.groupAria': 'Language selector',

    'console.regionAria': 'Dual-Screen 3DS Console',
    'fullscreen.exitBtn': '✕ Exit Fullscreen (Esc)',
    'fullscreen.exitAria': 'Exit fullscreen',
    'fullscreen.enterAria': 'Screens-only fullscreen',
    'fullscreen.enterTitle': 'Screens-only fullscreen (F)',
    'fullscreen.exitTitle': 'Exit fullscreen (Esc or F)',
    'fullscreen.utilityEnter': '⛶ Fullscreen (Screens)',
    'fullscreen.utilityExit': '✕ Exit Fullscreen',

    'motion.pauseAria': 'Pause 3D rotation',
    'motion.resumeAria': 'Resume 3D rotation',
    'audio.muteAria': 'Mute UI sound effects',
    'audio.unmuteAria': 'Enable UI sound effects',
    'battery.aria': 'Battery {percent}%{charging}',
    'battery.charging': ' (charging)',
    'badge.sabOk': 'SAB OK',
    'badge.noCoi': 'NO COI',

    'canvas.cartridgeAria': 'Interactive 3D Nintendo 3DS cartridge banner',
    'canvas.topAria': 'Nintendo 3DS Top Screen video output',
    'canvas.bottomAria': 'Nintendo 3DS Bottom Touchscreen',

    'controls.shoulderGroupAria': 'L, ZL, ZR, and R shoulder buttons',
    'controls.btnLAria': 'L Button',
    'controls.btnZLAria': 'ZL Button',
    'controls.btnZRAria': 'ZR Button',
    'controls.btnRAria': 'R Button',
    'controls.circlePadTitle': 'Analog Circle Pad — move mouse or drag',
    'controls.dpadGroupAria': 'D-Pad Directional Pad',
    'controls.dpadUpAria': 'D-Pad Up',
    'controls.dpadLeftAria': 'D-Pad Left',
    'controls.dpadRightAria': 'D-Pad Right',
    'controls.dpadDownAria': 'D-Pad Down',
    'controls.abxyGroupAria': 'A B X Y action buttons',
    'controls.btnXAria': 'X Button',
    'controls.btnYAria': 'Y Button',
    'controls.btnAAria': 'A Button',
    'controls.btnBAria': 'B Button',

    'home.gridAria': 'HOME Menu apps and slots',
    'home.slotLoadTitle': 'Load ROM',
    'home.slotSavesShort': 'Saves',
    'home.slotSavesTitle': 'Save Manager',
    'home.slotEmptyShort': 'Empty',
    'home.slotEmptyTitle': 'Empty Slot',
    'home.slotEmptyCart': 'EMPTY SLOT',
    'home.dockLoad': 'Load .3ds',
    'home.dockOpen': '▶ Launch',
    'home.dockChoose': '▶ Browse',
    'home.dockManage': '▶ Manage',
    'home.dockEmpty': 'Empty',

    'utility.regionAria': 'Controls, saves, and system status',
    'utility.mouseModeBtn': '🖱 Mouse Analog: {mode}',
    'utility.controlsBtn': '🎮 Gamepad / Keyboard',
    'utility.exportSaveBtn': 'Export Save',
    'utility.importSaveBtn': 'Import Save',
    'utility.manageUserBtn': 'Manage /user',
    'utility.supportBtn': '❤ Support (Ko-fi / Pix)',
    'utility.gamepadDisconnected': '🎮 Controller: Connect a gamepad or use the keyboard',
    'utility.gamepadConnected': '🎮 Controller: {name}',
    'utility.statusInitial': 'Checking cross-origin isolation and demo ROM...',

    'mouseMode.motion': 'Motion',
    'mouseMode.position': 'Position',
    'mouseMode.off': 'Off',

    'status.readyDemo': 'Ready • Demo {name} ({kb} KB) loaded • {coi}',
    'status.coiActive': 'crossOriginIsolated active (SharedArrayBuffer OK)',
    'status.coiInactive': 'No COOP/COEP',
    'status.preloadError': 'Failed to preload demo ROM ({url}): {error}',
    'status.romSelected': 'ROM selected: {name} ({kb} KB • {serial}{note})',
    'status.romNoteEncrypted': ' • Encrypted ExeFS (Panda3DS requires a decrypted ROM)',
    'status.romNoteIcon': ' • SMDH icon extracted',
    'status.returnedHome': 'Returned to HOME Menu. Saves synced to IDBFS (/user).',
    'status.noRomReady': 'No ROM ready to launch.',
    'status.initializing': 'Initializing Panda3DS for {name}...',
    'status.waitingCore': 'Waiting for compiled core at public/wasm/Panda3DS.js ({reason})',
    'status.launchFailed': 'Failed to start {name}: {error}',
    'status.encryptedError': 'Encrypted file: Panda3DS Web does not include proprietary keys. Use open-source homebrew (.3dsx) or your own decrypted backup.',
    'status.coprocError': 'Application incompatible with the current WASM interpreter (unsupported ARM coprocessor instruction). Try the Block Blast homebrew demo.',
    'status.aborted': 'Emulation halted: {reason}',
    'status.noSavesToExport': 'There are no files in /user to export right now.',
    'status.exportedSaves': 'Exported {count} file(s) to {fileName}.',
    'status.exportError': 'Error exporting saves: {error}',
    'status.importedSaves': 'Imported {count} save file(s) into /user and synced to IDBFS.',
    'status.importError': 'Error importing save: {error}',
    'status.clearedUser': 'IDBFS /user directory cleared.',
    'status.pixCopied': 'Pix key ({key}) copied to clipboard.',
    'status.pixFallback': 'Pix key: {key}',
    'status.pixSupportFallback': 'Support Pix key: {key}',

    'emu.noCoiWarn': 'Warning: crossOriginIsolated is disabled; SharedArrayBuffer may be unavailable.',
    'emu.resuming': 'Resuming {name}...',
    'emu.loadingCore': 'Loading Panda3DS.js core...',
    'emu.httpError': 'HTTP {status} while fetching /wasm/Panda3DS.js',
    'emu.htmlFallbackError': 'Server returned HTML fallback at /wasm/Panda3DS.js — the WASM core has not been built into public/wasm/ yet.',
    'emu.wasmLoadFailed': 'Failed to load /wasm/Panda3DS.js: {error}',
    'emu.noModuleFs': 'Module.FS is not exported in the WebAssembly build.',
    'emu.syncingSaves': 'Syncing saves (/user <-> IndexedDB)...',
    'emu.idbfsRestoreError': '[IDBFS] Error restoring /user: {error}',
    'emu.idbfsRestored': '[IDBFS] /user successfully restored from IndexedDB.',
    'emu.idbfsInitError': 'Failed to initialize IDBFS filesystem: {error}',
    'emu.idbfsSyncError': '[IDBFS] Sync error: {error}',
    'emu.romWritten': '[FS] ROM written to {path} ({bytes} bytes)',
    'emu.running': 'Running {name}...',
    'emu.emulatorAborted': 'Emulator aborted: {what}',

    'saves.emptyMsg': 'No save files found in /user (IDBFS).',
    'saves.downloadBtn': 'Download',
    'saves.loadingMsg': 'Loading saves...',
    'saves.noValidInPackage': 'No valid save file found in package.',
    'rom.defaultPublisher': 'Homebrew / User Backup',

    'coreNotice.title': 'Panda3DS WebAssembly Core',
    'coreNotice.closeAria': 'Close notice',
    'coreNotice.confirmBtn': 'Got it',
    'coreNotice.msg': 'The front-end staged ROM "{romName}" ({kb} KB) and checked the WebAssembly environment, but the compiled core is missing at /wasm/Panda3DS.js.',
    'coreNotice.coiTrue': 'true (SharedArrayBuffer available)',
    'coreNotice.coiFalse': 'false',
    'coreNotice.checkCoi': 'crossOriginIsolated: {status}',
    'coreNotice.checkRom': "ROM ready for FS.writeFile('/roms/{romName}'): {kb} KB",
    'coreNotice.checkReason': 'Reason: {reason}',
    'coreNotice.checkHint': 'Generate Panda3DS.js, Panda3DS.wasm, and Panda3DS.worker.js in public/wasm/ by running scripts/build-wasm.sh (requires Emscripten + ARM11 DynCom patch).',

    'saveDialog.title': 'Save Manager (/user • IDBFS)',
    'saveDialog.closeAria': 'Close save manager',
    'saveDialog.descHtml': 'Files persisted in <code>/user</code> via IndexedDB (<code>IDBFS</code>) are automatically restored when launching a ROM.',
    'saveDialog.importBtn': 'Import (.zip / .sav)',
    'saveDialog.exportBtn': 'Export All (.zip)',
    'saveDialog.clearBtn': 'Clear /user',
    'saveDialog.closeBtn': 'Close',

    'controlsDialog.title': 'Controller, Keyboard & Mouse Analog',
    'controlsDialog.closeAria': 'Close controller settings',
    'controlsDialog.gamepadNone': 'No controller detected. Connect a USB/Bluetooth gamepad (Xbox, PlayStation, Switch, 8BitDo) and press any button.',
    'controlsDialog.gamepadConnected': 'Connected: {id} ({mapping})',
    'controlsDialog.mouseModeLabel': 'Mouse Analog (Circle Pad)',
    'controlsDialog.mouseModeMotion': 'Mouse Motion (Auto-Center)',
    'controlsDialog.mouseModePosition': 'Cursor Position (Continuous Analog)',
    'controlsDialog.mouseModeOff': 'Off (Drag / Click Only)',
    'controlsDialog.gamepadLayoutLabel': 'A / B / X / Y Button Layout',
    'controlsDialog.gamepadLayoutXbox': 'Xbox / PlayStation (Bottom Button = A)',
    'controlsDialog.gamepadLayoutNintendo': 'Nintendo Positional (Right Button = A)',
    'controlsDialog.mouseMirrorDpad': 'Mirror mouse movement to D-Pad (2D / homebrew titles)',
    'controlsDialog.cpuClockLabel': 'ARM11 Clock Scale (Performance / FPS)',
    'controlsDialog.cpuClock100': '100% (Default)',
    'controlsDialog.cpuClock75': '75% (Balanced)',
    'controlsDialog.cpuClock50': '50% (Fast — 2D Games)',
    'controlsDialog.cpuClock35': '35% (Ultra)',
    'controlsDialog.enableAudio': 'Enable emulator audio (DSP)',
    'controlsDialog.tableCaption': 'Key & button mapping',
    'controlsDialog.thConsole': '3DS Input',
    'controlsDialog.thKeyboard': 'Keyboard',
    'controlsDialog.thGamepadMouse': 'Gamepad / Mouse',
    'controlsDialog.rowCirclePad': 'Circle Pad (Analog)',
    'controlsDialog.rowCirclePadGp': 'Left Stick or Mouse Motion',
    'controlsDialog.rowDpad': 'D-Pad',
    'controlsDialog.rowDpadKeysHtml': '<code>Arrow Keys ↑ ↓ ← →</code>',
    'controlsDialog.rowDpadGp': 'Controller D-Pad',
    'controlsDialog.rowAbxyKeysHtml': '<code>L K O I</code> or <code>X Z V C</code>',
    'controlsDialog.rowAbxyGp': 'Face buttons (or click on console)',
    'controlsDialog.rowShoulders': 'L / R and ZL / ZR',
    'controlsDialog.rowShouldersKeysHtml': '<code>Q P</code> and <code>1 0</code>',
    'controlsDialog.rowStartGp': 'Menu / View / Guide (Home)',
    'controlsDialog.rowFullscreen': 'Fullscreen / Mouse Mode',
    'controlsDialog.rowFullscreenDesc': 'Shows only the top and bottom screens',
    'controlsDialog.doneBtn': 'Done',

    'supportDialog.title': '❤ Support the Project (Ko-fi, Pix & Clean Ads)',
    'supportDialog.closeAria': 'Close support dialog',
    'supportDialog.descHtml': '<strong>Panda3DS Web</strong> stays free of pop-unders or intrusive ads that block gameplay controls. You can support development directly via Ko-fi or Pix (Brazil):',
    'supportDialog.pixLabel': 'Pix Key (Brazil • E-mail / Random)',
    'supportDialog.copyPix': '❖ Copy Pix Key',
    'supportDialog.pixCopied': '✓ Pix Copied!',
    'supportDialog.kofiLink': '☕ Support on Ko-fi',
    'supportDialog.githubLink': '★ Upstream Panda3DS Repo',
    'supportDialog.monetizationHeading': 'Monetization Configuration (Environment Variables):',
    'supportDialog.envPixHtml': '• <code>VITE_PIX_KEY</code> &amp; <code>VITE_KOFI_URL</code>: Sets your Pix key and Ko-fi/Sponsors link.',
    'supportDialog.envAadsHtml': '• <code>VITE_AADS_UNIT_ID</code>: Enables an A-Ads banner (instant approval, COEP-compatible).',
    'supportDialog.envAdsterraHtml': '• <code>VITE_ADSTERRA_BANNER_URL</code>: Enables a clean display banner (Adsterra / Monetag without pop-unders).',
    'supportDialog.envAdsenseHtml': '• <code>VITE_ADSENSE_CLIENT</code> + <code>VITE_ADSENSE_SLOT</code>: Enables Google AdSense when configured.',
    'supportDialog.closeBtn': 'Close',

    'ad.slotAria': 'Advertising and project support',
    'ad.badge': 'SPONSORED / PROJECT SUPPORT',
    'ad.policyTag': 'No Pop-unders • 100% Local Execution',
    'ad.bannerTitle': 'Support Panda3DS Web • 100% Client-Side ARM11 Emulation',
    'ad.bannerDesc': 'Independent open-source build with zero intrusive pop-ups. Support WebAssembly development via Ko-fi or Pix (or set VITE_AADS_UNIT_ID / VITE_ADSTERRA_BANNER_URL).',
    'ad.copyPixBtn': '❖ Copy Pix Key',
    'ad.pixCopiedBtn': '✓ Pix Copied!',
    'ad.kofiSupportBtn': '❤ Ko-fi / Support Options',
    'ad.statusSupport': 'Direct Support slot (Ko-fi / Pix) • Ready for A-Ads, Adsterra/Monetag (Display Banner), and Google AdSense.',
    'ad.aadsTitle': 'A-Ads Advertisement',
    'ad.aadsStatus': 'A-Ads banner active (Unit #{unitId} • Cookie-free / COEP-compatible).',
    'ad.customTitle': 'Native Display Advertisement',
    'ad.customStatus': 'Display banner active (Adsterra / Monetag • Sandboxed, no pop-unders).',
    'ad.adsenseStatus': 'Google AdSense active.',

    'doc.sectionAria': 'Technical documentation, system requirements, FAQ, and legal notice',
    'doc.aboutTitle': 'About Panda3DS Web (ARM11 Emulation in WebAssembly)',
    'doc.aboutP1Html': '<strong>Panda3DS Web</strong> is an open-source educational port bringing the Panda3DS emulator directly to the browser using <strong>WebAssembly (WASM)</strong>, hardware-accelerated <strong>WebGL2 (OpenGL ES 3.0)</strong> rendering with compiled GLSL vertex shaders, <strong>Web Audio DSP</strong> synthesis, and local <code>IndexedDB (IDBFS)</code> save persistence.',
    'doc.aboutP2Html': 'The interface recreates the dual-screen layout (native <code>400×240</code> top screen and <code>320×240</code> bottom touchscreen) and ships with only the open-source homebrew title <strong>Block Blast</strong> (<code>.3dsx</code> under the permissive Zlib license) preloaded as an instant demo.',
    'doc.reqTitle': 'System Requirements & Quick Start Guide',
    'doc.req1Html': '<strong>Supported Browsers:</strong> Google Chrome 110+, Microsoft Edge 110+, Mozilla Firefox 115+, or Safari 16.4+ with WebGL2 acceleration and multithreaded WebAssembly.',
    'doc.req2Html': '<strong>Cross-Origin Isolation (COOP/COEP):</strong> The <code>SAB OK</code> badge on the top screen confirms <code>SharedArrayBuffer</code> is enabled for maximum ARM11 interpreter speed.',
    'doc.req3Html': '<strong>Supported Local Formats:</strong> Homebrew executables (<code>.3dsx</code>) and personal decrypted backups (<code>.3ds</code>, <code>.cci</code>, <code>.cxi</code>) loaded straight from your device.',
    'doc.req4Html': '<strong>Save Management:</strong> Virtual <code>/user</code> storage automatically syncs progress to <code>IndexedDB</code> whenever returning to the HOME Menu, with full <code>.zip</code> import/export support.',

    'faq.heading': 'Frequently Asked Questions (FAQ)',
    'faq.q1Summary': 'Are ROMs or save files selected on my device uploaded to any server?',
    'faq.q1AnswerHtml': '<strong>No.</strong> All <code>.3dsx</code>, <code>.3ds</code>, <code>.cci</code>, <code>.cxi</code>, and save files are read 100% locally in your browser RAM via the <em>Web File API</em> and Emscripten virtual filesystem (<code>MEMFS</code> / <code>IDBFS</code>). Zero game binaries leave your device.',
    'faq.q2Summary': 'Why won’t encrypted files boot in the emulator?',
    'faq.q2AnswerHtml': 'Out of respect for copyright and intellectual property laws (DMCA / Law No. 9.610/1998), Panda3DS Web <strong>does not include proprietary cryptographic keys (AES keys), BIOS dumps, or system firmware</strong>. The core only runs open-source homebrew (<code>.3dsx</code>) or personal backups decrypted by the lawful owner of the physical cartridge.',
    'faq.q3Summary': 'How can I improve performance and frame rate (FPS) in the browser?',
    'faq.q3AnswerHtml': 'Click <strong>Gamepad / Keyboard</strong> in the utility bar and set <strong>ARM11 Clock Scale</strong> to <code>75% (Balanced)</code> or <code>50% (Fast — 2D Games)</code>. This lowers emulated CPU cycles per video frame, improving WebGL2 frame pacing on laptops and mobile devices.',
    'faq.q4Summary': 'How do I connect USB/Bluetooth controllers or use the mouse as an analog stick?',
    'faq.q4AnswerHtml': 'Simply connect any compatible controller (Xbox, PlayStation DualShock/DualSense, Nintendo Switch Pro Controller, or 8BitDo) and press any button to activate the <em>Web Gamepad API</em>. On keyboard and mouse, toggle <strong>Mouse Analog</strong> to steer the Circle Pad with cursor motion while clicking the bottom touchscreen.',

    'legal.title': 'Legal Notice & Intellectual Property Disclaimer',
    'legal.p1Html': '<strong>1. Non-Affiliation & Trademarks:</strong> This project and website are an independent computer-architecture and WebAssembly compilation study, <strong>not affiliated with, sponsored, licensed, or endorsed by Nintendo Co., Ltd.</strong> or its subsidiaries. Terms such as "Nintendo" and "3DS" are registered trademarks of their respective owners and appear strictly for descriptive technical interoperability.',
    'legal.p2Html': '<strong>2. Strict Anti-Piracy Policy (Zero Commercial ROMs):</strong> This software <strong>does not include, host, distribute, or link to</strong> any commercial ROMs, ISOs, copyrighted cartridge images, BIOS, NAND dumps, firmware, or encryption keys. The sole binary bundled with this page is the open-source homebrew demo <code>blockblast.3dsx</code>. Users are solely responsible for supplying only freely distributable homebrew or legal personal backups of media they own.',

    'footer.aria': 'Site footer and legal links',
    'footer.navAria': 'Legal and documentation links',
    'footer.aboutLink': 'About & Full Guide',
    'footer.privacyLink': 'Privacy Policy & Cookies',
    'footer.termsLink': 'Terms of Use',
    'footer.contactLink': 'Contact & DMCA',
    'footer.supportBtn': '❤ Support Project (Ko-fi / Pix)',
    'footer.copy': 'Panda3DS Web — Client-side educational WebAssembly emulation (GPLv3 / Zlib Demo). Not affiliated with Nintendo Co., Ltd.',

    'sobre.h1': 'Panda3DS Web — Guide, Privacy Policy & Legal Terms',
    'sobre.backBtn': '◀ Back to Emulator',
    'sobre.navAria': 'Page sections',
    'sobre.navArch': 'Technical Architecture',
    'sobre.navControls': 'Controls Guide',
    'sobre.navPrivacy': 'Privacy Policy & Cookies',
    'sobre.navTerms': 'Terms of Use & Copyright',
    'sobre.navContact': 'Contact & DMCA',
    'sobre.archTitle': 'Technical Architecture: ARM11 Emulation in WebAssembly',
    'sobre.archIntroHtml': '<strong>Panda3DS Web</strong> is an open-source educational port combining the <em>Panda3DS</em> emulator (by <code>wheremyfoodat</code>) with an <strong>ARM11v6K / Thumb / VFPv2 / CP15</strong> interpreter compiled to WebAssembly via Emscripten.',
    'sobre.arch1Html': '<strong>Dual-Screen WebGL2 Rendering:</strong> PICA200 GPU commands are translated to OpenGL ES 3.0 / WebGL2 with compiled GLSL vertex shaders and presented live across both screens (<code>400×240</code> top screen and <code>320×240</code> bottom touchscreen).',
    'sobre.arch2Html': '<strong>Persistent IDBFS Storage (<code>/user</code>):</strong> Save files written during gameplay are synced to the browser’s local <code>IndexedDB</code>, allowing <code>.zip</code> and <code>.sav</code> backup export/import without any external backend.',
    'sobre.arch3Html': '<strong>Licensed Homebrew Demo:</strong> By default, the app ships exclusively with the open-source homebrew title <em>Block Blast</em> (<code>blockblast.3dsx</code>, Zlib license) to demonstrate client-side <code>.3dsx</code> execution.',
    'sobre.adHeading': 'SPONSORED / PROJECT SUPPORT (COEP-FREE ROUTE)',
    'sobre.controlsTitle': 'Controls: Keyboard, Gamepad & Mouse Analog',
    'sobre.controlsIntroHtml': 'The emulator supports USB and Bluetooth gamepads via the <em>Web Gamepad API</em> (Xbox, PlayStation DualShock/DualSense, Nintendo Switch Pro Controller, 8BitDo), full keyboard bindings, bottom touchscreen pointer/touch input, and cursor-motion Circle Pad steering.',
    'sobre.tableCaption': 'Complete Control Mapping Reference',
    'sobre.thCommand': 'Console Input',
    'sobre.thKeyboard': 'Keyboard',
    'sobre.thGamepadMouse': 'Gamepad / Mouse',
    'sobre.rowAnalog': 'Circle Pad (Analog)',
    'sobre.rowAnalogGp': 'Left Analog Stick or Mouse Motion',
    'sobre.rowDpad': 'D-Pad (Digital Cross)',
    'sobre.rowDpadKeysHtml': '<code>Arrow Keys ↑ ↓ ← →</code>',
    'sobre.rowDpadGp': 'Controller D-Pad',
    'sobre.rowAbxy': 'A / B / X / Y Buttons',
    'sobre.rowAbxyKeysHtml': '<code>L / K / O / I</code> or <code>X / Z / V / C</code>',
    'sobre.rowAbxyGp': 'Face Buttons or Click Console UI',
    'sobre.rowShoulders': 'L / R Bumpers & ZL / ZR Triggers',
    'sobre.rowShouldersKeysHtml': '<code>Q / P</code> and <code>1 / 0</code>',
    'sobre.rowStartGp': 'Start / Select / Guide Button',
    'sobre.rowFullscreen': 'Fullscreen (Screens Only)',
    'sobre.rowFullscreenKeysHtml': '<code>F</code> (<code>Esc</code> to exit)',
    'sobre.rowFullscreenDesc': 'Hides the console shell and displays only both screens',

    'sobre.privacyTitle': 'Privacy Policy & Cookie Usage (GDPR / LGPD / Google AdSense Clause 10)',
    'sobre.privacy1Heading': '1. 100% Client-Side Processing',
    'sobre.privacy1Html': 'Panda3DS Web runs entirely inside your web browser. All application binaries (<code>.3dsx</code>, <code>.3ds</code>, <code>.cci</code>, <code>.cxi</code>) and save files (<code>.sav</code>, <code>.dat</code>, <code>.zip</code>) opened by the user stay strictly in local memory (<code>ArrayBuffer</code> / <code>MEMFS</code>) and local <code>IndexedDB</code> storage. No user-selected files are uploaded, logged, or stored on remote servers.',
    'sobre.privacy2Heading': '2. Local Storage (LocalStorage & IndexedDB)',
    'sobre.privacy2Html': 'We use <code>localStorage</code> solely to remember your local technical preferences (ARM11 clock scale, language choice, and audio toggle) and <code>IndexedDB</code> to persist save data inside <code>/user</code>. You can wipe all stored saves anytime by clicking <strong>"Clear /user"</strong> in the Save Manager or clearing site data in browser settings.',
    'sobre.privacy3Heading': '3. Third-Party Cookies & Advertising (Google AdSense & Partners)',
    'sobre.privacy3IntroHtml': 'This website may display banners served by <strong>A-Ads</strong>, <strong>Adsterra / Monetag</strong> (clean display banner format only), or <strong>Google AdSense</strong>, alongside direct support options via Ko-fi and Pix:',
    'sobre.privacy3Li1Html': '<strong>Third-Party Vendors & DoubleClick/DART Cookies (Clause 10):</strong> Third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits to this website or other websites on the Internet.',
    'sobre.privacy3Li2Html': '<strong>Personalized Advertising & Opt-Out:</strong> Google’s use of advertising cookies enables it and its partners to serve ads to users based on their visit to this site and/or other sites on the Internet. Users may opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.',
    'sobre.privacy3Li3Html': '<strong>General Third-Party Cookie Opt-Out:</strong> Alternatively, you can opt out of third-party vendor cookies for personalized advertising via the Digital Advertising Alliance at <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">www.aboutads.info/choices</a> or, for EU residents, <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer">www.youronlinechoices.eu</a>.',
    'sobre.privacy4Heading': '4. Data Subject Rights (GDPR & LGPD)',
    'sobre.privacy4Body': 'In accordance with the European Union General Data Protection Regulation (GDPR) and Brazil’s General Data Protection Law (LGPD — Law No. 13.709/2018), we do not collect personally identifiable data (such as names, government IDs, or user accounts) to run the emulator. If you contact us by e-mail, your message details are used exclusively to respond to your request.',

    'sobre.termsTitle': 'Terms of Use & Intellectual Property Notice',
    'sobre.terms1Heading': '1. Disclaimer of Warranties & Educational Purpose',
    'sobre.terms1Html': 'Panda3DS Web is provided free of charge "as-is", strictly for educational research, WebAssembly compilation study, and open-source homebrew software preservation.',
    'sobre.terms2Heading': '2. Non-Affiliation & Nominative Trademark Use',
    'sobre.terms2Html': 'This project has no commercial relationship, partnership, sponsorship, or endorsement from <strong>Nintendo Co., Ltd.</strong> Technical terms such as "Nintendo 3DS", "3DS", "NCCH", "NCSD", and "SMDH" are referenced solely for technical documentation and compatibility description (<em>nominative fair use</em>).',
    'sobre.terms3Heading': '3. Strict Policy on ROMs, BIOS & Copyrights',
    'sobre.terms3Html': 'This website <strong>does not host, provide, sell, or link externally to</strong> commercial ROMs, copyrighted games, decryption keys (<code>aes_keys.txt</code>), BIOS dumps, or proprietary firmware. Users agree to load only freely licensed homebrew software (such as authorized <code>.3dsx</code> apps) or personal backups legally created from cartridges they own.',

    'sobre.contactTitle': 'Maintainer Info, Contact & DMCA Notices',
    'sobre.contact1Html': 'The upstream Panda3DS emulator core is developed by the open-source community under the GPLv3 license, and the bundled demo game <em>Block Blast</em> (<code>blockblast.3dsx</code>) is an open-source homebrew project under the Zlib license.',
    'sobre.contact2Body': 'For technical questions, feedback, privacy inquiries (GDPR/LGPD), or formal intellectual property / DMCA notices, contact the project maintainer:',
    'sobre.contactLiEmailHtml': '<strong>Contact & Legal Compliance E-mail:</strong> <a href="mailto:contato@panda3dsweb.dev">contato@panda3dsweb.dev</a>',
    'sobre.contactPixLabel': 'Pix Key (Brazil) for Project Support:',
    'sobre.contactLiRepoHtml': '<strong>Upstream Source Code Reference:</strong> <a href="https://github.com/wheremyfoodat/Panda3DS" target="_blank" rel="noopener noreferrer">github.com/wheremyfoodat/Panda3DS</a>',
    'sobre.footerSpan': 'Panda3DS Web — Educational WebAssembly project built on Panda3DS and the Azahar DynCom ARM11 Interpreter.',
    'sobre.footerBack': 'Back to Emulator',
  },
};

let currentLang = 'en';
const listeners = new Set();

function escapeHtml(value) {
  return String(value).replace(HTML_ENTITIES_RE, (ch) => {
    switch (ch) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function formatTemplate(template, vars, { htmlEscape = false } = {}) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;
    const raw = vars[name] ?? '';
    return htmlEscape ? escapeHtml(raw) : String(raw);
  });
}

export function getLang() {
  return currentLang;
}

export function t(key, vars) {
  const table = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const raw = table[key] ?? TRANSLATIONS.pt[key] ?? key;
  return formatTemplate(raw, vars, { htmlEscape: false });
}

export function tHtml(key, vars) {
  const table = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const raw = table[key] ?? TRANSLATIONS.pt[key] ?? key;
  return formatTemplate(raw, vars, { htmlEscape: true });
}

export function applyDomTranslations(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;

  if (typeof document !== 'undefined' && root === document) {
    document.documentElement.lang = currentLang === 'pt' ? 'pt-BR' : 'en';
    const titleKey = document.documentElement.dataset.i18nTitle;
    if (titleKey) {
      document.title = t(titleKey);
    }
  }

  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  }

  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = tHtml(key);
  }

  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  }

  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  }

  for (const btn of root.querySelectorAll('[data-lang-btn]')) {
    const btnLang = normalizeLang(btn.getAttribute('data-lang-btn'));
    const active = btnLang === currentLang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

export function setLang(nextLang, { persist = true, root = typeof document !== 'undefined' ? document : null } = {}) {
  const normalized = normalizeLang(nextLang);
  if (!normalized || !SUPPORTED_LANGS.includes(normalized)) return currentLang;

  currentLang = normalized;

  if (persist && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch {
      // Ignore storage unavailability
    }
  }

  applyDomTranslations(root);

  for (const listener of listeners) {
    try {
      listener(currentLang);
    } catch {
      // Keep UI responsive even if a listener fails
    }
  }

  return currentLang;
}

export function onLangChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initI18n(root = typeof document !== 'undefined' ? document : null) {
  const initial = detectInitialLang();
  setLang(initial, { persist: false, root });

  if (root) {
    for (const btn of root.querySelectorAll('[data-lang-btn]')) {
      if (btn.dataset.i18nBound === 'true') continue;
      btn.dataset.i18nBound = 'true';
      btn.addEventListener('click', () => {
        setLang(btn.getAttribute('data-lang-btn'), { persist: true, root });
      });
    }
  }

  return currentLang;
}
