import { useState } from "react";
import { useAuth } from "../lib/auth";

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

  if (message.includes("user already registered") || message.includes("already registered")) {
    return "Este email ja esta registado. Usa a opcao Entrar.";
  }

  if (message.includes("invalid login credentials")) {
    return "Email ou password incorretos.";
  }

  return error?.message || "Erro ao autenticar. Tenta novamente.";
}

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Portugal");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleAuth = async () => {
    try {
      if (!email || !password) {
        setError("Preenche email e password");
        return;
      }

      setLoading(true);
      setError(null);

      if (isSignUp) {
        if (!username || !phone || !country || !region || !city) {
          setError("Preenche utilizador, email, telefone, pais, regiao, cidade e password");
          return;
        }

        if (!acceptedTerms) {
          setError("Aceita os Termos e Condições para continuar.");
          return;
        }

        await signUp({ username, email, phone, city, password });
        setUsername("");
        setEmail("");
        setPhone("");
        setCountry("Portugal");
        setRegion("");
        setCity("");
        setPassword("");
        setAcceptedTerms(false);
        setIsSignUp(false);
        setError(null);
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
            <input
              type="text"
              placeholder="Utilizador"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
          />
          {isSignUp && (
            <>
              <input
                type="tel"
                placeholder="Telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                  }}
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
                  }}
                  disabled={loading}
                >
                  <option value="">Regiao</option>
                  {Object.keys(locationOptions[country as keyof typeof locationOptions] || {}).map((regionName) => (
                    <option key={regionName} value={regionName}>{regionName}</option>
                  ))}
                </select>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={loading || !region}
                >
                  <option value="">Cidade</option>
                  {((locationOptions[country as keyof typeof locationOptions] || {})[region as keyof typeof locationOptions.Portugal] || []).map((cityName) => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
              </div>
              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary btn-lg" onClick={handleAuth} disabled={loading}>
          {loading ? "A processar..." : isSignUp ? "Criar conta" : "Entrar"}
        </button>

        <button className="btn btn-ghost" onClick={() => {
          setIsSignUp(!isSignUp);
          setAcceptedTerms(false);
        }} disabled={loading}>
          {isSignUp ? "Ja tens conta? Entra" : "Nao tens conta? Regista-te"}
        </button>

        <a className="login-terms-link" href="/terms.html" target="_blank" rel="noreferrer">
          Termos e Condições
        </a>
      </div>
    </div>
  );
}
