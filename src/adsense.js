const PLACEHOLDER_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const PLACEHOLDER_SLOT = '0000000000';
const DEFAULT_PIX_KEY = 'apoio@panda3dsweb.dev';
const DEFAULT_KOFI_URL = 'https://ko-fi.com';
const DEFAULT_GITHUB_URL = 'https://github.com/wheremyfoodat/Panda3DS';

export function getAdSenseConfig() {
  const override = (typeof window !== 'undefined' && window.PANDA3DS_ADSENSE) || {};
  const env = import.meta.env || {};

  const providerPref = String(override.provider || env.VITE_AD_PROVIDER || 'auto').trim().toLowerCase();
  const aadsUnitId = String(override.aadsUnitId || env.VITE_AADS_UNIT_ID || '').trim();
  const adsterraBannerUrl = String(override.adsterraBannerUrl || env.VITE_ADSTERRA_BANNER_URL || '').trim();
  const client = String(override.client || env.VITE_ADSENSE_CLIENT || PLACEHOLDER_CLIENT).trim();
  const slot = String(override.slot || env.VITE_ADSENSE_SLOT || PLACEHOLDER_SLOT).trim();

  const pixKey = String(override.pixKey || env.VITE_PIX_KEY || DEFAULT_PIX_KEY).trim();
  const kofiUrl = String(override.kofiUrl || env.VITE_KOFI_URL || DEFAULT_KOFI_URL).trim();
  const githubUrl = String(override.githubUrl || env.VITE_GITHUB_SPONSORS_URL || DEFAULT_GITHUB_URL).trim();

  const hasAads = /^\d{4,12}$/.test(aadsUnitId);
  const hasAdsterra = /^https?:\/\//i.test(adsterraBannerUrl);
  const hasAdSense = /^ca-pub-\d{10,20}$/.test(client) && /^\d{6,20}$/.test(slot) && slot !== PLACEHOLDER_SLOT;

  let activeProvider = 'support';
  if (providerPref === 'aads' && hasAads) activeProvider = 'aads';
  else if (providerPref === 'adsterra' && hasAdsterra) activeProvider = 'adsterra';
  else if (providerPref === 'adsense' && hasAdSense) activeProvider = 'adsense';
  else if (providerPref === 'auto') {
    if (hasAads) activeProvider = 'aads';
    else if (hasAdsterra) activeProvider = 'adsterra';
    else if (hasAdSense) activeProvider = 'adsense';
  }

  return {
    activeProvider,
    aadsUnitId,
    adsterraBannerUrl,
    client,
    slot,
    pixKey,
    kofiUrl,
    githubUrl,
    isConfigured: activeProvider !== 'support',
  };
}

function renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport }) {
  if (insElement) {
    insElement.style.display = 'none';
  }
  if (!frameEl) return;

  const existingWidget = frameEl.querySelector('.native-support-banner');
  if (existingWidget) existingWidget.remove();

  const banner = document.createElement('div');
  banner.className = 'native-support-banner';

  const copyWrap = document.createElement('div');
  copyWrap.className = 'support-banner-copy';

  const title = document.createElement('strong');
  title.className = 'support-banner-title';
  title.textContent = 'Apoie o Panda3DS Web • Emulação ARM11 100% no Navegador';

  const desc = document.createElement('p');
  desc.className = 'support-banner-desc';
  desc.textContent =
    'Projeto independente sem pop-ups invasivos. Apoie via Pix ou Ko-fi para manter o desenvolvimento WebAssembly (ou configure VITE_AADS_UNIT_ID / VITE_ADSTERRA_BANNER_URL).';

  copyWrap.append(title, desc);

  const actions = document.createElement('div');
  actions.className = 'support-banner-actions';

  const pixBtn = document.createElement('button');
  pixBtn.type = 'button';
  pixBtn.className = 'support-cta-btn support-cta-pix';
  pixBtn.textContent = '❖ Copiar Chave Pix';
  pixBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cfg.pixKey);
      pixBtn.textContent = '✓ Pix Copiado!';
      if (statusElement) {
        statusElement.textContent = `Chave Pix (${cfg.pixKey}) copiada para a área de transferência.`;
      }
      setTimeout(() => {
        pixBtn.textContent = '❖ Copiar Chave Pix';
      }, 2800);
    } catch {
      if (typeof onOpenSupport === 'function') {
        onOpenSupport();
      } else if (statusElement) {
        statusElement.textContent = `Chave Pix para apoio: ${cfg.pixKey}`;
      }
    }
  });

  const modalBtn = document.createElement('button');
  modalBtn.type = 'button';
  modalBtn.className = 'support-cta-btn support-cta-secondary';
  modalBtn.textContent = '❤ Ko-fi / Opções de Apoio';
  modalBtn.addEventListener('click', () => {
    if (typeof onOpenSupport === 'function') {
      onOpenSupport();
    } else {
      window.open(cfg.kofiUrl, '_blank', 'noopener,noreferrer');
    }
  });

  actions.append(pixBtn, modalBtn);
  banner.append(copyWrap, actions);
  frameEl.prepend(banner);

  if (statusElement) {
    statusElement.textContent =
      'Slot monetizado em modo Apoio Direto (Pix/Ko-fi) • Compatível com A-Ads, Adsterra/Monetag (Display Nativo) e Google AdSense.';
  }
}

