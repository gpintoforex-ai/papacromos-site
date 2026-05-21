import { useState } from "react";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { locationOptions } from "../lib/locations";

function findRegionForCity(city: string) {
  return Object.entries(locationOptions.Portugal).find(([, cities]) => cities.includes(city))?.[0] || "";
}

export default function ProfileCompletionGate() {
  const { profile, updateProfileDetails, signOut } = useAuth();
  const [phone, setPhone] = useState(profile?.phone || "");
  const [region, setRegion] = useState(profile?.region || findRegionForCity(profile?.city || ""));
  const [city, setCity] = useState(profile?.city || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!phone.trim() || !region.trim() || !city.trim()) {
      setError("Indica o telemovel, distrito e cidade para continuar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateProfileDetails({ phone, region, city });
    } catch (err: any) {
      setError(err.message || "Nao foi possivel guardar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-completion-page">
      <section className="profile-completion-card">
        <div className="profile-completion-hero">
          <span>Completar perfil</span>
          <h1>Precisamos destes dados para as trocas</h1>
          <p>O login Google/Facebook nao fornece telemovel, distrito nem cidade. Estes campos ajudam a combinar trocas e parceiros proximos.</p>
        </div>

        <div className="profile-completion-form">
          <label>
            <span><Phone size={16} /> Telemovel</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Telemovel"
              autoComplete="tel"
              disabled={saving}
            />
          </label>

          <label>
            <span><MapPin size={16} /> Distrito</span>
            <select
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setCity("");
              }}
              disabled={saving}
            >
              <option value="">Seleciona o distrito</option>
              {Object.keys(locationOptions.Portugal).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span><MapPin size={16} /> Cidade</span>
            <select value={city} onChange={(event) => setCity(event.target.value)} disabled={saving || !region}>
              <option value="">Seleciona a cidade</option>
              {(locationOptions.Portugal[region as keyof typeof locationOptions.Portugal] || []).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary btn-lg" type="button" onClick={saveProfile} disabled={saving}>
          <ShieldCheck size={18} /> {saving ? "A guardar..." : "Guardar e continuar"}
        </button>

        <button className="btn btn-ghost" type="button" onClick={signOut} disabled={saving}>
          Sair
        </button>
      </section>
    </div>
  );
}
