import { useState } from "react";
import { useAuth } from "../lib/auth";
import LegalFooter from "../components/LegalFooter";
import { supabase } from "../lib/supabase";

const locationOptions = {
  Portugal: {
    Aveiro: ["Aveiro", "Agueda", "Espinho", "Santa Maria da Feira"],
    Beja: ["Beja", "Moura", "Serpa"],
    Braga: ["Braga", "Barcelos", "Guimaraes", "Vila Nova de Famalicao"],
    Braganca: ["Braganca", "Mirandela", "Macedo de Cavaleiros"],
    "Castelo Branco": ["Castelo Branco", "Covilha", "Fundao"],
    Coimbra: ["Coimbra", "Figueira da Foz", "Cantanhede", "Pombal"],
    Evora: ["Evora", "Estremoz", "Montemor-o-Novo"],
    Faro: ["Faro", "Albufeira", "Loule", "Portimao"],
    Guarda: ["Guarda", "Seia", "Gouveia"],
    Leiria: ["Leiria", "Pombal", "Marinha Grande", "Caldas da Rainha", "Peniche"],
    Lisboa: ["Lisboa", "Amadora", "Cascais", "Loures", "Odivelas", "Sintra"],
    Portalegre: ["Portalegre", "Elvas", "Ponte de Sor"],
    Porto: ["Porto", "Gondomar", "Maia", "Matosinhos", "Vila Nova de Gaia"],
    Santarem: ["Santarem", "Tomar", "Torres Novas", "Entroncamento"],
    Setubal: ["Setubal", "Almada", "Barreiro", "Sesimbra"],
    "Viana do Castelo": ["Viana do Castelo", "Ponte de Lima", "Valenca"],
    "Vila Real": ["Vila Real", "Chaves", "Peso da Regua"],
    Viseu: ["Viseu", "Lamego", "Tondela"],
    Acores: ["Ponta Delgada", "Angra do Heroismo", "Horta"],
    Madeira: ["Funchal", "Camara de Lobos", "Machico"],
  },
};

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
  const { signIn, signUp } = useAuth();
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

        const result = await signUp({ firstName, lastName, username, email, phone, city, password });
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-hero">
          <img className="login-logo" src="/logo.png" alt="Papa Cromos" />
        </div>
        <div className="login-features">
          <div className="login-feature">
            <span className="feature-icon">&#x1F4D6;</span>
            <span>Organiza a tua colecao</span>
          </div>
          <div className="login-feature">
            <span className="feature-icon">&#x1F504;</span>
            <span>Encontra matches automaticos</span>
          </div>
          <div className="login-feature">
            <span className="feature-icon">&#x1F91D;</span>
            <span>Troca cromos com outros</span>
          </div>
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
      <LegalFooter />
    </div>
  );
}
