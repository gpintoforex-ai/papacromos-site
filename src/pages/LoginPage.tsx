import { useState } from "react";
import { BookOpen, Repeat2, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import LegalFooter from "../components/LegalFooter";
import { supabase } from "../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { locationOptions } from "../lib/locations";

function getAuthErrorMessage(error: any) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("email rate limit exceeded")) {
    return "Limite de emails do Supabase atingido. Aguarda alguns minutos ou cria o utilizador no Dashboard do Supabase.";
  }

  if (message.includes("email signups are disabled") || message.includes("signup disabled") || message.includes("signups are disabled")) {
    return "O registo por email esta desativado no Supabase. Ativa os registos por email nas definicoes de Authentication.";
  }

  if (message.includes("user already registered") || message.includes("already registered")) {
    return "Este email ja esta registado. Usa a opcao Entrar.";
  }

  if (message.includes("invalid login credentials")) {
    return "Email ou password incorretos.";
  }

  if (message.includes("email not confirmed")) {
    return "Confirma o email antes de entrar. Verifica a caixa de entrada e o spam.";
  }

  return error?.message || "Erro ao autenticar. Tenta novamente.";
}

export default function LoginPage() {
  const { signIn, signInWithProvider, signUp } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Portugal");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const nextMissingFields = [
          ...(!firstName.trim() ? ["firstName"] : []),
          ...(!lastName.trim() ? ["lastName"] : []),
          ...(!username.trim() ? ["username"] : []),
          ...(!email.trim() ? ["email"] : []),
          ...(!phone.trim() ? ["phone"] : []),
          ...(!country.trim() ? ["country"] : []),
          ...(!region.trim() ? ["region"] : []),
          ...(!city.trim() ? ["city"] : []),
          ...(!password ? ["password"] : []),
          ...(!acceptedTerms ? ["terms"] : []),
        ];

        if (nextMissingFields.length > 0) {
          setMissingFields(nextMissingFields);
          setError("Preenche os campos assinalados para criar a conta.");
          return;
        }
      }

      if (!isSignUp && (!email.trim() || !password)) {
        setMissingFields([
          ...(!email.trim() ? ["email"] : []),
          ...(!password ? ["password"] : []),
        ]);
        setError("Preenche email e password");
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);
      setMissingFields([]);

      if (isSignUp) {
        if (!acceptedTerms) {
          setError("Aceita os Termos e Condições para continuar.");
          return;
        }

        const result = await signUp({ firstName, lastName, username, email, phone, region, city, password });
        setFirstName("");
        setLastName("");
        setUsername("");
        setEmail("");
        setPhone("");
        setCountry("Portugal");
        setRegion("");
        setCity("");
        setPassword("");
        setAcceptedTerms(false);
        setError(null);
        if (result.needsEmailConfirmation) {
          setSuccess("Conta criada. Confirma o email antes de entrar. Verifica tambem o spam.");
        } else {
          setIsSignUp(false);
          setSuccess("Conta criada com sucesso. Ja podes entrar com o teu email e password.");
        }
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAuth();
  };

  const handleOAuth = async (provider: Provider) => {
    if (isSignUp && !acceptedTerms) {
      setMissingFields(["terms"]);
      setError("Aceita os Termos e Condicoes para continuar.");
      setSuccess(null);
      return;
    }

    setOauthLoading(provider);
    setLoading(true);
    setError(null);
    setSuccess(null);
    setMissingFields([]);
    try {
      await signInWithProvider(provider);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
      setOauthLoading(null);
    }
  };

  const clearMissingField = (field: string) => {
    setMissingFields((current) => current.filter((item) => item !== field));
  };

  const isMissing = (field: string) => missingFields.includes(field);

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Preenche o email para recuperar a password.");
      setSuccess(null);
      return;
    }

    setResetLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;

      setSuccess(`Enviamos um email de recuperacao para ${cleanEmail}.`);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const scrollToLoginForm = () => {
    document.querySelector(".login-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-visual" aria-label="Papa Cromos">
          <button className="login-scroll-hint" type="button" onClick={scrollToLoginForm} aria-label="Ir para entrar ou registar">
            <UserRound size={20} />
          </button>
          <img className="login-visual-image" src="/login-hero-phone-screen.png" alt="" aria-hidden="true" />
          <div className="login-visual-overlay">
            <img className="login-logo" src="/logo-transparent.png" alt="Papa Cromos" />
            <div className="login-visual-tagline">
              <span>O app para</span>
              <span>todos os</span>
              <strong>colecionadores!</strong>
            </div>
            <div className="login-visual-stats">
              <span><BookOpen size={16} /> Colecoes</span>
              <span><Repeat2 size={16} /> Trocas</span>
              <span><Users size={16} /> Amigos</span>
            </div>
          </div>
        </section>
      <div className="login-card">
        <div className="login-hero">
          <div>
            <span className="login-kicker">{isSignUp ? "Nova conta" : "Acesso seguro"}</span>
            <h1>{isSignUp ? "Criar conta" : "Entrar"}</h1>
            <p>{isSignUp ? "Preenche os dados para comecar a gerir a tua caderneta." : "Continua para a tua colecao e propostas de troca."}</p>
          </div>
          <ShieldCheck size={24} />
        </div>
        <div className="login-features">
          <div className="login-feature">
            <BookOpen size={18} />
            <span>Organiza a tua colecao</span>
          </div>
          <div className="login-feature">
            <Repeat2 size={18} />
            <span>Encontra matches automaticos</span>
          </div>
          <div className="login-feature">
            <Users size={18} />
            <span>Troca cromos com outros</span>
          </div>
        </div>

        <div className="login-oauth">
          <div className="login-oauth-row">
            <button className="oauth-button google" type="button" onClick={() => handleOAuth("google")} disabled={loading || Boolean(oauthLoading)}>
              <span aria-hidden="true">G</span>
              {oauthLoading === "google" ? "A abrir Google..." : isSignUp ? "Registar com Google" : "Entrar com Google"}
            </button>
            <button className="oauth-button facebook" type="button" onClick={() => handleOAuth("facebook")} disabled={loading || Boolean(oauthLoading)}>
              <span aria-hidden="true">f</span>
              {oauthLoading === "facebook" ? "A abrir Facebook..." : isSignUp ? "Registar com Facebook" : "Entrar com Facebook"}
            </button>
          </div>
          <div className="login-divider"><span>ou</span></div>
        </div>

        <div className="login-form">
          {isSignUp && (
            <>
              <div className="login-name-grid">
                <input
                  type="text"
                  placeholder="Nome"
                  className={isMissing("firstName") ? "field-error" : ""}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    clearMissingField("firstName");
                  }}
                  onKeyDown={handleKeyPress}
                  disabled={loading}
                  autoComplete="given-name"
                />
                <input
                  type="text"
                  placeholder="Apelido"
                  className={isMissing("lastName") ? "field-error" : ""}
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    clearMissingField("lastName");
                  }}
                  onKeyDown={handleKeyPress}
                  disabled={loading}
                  autoComplete="family-name"
                />
              </div>
              <input
                type="text"
                placeholder="Utilizador"
                className={isMissing("username") ? "field-error" : ""}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearMissingField("username");
                }}
                onKeyDown={handleKeyPress}
                disabled={loading}
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            className={isMissing("email") ? "field-error" : ""}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearMissingField("email");
            }}
            onKeyDown={handleKeyPress}
            disabled={loading}
          />
          {isSignUp && (
            <>
              <input
                type="tel"
                placeholder="Telefone"
                className={isMissing("phone") ? "field-error" : ""}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearMissingField("phone");
                }}
                onKeyDown={handleKeyPress}
                disabled={loading}
              />
              <div className="location-select-grid">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setRegion("");
                    setCity("");
                    clearMissingField("country");
                  }}
                  className={isMissing("country") ? "field-error" : ""}
                  disabled={loading}
                >
                  {Object.keys(locationOptions).map((countryName) => (
                    <option key={countryName} value={countryName}>{countryName}</option>
                  ))}
                </select>
                <select
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setCity("");
                    clearMissingField("region");
                  }}
                  className={isMissing("region") ? "field-error" : ""}
                  disabled={loading}
                >
                  <option value="">Regiao</option>
                  {Object.keys(locationOptions[country as keyof typeof locationOptions] || {}).map((regionName) => (
                    <option key={regionName} value={regionName}>{regionName}</option>
                  ))}
                </select>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    clearMissingField("city");
                  }}
                  className={isMissing("city") ? "field-error" : ""}
                  disabled={loading || !region}
                >
                  <option value="">Cidade</option>
                  {((locationOptions[country as keyof typeof locationOptions] || {})[region as keyof typeof locationOptions.Portugal] || []).map((cityName) => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
              </div>
              <label className={`terms-checkbox ${isMissing("terms") ? "field-error" : ""}`}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    clearMissingField("terms");
                  }}
                  disabled={loading}
                />
                <span>
                  Aceito os <a href="/terms.html" target="_blank" rel="noreferrer">Termos e Condições</a> e a <a href="/privacy.html" target="_blank" rel="noreferrer">Política de Privacidade</a>
                </span>
              </label>
            </>
          )}
          <input
            type="password"
            placeholder="Password"
            className={isMissing("password") ? "field-error" : ""}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearMissingField("password");
            }}
            onKeyDown={handleKeyPress}
            disabled={loading}
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <button className="btn btn-primary btn-lg" onClick={handleAuth} disabled={loading}>
          {loading ? "A processar..." : isSignUp ? "Criar conta" : "Entrar"}
        </button>

        <button className={`btn ${isSignUp ? "btn-ghost" : "btn-register-cta"}`} onClick={() => {
          setIsSignUp(!isSignUp);
          setAcceptedTerms(false);
          setMissingFields([]);
          setError(null);
          setSuccess(null);
        }} disabled={loading}>
          {isSignUp ? "Ja tens conta? Entra" : "Nao tens conta? Regista-te"}
        </button>

        {!isSignUp && (
          <button className="btn btn-forgot-password" type="button" onClick={handlePasswordReset} disabled={loading || resetLoading}>
            {resetLoading ? "A enviar..." : "Esqueci-me da senha"}
          </button>
        )}

      </div>
      </div>
      <LegalFooter />
    </div>
  );
}
