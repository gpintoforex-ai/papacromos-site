import { useEffect, useState } from "react";

const cookieConsentKey = "papacromos-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(cookieConsentKey));
  }, []);

  const saveConsent = (value: "necessary" | "accepted") => {
    localStorage.setItem(cookieConsentKey, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-live="polite">
      <div className="cookie-consent-panel">
        <h2 id="cookie-consent-title">Consentimento de Cookies</h2>
        <p>
          Usamos cookies e tecnologias semelhantes para manter a sessão, lembrar preferências e melhorar a experiência.
          Saiba mais na nossa{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>
          .
        </p>
        <div className="cookie-consent-actions">
          <button className="cookie-btn cookie-btn-secondary" type="button" onClick={() => saveConsent("necessary")}>
            Somente necessários
          </button>
          <button className="cookie-btn cookie-btn-primary" type="button" onClick={() => saveConsent("accepted")}>
            Aceitar cookies
          </button>
        </div>
      </div>
    </div>
  );
}
