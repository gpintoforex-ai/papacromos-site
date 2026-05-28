import { useEffect, useRef, useState, type ReactNode } from "react";
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

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const isSecurePassword = (password: string) => passwordPattern.test(password);

interface LoginSlide {
  id: string;
  mediaType: "image" | "video" | "instagram";
  src: string;
  title: string[];
  highlight: string;
  stats: Array<{ icon: ReactNode; label: string }>;
}

function getInstagramEmbedUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("instagram.com")) return url;

    const cleanPath = parsedUrl.pathname.replace(/\/$/, "");
    if (cleanPath.endsWith("/embed")) return parsedUrl.toString();

    return `${parsedUrl.origin}${cleanPath}/embed`;
  } catch {
    return url;
  }
}

const baseLoginSlides: LoginSlide[] = [
  {
    id: "colecionadores",
    mediaType: "image",
    src: "/login-hero-phone-screen.png",
    title: ["O app para", "todos os", "colecionadores!"],
    highlight: "colecionadores!",
    stats: [
      { icon: <BookOpen size={16} />, label: "Colecoes" },
      { icon: <Repeat2 size={16} />, label: "Trocas" },
      { icon: <Users size={16} />, label: "Amigos" },
    ],
  },
  {
    id: "trocas",
    mediaType: "image",
    src: "/login-hero-phone-screen.png",
    title: ["Encontra", "matches para", "trocar cromos"],
    highlight: "trocar cromos",
    stats: [
      { icon: <Repeat2 size={16} />, label: "Matches" },
      { icon: <Users size={16} />, label: "Colecionadores" },
      { icon: <BookOpen size={16} />, label: "Repetidos" },
    ],
  },
  {
    id: "cadernetas",
    mediaType: "image",
    src: "/login-hero-phone-screen.png",
    title: ["Todas as", "cadernetas", "num so sitio"],
    highlight: "num so sitio",
    stats: [
      { icon: <BookOpen size={16} />, label: "Cadernetas" },
      { icon: <ShieldCheck size={16} />, label: "Seguro" },
      { icon: <Repeat2 size={16} />, label: "Historico" },
    ],
  },
];

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
  const [loginHeroVideoUrl, setLoginHeroVideoUrl] = useState("");
  const [activeLoginSlide, setActiveLoginSlide] = useState(0);
  const loginVideoRef = useRef<HTMLVideoElement | null>(null);
  const loginSlides = loginHeroVideoUrl
    ? baseLoginSlides.map((slide, index) => (
      index === 0 ? { ...slide, mediaType: "video" as const, src: loginHeroVideoUrl } : slide
    ))
    : baseLoginSlides;
  const activeSlide = loginSlides[activeLoginSlide] || loginSlides[0];

  useEffect(() => {
    let ignore = false;

    const loadLoginHeroVideo = async () => {
      const { data, error: settingsError } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "login_hero_video")
        .maybeSingle();

      if (ignore || settingsError) return;

      const value = data?.value as { url?: string } | null;
      setLoginHeroVideoUrl(typeof value?.url === "string" ? value.url : "");
    };

    loadLoginHeroVideo();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const activeLoginVideo = loginVideoRef.current;
    if (activeSlide.mediaType === "video" && activeLoginVideo) {
      activeLoginVideo.currentTime = 0;
      activeLoginVideo.play().catch(() => undefined);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveLoginSlide((index) => (index + 1) % loginSlides.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [activeSlide.mediaType, loginSlides.length]);

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const nextMissingFields = [
          ...(!firstName.trim() ? ["firstName"] : []),
          ...(!lastName.trim() ? ["lastName"] : []),
          ...(!username.trim() ? ["username"] : []),
          ...(!email.trim() ? ["email"] : []),
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

        if (!isSecurePassword(password)) {
          setMissingFields((current) => Array.from(new Set([...current, "password"])));
          setError("A password deve ter pelo menos 8 caracteres, uma letra maiúscula, uma letra minúscula, um número e um símbolo.");
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
        <section className="login-visual login-visual-slider" aria-label="Papa Cromos">
          <button className="login-scroll-hint" type="button" onClick={scrollToLoginForm} aria-label="Ir para entrar ou registar">
            <UserRound size={20} />
          </button>
          <div className="login-slide-media" aria-hidden="true">
            {loginSlides.map((slide, index) => (
              slide.mediaType === "instagram" ? (
                <iframe
                  className={`login-visual-image login-slide login-instagram-slide ${index === activeLoginSlide ? "active" : ""}`}
                  key={slide.id}
                  src={getInstagramEmbedUrl(slide.src)}
                  title=""
                  tabIndex={-1}
                  loading={index === 0 ? "eager" : "lazy"}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : slide.mediaType === "video" ? (
                <video
                  className={`login-visual-image login-slide ${index === activeLoginSlide ? "active" : ""}`}
                  key={slide.id}
                  src={slide.src}
                  ref={index === 0 ? loginVideoRef : undefined}
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => setActiveLoginSlide((currentIndex) => (currentIndex + 1) % loginSlides.length)}
                />
              ) : (
                <img
                  className={`login-visual-image login-slide ${index === activeLoginSlide ? "active" : ""}`}
                  key={slide.id}
                  src={slide.src}
                  alt=""
                />
              )
            ))}
          </div>
          {activeSlide.mediaType !== "video" && (
            <div className="login-visual-overlay">
              <img className="login-logo" src="/logo-transparent.png" alt="Papa Cromos" />
              <div className="login-visual-tagline" key={activeSlide.id}>
                {activeSlide.title.map((line) => (
                  line === activeSlide.highlight ? <strong key={line}>{line}</strong> : <span key={line}>{line}</span>
                ))}
              </div>
              <div className="login-visual-bottom">
                <div className="login-visual-stats">
                  {activeSlide.stats.map((stat) => (
                    <span key={stat.label}>{stat.icon} {stat.label}</span>
                  ))}
                </div>
                <div className="login-slide-dots" aria-label="Slides da pagina principal">
                  {loginSlides.map((slide, index) => (
                    <button
                      className={index === activeLoginSlide ? "active" : ""}
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveLoginSlide(index)}
                      aria-label={`Mostrar slide ${index + 1}`}
                      aria-pressed={index === activeLoginSlide}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      <div className="login-card">
        <div className="login-hero">
          <div>
            <span className="login-kicker">{isSignUp ? "Nova conta" : "Acesso seguro"}</span>
            <h1>{isSignUp ? "Criar conta" : "Entrar"}</h1>
            {isSignUp && <p>Preenche os dados para comecar a gerir a tua caderneta.</p>}
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
              {oauthLoading === "google" ? "A abrir Google..." : isSignUp ? "Registar com Google" : "Google"}
            </button>
            <button className="oauth-button facebook" type="button" onClick={() => handleOAuth("facebook")} disabled={loading || Boolean(oauthLoading)}>
              <span aria-hidden="true">f</span>
              {oauthLoading === "facebook" ? "A abrir Facebook..." : isSignUp ? "Registar com Facebook" : "Facebook"}
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
                placeholder="Telefone (opcional)"
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
          {isSignUp && (
            <p className={`password-guidance ${(!password || isSecurePassword(password)) ? "" : "password-guidance-weak"}`}>
              A password deve ter pelo menos 8 caracteres, uma letra maiúscula, uma letra minúscula, um número e um símbolo.
            </p>
          )}
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
