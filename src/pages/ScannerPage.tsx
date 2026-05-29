import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, HelpCircle, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

interface Collection {
  id: string;
  name: string;
}

interface Sticker {
  id: string;
  number: number;
  name: string;
  collection_id: string;
}

interface UserSticker {
  id: string;
  user_id: string;
  sticker_id: string;
  status: "have" | "want";
  quantity: number;
}

interface ScannedCodeItem {
  rawValue: string;
  sticker: Sticker | null;
  count: number;
}

interface ScanReviewEntry {
  key: string;
  rawValues: string[];
  sticker: Sticker | null;
  count: number;
  existingQuantity: number;
}

interface StickerCodeCandidate {
  abbrev: string;
  number: number;
  code: string;
}

type CodeOcrCanvasMode = "normal" | "inverted";
type CodeOcrRegion = readonly [number, number, number, number];

interface CodeOcrCanvasInput {
  canvas: HTMLCanvasElement;
  pageSegMode: "6" | "7" | "11";
}

interface OcrSpaceResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ErrorDetails?: string | string[];
  ParsedResults?: Array<{ ParsedText?: string }>;
}

const DATA_PAGE_SIZE = 1000;
const WORLD_ALBUM_COLLECTION_ID = "b2026000-0000-4000-8000-000000000001";
const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const OCR_SPACE_API_KEY = (import.meta.env.VITE_OCR_SPACE_API_KEY || "helloworld").trim();

const normalizeOcrSpaceMessage = (message?: string | string[]) => {
  if (!message) return "";
  return Array.isArray(message) ? message.filter(Boolean).join(" ") : message;
};

const getOcrSpaceErrorMessage = (payload?: OcrSpaceResponse | null, status?: number) => {
  const rawMessage = [
    normalizeOcrSpaceMessage(payload?.ErrorMessage),
    normalizeOcrSpaceMessage(payload?.ErrorDetails),
  ].filter(Boolean).join(" ");
  const lowerMessage = rawMessage.toLowerCase();

  if (
    status === 429 ||
    /\b(quota|rate|limit|limited|exceeded|maximum|daily|monthly)\b/.test(lowerMessage)
  ) {
    return "A cota/limite do OCR avancado foi atingido. Tenta mais tarde ou usa a opcao Manual.";
  }

  if (
    status === 401 ||
    status === 403 ||
    /\b(api\s*key|apikey|unauthorized|forbidden|permission|invalid key)\b/.test(lowerMessage)
  ) {
    return "OCR avancado sem permissao. Confirma a API key do OCR.space e volta a publicar a app.";
  }

  if (status && status >= 500) {
    return "OCR avancado temporariamente indisponivel. Tenta novamente mais tarde.";
  }

  return rawMessage || "OCR avancado nao conseguiu processar a imagem.";
};

const abbrevToTeam: Record<string, string> = {
  AFS: "Africa do Sul",
  ALG: "Argelia",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgica",
  BIH: "Bosnia e Herzegovina",
  BRA: "Brasil",
  BRAZ: "Brasil",
  CAN: "Canada",
  CHE: "Suica",
  CIV: "Costa do Marfim",
  COD: "RD do Congo",
  COL: "Colombia",
  CPV: "Cabo Verde",
  CRO: "Croacia",
  CUW: "Curacao",
  CZE: "Tchequia",
  DEU: "Alemanha",
  DRC: "RD do Congo",
  ECU: "Equador",
  EGY: "Egito",
  ENG: "Inglaterra",
  ESP: "Espanha",
  EUS: "Estados Unidos",
  FRA: "Franca",
  GER: "Alemanha",
  GHA: "Gana",
  HAI: "Haiti",
  HOL: "Holanda",
  HRV: "Croacia",
  IRN: "RI do Ira",
  IRQ: "Iraque",
  JAM: "Jamaica",
  JOR: "Jordania",
  JPN: "Japao",
  KOR: "Republica da Coreia",
  KSA: "Arabia Saudita",
  MAR: "Marrocos",
  MEX: "Mexico",
  NED: "Holanda",
  NLD: "Holanda",
  NOR: "Noruega",
  NZL: "Nova Zelandia",
  PAN: "Panama",
  PAR: "Paraguai",
  POR: "Portugal",
  QAT: "Catar",
  RSA: "Africa do Sul",
  SAU: "Arabia Saudita",
  SEN: "Senegal",
  SCO: "Escocia",
  SUE: "Suecia",
  SUI: "Suica",
  SWE: "Suecia",
  TUN: "Tunisia",
  TUR: "Turquia",
  URU: "Uruguai",
  USA: "Estados Unidos",
  UZB: "Uzbequistao",
  ZAF: "Africa do Sul",
};

const flagCodeByTeamNorm: Record<string, string> = {
  AFRICADOSUL: "za",
  ALEMANHA: "de",
  ARGELIA: "dz",
  ARGENTINA: "ar",
  ARABIASAUDITA: "sa",
  AUSTRALIA: "au",
  AUSTRIA: "at",
  BELGICA: "be",
  BOSNIAEHERZEGOVINA: "ba",
  BRASIL: "br",
  CABOVERDE: "cv",
  CANADA: "ca",
  CATAR: "qa",
  COLOMBIA: "co",
  COREIADOSUL: "kr",
  COSTADOMARFIM: "ci",
  CROACIA: "hr",
  CURACAO: "cw",
  DINAMARCA: "dk",
  EGITO: "eg",
  EQUADOR: "ec",
  ESCOCIA: "gb-sct",
  ESPANHA: "es",
  ESTADOSUNIDOS: "us",
  FRANCA: "fr",
  GANA: "gh",
  HAITI: "ht",
  HOLANDA: "nl",
  INGLATERRA: "gb-eng",
  IRA: "ir",
  IRAQUE: "iq",
  ITALIA: "it",
  JAMAICA: "jm",
  JAPAO: "jp",
  JORDANIA: "jo",
  MARROCOS: "ma",
  MEXICO: "mx",
  NORUEGA: "no",
  NOVAZELANDIA: "nz",
  PAISESBAIXOS: "nl",
  PANAMA: "pa",
  PARAGUAI: "py",
  PORTUGAL: "pt",
  QATAR: "qa",
  RDDOCONGO: "cd",
  CONGODR: "cd",
  REPUBLICADACOREIA: "kr",
  RIDOIRA: "ir",
  SENEGAL: "sn",
  SUECIA: "se",
  SUICA: "ch",
  TCHEQUIA: "cz",
  TUNISIA: "tn",
  TURQUIA: "tr",
  URUGUAI: "uy",
  UZBEQUISTAO: "uz",
};