function renderAAdsBanner({ frameEl, insElement, statusElement, cfg }) {
  if (insElement) insElement.style.display = 'none';
  if (!frameEl) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-aa', cfg.aadsUnitId);
  iframe.src = `https://ad.a-ads.com/${encodeURIComponent(cfg.aadsUnitId)}?size=Adaptive`;
  iframe.title = 'Publicidade A-Ads';
  iframe.className = 'permissive-ad-iframe';
  iframe.setAttribute('credentialless', '');
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  frameEl.prepend(iframe);
  if (statusElement) {
    statusElement.textContent = `Publicidade A-Ads ativa (Unidade #${cfg.aadsUnitId} • Sem cookies invasivos / Compatível com COEP).`;
  }
}

function renderCustomPermissiveBanner({ frameEl, insElement, statusElement, cfg }) {
  if (insElement) insElement.style.display = 'none';
  if (!frameEl) return;

  const iframe = document.createElement('iframe');
  iframe.src = cfg.adsterraBannerUrl;
  iframe.title = 'Publicidade Display Nativo';
  iframe.className = 'permissive-ad-iframe';
  iframe.setAttribute('credentialless', '');
  iframe.loading = 'lazy';
  iframe.sandbox = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  frameEl.prepend(iframe);
  if (statusElement) {
    statusElement.textContent = 'Banner Display Nativo ativo (Adsterra / Monetag • Pop-unders desativados).';
  }
}

/**
 * Configures and initializes the monetization slot (A-Ads, Adsterra/Monetag Native Banner,
 * Direct Pix/Ko-fi Support, or Google AdSense) while staying compatible with Cross-Origin Isolation.
 */
export function initAdSense({ insElement, statusElement, containerElement, onOpenSupport }) {
  if (!insElement && !containerElement) {
    return { configured: false, isolated: Boolean(window.crossOriginIsolated) };
  }

  const cfg = getAdSenseConfig();
  const isolated = Boolean(window.crossOriginIsolated);
  const frameEl = insElement?.parentElement || containerElement;

  if (insElement) {
    insElement.setAttribute('data-ad-client', cfg.client);
    insElement.setAttribute('data-ad-slot', cfg.slot);
  }

  if (cfg.activeProvider === 'aads') {
    containerElement?.classList.remove('is-preview');
    renderAAdsBanner({ frameEl, insElement, statusElement, cfg });
    return { configured: true, provider: 'aads', isolated };
  }

  if (cfg.activeProvider === 'adsterra') {
    containerElement?.classList.remove('is-preview');
    renderCustomPermissiveBanner({ frameEl, insElement, statusElement, cfg });
    return { configured: true, provider: 'adsterra', isolated };
  }

  if (cfg.activeProvider === 'support') {
    containerElement?.classList.add('is-preview');
    renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
    return { configured: false, provider: 'support', isolated };
  }

  // Google AdSense path (when VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT are explicitly configured)
  containerElement?.classList.remove('is-preview');
  if (insElement) insElement.style.display = 'block';

  const scriptId = 'google-adsense-script';
  let script = document.getElementById(scriptId);

  const pushAd = () => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      if (statusElement) {
        statusElement.textContent = 'Publicidade Google AdSense ativa.';
      }
    } catch {
      renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
    }
  };

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`;
    script.addEventListener('error', () => {
      renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
    });
    document.head.append(script);
  }

  pushAd();
  return { configured: true, provider: 'adsense', isolated };
}
