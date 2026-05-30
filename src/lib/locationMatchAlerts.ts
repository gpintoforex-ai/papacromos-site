import { countUniqueRequestedStickers, findUserMatches } from "./matches";

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface ReverseGeocodeAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
}

interface ReverseGeocodeResult {
  address?: ReverseGeocodeAddress;
}

const sessionCheckKey = "papacromos:location-match-alert-session";
const alertStoragePrefix = "papacromos:location-match-alert";
const alertCooldownMs = 24 * 60 * 60 * 1000;

function normalizeLocation(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function getCurrentPosition() {
  return new Promise<UserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      reject,
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function getApproximateCity(location: UserLocation) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(location.latitude),
    lon: String(location.longitude),
    zoom: "10",
    addressdetails: "1",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
  if (!response.ok) return "";

  const result = await response.json() as ReverseGeocodeResult;
  const address = result.address || {};
  return address.city || address.town || address.village || address.municipality || address.county || "";
}

async function canCheckLocation() {
  if (!("permissions" in navigator) || typeof navigator.permissions.query !== "function") return true;

  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    return true;
  }
}

async function showLocationMatchNotification(city: string, matchCount: number, userCount: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Trocas perto de ti", {
    body: `${userCount} utilizador${userCount === 1 ? "" : "es"} em ${city} com ${matchCount} troca${matchCount === 1 ? "" : "s"} possive${matchCount === 1 ? "l" : "is"}.`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `location-match:${normalizeLocation(city)}`,
    data: { type: "location_match", city },
  });
}

export async function checkNearbyTradeMatchAlert(userId: string) {
  if (!userId || sessionStorage.getItem(sessionCheckKey) === "true") return;

  if (!await canCheckLocation()) return;

  const location = await getCurrentPosition();
  sessionStorage.setItem(sessionCheckKey, "true");

  const city = await getApproximateCity(location);
  const normalizedCity = normalizeLocation(city);
  if (!normalizedCity) return;

  const alertKey = `${alertStoragePrefix}:${userId}:${normalizedCity}`;
  const lastAlertAt = Number(localStorage.getItem(alertKey) || "0");
  if (Date.now() - lastAlertAt < alertCooldownMs) return;

  const matches = await findUserMatches(userId);
  const cityMatches = matches.filter((match) => normalizeLocation(match.otherCity) === normalizedCity);
  if (cityMatches.length === 0) return;

  localStorage.setItem(alertKey, String(Date.now()));
  await showLocationMatchNotification(city, countUniqueRequestedStickers(cityMatches), new Set(cityMatches.map((match) => match.otherUserId)).size);
}