const flagCodeByAbbrev: Record<string, string> = {
  AFS: "za",
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CHE: "ch",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  DEU: "de",
  DRC: "cd",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  HOL: "nl",
  HRV: "hr",
  IRN: "ir",
  IRQ: "iq",
  JAM: "jm",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NLD: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SAU: "sa",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  URU: "uy",
  USA: "us",
  UZB: "uz",
  ZAF: "za",
};

function getStickerTeamName(stickerName: string) {
  return stickerName.includes(" - ") ? stickerName.split(" - ")[0].trim() : "Cromos";
}

function isWorldAlbumSpecialSticker(sticker: Sticker) {
  const teamName = getStickerTeamName(sticker.name);
  return sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && (teamName === "FWC" || teamName === "CC");
}

function getAlbumTeamOrder(sticker: Sticker) {
  if (isWorldAlbumSpecialSticker(sticker)) return 0;
  return Math.floor((sticker.number - 1) / 20) + 1;
}

function getStickerEffectiveTeamName(sticker: Sticker) {
  if (sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && getAlbumTeamOrder(sticker) === 42) {
    return "RD do Congo";
  }

  return getStickerTeamName(sticker.name);
}

function getStickerFlagCode(sticker: Sticker | null) {
  if (!sticker) return "";
  return flagCodeByTeamNorm[normalizeAbbrev(getStickerEffectiveTeamName(sticker))] || "";
}

function getFlagCodeForScannedItem(item: ScannedCodeItem | ScanReviewEntry) {
  const stickerCode = getStickerFlagCode(item.sticker);
  if (stickerCode) return stickerCode;
  const rawValue = "rawValue" in item ? item.rawValue : item.rawValues[0] || "";
  const abbrev = normalizeAbbrev(rawValue).match(/^[A-Z]{2,4}/)?.[0] || "";
  return flagCodeByAbbrev[abbrev] || "";
}

function getFlagUrl(flagCode: string) {
  return `https://flagcdn.com/w40/${flagCode}.png`;
}

function getAlbumLocalNumber(sticker: Sticker) {
  const teamName = getStickerTeamName(sticker.name);
  if (sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && teamName === "FWC") return sticker.number - 960;
  if (sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && teamName === "CC") return sticker.number - 979;
  const slot = ((sticker.number - 1) % 20) + 1;
  if (sticker.name.includes("Escudo")) return 1;
  if (sticker.name.includes("Foto de equipa")) return 13;
  return slot;
}

function getStickerDisplayName(sticker: Sticker) {
  const teamName = getStickerEffectiveTeamName(sticker);
  const localNumber = getAlbumLocalNumber(sticker);
  if (localNumber === 1) return `${teamName} - Escudo`;
  if (localNumber === 13) return `${teamName} - Foto de equipa`;
  return sticker.name.startsWith(`${teamName} - `) ? sticker.name : `${teamName} - ${sticker.name.split(" - ").slice(1).join(" - ") || sticker.name}`;
}

function normalizeAbbrev(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function levenshtein(a: string, b: string) {
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  const v0 = new Array(blen + 1).fill(0);
  const v1 = new Array(blen + 1).fill(0);
  for (let i = 0; i <= blen; i++) v0[i] = i;
  for (let i = 0; i < alen; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < blen; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= blen; j++) v0[j] = v1[j];
  }
  return v1[blen];
}

function isSimilarAbbrev(abbrev: string, teamNameNorm: string) {
  if (teamNameNorm.startsWith(abbrev)) return true;
  if (teamNameNorm.includes(abbrev)) return true;
  return levenshtein(abbrev.slice(0, 4), teamNameNorm.slice(0, 4)) <= 1;
}

function normalizeOcrCodeText(text: string) {
  return text
    .toUpperCase()
    .replace(/[|]/g, "I")
    .replace(/[€£]/g, "E")
    .replace(/[“”]/g, '"')
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\b0\s*([0-9]{1,2})\b/g, "O $1")
    .replace(/\bA[1I]G\b/g, "ALG")
    .replace(/\bAIG\b/g, "ALG")
    .replace(/\bB8A\b/g, "BRA")
    .replace(/\b8RA\b/g, "BRA")
    .replace(/\bC[0O]D\b/g, "COD")
    .replace(/\bC[O0][D0O]\b/g, "COD")
    .replace(/\bC0[DO]\b/g, "COD")
    .replace(/\bC[O0]V\b/g, "CPV")
    .replace(/\bCPY\b/g, "CPV")
    .replace(/\bN[2Z]L\b/g, "NZL")
    .replace(/\bNZI\b/g, "NZL")
    .replace(/\b5EN\b/g, "SEN")
    .replace(/\b5CO\b/g, "SCO")
    .replace(/\bSC0\b/g, "SCO")
    .replace(/\b5C[O0]\b/g, "SCO")
    .replace(/\bSC[O0Q]\b/g, "SCO")
    .replace(/\bEC[O0]\b/g, "ECU")
    .replace(/\bE[CO]U\b/g, "ECU")
    .replace(/\bU[2Z]8\b/g, "UZB")
    .replace(/\bUZ8\b/g, "UZB")
    .replace(/\b6ER\b/g, "GER")
    .replace(/\bG[£E]R\b/g, "GER")
    .replace(/\bGE[8B]\b/g, "GER")
    .replace(/\bGFR\b/g, "GER")
    .replace(/\bCER\b/g, "GER")
    .replace(/\bT[UO]M\b/g, "TUN")
    .replace(/\bT[UO][NM]\b/g, "TUN")
    .replace(/\bT[UV][NM]\b/g, "TUN")
    .replace(/\bT[JY]N\b/g, "TUN")
    .replace(/\b1RN\b/g, "IRN")
    .replace(/\b[1I]R[NM]\b/g, "IRN")
    .replace(/\bIR[NM]\b/g, "IRN")
    .replace(/\bIR[HNM]\b/g, "IRN")
    .replace(/\bA1G\b/g, "ALG")
    .replace(/\bAL6\b/g, "ALG")
    .replace(/\bEN6\b/g, "ENG")
    .replace(/\b6HA\b/g, "GHA")
    .replace(/\bC0D\b/g, "COD")
    .replace(/\s+/g, " ")
    .trim();
}

