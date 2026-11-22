import { t } from './i18n.js';

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
  const adsterraKey = String(override.adsterraKey || env.VITE_ADSTERRA_KEY || '').trim();
  const adsterraHost = String(
    override.adsterraHost || env.VITE_ADSTERRA_HOST || 'www.highperformanceformat.com',
  ).trim();
  const adsterraBannerUrl = String(override.adsterraBannerUrl || env.VITE_ADSTERRA_BANNER_URL || '').trim();
  const client = String(override.client || env.VITE_ADSENSE_CLIENT || PLACEHOLDER_CLIENT).trim();
  const slot = String(override.slot || env.VITE_ADSENSE_SLOT || PLACEHOLDER_SLOT).trim();

  const pixKey = String(override.pixKey || env.VITE_PIX_KEY || DEFAULT_PIX_KEY).trim();
  const kofiUrl = String(override.kofiUrl || env.VITE_KOFI_URL || DEFAULT_KOFI_URL).trim();
  const githubUrl = String(override.githubUrl || env.VITE_GITHUB_SPONSORS_URL || DEFAULT_GITHUB_URL).trim();

  const hasAads = /^\d{4,12}$/.test(aadsUnitId);
  const hasAdsterraKey = /^[a-f0-9]{24,40}$/i.test(adsterraKey);
  const hasAdsterraUrl = /^https?:\/\//i.test(adsterraBannerUrl);
  const hasAdsterra = hasAdsterraKey || hasAdsterraUrl;
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
    adsterraKey,
    adsterraHost,
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
  title.textContent = t('ad.bannerTitle');

  const desc = document.createElement('p');
  desc.className = 'support-banner-desc';
  desc.textContent = t('ad.bannerDesc');

  copyWrap.append(title, desc);

  const actions = document.createElement('div');
  actions.className = 'support-banner-actions';

  const pixBtn = document.createElement('button');
  pixBtn.type = 'button';
  pixBtn.className = 'support-cta-btn support-cta-pix';
  pixBtn.textContent = t('ad.copyPixBtn');
  pixBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cfg.pixKey);
      pixBtn.textContent = t('ad.pixCopiedBtn');
      if (statusElement) {
        statusElement.textContent = t('status.pixCopied', { key: cfg.pixKey });
      }
      setTimeout(() => {
        pixBtn.textContent = t('ad.copyPixBtn');
      }, 2800);
    } catch {
      if (typeof onOpenSupport === 'function') {
        onOpenSupport();
      } else if (statusElement) {
        statusElement.textContent = t('status.pixSupportFallback', { key: cfg.pixKey });
      }
    }
  });

  const modalBtn = document.createElement('button');
  modalBtn.type = 'button';
  modalBtn.className = 'support-cta-btn support-cta-secondary';
  modalBtn.textContent = t('ad.kofiSupportBtn');
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
    statusElement.textContent = t('ad.statusSupport');
  }
}

function renderAAdsBanner({ frameEl, insElement, statusElement, cfg }) {
  if (insElement) insElement.style.display = 'none';
  if (!frameEl) return null;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-aa', cfg.aadsUnitId);
  iframe.src = `https://ad.a-ads.com/${encodeURIComponent(cfg.aadsUnitId)}?size=Adaptive`;
  iframe.title = t('ad.aadsTitle');
  iframe.className = 'permissive-ad-iframe';
  iframe.setAttribute('credentialless', '');
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  frameEl.prepend(iframe);
  if (statusElement) {
    statusElement.textContent = t('ad.aadsStatus', { unitId: cfg.aadsUnitId });
  }
  return iframe;
}

function renderCustomPermissiveBanner({ frameEl, insElement, statusElement, cfg }) {
  if (insElement) insElement.style.display = 'none';
  if (!frameEl) return null;

  const iframe = document.createElement('iframe');
  iframe.title = t('ad.customTitle');
  iframe.className = 'permissive-ad-iframe';
  iframe.setAttribute('credentialless', '');
  iframe.loading = 'lazy';
  iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  if (cfg.adsterraKey) {
    const safeKey = cfg.adsterraKey.replace(/[^a-f0-9]/gi, '');
    const safeHost = cfg.adsterraHost.replace(/[^a-z0-9.-]/gi, '');
    iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:transparent;overflow:hidden;}</style></head><body><script>atOptions={'key':'${safeKey}','format':'iframe','height':90,'width':728,'params':{}};</script><script src="https://${safeHost}/${safeKey}/invoke.js"></script></body></html>`;
  } else {
    iframe.src = cfg.adsterraBannerUrl;
  }

  frameEl.prepend(iframe);
  if (statusElement) {
    statusElement.textContent = t('ad.customStatus');
  }
  return iframe;
}

/**
 * Configures and initializes the monetization slot (A-Ads, Adsterra/Monetag Native Banner,
 * Direct Pix/Ko-fi Support, or Google AdSense) while staying compatible with Cross-Origin Isolation.
 */
export function initAdSense({ insElement, statusElement, containerElement, onOpenSupport }) {
  if (!insElement && !containerElement) {
    return { configured: false, isolated: Boolean(window.crossOriginIsolated), refreshLanguage: () => {} };
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
    const iframe = renderAAdsBanner({ frameEl, insElement, statusElement, cfg });
    return {
      configured: true,
      provider: 'aads',
      isolated,
      refreshLanguage: () => {
        if (iframe) iframe.title = t('ad.aadsTitle');
        if (statusElement) statusElement.textContent = t('ad.aadsStatus', { unitId: cfg.aadsUnitId });
      },
    };
  }

  if (cfg.activeProvider === 'adsterra') {
    containerElement?.classList.remove('is-preview');
    const iframe = renderCustomPermissiveBanner({ frameEl, insElement, statusElement, cfg });
    return {
      configured: true,
      provider: 'adsterra',
      isolated,
      refreshLanguage: () => {
        if (iframe) iframe.title = t('ad.customTitle');
        if (statusElement) statusElement.textContent = t('ad.customStatus');
      },
    };
  }

  if (cfg.activeProvider === 'support') {
    containerElement?.classList.add('is-preview');
    renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
    return {
      configured: false,
      provider: 'support',
      isolated,
      refreshLanguage: () => {
        renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
      },
    };
  }

  // Google AdSense path (when VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT are explicitly configured)
  containerElement?.classList.remove('is-preview');
  if (insElement) insElement.style.display = 'block';

  const scriptId = 'google-adsense-script';
  let script = document.getElementById(scriptId);
  let fallbackActive = false;

  const pushAd = () => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      if (statusElement) {
        statusElement.textContent = t('ad.adsenseStatus');
      }
    } catch {
      fallbackActive = true;
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
      fallbackActive = true;
      renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
    });
    document.head.append(script);
  }

  pushAd();
  return {
    configured: true,
    provider: 'adsense',
    isolated,
    refreshLanguage: () => {
      if (fallbackActive) {
        renderSupportAndPermissiveBanner({ frameEl, insElement, statusElement, cfg, onOpenSupport });
      } else if (statusElement) {
        statusElement.textContent = t('ad.adsenseStatus');
      }
    },
  };
}
