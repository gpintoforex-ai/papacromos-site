import { useEffect, useState } from "react";

const cookieConsentKey = "papacromos-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(cookieConsentKey));
  }, []);

  const saveConsent = (value: "necessary" | "accepted") => {
    localStorage.setItem(cookieConsentKey, JSON.stringify({ value, savedAt: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-live="polite">
      <div className="cookie-consent-panel">
        <h2 id="cookie-consent-title">Cookies e armazenamento local</h2>
        <p>
          Usamos cookies e tecnologias semelhantes essenciais para manter a sessao, guardar preferencias e proteger a
          conta. Se aceitarmos cookies opcionais no futuro, so serao ativados depois do teu consentimento. Saiba mais na
          nossa{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">
            Politica de Privacidade
          </a>
          .
        </p>
        <div className="cookie-consent-actions">
          <button className="cookie-btn cookie-btn-secondary" type="button" onClick={() => saveConsent("necessary")}>
            Recusar opcionais
          </button>
          <button className="cookie-btn cookie-btn-primary" type="button" onClick={() => saveConsent("accepted")}>
            Aceitar opcionais
          </button>
        </div>
      </div>
    </div>
  );
}