function getStickerCodeCandidatesFromOcrText(text: string) {
  const normalizedText = normalizeOcrCodeText(text)
    .replace(/\b([A-Z]{3})\s*[IL|]\s*[B8]\b/g, "$1 18")
    .replace(/\b([A-Z]{3})\s*[IL|][ZT]\b/g, "$1 17")
    .replace(/\b([A-Z]{3})\s*[IL|]\s*([0-9])\b/g, "$1 1$2")
    .replace(/\b([A-Z]{3})\s*([0-9])\s*[B8]\b/g, "$1 $28")
    .replace(/\b([A-Z]{3})([0-9]{1,2})\b/g, "$1 $2");
  const candidates: StickerCodeCandidate[] = [];
  const re = /\b([A-Z0-9]{2,4})\s*[-_/]?\s*([0-9]{1,2})\b/g;

  for (const match of normalizedText.matchAll(re)) {
    const abbrev = normalizeAbbrev(match[1]);
    const number = Number.parseInt(match[2], 10);
    if (!Number.isFinite(number) || number < 1 || number > 20) continue;
    if (!abbrevToTeam[abbrev]) continue;
    candidates.push({ abbrev, number, code: `${abbrev} ${number}` });
  }

  return candidates.filter((candidate, index, all) =>
    all.findIndex((item) => item.code === candidate.code) === index
  );
}

function resolveOcrCodeCandidates(candidates: StickerCodeCandidate[]) {
  return candidates
    .filter((candidate) => {
      const digits = String(candidate.number);
      return !candidates.some((other) =>
        other.abbrev === candidate.abbrev &&
        other.number !== candidate.number &&
        String(other.number).startsWith(digits)
      );
    })
    .map((candidate) => candidate.code)
    .filter((code, index, all) => all.indexOf(code) === index);
}

function getStickerCodesFromOcrText(text: string) {
  return resolveOcrCodeCandidates(getStickerCodeCandidatesFromOcrText(text));
}

const numericOcrNoiseWords = [
  "BETCLIC",
  "BOLAS",
  "COLECAO",
  "CROMOS",
  "MADE",
  "OFICIAL",
  "PANINI",
  "PROMOCAO",
  "PUMA",
  "SINDICATO",
  "SUPERGOLACO",
];

function scoreNumericOcrMatch(line: string, value: string, maxStickerNumber: number, validMatchesOnLine: number) {
  const compactLine = line.replace(/\s+/g, " ").trim();
  const lineWithoutValue = compactLine.replace(value, "").trim();
  const hasNoiseWord = numericOcrNoiseWords.some((word) => compactLine.includes(word));
  const hasSeason = /\b20[0-9]{2}\b/.test(compactLine) || /\b[0-9]{2}\s*[-_/]\s*[0-9]{2}\b/.test(compactLine);
  let score = 0;

  if (/^[0-9]{1,4}$/.test(compactLine)) score += 18;
  if (value.length >= 3) score += 8;
  if (value.length === String(maxStickerNumber).length) score += 4;
  if (value.length <= 2 && maxStickerNumber >= 100) score -= 5;
  if (lineWithoutValue.length <= 8) score += 4;
  if (validMatchesOnLine >= 2 && !hasNoiseWord && !hasSeason) score += 8;
  if (hasNoiseWord) score -= 10;
  if (hasSeason) score -= 14;

  return score;
}

function getStickerNumbersFromOcrText(text: string, candidates: Sticker[]) {
  if (candidates.length === 0) return [];
  if (candidates.some((sticker) => sticker.collection_id === WORLD_ALBUM_COLLECTION_ID)) return [];

  const validNumbers = new Set(candidates.map((sticker) => sticker.number));
  const maxStickerNumber = Math.max(...candidates.map((sticker) => sticker.number));
  const scoredCodes = new Map<string, number>();

  for (const rawLine of text.split(/\r?\n/)) {
    const normalizedLine = normalizeOcrCodeText(rawLine);
    const matches = [...normalizedLine.matchAll(/\b[0-9]{1,4}\b/g)]
      .map((match) => ({ value: match[0], number: Number.parseInt(match[0], 10) }))
      .filter((match) => Number.isFinite(match.number) && validNumbers.has(match.number));

    for (const match of matches) {
      const score = scoreNumericOcrMatch(normalizedLine, match.value, maxStickerNumber, matches.length);
      if (score < 10) continue;

      const code = String(match.number);
      scoredCodes.set(code, Math.max(scoredCodes.get(code) || 0, score));
    }
  }

  const rankedCodes = [...scoredCodes.entries()].sort((a, b) => b[1] - a[1]);
  return rankedCodes.slice(0, 24).map(([code]) => code);
}

function playScannerBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(980, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.07);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.14);
    window.setTimeout(() => void audioContext.close(), 220);
  } catch {
    // Audio feedback is optional; scanner capture should continue if blocked.
  }
}

async function fetchAllStickers() {
  const allStickers: Sticker[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("stickers")
      .select("id, number, name, collection_id")
      .order("collection_id", { ascending: true })
      .order("number", { ascending: true })
      .range(from, from + DATA_PAGE_SIZE - 1);

    if (error) throw error;
    allStickers.push(...((data || []) as Sticker[]));
    if (!data || data.length < DATA_PAGE_SIZE) break;
    from += DATA_PAGE_SIZE;
  }

  return allStickers;
}

async function fetchUserStickers(userId: string) {
  const allUserStickers: UserSticker[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("user_stickers")
      .select("id, user_id, sticker_id, status, quantity")
      .eq("user_id", userId)
      .range(from, from + DATA_PAGE_SIZE - 1);

    if (error) throw error;
    allUserStickers.push(...((data || []) as UserSticker[]));
    if (!data || data.length < DATA_PAGE_SIZE) break;
    from += DATA_PAGE_SIZE;
  }

  return allUserStickers;
}

function findStickerForCodeInCollection(rawValue: string, candidates: Sticker[]): Sticker | null {
  const abbrevMatch = normalizeOcrCodeText(rawValue).match(/^([A-Z0-9]{2,4})\s*[-_\\/]?\s*0*([1-9][0-9]?)$/);
  if (abbrevMatch) {
    const abbrev = normalizeAbbrev(abbrevMatch[1]);
    const num = Number.parseInt(abbrevMatch[2], 10);
    const mappedTeam = abbrevToTeam[abbrev];
    if (mappedTeam) {
      const mappedTeamNorm = normalizeAbbrev(mappedTeam);
      const found = candidates.find((sticker) =>
        normalizeAbbrev(getStickerEffectiveTeamName(sticker)) === mappedTeamNorm &&
        getAlbumLocalNumber(sticker) === num
      );
      if (found) return found;
    }

    const found = candidates.find((sticker) =>
      isSimilarAbbrev(abbrev, normalizeAbbrev(getStickerEffectiveTeamName(sticker))) &&
      getAlbumLocalNumber(sticker) === num
    );
    if (found) return found;
  }

  const number = Number.parseInt(rawValue.replace(/\D/g, ""), 10);
  if (Number.isFinite(number)) {
    return candidates.find((sticker) => sticker.number === number || getAlbumLocalNumber(sticker) === number) || null;
  }

  return null;
}

