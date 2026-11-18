const PLACEHOLDER_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const PLACEHOLDER_SLOT = '0000000000';

export function getAdSenseConfig() {
  const override = (typeof window !== 'undefined' && window.PANDA3DS_ADSENSE) || {};
  const client = String(override.client || import.meta.env?.VITE_ADSENSE_CLIENT || PLACEHOLDER_CLIENT).trim();
  const slot = String(override.slot || import.meta.env?.VITE_ADSENSE_SLOT || PLACEHOLDER_SLOT).trim();
  const isConfigured = /^ca-pub-\d{10,20}$/.test(client) && /^\d{6,20}$/.test(slot) && slot !== PLACEHOLDER_SLOT;
  return { client, slot, isConfigured };
}

/**
 * Configures and initializes Google AdSense on a container while staying
 * compatible with Cross-Origin Isolation (`COEP: require-corp` on the emulator route).
 */
export function initAdSense({ insElement, statusElement, containerElement }) {
  if (!insElement) return { configured: false, isolated: Boolean(window.crossOriginIsolated) };

  const cfg = getAdSenseConfig();
  const isolated = Boolean(window.crossOriginIsolated);

  insElement.setAttribute('data-ad-client', cfg.client);
  insElement.setAttribute('data-ad-slot', cfg.slot);

  if (!cfg.isConfigured) {
    containerElement?.classList.add('is-preview');
    if (statusElement) {
      statusElement.textContent = isolated
        ? 'Google AdSense pronto (configure VITE_ADSENSE_CLIENT e VITE_ADSENSE_SLOT). Rota /sobre.html serve anúncios sem bloqueio COEP.'
        : 'Google AdSense pronto (configure VITE_ADSENSE_CLIENT e VITE_ADSENSE_SLOT para exibir anúncios reais).';
    }
    return { configured: false, isolated };
  }

  containerElement?.classList.remove('is-preview');

  const scriptId = 'google-adsense-script';
  let script = document.getElementById(scriptId);

  const pushAd = () => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      if (statusElement) {
        statusElement.textContent = 'Publicidade Google AdSense ativa.';
      }
    } catch {
      if (statusElement) {
        statusElement.textContent = isolated
          ? 'AdSense bloqueado por COEP nesta aba — confira /sobre.html.'
          : 'Não foi possível inicializar o bloco AdSense.';
      }
    }
  };

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`;
    script.addEventListener('error', () => {
      if (statusElement) {
        statusElement.textContent = isolated
          ? 'Scripts de terceiros restringidos por COEP: require-corp; página /sobre.html exibe AdSense sem restrição.'
          : 'Script Google AdSense indisponível nesta rede/bloqueador.';
      }
    });
    document.head.append(script);
  }

  pushAd();
  return { configured: true, isolated };
}