export default function ScannerPage({ onCollectionChange, onClose }: { onCollectionChange?: () => void; onClose?: () => void }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeScanning, setCodeScanning] = useState(false);
  const [codeReading, setCodeReading] = useState(false);
  const [advancedReading, setAdvancedReading] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const [scannedCodes, setScannedCodes] = useState<ScannedCodeItem[]>([]);
  const [scanConfirming, setScanConfirming] = useState(false);
  const [scanReviewItems, setScanReviewItems] = useState<ScanReviewEntry[]>([]);
  const [scanReviewMode, setScanReviewMode] = useState<"confirm" | "summary">("summary");
  const [manualCodeOpen, setManualCodeOpen] = useState(false);
  const [manualCodeValue, setManualCodeValue] = useState("");
  const [scannerHelpOpen, setScannerHelpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const codeVideoRef = useRef<HTMLVideoElement | null>(null);
  const codeStreamRef = useRef<MediaStream | null>(null);
  const codeOcrBusyRef = useRef(false);
  const codeOcrWorkerRef = useRef<any | null>(null);
  const codeOcrWorkerPromiseRef = useRef<Promise<any> | null>(null);
  const codeLastSeenAtRef = useRef<Map<string, number>>(new Map());
  const scannerListRef = useRef<HTMLDivElement | null>(null);
  const autoStartedScannerRef = useRef(false);

  const collectionStickers = useMemo(
    () => stickers.filter((sticker) => sticker.collection_id === selectedCollectionId),
    [selectedCollectionId, stickers]
  );

  useEffect(() => {
    loadData();
    return () => stopCodeScanner();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) return;
      const [collectionsRes, preferencesRes, allStickers, ownStickers] = await Promise.all([
        supabase.from("collections").select("id, name").order("name", { ascending: true }),
        supabase.from("user_collection_preferences").select("collection_id, is_active").eq("user_id", user.id),
        fetchAllStickers(),
        fetchUserStickers(user.id),
      ]);
      if (collectionsRes.error) throw collectionsRes.error;
      if (preferencesRes.error) throw preferencesRes.error;

      const loadedCollections = (collectionsRes.data || []) as Collection[];
      setCollections(loadedCollections);
      setStickers(allStickers);
      setUserStickers(ownStickers);

      const activeIds = new Set((preferencesRes.data || []).filter((item) => item.is_active).map((item) => item.collection_id));
      const defaultCollection = loadedCollections.find((collection) => activeIds.has(collection.id)) || loadedCollections[0];
      setSelectedCollectionId((current) => current || defaultCollection?.id || "");
    } catch (err: any) {
      setError(err.message || "Erro ao carregar scanner.");
    } finally {
      setLoading(false);
    }
  };

  const findStickerForScannedCode = useCallback(
    (rawValue: string): Sticker | null => findStickerForCodeInCollection(rawValue, collectionStickers),
    [collectionStickers]
  );

  const getScannableCodesFromOcrText = useCallback(
    (text: string) => {
      const stickerCodes = getStickerCodesFromOcrText(text);
      const numericCodes = getStickerNumbersFromOcrText(text, collectionStickers);
      return [...stickerCodes, ...numericCodes].filter((code, index, all) => all.indexOf(code) === index);
    },
    [collectionStickers]
  );

  const handleCollectionFilterChange = (collectionId: string) => {
    const nextCollectionStickers = stickers.filter((sticker) => sticker.collection_id === collectionId);
    setSelectedCollectionId(collectionId);
    setScannedCodes((current) =>
      current.map((item) => ({
        ...item,
        sticker: findStickerForCodeInCollection(item.rawValue, nextCollectionStickers),
      }))
    );
    setError(null);
    setCodeResult(null);
  };

  const stopCodeScanner = (options?: { keepWorker?: boolean }) => {
    setCapturedPreview(null);
    if (!options?.keepWorker) {
      codeOcrBusyRef.current = false;
    }
    if (!options?.keepWorker && codeOcrWorkerRef.current) {
      void codeOcrWorkerRef.current.terminate();
      codeOcrWorkerRef.current = null;
      codeOcrWorkerPromiseRef.current = null;
    }
    codeStreamRef.current?.getTracks().forEach((track) => track.stop());
    codeStreamRef.current = null;
    if (codeVideoRef.current) codeVideoRef.current.srcObject = null;
    setCodeScanning(false);
    if (!options?.keepWorker) {
      setCodeReading(false);
    }
  };

  const addCodeToScanList = (normalized: string) => {
    setCodeText(normalized);
    setScannedCodes((current) => {
      const existing = current.find((item) => item.rawValue === normalized);
      if (existing) {
        return current.map((item) =>
          item.rawValue === normalized ? { ...item, count: item.count + 1 } : item
        );
      }
      return [...current, { rawValue: normalized, sticker: findStickerForScannedCode(normalized), count: 1 }];
    });
  };

  const addDetectedCode = (rawValue: string) => {
    const normalized = getStickerCodesFromOcrText(rawValue)[0] || normalizeOcrCodeText(rawValue);
    const now = Date.now();
    const lastSeenAt = codeLastSeenAtRef.current.get(normalized) || 0;
    if (now - lastSeenAt < 1600) return;
    codeLastSeenAtRef.current.set(normalized, now);
    addCodeToScanList(normalized);
  };

  const createCodeOcrCanvas = (
    source: CanvasImageSource,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth = 1600,
    mode: CodeOcrCanvasMode = "normal",
  ) => {
    const scale = Math.min(4, targetWidth / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.imageSmoothingEnabled = scale < 1;
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 2.25 + 128));
      const value = mode === "inverted"
        ? (contrasted > 150 ? 0 : 255)
        : contrasted;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  };

  const createCodeOcrSheetCanvas = (
    source: HTMLCanvasElement,
    regions: CodeOcrRegion[],
    mode: CodeOcrCanvasMode,
  ) => {
    const crops = regions
      .map(([sourceX, sourceY, sourceWidth, sourceHeight]) =>
        createCodeOcrCanvas(source, sourceX, sourceY, sourceWidth, sourceHeight, 760, mode)
      )
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
    if (crops.length === 0) return null;

    const gap = 24;
    const padding = 24;
    const sheetWidth = Math.max(...crops.map((crop) => crop.width)) + padding * 2;
    const sheetHeight = crops.reduce((total, crop) => total + crop.height, padding * 2 + gap * Math.max(0, crops.length - 1));
    const sheet = document.createElement("canvas");
    sheet.width = sheetWidth;
    sheet.height = sheetHeight;
    const context = sheet.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sheet.width, sheet.height);
    let y = padding;
    crops.forEach((crop) => {
      context.drawImage(crop, padding, y);
      y += crop.height + gap;
    });

    return sheet;
  };

  const detectCodeLabelRegions = (source: HTMLCanvasElement): CodeOcrRegion[] => {
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / source.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];

    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const dark = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      dark[index] = gray < 168 ? 1 : 0;
    }

    const regions: CodeOcrRegion[] = [];
    const stack: number[] = [];

    for (let start = 0; start < dark.length; start += 1) {
      if (!dark[start] || visited[start]) continue;

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let pixels = 0;
      visited[start] = 1;
      stack.push(start);

      while (stack.length > 0) {
        const current = stack.pop()!;
        const x = current % width;
        const y = Math.floor(current / width);
        pixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const neighbours = [current - 1, current + 1, current - width, current + width];
        for (const next of neighbours) {
          if (next < 0 || next >= dark.length || visited[next] || !dark[next]) continue;
          const nextX = next % width;
          if (Math.abs(nextX - x) > 1) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const ratio = boxWidth / Math.max(1, boxHeight);
      const density = pixels / Math.max(1, boxWidth * boxHeight);
      const looksLikeCodePill =
        boxWidth >= 26 &&
        boxWidth <= width * 0.46 &&
        boxHeight >= 8 &&
        boxHeight <= height * 0.17 &&
        ratio >= 1.8 &&
        ratio <= 10.5 &&
        density >= 0.22 &&
        minY <= height * 0.82;

      if (!looksLikeCodePill) continue;

      const padX = Math.round(boxWidth * 0.22);
      const padY = Math.round(boxHeight * 0.38);
      const sourceX = Math.max(0, Math.round((minX - padX) / scale));
      const sourceY = Math.max(0, Math.round((minY - padY) / scale));
      const sourceRight = Math.min(source.width, Math.round((maxX + padX) / scale));
      const sourceBottom = Math.min(source.height, Math.round((maxY + padY) / scale));
      regions.push([sourceX, sourceY, Math.max(1, sourceRight - sourceX), Math.max(1, sourceBottom - sourceY)]);
    }

    return regions
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .filter((region, index, all) => {
        return all.findIndex((other) => {
          const xOverlap = Math.max(0, Math.min(region[0] + region[2], other[0] + other[2]) - Math.max(region[0], other[0]));
          const yOverlap = Math.max(0, Math.min(region[1] + region[3], other[1] + other[3]) - Math.max(region[1], other[1]));
          const overlap = xOverlap * yOverlap;
          const smaller = Math.min(region[2] * region[3], other[2] * other[3]);
          return overlap / Math.max(1, smaller) > 0.55;
        }) === index;
      })
      .slice(0, 16);
  };

  const buildCodeOcrCanvasesFromSource = (
    source: HTMLCanvasElement,
    width: number,
    height: number,
    exhaustive = false,
  ) => {
    const fastRegions = [
      [0, 0, width, height],
    ] as const;
    const exhaustiveRegions = [
      [Math.round(width * 0.46), Math.round(height * 0.02), Math.round(width * 0.5), Math.round(height * 0.18)],
      [Math.round(width * 0.42), 0, Math.round(width * 0.56), Math.round(height * 0.26)],
      [Math.round(width * 0.46), Math.round(height * 0.18), Math.round(width * 0.5), Math.round(height * 0.2)],
      [Math.round(width * 0.46), Math.round(height * 0.28), Math.round(width * 0.5), Math.round(height * 0.2)],
      [0, 0, width, Math.round(height * 0.34)],
      [0, 0, width, Math.round(height * 0.48)],
      [Math.round(width * 0.48), 0, Math.round(width * 0.52), Math.round(height * 0.52)],
      [0, 0, Math.round(width * 0.55), Math.round(height * 0.52)],
      [Math.round(width * 0.33), 0, Math.round(width * 0.34), Math.round(height * 0.58)],
      [Math.round(width * 0.32), Math.round(height * 0.18), Math.round(width * 0.66), Math.round(height * 0.42)],
      [Math.round(width * 0.15), Math.round(height * 0.12), Math.round(width * 0.7), Math.round(height * 0.72)],
    ] as const;
    const detectedRegions = exhaustive ? detectCodeLabelRegions(source) : [];
    const regions: CodeOcrRegion[] = detectedRegions.length > 0
      ? detectedRegions
      : exhaustive ? [...fastRegions, ...exhaustiveRegions] : [...fastRegions];
    const modes: CodeOcrCanvasMode[] = detectedRegions.length > 0
      ? ["inverted", "normal"]
      : exhaustive ? ["inverted", "normal"] : ["normal"];
    const inputs: CodeOcrCanvasInput[] = [];
    const individualRegions = detectedRegions.length > 0 ? detectedRegions : exhaustiveRegions;

    modes.forEach((mode) => {
      individualRegions.forEach(([sourceX, sourceY, sourceWidth, sourceHeight]) => {
        const canvas = createCodeOcrCanvas(source, sourceX, sourceY, sourceWidth, sourceHeight, 1400, mode);
        if (canvas) inputs.push({ canvas, pageSegMode: "7" });
      });

      const sheet = createCodeOcrSheetCanvas(source, regions, mode);
      if (sheet) inputs.push({ canvas: sheet, pageSegMode: "6" });
    });

    if (!exhaustive) {
      const canvas = createCodeOcrCanvas(source, 0, 0, width, height, 1600, "normal");
      if (canvas) inputs.push({ canvas, pageSegMode: "11" });
    }

    return inputs;
  };

  const prepareCodeOcrWorker = async () => {
    if (codeOcrWorkerRef.current) return codeOcrWorkerRef.current;
    if (codeOcrWorkerPromiseRef.current) return codeOcrWorkerPromiseRef.current;

    codeOcrWorkerPromiseRef.current = import("tesseract.js").then(async ({ createWorker, OEM }) => {
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {}, {
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_/",
        tessedit_pageseg_mode: "11",
      } as any);
      codeOcrWorkerRef.current = worker;
      return worker;
    });

    return codeOcrWorkerPromiseRef.current;
  };

  const recognizeCodeCanvases = async (canvases: CodeOcrCanvasInput[]) => {
    if (canvases.length === 0) return 0;
    const worker = await prepareCodeOcrWorker();
    const candidates: StickerCodeCandidate[] = [];
    const numericCodes: string[] = [];

    for (const { canvas, pageSegMode } of canvases) {
      if (typeof worker.setParameters === "function") {
        await worker.setParameters({ tessedit_pageseg_mode: pageSegMode } as any);
      }
      const result = await worker.recognize(canvas);
      candidates.push(...getStickerCodeCandidatesFromOcrText(result.data.text));
      numericCodes.push(...getStickerNumbersFromOcrText(result.data.text, collectionStickers));
    }

    const codes = [...resolveOcrCodeCandidates(candidates), ...numericCodes]
      .filter((code, index, all) => all.indexOf(code) === index);
    codes.forEach(addDetectedCode);
    return codes.length;
  };

  const captureCameraCanvas = () => {
    const video = codeVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Nao consegui capturar a imagem da camara.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Nao consegui preparar a imagem capturada.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const createExternalOcrImage = (source: HTMLCanvasElement) => {
    const targetWidth = Math.min(1400, source.width);
    const scale = targetWidth / source.width;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return source.toDataURL("image/jpeg", 0.82);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  };

  const recognizeWithExternalOcr = async (source: HTMLCanvasElement) => {
    const formData = new FormData();
    formData.append("apikey", OCR_SPACE_API_KEY);
    formData.append("base64Image", createExternalOcrImage(source));
    formData.append("language", "eng");
    formData.append("scale", "true");
    formData.append("isOverlayRequired", "false");
    formData.append("OCREngine", "2");

    const response = await fetch(OCR_SPACE_ENDPOINT, {
      method: "POST",
      body: formData,
    });
    let payload: OcrSpaceResponse | null = null;
    try {
      payload = await response.json() as OcrSpaceResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) throw new Error(getOcrSpaceErrorMessage(payload, response.status));
    if (!payload) throw new Error("OCR avancado devolveu uma resposta invalida.");

    if (payload.IsErroredOnProcessing) {
      throw new Error(getOcrSpaceErrorMessage(payload, response.status));
    }

    const text = (payload.ParsedResults || [])
      .map((result) => result.ParsedText || "")
      .join("\n");
    const codes = getScannableCodesFromOcrText(text);
    codes.forEach(addDetectedCode);
    return codes.length;
  };

  const startCodeScanner = async () => {
    setError(null);
    setCodeResult(null);
    setCapturedPreview(null);
    try {
      if (!selectedCollectionId) throw new Error("Escolhe uma colecao primeiro.");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este browser nao permite abrir a camara aqui.");
      }

      stopCodeScanner();
      void prepareCodeOcrWorker();
      const video = codeVideoRef.current;
      if (!video) throw new Error("Nao consegui abrir o leitor de codigos.");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      codeStreamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setCodeScanning(true);
    } catch (err: any) {
      stopCodeScanner();
      if (err?.name === "NotAllowedError") {
        setError("Permissao da camara bloqueada. Autoriza a camara no browser e tenta novamente.");
        return;
      }
      if (err?.name === "NotFoundError") {
        setError("Nao encontrei nenhuma camara disponivel neste dispositivo.");
        return;
      }
      setError(err.message || "Erro ao iniciar leitura de codigos.");
    }
  };

  useEffect(() => {
    if (autoStartedScannerRef.current || loading || !selectedCollectionId || codeScanning) return;
    autoStartedScannerRef.current = true;
    void startCodeScanner();
  }, [loading, selectedCollectionId, codeScanning]);

  const readCodeFrame = async (options: { audible?: boolean; showError?: boolean } = {}) => {
    if (codeOcrBusyRef.current) return;
    if (options.showError !== false) setError(null);
    setCodeResult(null);
    if (options.audible) playScannerBeep();

    codeOcrBusyRef.current = true;
    setCodeReading(true);
    try {
      const canvas = captureCameraCanvas();
      const canvases = buildCodeOcrCanvasesFromSource(canvas, canvas.width, canvas.height, true);
      const detectedCount = await recognizeCodeCanvases(canvases);
      if (detectedCount === 0) {
        if (options.showError !== false) {
          setError("Nao encontrei codigos nesta captura. Aproxima mais os cantos com os codigos e evita reflexos.");
        }
      } else {
        setError(null);
      }
    } catch (err: any) {
      if (options.showError !== false) setError(err.message || "Erro ao ler a imagem capturada.");
    } finally {
      codeOcrBusyRef.current = false;
      setCodeReading(false);
    }
  };

  const captureCodeFrame = async () => {
    await readCodeFrame({ audible: true, showError: true });
  };

  const captureAdvancedOcr = async () => {
    if (advancedReading || codeOcrBusyRef.current) return;
    setError(null);
    setCodeResult(null);
    playScannerBeep();
    setAdvancedReading(true);
    try {
      const canvas = captureCameraCanvas();
      setCapturedPreview(canvas.toDataURL("image/jpeg", 0.76));
      const detectedCount = await recognizeWithExternalOcr(canvas);
      if (detectedCount === 0) {
        setError("OCR avancado nao encontrou codigos nesta captura.");
      }
    } catch (err: any) {
      setError(err.message || "Erro no OCR avancado.");
    } finally {
      setCapturedPreview(null);
      setAdvancedReading(false);
    }
  };

  const clearScannedCodes = () => {
    setScannedCodes([]);
    codeLastSeenAtRef.current.clear();
    setCodeText("");
    setCodeResult(null);
  };

  const removeScannedCode = (rawValue: string) => {
    setScannedCodes((current) => current.filter((item) => item.rawValue !== rawValue));
    codeLastSeenAtRef.current.delete(rawValue);
    if (codeText === rawValue) setCodeText("");
  };

  const markCodes = async (codes: string[]) => {
    if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
    if (!selectedCollectionId) throw new Error("Escolhe uma colecao primeiro.");

    const matched = codes
      .map((code) => ({ code, sticker: findStickerForScannedCode(code) }))
      .filter((item): item is { code: string; sticker: Sticker } => Boolean(item.sticker));

    if (matched.length === 0) throw new Error("Nenhum codigo pertence a esta colecao.");

    const countByStickerId = new Map<string, { sticker: Sticker; count: number }>();
    matched.forEach(({ sticker }) => {
      const current = countByStickerId.get(sticker.id);
      if (current) current.count += 1;
      else countByStickerId.set(sticker.id, { sticker, count: 1 });
    });

    const existingHaveByStickerId = new Map(
      userStickers
        .filter((userSticker) => userSticker.user_id === user.id && userSticker.status === "have")
        .map((userSticker) => [userSticker.sticker_id, userSticker])
    );

    for (const item of countByStickerId.values()) {
      const existing = existingHaveByStickerId.get(item.sticker.id);
      if (existing) {
        const { error: updateError } = await supabase
          .from("user_stickers")
          .update({ quantity: Math.max(0, existing.quantity || 0) + item.count })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_stickers").upsert({
          user_id: user.id,
          sticker_id: item.sticker.id,
          status: "have",
          quantity: item.count,
        }, {
          onConflict: "user_id,sticker_id,status",
        });
        if (insertError) throw insertError;
      }
    }

    const matchedStickerIds = Array.from(countByStickerId.keys());
    const wantIdsToRemove = userStickers
      .filter((userSticker) =>
        userSticker.user_id === user.id &&
        userSticker.status === "want" &&
        matchedStickerIds.includes(userSticker.sticker_id)
      )
      .map((userSticker) => userSticker.id);
    if (wantIdsToRemove.length > 0) {
      const { error: deleteWantError } = await supabase.from("user_stickers").delete().in("id", wantIdsToRemove);
      if (deleteWantError) throw deleteWantError;
    }

    await loadData();
    onCollectionChange?.();
    setCodeResult(`${countByStickerId.size} cromo${countByStickerId.size === 1 ? "" : "s"} marcado${countByStickerId.size === 1 ? "" : "s"}.`);
  };

  const buildScanReviewEntries = () => {
    const existingHaveByStickerId = new Map(
      userStickers
        .filter((userSticker) => userSticker.user_id === user?.id && userSticker.status === "have")
        .map((userSticker) => [userSticker.sticker_id, userSticker.quantity || 0])
    );

    return scannedCodes.map((item) => ({
      key: item.rawValue,
      rawValues: [item.rawValue],
      sticker: item.sticker,
      count: item.count,
      existingQuantity: item.sticker ? existingHaveByStickerId.get(item.sticker.id) || 0 : 0,
    }));
  };

  const addScannedCodes = async (reviewEntries: ScanReviewEntry[]) => {
    const codes = reviewEntries.flatMap((item) => Array.from({ length: item.count }, () => item.rawValues[0]));
    await markCodes(codes);
    setScanReviewItems(reviewEntries);
    setScanReviewMode("summary");
    clearScannedCodes();
  };

  const confirmScannedCodes = async () => {
    if (scannedCodes.length === 0) {
      setError("Nenhum codigo detectado para adicionar.");
      return;
    }

    setError(null);
    setCodeResult(null);
    setScanReviewItems(buildScanReviewEntries());
    setScanReviewMode("confirm");
  };

  const updateScanReviewQuantity = (key: string, value: number | null) => {
    const count = value === null ? 0 : Math.max(0, Math.min(99, Math.round(value) || 0));
    setScanReviewItems((current) =>
      current.map((item) => item.key === key ? { ...item, count } : item)
    );
  };

  const confirmReviewCodes = async () => {
    const normalizedItems = scanReviewItems.map((item) => ({ ...item, count: Math.max(1, item.count || 0) }));
    setError(null);
    setCodeResult(null);
    setScanConfirming(true);
    try {
      await addScannedCodes(normalizedItems);
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar os codigos detectados.");
    } finally {
      setScanConfirming(false);
    }
  };

  const cancelRepeatedCodes = () => {
    setScanReviewItems([]);
    setScanReviewMode("summary");
  };

  const openManualCode = () => {
    setManualCodeValue("");
    setManualCodeOpen(true);
  };

  const addManualCode = () => {
    const code = getStickerCodesFromOcrText(manualCodeValue)[0] || normalizeOcrCodeText(manualCodeValue);
    const normalized = getStickerCodesFromOcrText(code)[0] || code;
    if (!getStickerCodesFromOcrText(normalized).length && !findStickerForScannedCode(normalized)) {
      setError("Codigo manual invalido. Usa formato como GER 3 ou CUW 15.");
      return;
    }

    setError(null);
    addCodeToScanList(normalized);
    setManualCodeValue("");
    setManualCodeOpen(false);
  };

  const detectedTotal = scannedCodes.reduce((total, item) => total + item.count, 0);
  const scanReviewNew = scanReviewItems.filter((item) => item.sticker && item.existingQuantity === 0);
  const scanReviewRepeated = scanReviewItems.filter((item) => item.sticker && item.existingQuantity > 0);
  const scanReviewUnknown = scanReviewItems.filter((item) => !item.sticker);
  const scanReviewTotal = scanReviewItems.reduce((total, item) => total + item.count, 0);

  useEffect(() => {
    const list = scannerListRef.current;
    if (!list || scannedCodes.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scannedCodes.length, detectedTotal]);

  const handleClose = () => {
    stopCodeScanner();
    onClose?.();
  };

  return (
    <div className={`scanner-page scanner-live-page ${scannedCodes.length > 0 ? "has-detections" : ""}`}>
      <header className="scanner-live-header">
        <div>
          <strong>Scanner</strong>
        </div>
        <button className="scanner-live-close scanner-live-exit" type="button" onClick={handleClose} aria-label="Fechar scanner">
          <X size={28} />
        </button>
      </header>

      <section className="scanner-live-camera">
        <video ref={codeVideoRef} muted playsInline />
        {capturedPreview && (
          <img className="scanner-captured-preview" src={capturedPreview} alt="Captura analisada" />
        )}
        {!codeScanning && <span className="code-scan-empty">Camara desligada</span>}
        {codeScanning && !capturedPreview && <div className="code-scan-line" />}
        {(codeReading || advancedReading) && <span className="code-scan-status">{advancedReading ? "A analisar captura..." : "A ler texto..."}</span>}
        <button className="scanner-help-btn" type="button" onClick={() => setScannerHelpOpen(true)} aria-label="Como usar o scanner">
          <HelpCircle size={24} />
        </button>
      </section>

      <section className="scanner-live-body">
        <label className="scanner-collection-picker scanner-live-picker">
          <span>Colecao</span>
          <select
            value={selectedCollectionId}
            onChange={(event) => handleCollectionFilterChange(event.target.value)}
            disabled={loading || scanConfirming}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </label>

        {error && <p className="scanner-live-message error">{error}</p>}
        {codeResult && <p className="scanner-live-message success">{codeResult}</p>}

        <div className="scanner-live-list" ref={scannerListRef}>
          {scannedCodes.length > 0 && (
            scannedCodes.map((item, index) => {
              const flagCode = getFlagCodeForScannedItem(item);
              const chipTone = index % 3 === 0 ? "green" : index % 3 === 1 ? "blue" : "gold";

              return (
                <button
                  className={`scanner-live-chip ${chipTone}`}
                  type="button"
                  key={item.rawValue}
                  onClick={() => removeScannedCode(item.rawValue)}
                  title="Remover detectada"
                >
                  {flagCode && <img src={getFlagUrl(flagCode)} alt="" loading="lazy" aria-hidden="true" />}
                  <span>
                    {item.rawValue}
                    {item.sticker ? ` - ${getStickerDisplayName(item.sticker)}` : " - Sem correspondencia"}
                    {item.count > 1 ? ` x${item.count}` : ""}
                  </span>
                  <X size={16} />
                </button>
              );
            })
          )}
        </div>

        <div className="scanner-live-actions">
          <button className="scanner-live-capture scanner-live-disabled-option" type="button" onClick={captureCodeFrame} disabled>
            <Camera size={24} /> {codeReading ? "A ler..." : "Capturar e Ler"}
          </button>
          <div className="scanner-live-action-row">
            <button className="scanner-live-advanced" type="button" onClick={captureAdvancedOcr} disabled={!codeScanning || codeReading || advancedReading}>
              <Camera size={22} /> {advancedReading ? "A analisar..." : "Capturar imagem"}
            </button>
            <button className="scanner-live-manual" type="button" onClick={openManualCode}>
              <Plus size={22} /> Manual
            </button>
          </div>
          <button className="scanner-live-add" type="button" onClick={confirmScannedCodes} disabled={scannedCodes.length === 0 || scanConfirming}>
            <Plus size={26} /> {scanConfirming ? "A adicionar..." : `Adicionar (${detectedTotal}) detectadas`}
          </button>
        </div>
      </section>

      {scanReviewItems.length > 0 && (
        <div className="scanner-review-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-review-title">
          <div className="scanner-review-panel">
            {scanReviewNew.length > 0 && (
              <div className="scanner-confetti" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            )}
            <header className="scanner-review-header">
              <div>
                <h3 id="scanner-review-title">{scanReviewMode === "confirm" ? "Confirmar cromos" : "Cromos adicionados"}</h3>
                <p>
                  {scanReviewMode === "confirm"
                    ? (scanReviewRepeated.length > 0
                      ? "Existem repetidos. Confirma os cromos e corrige a quantidade antes de adicionar."
                      : "Confirma os cromos e corrige a quantidade antes de adicionar.")
                    : `${scanReviewTotal} cromo${scanReviewTotal === 1 ? "" : "s"} processado${scanReviewTotal === 1 ? "" : "s"}.`}
                </p>
              </div>
              <button className="scanner-live-close" type="button" onClick={cancelRepeatedCodes} aria-label="Fechar resumo">
                <X size={24} />
              </button>
            </header>

            <div className="scanner-review-grid">
              <ScanReviewSection
                title="Novos"
                emptyText="Nenhum cromo novo nesta leitura."
                items={scanReviewNew}
                tone="new"
                editable={scanReviewMode === "confirm"}
                onQuantityChange={updateScanReviewQuantity}
              />
              <ScanReviewSection
                title="Repetidos"
                emptyText="Nenhum repetido nesta leitura."
                items={scanReviewRepeated}
                tone="repeated"
                editable={scanReviewMode === "confirm"}
                onQuantityChange={updateScanReviewQuantity}
              />
              {scanReviewUnknown.length > 0 && (
                <ScanReviewSection
                  title="Sem correspondencia"
                  emptyText="Todos os codigos foram encontrados."
                  items={scanReviewUnknown}
                  tone="unknown"
                  editable={scanReviewMode === "confirm"}
                  onQuantityChange={updateScanReviewQuantity}
                />
              )}
            </div>

            <div className="scanner-review-actions">
              {scanReviewMode === "confirm" ? (
                <>
                  <button className="btn btn-secondary" type="button" onClick={cancelRepeatedCodes} disabled={scanConfirming}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="button" onClick={confirmReviewCodes} disabled={scanConfirming}>
                    {scanConfirming ? "A adicionar..." : "Confirmar"}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" type="button" onClick={cancelRepeatedCodes}>
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {manualCodeOpen && (
        <div className="scanner-review-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-manual-title">
          <div className="scanner-manual-panel">
            <header className="scanner-review-header">
              <div>
                <h3 id="scanner-manual-title">Adicionar manualmente</h3>
                <p>Escreve o codigo do verso do cromo.</p>
              </div>
              <button className="scanner-live-close" type="button" onClick={() => setManualCodeOpen(false)} aria-label="Fechar adicionar manualmente">
                <X size={24} />
              </button>
            </header>
            <label className="scanner-manual-field">
              <span>Codigo</span>
              <input
                value={manualCodeValue}
                onChange={(event) => setManualCodeValue(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addManualCode();
                }}
                placeholder="Ex: GER 3"
                autoFocus
              />
            </label>
            <div className="scanner-review-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setManualCodeOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={addManualCode}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {scannerHelpOpen && (
        <div className="scanner-help-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-help-title">
          <div className="scanner-help-panel">
            <button className="scanner-live-close scanner-help-close" type="button" onClick={() => setScannerHelpOpen(false)} aria-label="Fechar ajuda">
              <X size={28} />
            </button>
            <h2 id="scanner-help-title">Como usar o Scanner</h2>
            <ol>
              <li>Aponte a camara para o numero no verso da figurinha que deseja escanear.</li>
              <li>Quando estiver pronto, toque em Capturar e Ler.</li>
              <li>A figurinha sera marcada na lista quando for identificada.</li>
              <li>Revise os itens detectados. Toque em uma figurinha detectada para remove-la, se necessario.</li>
              <li>Ao finalizar, toque em Adicionar Detectadas para enviar tudo ao seu album.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScanReviewSection({
  title,
  emptyText,
  items,
  tone,
  editable = false,
  onQuantityChange,
}: {
  title: string;
  emptyText: string;
  items: ScanReviewEntry[];
  tone: "new" | "repeated" | "unknown";
  editable?: boolean;
  onQuantityChange?: (key: string, value: number | null) => void;
}) {
  return (
    <section className={`scanner-review-section ${tone}`}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => {
            const flagCode = getFlagCodeForScannedItem(item);

            return (
              <li key={item.key}>
                <span className="code-scan-chip">{item.rawValues.join(", ")}{item.count > 1 ? ` x${item.count}` : ""}</span>
                <div>
                  <span className="scanner-review-title-row">
                    {flagCode && <img src={getFlagUrl(flagCode)} alt="" loading="lazy" aria-hidden="true" />}
                    <strong>{item.sticker ? getStickerDisplayName(item.sticker) : "Codigo sem correspondencia"}</strong>
                  </span>
                  {item.sticker ? (
                    <small>
                      #{String(item.sticker.number).padStart(3, "0")}
                      {item.existingQuantity > 0
                        ? ` - ja tens ${item.existingQuantity}, fica ${item.existingQuantity + item.count}`
                        : ` - fica ${item.count}`}
                    </small>
                  ) : (
                    <small>Confirma a colecao ou escreve o codigo manualmente.</small>
                  )}
                </div>
                {editable && (
                  <label className="scanner-review-quantity">
                    <span>Qtd</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.count || ""}
                      onFocus={(event) => event.currentTarget.select()}
                      onClick={(event) => event.currentTarget.select()}
                      onBlur={() => {
                        if (!item.count) onQuantityChange?.(item.key, 1);
                      }}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
                        onQuantityChange?.(item.key, digits ? Number(digits) : null);
                      }}
                      aria-label={`Quantidade de ${item.rawValues.join(", ")}`}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
