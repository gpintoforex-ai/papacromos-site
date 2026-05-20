import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getAvatarColor, getAvatarInitial } from "../lib/avatar";
import StickerCard from "../components/StickerCard";
import { Search, Camera, ArrowLeft, X, Mic, ClipboardCheck, Eye, EyeOff, ScanLine, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, CopyPlus, Album, Images, Trophy } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  description: string;
  image_url: string;
  total_stickers: number;
}

interface Sticker {
  id: string;
  number: number;
  name: string;
  image_url: string;
  rarity: string;
  collection_id: string;
}

interface UserSticker {
  id: string;
  user_id: string;
  sticker_id: string;
  status: "have" | "want";
  quantity: number;
  stickers: Sticker;
}

interface UserCollectionPreference {
  collection_id: string;
  is_active: boolean;
}

interface NeededStickerHolder {
  userId: string;
  username: string;
  avatarSeed: string;
  count: number;
  sampleStickers: Sticker[];
}

type FilterMode = "all" | "have" | "repeated" | "want" | "missing";
type VoiceMarkMode = "have" | "want";
type HomeResultMode = "collections" | "owned" | "complete";
type AlbumSlideDirection = "previous" | "next" | null;
type CodeOcrCanvasMode = "normal" | "inverted";

const WORLD_ALBUM_COLLECTION_ID = "b2026000-0000-4000-8000-000000000001";

interface ScannedCodeItem {
  rawValue: string;
  sticker: Sticker | null;
  count: number;
}

interface AlbumTeamPage {
  teamName: string;
  groupName: string;
  flag: string;
  flagCode: string;
  flagUrl: string;
  stickers: Sticker[];
}

const collectionFallbackImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Crect x='92' y='70' width='216' height='260' rx='18' fill='%23ffffff' stroke='%23d1d5db' stroke-width='10'/%3E%3Cpath d='M132 132h136v24H132zm0 58h136v24H132zm0 58h92v24h-92z' fill='%239ca3af'/%3E%3C/svg%3E";

function applyFallbackImage(event: SyntheticEvent<HTMLImageElement>, sticker?: Sticker) {
  event.currentTarget.src = sticker ? getStickerFallbackImage(sticker) : collectionFallbackImage;
  event.currentTarget.classList.add("sticker-fallback-logo");
}

const stickerCodeByTeamNorm: Record<string, string> = {
  MEXICO: "MEX",
  AFRICADOSUL: "RSA",
  REPUBLICADACOREIA: "KOR",
  COREIADOSUL: "KOR",
  TCHEQUIA: "CZE",
  CANADA: "CAN",
  BOSNIAEHERZEGOVINA: "BIH",
  CATAR: "QAT",
  QATAR: "QAT",
  SUICA: "SUI",
  BRASIL: "BRA",
  MARROCOS: "MAR",
  HAITI: "HAI",
  ESCOCIA: "SCO",
  ESTADOSUNIDOS: "USA",
  AUSTRALIA: "AUS",
  PARAGUAI: "PAR",
  TURQUIA: "TUR",
  ALEMANHA: "GER",
  CURACAO: "CUW",
  COSTADOMARFIM: "CIV",
  EQUADOR: "ECU",
  HOLANDA: "NED",
  PAISESBAIXOS: "NED",
  JAPAO: "JPN",
  SUECIA: "SWE",
  TUNISIA: "TUN",
  BELGICA: "BEL",
  EGITO: "EGY",
  RIDOIRA: "IRN",
  NOVAZELANDIA: "NZL",
  ESPANHA: "ESP",
  CABOVERDE: "CPV",
  ARABIASAUDITA: "KSA",
  URUGUAI: "URU",
  FRANCA: "FRA",
  IRAQUE: "IRQ",
  NORUEGA: "NOR",
  SENEGAL: "SEN",
  ARGENTINA: "ARG",
  ARGELIA: "ALG",
  AUSTRIA: "AUT",
  JORDANIA: "JOR",
  PORTUGAL: "POR",
  JAMAICA: "JAM",
  UZBEQUISTAO: "UZB",
  COLOMBIA: "COL",
  INGLATERRA: "ENG",
  CROACIA: "CRO",
  GANA: "GHA",
  PANAMA: "PAN",
  RDDOCONGO: "COD",
  CONGODR: "COD",
};

const knownWorldPlayerNames: Record<string, Record<number, string>> = {
  ALEMANHA: {
    2: "Marc-Andre ter Stegen",
    4: "Felix Nmecha",
    5: "Jonathan Tah",
    7: "Nico Schlotterbeck",
    8: "Antonio Rudiger",
    9: "Leon Goretzka",
    10: "Jamal Musiala",
    12: "Ilkay Gundogan",
    15: "Ridle Baku",
    16: "Maximilian Mittelstadt",
    17: "Joshua Kimmich",
    18: "Leroy Sane",
  },
  BOSNIAEHERZEGOVINA: {
    3: "Sanjin Prcic",
    4: "Caid Hamulic",
    6: "Amar Dedic",
    7: "Sead Kolasinac",
    9: "Haris Hajradinovic",
    11: "Emir Sahitarevic",
    14: "Nicola Vasilj",
    18: "Edin Dzeko",
    19: "Samed Bazdar",
  },
  BRASIL: {
    2: "Joao Pedro",
    3: "Matheus Cunha",
    5: "Wesley",
    6: "Lucas Paqueta",
    7: "Casemiro",
    8: "Gabriel Martinelli",
    9: "Raphinha",
    10: "Estevao",
    12: "Alisson",
    14: "Luiz Henrique",
    16: "Bento",
    17: "Marquinhos",
    19: "Gabriel Magalhaes",
  },
  CURACAO: {
    2: "Kenji Gorre",
    3: "Jearl Margaritha",
    4: "Jurgen Locadia",
    5: "Richon van Eijma",
    6: "Shurandy Sambo",
    7: "Livano Comenencia",
    8: "Clifford Roemeratoe",
    9: "Jeremy Antonisse",
    11: "Chritz Hansen",
    14: "Juninho Bacuna",
    16: "Armando Obispo",
    17: "Sherel Floranus",
    19: "Joshua Brenet",
  },
  EQUADOR: {
    3: "Kendry Paez",
    5: "Gonzalo Valle",
    6: "Piero Hincapie",
    12: "Nilson Angulo",
    15: "Joel Ordonez",
    18: "Alan Minda",
    19: "Kevin Rodriguez",
    20: "Enner Valencia",
  },
  ESCOCIA: {
    2: "Angus Gunn",
    3: "Scott McTominay",
    6: "Jack Hendry",
    7: "Kieran Tierney",
    8: "Aaron Hickey",
    9: "Andrew Robertson",
    10: "Lewis Ferguson",
    14: "Scott McKenna",
    16: "Anthony Ralston",
    19: "Che Adams",
  },
  ESTADOSUNIDOS: {
    4: "Timothy Weah",
    6: "Chris Richards",
    7: "Tim Ream",
    9: "Alex Freeman",
    10: "Diego Luna",
    16: "Malik Tillman",
    17: "Christian Pulisic",
    18: "Brenden Aaronson",
    19: "Antonee Robinson",
  },
  HAITI: {
    2: "Johny Placide",
    3: "Danley Jean Jacques",
    12: "Jose Casimir",
    20: "Frantzdy Pierrot",
  },
  HOLANDA: {
    3: "Justin Kluivert",
    6: "Cody Gakpo",
    7: "Jeremie Frimpong",
    10: "Donyell Malen",
    12: "Virgil van Dijk",
    14: "Micky van de Ven",
    15: "Jurrien Timber",
    16: "Denzel Dumfries",
    17: "Bart Verbruggen",
    18: "Teun Koopmeiners",
    19: "Frenkie de Jong",
    20: "Justin Kluivert",
  },
  MARROCOS: {
    2: "Youssef En-Nesyri",
    4: "Romain Saiss",
    6: "Adam Masina",
    8: "Soufiane Rahimi",
    10: "Ayoub El Kaabi",
    11: "Yassine Bounou",
    18: "Noussair Mazraoui",
  },
  MEXICO: {
    6: "Jorge Sanchez",
    8: "Jesus Gallardo",
    10: "Hirving Lozano",
    11: "Santiago Gimenez",
    12: "Jesus Gallardo",
    14: "Raul Reyes",
    20: "Alexis Vega",
  },
  PARAGUAI: {
    6: "Orlando Gill",
    10: "Gerardo Gill",
    11: "Gustavo Gomez",
    14: "Juan Jose Caceres",
    15: "Matias Galarza Fonda",
    16: "Julio Enciso",
    17: "Alejandro Romero Gamarra",
    19: "Omar Alderete",
    20: "Junior Alonso",
  },
  QATAR: {
    7: "Pedro Miguel",
    9: "Mohamed Mannai",
    10: "Assim Madibo",
    11: "Akram Afif",
    18: "Akram Hassan Afif",
    20: "Ahmed Alaaeldin",
  },
  REPUBLICADACOREIA: {
    8: "Seung-ho Paik",
    15: "Tae-seok Lee",
    17: "Heung-min Son",
    20: "Hwang Hee-chan",
  },
  SUICA: {
    17: "Denis Zakaria",
    18: "Ruben Vargas",
  },
  TCHEQUIA: {
    2: "Matej Kovar",
    3: "Tomas Chory",
    6: "Ladislav Krejci",
    9: "Pavel Sulc",
    11: "Adam Hlozek",
    15: "David Zima",
    16: "Michal Sadilek",
    17: "Lukas Provod",
    18: "Lukas Cerv",
  },
  TURQUIA: {
    2: "Ugurcan Cakir",
    6: "Mert Muldur",
    8: "Abdulkerim Bardakci",
    10: "Irfan Can Kahveci",
    11: "Yunus Akgun",
    12: "Can Uzun",
    14: "Merih Demiral",
    15: "Ferdi Kadioglu",
    16: "Kaan Ayhan",
    17: "Ismail Yuksek",
    19: "Kerem Akturkoglu",
    20: "Kenan Yildiz",
  },
};

function getKnownWorldPlayerName(sticker: Sticker) {
  const teamName = getStickerEffectiveTeamName(sticker);
  const localNumber = getAlbumLocalNumber(sticker);
  return knownWorldPlayerNames[normalizeAbbrev(teamName)]?.[localNumber] || "";
}

function getStickerDisplayName(sticker: Sticker) {
  const teamName = getStickerEffectiveTeamName(sticker);
  const localNumber = getAlbumLocalNumber(sticker);
  if (localNumber === 1) return `${teamName} - Escudo`;
  if (localNumber === 13) return `${teamName} - Foto de equipa`;

  const knownName = getKnownWorldPlayerName(sticker);
  if (!knownName) {
    const detail = sticker.name.includes(" - ") ? sticker.name.split(" - ").slice(1).join(" - ").trim() : sticker.name;
    return `${teamName} - ${detail}`;
  }
  return `${teamName} - ${knownName}`;
}

function normalizeSearchText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getStickerSearchText(sticker: Sticker) {
  const teamName = getStickerEffectiveTeamName(sticker);
  const localNumber = getAlbumLocalNumber(sticker);
  const displayName = getStickerDisplayName(sticker);
  const detail = displayName.includes(" - ") ? displayName.split(" - ").slice(1).join(" - ").trim() : displayName;
  const searchParts = [teamName, String(localNumber), String(sticker.number).padStart(3, "0")];

  if (localNumber === 1 || localNumber === 13 || !/^Jogador\s+\d+$/i.test(detail)) {
    searchParts.push(detail, displayName);
  }

  return normalizeSearchText(searchParts.join(" "));
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitSvgText(value: string, maxLength: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  words.forEach((word) => {
    const current = lines[lines.length - 1] || "";
    if (!current) {
      lines.push(word);
      return;
    }

    if (`${current} ${word}`.length <= maxLength) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < 2) {
      lines.push(word);
    }
  });

  if (lines.length === 0) return [value.slice(0, maxLength)];
  if (lines.length > 2) lines.length = 2;
  return lines.map((line) => (line.length > maxLength + 3 ? `${line.slice(0, maxLength)}...` : line));
}

function getStickerFallbackImage(sticker: Sticker) {
  const teamName = getStickerEffectiveTeamName(sticker);
  const localNumber = getAlbumLocalNumber(sticker);
  const teamNorm = normalizeAbbrev(teamName);
  const teamCode = stickerCodeByTeamNorm[teamNorm];
  const codeLabel = teamCode ? `${teamCode} ${localNumber}` : `#${String(sticker.number).padStart(3, "0")}`;
  const knownName = getKnownWorldPlayerName(sticker);
  const detail = knownName || (sticker.name.includes(" - ") ? sticker.name.split(" - ").slice(1).join(" - ").trim() : sticker.name);
  const titleLines = splitSvgText(teamName === "Cromos" ? sticker.name : teamName, 17);
  const detailLines = splitSvgText(detail || "Cromo", 18);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f8fafc"/>
          <stop offset="1" stop-color="#e5e7eb"/>
        </linearGradient>
      </defs>
      <rect width="360" height="480" fill="#f3f4f6"/>
      <rect x="28" y="24" width="304" height="432" rx="24" fill="url(#bg)" stroke="#d1d5db" stroke-width="8"/>
      <rect x="52" y="52" width="256" height="58" rx="18" fill="#111827"/>
      <text x="180" y="91" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" fill="#ffffff">${escapeSvgText(codeLabel)}</text>
      <rect x="82" y="144" width="196" height="180" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="8"/>
      <path d="M132 216h96v22h-96zm0 52h96v22h-96z" fill="#94a3b8"/>
      <circle cx="180" cy="180" r="24" fill="#94a3b8"/>
      <path d="M138 302c9-34 26-50 42-50s33 16 42 50" fill="#94a3b8"/>
      <text x="180" y="366" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#0f172a">${escapeSvgText(titleLines[0] || "")}</text>
      ${titleLines[1] ? `<text x="180" y="398" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#0f172a">${escapeSvgText(titleLines[1])}</text>` : ""}
      <text x="180" y="${titleLines[1] ? 428 : 408}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="#475569">${escapeSvgText(detailLines[0] || "Sem imagem")}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getStickerPreviewImageUrl(imageUrl: string) {
  const match = imageUrl.match(/^\/stickers\/([^/]+)\/([^/.]+)\.(png|jpe?g|webp)$/i);
  if (!match) return "";
  return `/sticker-previews/${match[1]}/${match[2]}.jpg`;
}

function isGenericSeedStickerImage(imageUrl: string) {
  return imageUrl.startsWith("https://images.pexels.com/");
}

function getStickerImageSource(sticker: Sticker) {
  if (!sticker.image_url) return getStickerFallbackImage(sticker);
  if (sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && isGenericSeedStickerImage(sticker.image_url)) {
    return getStickerFallbackImage(sticker);
  }
  return getStickerPreviewImageUrl(sticker.image_url) || sticker.image_url;
}

const teamFlags: Record<string, string> = {
  Portugal: "🇵🇹",
  Brasil: "🇧🇷",
  Argentina: "🇦🇷",
  Franca: "🇫🇷",
  França: "🇫🇷",
  Espanha: "🇪🇸",
  Alemanha: "🇩🇪",
  Inglaterra: "🏴",
  Italia: "🇮🇹",
  Holanda: "🇳🇱",
  "Paises Baixos": "🇳🇱",
  Belgica: "🇧🇪",
  Bélgica: "🇧🇪",
  Croacia: "🇭🇷",
  Croácia: "🇭🇷",
  Uruguai: "🇺🇾",
  Mexico: "🇲🇽",
  México: "🇲🇽",
  "Estados Unidos": "🇺🇸",
  Japao: "🇯🇵",
  Japão: "🇯🇵",
  Marrocos: "🇲🇦",
  Canada: "🇨🇦",
  Canadá: "🇨🇦",
  Suica: "🇨🇭",
  Suíça: "🇨🇭",
  Turquia: "🇹🇷",
  Senegal: "🇸🇳",
  Argelia: "🇩🇿",
  Argélia: "🇩🇿",
  "Congo DR": "🇨🇩",
  "RD do Congo": "🇨🇩",
  Jamaica: "🇯🇲",
  "Coreia do Sul": "🇰🇷",
  "República da Coreia": "🇰🇷",
  Australia: "🇦🇺",
  Austrália: "🇦🇺",
  Dinamarca: "🇩🇰",
  Suecia: "🇸🇪",
  Suécia: "🇸🇪",
  Noruega: "🇳🇴",
  Colombia: "🇨🇴",
  Colômbia: "🇨🇴",
  Equador: "🇪🇨",
  Paraguai: "🇵🇾",
  Panama: "🇵🇦",
  Panamá: "🇵🇦",
  Egito: "🇪🇬",
  Gana: "🇬🇭",
  Tunisia: "🇹🇳",
  Tunísia: "🇹🇳",
  "Africa do Sul": "🇿🇦",
  "África do Sul": "🇿🇦",
  "Arabia Saudita": "🇸🇦",
  "Arábia Saudita": "🇸🇦",
  Iraque: "🇮🇶",
  Qatar: "🇶🇦",
  Catar: "🇶🇦",
  "Nova Zelandia": "🇳🇿",
  "Nova Zelândia": "🇳🇿",
  "Bósnia e Herzegovina": "🇧🇦",
  Tchéquia: "🇨🇿",
  Haiti: "🇭🇹",
  Escócia: "🏴",
  Curaçau: "🇨🇼",
  "Costa do Marfim": "🇨🇮",
  "RI do Irã": "🇮🇷",
  "Cabo Verde": "🇨🇻",
  Áustria: "🇦🇹",
  Jordânia: "🇯🇴",
  Uzbequistão: "🇺🇿",
};

const flagCodeByTeam: Record<string, string> = {
  Portugal: "pt",
  Brasil: "br",
  Argentina: "ar",
  Franca: "fr",
  França: "fr",
  Espanha: "es",
  Alemanha: "de",
  Inglaterra: "gb-eng",
  Italia: "it",
  Holanda: "nl",
  "Paises Baixos": "nl",
  Belgica: "be",
  Bélgica: "be",
  Croacia: "hr",
  Croácia: "hr",
  Uruguai: "uy",
  Mexico: "mx",
  México: "mx",
  "Estados Unidos": "us",
  Japao: "jp",
  Japão: "jp",
  Marrocos: "ma",
  Canada: "ca",
  Canadá: "ca",
  Suica: "ch",
  Suíça: "ch",
  Turquia: "tr",
  Senegal: "sn",
  Argelia: "dz",
  Argélia: "dz",
  "Congo DR": "cd",
  "RD do Congo": "cd",
  Jamaica: "jm",
  "Coreia do Sul": "kr",
  "República da Coreia": "kr",
  Australia: "au",
  Austrália: "au",
  Dinamarca: "dk",
  Suecia: "se",
  Suécia: "se",
  Noruega: "no",
  Colombia: "co",
  Colômbia: "co",
  Equador: "ec",
  Paraguai: "py",
  Panama: "pa",
  Panamá: "pa",
  Egito: "eg",
  Gana: "gh",
  Tunisia: "tn",
  Tunísia: "tn",
  "Africa do Sul": "za",
  "África do Sul": "za",
  "Arabia Saudita": "sa",
  "Arábia Saudita": "sa",
  Iraque: "iq",
  Qatar: "qa",
  Catar: "qa",
  "Nova Zelandia": "nz",
  "Nova Zelândia": "nz",
  "Bósnia e Herzegovina": "ba",
  Tchéquia: "cz",
  Haiti: "ht",
  Escócia: "gb-sct",
  Curaçau: "cw",
  "Costa do Marfim": "ci",
  "RI do Irã": "ir",
  "Cabo Verde": "cv",
  Áustria: "at",
  Jordânia: "jo",
  Uzbequistão: "uz",
};

const groupByTeam: Record<string, string> = {
  México: "Grupo A",
  Mexico: "Grupo A",
  "África do Sul": "Grupo A",
  "Africa do Sul": "Grupo A",
  "República da Coreia": "Grupo A",
  "Coreia do Sul": "Grupo A",
  Tchéquia: "Grupo A",
  Canadá: "Grupo B",
  Canada: "Grupo B",
  "Bósnia e Herzegovina": "Grupo B",
  Catar: "Grupo B",
  Qatar: "Grupo B",
  Suíça: "Grupo B",
  Suica: "Grupo B",
  Brasil: "Grupo C",
  Marrocos: "Grupo C",
  Haiti: "Grupo C",
  Escócia: "Grupo C",
  "Estados Unidos": "Grupo D",
  Austrália: "Grupo D",
  Australia: "Grupo D",
  Paraguai: "Grupo D",
  Turquia: "Grupo D",
  Dinamarca: "Grupo D",
  Alemanha: "Grupo E",
  Curaçau: "Grupo E",
  "Costa do Marfim": "Grupo E",
  Equador: "Grupo E",
  Holanda: "Grupo F",
  "Paises Baixos": "Grupo F",
  Japão: "Grupo F",
  Japao: "Grupo F",
  Suécia: "Grupo F",
  Suecia: "Grupo F",
  Tunísia: "Grupo F",
  Tunisia: "Grupo F",
  Bélgica: "Grupo G",
  Belgica: "Grupo G",
  Egito: "Grupo G",
  "RI do Irã": "Grupo G",
  "Nova Zelândia": "Grupo G",
  "Nova Zelandia": "Grupo G",
  Espanha: "Grupo H",
  "Cabo Verde": "Grupo H",
  "Arábia Saudita": "Grupo H",
  "Arabia Saudita": "Grupo H",
  Uruguai: "Grupo H",
  França: "Grupo I",
  Franca: "Grupo I",
  Iraque: "Grupo I",
  Noruega: "Grupo I",
  Senegal: "Grupo I",
  Argentina: "Grupo J",
  Argélia: "Grupo J",
  Argelia: "Grupo J",
  Áustria: "Grupo J",
  Jordânia: "Grupo J",
  Portugal: "Grupo K",
  "RD do Congo": "Grupo K",
  "Congo DR": "Grupo K",
  Uzbequistão: "Grupo K",
  Colômbia: "Grupo K",
  Colombia: "Grupo K",
  Inglaterra: "Grupo L",
  Croácia: "Grupo L",
  Croacia: "Grupo L",
  Gana: "Grupo L",
  Panamá: "Grupo L",
  Panama: "Grupo L",
};

function getStickerTeamName(stickerName: string) {
  return stickerName.includes(" - ") ? stickerName.split(" - ")[0].trim() : "Cromos";
}

function getAlbumTeamOrder(sticker: Sticker) {
  return Math.floor((sticker.number - 1) / 20) + 1;
}

function getStickerEffectiveTeamName(sticker: Sticker) {
  if (sticker.collection_id === WORLD_ALBUM_COLLECTION_ID && getAlbumTeamOrder(sticker) === 42) {
    return "RD do Congo";
  }

  return getStickerTeamName(sticker.name);
}

function getAlbumLocalNumber(sticker: Sticker) {
  const slot = ((sticker.number - 1) % 20) + 1;
  if (sticker.name.includes("Escudo")) return 1;
  if (sticker.name.includes("Foto de equipa")) return 13;
  return slot;
}

function normalizeAbbrev(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

const abbrevToTeam: Record<string, string> = {
  AFS: "Africa do Sul",
  ALG: "Argélia",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgica",
  BIH: "Bosnia e Herzegovina",
  POR: "Portugal",
  BRA: "Brasil",
  BRAZ: "Brasil",
  CAN: "Canada",
  CPV: "Cabo Verde",
  SWE: "Suécia",
  SUE: "Suécia",
  SUI: "Suica",
  CHE: "Suica",
  CIV: "Costa do Marfim",
  COL: "Colombia",
  CRO: "Croacia",
  CUW: "Curacao",
  CZE: "Tchequia",
  MEX: "Mexico",
  ARG: "Argentina",
  ENG: "Inglaterra",
  EGY: "Egito",
  ESP: "Espanha",
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
  NED: "Holanda",
  NLD: "Holanda",
  NOR: "Noruega",
  PAN: "Panama",
  PAR: "Paraguai",
  QAT: "Catar",
  RSA: "Africa do Sul",
  SAU: "Arabia Saudita",
  TUR: "Turquia",
  URU: "Uruguai",
  ZAF: "Africa do Sul",
  FRA: "Franca",
  GER: "Alemanha",
  DEU: "Alemanha",
  GHA: "Gana",
  COD: "RD do Congo",
  DRC: "RD do Congo",
  USA: "Estados Unidos",
  EUS: "Estados Unidos",
  NZL: "Nova Zelândia",
  SEN: "Senegal",
  SCO: "Escócia",
  ECU: "Equador",
  UZB: "Uzbequistão",
  TUN: "Tunísia",
};

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
  // allow small typos (distance <= 1)
  const dist = levenshtein(abbrev.slice(0, 4), teamNameNorm.slice(0, 4));
  return dist <= 1;
}

function buildAlbumTeamPages(stickers: Sticker[]): AlbumTeamPage[] {
  const teams = new Map<string, Sticker[]>();
  stickers.forEach((sticker) => {
    const teamName = getStickerEffectiveTeamName(sticker);
    teams.set(teamName, [...(teams.get(teamName) || []), sticker]);
  });

  return Array.from(teams.entries()).map(([teamName, teamStickers], index) => ({
    teamName,
    groupName: groupByTeam[teamName] || `Grupo ${String.fromCharCode(65 + Math.floor(index / 4))}`,
    flag: teamFlags[teamName] || "🏳️",
    flagCode: flagCodeByTeam[teamName] || "",
    flagUrl: flagCodeByTeam[teamName] ? `https://flagcdn.com/w160/${flagCodeByTeam[teamName]}.png` : "",
    stickers: teamStickers.sort((a, b) => getAlbumLocalNumber(a) - getAlbumLocalNumber(b)),
  }));
}

const DATA_PAGE_SIZE = 1000;
const QUERY_CHUNK_SIZE = 80;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchAllStickers() {
  const allStickers: Sticker[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("stickers")
      .select("*")
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
      .select("id, user_id, sticker_id, status, quantity, stickers(*)")
      .eq("user_id", userId)
      .range(from, from + DATA_PAGE_SIZE - 1);

    if (error) throw error;
    allUserStickers.push(...((data || []) as unknown as UserSticker[]));

    if (!data || data.length < DATA_PAGE_SIZE) break;
    from += DATA_PAGE_SIZE;
  }

  return allUserStickers;
}

async function fetchNeededStickerHolders(userId: string, missingStickers: Sticker[]) {
  if (missingStickers.length === 0) return [];

  const stickerById = new Map(missingStickers.map((sticker) => [sticker.id, sticker]));
  const holders = new Map<string, Set<string>>();

  for (const stickerIdChunk of chunkArray(Array.from(stickerById.keys()), QUERY_CHUNK_SIZE)) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("user_stickers")
        .select("user_id, sticker_id")
        .eq("status", "have")
        .gt("quantity", 1)
        .neq("user_id", userId)
        .in("sticker_id", stickerIdChunk)
        .range(from, from + DATA_PAGE_SIZE - 1);

      if (error) throw error;

      (data || []).forEach((row) => {
        const existing = holders.get(row.user_id) || new Set<string>();
        existing.add(row.sticker_id);
        holders.set(row.user_id, existing);
      });

      if (!data || data.length < DATA_PAGE_SIZE) break;
      from += DATA_PAGE_SIZE;
    }
  }

  const rankedHolders = Array.from(holders.entries())
    .map(([holderUserId, stickerIds]) => ({
      userId: holderUserId,
      stickerIds: Array.from(stickerIds),
      count: stickerIds.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  if (rankedHolders.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, username, avatar_seed")
    .in("id", rankedHolders.map((holder) => holder.userId));

  if (profilesError) throw profilesError;

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return rankedHolders.map((holder): NeededStickerHolder => {
    const profile = profilesById.get(holder.userId);

    return {
      userId: holder.userId,
      username: profile?.username || "Colecionador",
      avatarSeed: profile?.avatar_seed || holder.userId,
      count: holder.count,
      sampleStickers: holder.stickerIds
        .map((stickerId) => stickerById.get(stickerId))
        .filter((sticker): sticker is Sticker => Boolean(sticker))
        .slice(0, 3),
    };
  });
}

function CollectionHomeCarousel({
  itemCount,
  emptyText,
  children,
}: {
  itemCount: number;
  emptyText: string;
  children: ReactNode;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || itemCount === 0) {
      setCanScroll(false);
      return;
    }

    const updateCanScroll = () => {
      setCanScroll(strip.scrollWidth > strip.clientWidth + 4);
    };

    updateCanScroll();
    window.addEventListener("resize", updateCanScroll);

    return () => window.removeEventListener("resize", updateCanScroll);
  }, [itemCount]);

  const scrollCarousel = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;

    strip.scrollBy({
      left: direction * Math.max(160, strip.clientWidth * 0.85),
      behavior: "smooth",
    });
  };

  if (itemCount === 0) {
    return <p className="muted-text collection-home-empty">{emptyText}</p>;
  }

  return (
    <div className="collection-home-carousel">
      {canScroll && (
        <button className="collection-carousel-btn prev" type="button" onClick={() => scrollCarousel(-1)} title="Anterior">
          <ChevronLeft size={18} />
        </button>
      )}
      <div className="collection-home-strip" ref={stripRef}>
        {children}
      </div>
      {canScroll && (
        <button className="collection-carousel-btn next" type="button" onClick={() => scrollCarousel(1)} title="Seguinte">
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

interface CollectionPageProps {
  homeKey: number;
  onCollectionChange?: () => void;
  onOpenSharedUser?: (userId: string) => void;
}

export default function CollectionPage({ homeKey, onCollectionChange, onOpenSharedUser }: CollectionPageProps) {
  const { user, profile } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionPreferences, setCollectionPreferences] = useState<UserCollectionPreference[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [selectedAlbumTeamName, setSelectedAlbumTeamName] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMarkMode>("have");
  const [voiceText, setVoiceText] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState<string | null>(null);
  const [homeResultMode, setHomeResultMode] = useState<HomeResultMode>("collections");
  const [neededStickerHolders, setNeededStickerHolders] = useState<NeededStickerHolder[]>([]);
  const [neededStickerHoldersLoading, setNeededStickerHoldersLoading] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [codeScanning, setCodeScanning] = useState(false);
  const [codeReading, setCodeReading] = useState(false);
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const [scannedCodes, setScannedCodes] = useState<ScannedCodeItem[]>([]);
  const [albumSlideDirection, setAlbumSlideDirection] = useState<AlbumSlideDirection>(null);
  const [collectionOnboardingOpen, setCollectionOnboardingOpen] = useState(false);
  const [collectionOnboardingSelection, setCollectionOnboardingSelection] = useState<string[]>([]);
  const [collectionOnboardingSaving, setCollectionOnboardingSaving] = useState(false);
  const collectionsSectionRef = useRef<HTMLElement | null>(null);
  const codeVideoRef = useRef<HTMLVideoElement | null>(null);
  const codeStreamRef = useRef<MediaStream | null>(null);
  const codeOcrTimerRef = useRef<number | null>(null);
  const codeOcrBusyRef = useRef(false);
  const codeOcrWorkerRef = useRef<any | null>(null);
  const codeLastSeenAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user?.id]);

  useEffect(() => {
    setSelectedCollectionId(null);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(null);
    setSelectedAlbumTeamName(null);
    loadData();
  }, [homeKey]);

  useEffect(() => {
    if (!selectedCollectionId || !user?.id || stickers.length === 0) return;
    syncWantedForCollection(selectedCollectionId);
  }, [selectedCollectionId, stickers.length, userStickers.length, user?.id]);

  useEffect(() => {
    if (!selectedCollectionId) return;
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!selectedStickerId) return;

    const timeoutId = window.setTimeout(() => {
      const card = document.querySelector(`[data-sticker-id="${selectedStickerId}"]`);
      card?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedStickerId, userStickers]);

  useEffect(() => {
    return () => stopCodeScanner();
  }, []);

  useEffect(() => {
    if (codePanelOpen) {
      startCodeScanner();
    } else {
      stopCodeScanner();
    }
  }, [codePanelOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setCollections([]);
        setCollectionPreferences([]);
        setStickers([]);
        setUserStickers([]);
        setNeededStickerHolders([]);
        return;
      }

      const [collectionsRes, preferencesRes, allStickers, allUserStickers] = await Promise.all([
        supabase.from("collections").select("*").order("created_at", { ascending: false }),
        supabase.from("user_collection_preferences").select("collection_id, is_active").eq("user_id", user.id),
        fetchAllStickers(),
        fetchUserStickers(user.id),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (preferencesRes.error) throw preferencesRes.error;

      const loadedCollections = (collectionsRes.data || []) as Collection[];
      const loadedPreferences = (preferencesRes.data || []) as UserCollectionPreference[];
      setCollections(loadedCollections);
      setCollectionPreferences(loadedPreferences);
      setStickers(allStickers);
      setUserStickers(allUserStickers.filter((userSticker) => userSticker.user_id === user.id));

      const onboardingKey = `papacromos:collection-onboarding:${user.id}`;
      if (loadedCollections.length > 0 && loadedPreferences.length === 0 && !localStorage.getItem(onboardingKey)) {
        setCollectionOnboardingSelection(loadedCollections.map((collection) => collection.id));
        setCollectionOnboardingOpen(true);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar caderneta.");
    } finally {
      setLoading(false);
    }
  };

  const getUserSticker = (stickerId: string) => {
    return userStickers.find((us) => us.user_id === user?.id && us.sticker_id === stickerId && us.status === "have" && (us.quantity || 0) > 0);
  };

  const hasUserStickerStatus = (stickerId: string, status: "have" | "want") => {
    return userStickers.some((us) =>
      us.user_id === user?.id &&
      us.sticker_id === stickerId &&
      us.status === status &&
      (status === "want" || (us.quantity || 0) > 0)
    );
  };

  const addSticker = async (stickerId: string, status: "have" | "want") => {
    setError(null);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");

      const existing = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === status);
      if (existing) {
        const { error: updateError } = await supabase
          .from("user_stickers")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_stickers").upsert({
          user_id: user.id,
          sticker_id: stickerId,
          status,
          quantity: 1,
        }, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
        });
        if (insertError) throw insertError;
      }

      if (status === "have") {
        const existingWant = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === "want");
        if (existingWant) {
          const { error: deleteWantError } = await supabase.from("user_stickers").delete().eq("id", existingWant.id);
          if (deleteWantError) throw deleteWantError;
        }
      }
      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar cromo.");
    }
  };

  const ensureWantSticker = async (stickerId: string) => {
    if (!user?.id) return;
    const existingWant = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === "want");
    if (existingWant) return;

    const { error: insertError } = await supabase.from("user_stickers").upsert({
      user_id: user.id,
      sticker_id: stickerId,
      status: "want",
      quantity: 1,
    }, {
      onConflict: "user_id,sticker_id,status",
      ignoreDuplicates: true,
    });
    if (insertError) throw insertError;
  };

  const syncWantedForCollection = async (collectionId: string) => {
    if (!user?.id) return;

    const collectionStickers = stickers.filter((sticker) => sticker.collection_id === collectionId);
    if (collectionStickers.length === 0) return;

    const haveIds = new Set(
      userStickers
        .filter((us) => us.user_id === user.id && us.status === "have")
        .map((us) => us.sticker_id)
    );
    const wantIds = new Set(
      userStickers
        .filter((us) => us.user_id === user.id && us.status === "want")
        .map((us) => us.sticker_id)
    );

    const wantsToCreate = collectionStickers
      .filter((sticker) => !haveIds.has(sticker.id) && !wantIds.has(sticker.id))
      .map((sticker) => ({
        user_id: user.id,
        sticker_id: sticker.id,
        status: "want",
        quantity: 1,
      }));

    const wantsToRemove = userStickers.filter(
      (us) => us.user_id === user.id && us.status === "want" && haveIds.has(us.sticker_id)
    );

    if (wantsToCreate.length === 0 && wantsToRemove.length === 0) return;

    try {
      if (wantsToCreate.length > 0) {
        const { error: insertError } = await supabase.from("user_stickers").upsert(wantsToCreate, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
        });
        if (insertError) throw insertError;
      }

      if (wantsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_stickers")
          .delete()
          .in("id", wantsToRemove.map((want) => want.id));
        if (deleteError) throw deleteError;
      }

      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao sincronizar cromos em falta.");
    }
  };

  const removeSticker = async (userStickerId: string) => {
    const userSticker = userStickers.find((us) => us.user_id === user?.id && us.id === userStickerId);
    const { error: deleteError } = await supabase.from("user_stickers").delete().eq("id", userStickerId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (userSticker?.status === "have") {
      await ensureWantSticker(userSticker.sticker_id);
    }
    await loadData();
    onCollectionChange?.();
  };

  const addQuantity = async (userStickerId: string) => {
    setError(null);
    try {
      const us = userStickers.find((u) => u.user_id === user?.id && u.id === userStickerId);
      if (us) {
        const { error: updateError } = await supabase
          .from("user_stickers")
          .update({ quantity: us.quantity + 1 })
          .eq("id", userStickerId);
        if (updateError) throw updateError;
        await loadData();
        onCollectionChange?.();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar quantidade.");
    }
  };

  const reduceQuantity = async (userStickerId: string) => {
    setError(null);
    try {
      const us = userStickers.find((u) => u.user_id === user?.id && u.id === userStickerId);
      if (us) {
        if (us.quantity <= 1) {
          await removeSticker(userStickerId);
        } else {
          const { error: updateError } = await supabase
            .from("user_stickers")
            .update({ quantity: us.quantity - 1 })
            .eq("id", userStickerId);
          if (updateError) throw updateError;
          await loadData();
          onCollectionChange?.();
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar quantidade.");
    }
  };

  const showHomeCollections = () => {
    setHomeResultMode("collections");
    window.setTimeout(() => {
      collectionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const getStickerBySpokenNumber = (number: number) => {
    const collectionStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
    if (isWorldAlbum && selectedAlbumTeamName && number >= 1 && number <= 20) {
      const teamSticker = collectionStickers.find(
        (sticker) => getStickerEffectiveTeamName(sticker) === selectedAlbumTeamName && getAlbumLocalNumber(sticker) === number
      );
      if (teamSticker) return teamSticker;
    }

    return collectionStickers.find((sticker) => sticker.number === number) || null;
  };

  const parseSpokenStickerCounts = (text: string) => {
    const counts = new Map<number, number>();
    const matches = text.match(/\d+/g) || [];

    matches.forEach((match) => {
      const number = Number.parseInt(match, 10);
      if (!Number.isFinite(number) || number <= 0) return;
      counts.set(number, (counts.get(number) || 0) + 1);
    });

    return counts;
  };

  const getCodeNumberCandidates = (text: string) => {
    const candidates = new Set<number>();
    const matches = text.match(/\d+/g) || [];

    matches.forEach((match) => {
      const clean = match.replace(/^0+(?=\d)/, "");
      const fullNumber = Number.parseInt(clean, 10);
      if (Number.isFinite(fullNumber) && fullNumber > 0) candidates.add(fullNumber);

      [1, 2, 3, 4].forEach((size) => {
        if (clean.length <= size) return;
        const suffixNumber = Number.parseInt(clean.slice(-size), 10);
        if (Number.isFinite(suffixNumber) && suffixNumber > 0) candidates.add(suffixNumber);
      });
    });

    return candidates;
  };

  const normalizeOcrCodeText = (text: string) => {
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
  };

  const getStickerCodesFromOcrText = (text: string) => {
    const normalizedText = normalizeOcrCodeText(text)
      .replace(/\b([A-Z]{3})\s*[IL|]\s*[B8]\b/g, "$1 18")
      .replace(/\b([A-Z]{3})\s*[IL|][ZT]\b/g, "$1 17")
      .replace(/\b([A-Z]{3})\s*[IL|]\s*([0-9])\b/g, "$1 1$2")
      .replace(/\b([A-Z]{3})\s*([0-9])\s*[B8]\b/g, "$1 $28")
      .replace(/\b([A-Z]{3})([0-9]{1,2})\b/g, "$1 $2");
    const codes: string[] = [];
    const re = /\b([A-Z0-9]{2,4})\s*[-_/]?\s*([0-9]{1,2})\b/g;

    for (const match of normalizedText.matchAll(re)) {
      const abbrev = normalizeAbbrev(match[1]);
      const number = Number.parseInt(match[2], 10);
      if (!Number.isFinite(number) || number < 1 || number > 20) continue;
      if (!abbrevToTeam[abbrev]) continue;
      codes.push(`${abbrev} ${number}`);
    }

    return Array.from(new Set(codes));
  };

  const markStickerNumbersFromText = async (
    text: string,
    mode: VoiceMarkMode,
    setResult: (message: string | null) => void,
    options?: { codeMode?: boolean; selectFirstMatch?: boolean }
  ) => {
    setError(null);
    setResult(null);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
      if (!selectedCollectionId) throw new Error("Abre uma colecao primeiro.");

      const spokenCounts = options?.codeMode ? new Map<number, number>() : parseSpokenStickerCounts(text);
      const parsedText = options?.codeMode ? normalizeOcrCodeText(text) : text;

      // Additional parsing for code-mode: detect patterns like "ALG 7" or "ALG-07"
      const explicitStickerMatches: Map<string, number> = new Map();
      if (options?.codeMode) {
        const collectionStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
        // match letter+number combos
        const re = /([A-Za-z]{1,4})\s*[-_\\/]?\s*0*([1-9][0-9]?)/g;
        for (const m of parsedText.matchAll(re)) {
          const abbrev = normalizeAbbrev(m[1]);
          const num = Number.parseInt(m[2], 10);
          if (!Number.isFinite(num)) continue;

          let found: Sticker | undefined;
          const mappedTeam = abbrevToTeam[abbrev];
          if (mappedTeam) {
            found = collectionStickers.find((st) => normalizeAbbrev(getStickerEffectiveTeamName(st)) === normalizeAbbrev(mappedTeam) && getAlbumLocalNumber(st) === num);
          }

          if (!found) {
            // try to find sticker by matching start/include/fuzzy of normalized team name
            found = collectionStickers.find((st) => isSimilarAbbrev(abbrev, normalizeAbbrev(getStickerEffectiveTeamName(st))) && getAlbumLocalNumber(st) === num);
          }

          if (found) {
            explicitStickerMatches.set(found.id, (explicitStickerMatches.get(found.id) || 0) + 1);
          }
        }

        // numeric candidates from free text (fallback), excluding the digits already
        // consumed by explicit team codes such as "POR-13".
        const numericFallbackText = parsedText.replace(re, " ");
        getCodeNumberCandidates(numericFallbackText).forEach((number) => {
          if (!spokenCounts.has(number)) spokenCounts.set(number, 1);
        });
      }

      if (spokenCounts.size === 0 && explicitStickerMatches.size === 0) {
        throw new Error("Nao encontrei numeros de cromos no texto.");
      }

      const matchedFromNumbers = Array.from(spokenCounts.entries())
        .map(([number, count]) => ({ number, count, sticker: getStickerBySpokenNumber(number) }))
        .filter((item): item is { number: number; count: number; sticker: Sticker } => Boolean(item.sticker));

      const matchedFromExplicit = Array.from(explicitStickerMatches.entries()).map(([stickerId, count]) => ({
        number: NaN,
        count,
        sticker: stickers.find((s) => s.id === stickerId) as Sticker,
      }));

      const matchedByStickerId = new Map<string, { number: number; count: number; sticker: Sticker }>();
      [...matchedFromNumbers, ...matchedFromExplicit].forEach((item) => {
        const existing = matchedByStickerId.get(item.sticker.id);
        if (existing) {
          existing.count += item.count;
          if (Number.isNaN(existing.number)) existing.number = item.number;
          return;
        }
        matchedByStickerId.set(item.sticker.id, { ...item });
      });
      const matched = Array.from(matchedByStickerId.values());
      const missingNumbers = Array.from(spokenCounts.keys())
        .filter((number) => !matched.some((item) => item.number === number));

      if (matched.length === 0) {
        throw new Error("Nenhum dos numeros indicados pertence a esta caderneta.");
      }

      if (mode === "have") {
        const existingHaveByStickerId = new Map(
          userStickers
            .filter((userSticker) => userSticker.user_id === user.id && userSticker.status === "have")
            .map((userSticker) => [userSticker.sticker_id, userSticker])
        );
        const updates = matched
          .filter((item) => existingHaveByStickerId.has(item.sticker.id))
          .map((item) => {
            const existing = existingHaveByStickerId.get(item.sticker.id)!;
            return supabase
              .from("user_stickers")
              .update({ quantity: Math.max(0, existing.quantity || 0) + item.count })
              .eq("id", existing.id);
          });
        const inserts = matched
          .filter((item) => !existingHaveByStickerId.has(item.sticker.id))
          .map((item) => ({
            user_id: user.id,
            sticker_id: item.sticker.id,
            status: "have",
            quantity: item.count,
          }));

        for (const update of updates) {
          const { error: updateError } = await update;
          if (updateError) throw updateError;
        }

        if (inserts.length > 0) {
          const { error: insertError } = await supabase.from("user_stickers").upsert(inserts, {
            onConflict: "user_id,sticker_id,status",
          });
          if (insertError) throw insertError;
        }

        const wantIdsToRemove = userStickers
          .filter((userSticker) =>
            userSticker.user_id === user.id &&
            userSticker.status === "want" &&
            matched.some((item) => item.sticker.id === userSticker.sticker_id)
          )
          .map((userSticker) => userSticker.id);
        if (wantIdsToRemove.length > 0) {
          const { error: deleteWantError } = await supabase.from("user_stickers").delete().in("id", wantIdsToRemove);
          if (deleteWantError) throw deleteWantError;
        }
      } else {
        const existingWantIds = new Set(
          userStickers
            .filter((userSticker) => userSticker.user_id === user.id && userSticker.status === "want")
            .map((userSticker) => userSticker.sticker_id)
        );
        const haveIdsToRemove = userStickers
          .filter((userSticker) =>
            userSticker.user_id === user.id &&
            userSticker.status === "have" &&
            matched.some((item) => item.sticker.id === userSticker.sticker_id)
          )
          .map((userSticker) => userSticker.id);
        if (haveIdsToRemove.length > 0) {
          const { error: deleteHaveError } = await supabase.from("user_stickers").delete().in("id", haveIdsToRemove);
          if (deleteHaveError) throw deleteHaveError;
        }

        const wantsToInsert = matched
          .filter((item) => !existingWantIds.has(item.sticker.id))
          .map((item) => ({
            user_id: user.id,
            sticker_id: item.sticker.id,
            status: "want",
            quantity: 1,
          }));
        if (wantsToInsert.length > 0) {
          const { error: insertWantError } = await supabase.from("user_stickers").upsert(wantsToInsert, {
            onConflict: "user_id,sticker_id,status",
            ignoreDuplicates: true,
          });
          if (insertWantError) throw insertWantError;
        }
      }

      if (options?.selectFirstMatch) {
        setFilter("all");
        setSelectedStickerId(matched[0].sticker.id);
        if (isWorldAlbum) {
          setSelectedAlbumTeamName(getStickerEffectiveTeamName(matched[0].sticker));
        }
      }

      await loadData();
      onCollectionChange?.();
      setResult(`${matched.length} cromo${matched.length === 1 ? "" : "s"} marcado${matched.length === 1 ? "" : "s"}${missingNumbers.length ? `. Nao encontrei: ${missingNumbers.join(", ")}.` : "."}`);
    } catch (err: any) {
      setError(err.message || "Erro ao marcar cromos automaticamente.");
    }
  };

  const markSpokenStickers = async () => {
    await markStickerNumbersFromText(voiceText, voiceMode, setVoiceResult);
  };

  const findStickerForScannedCode = (rawValue: string): Sticker | null => {
    // try abbreviation+number first (e.g. ALG 7)
    const abbrevMatch = rawValue.trim().match(/^([A-Za-z]{1,4})\s*[-_\\/]?\s*0*([1-9][0-9]?)$/);
    if (abbrevMatch && selectedCollectionId) {
      const collectionStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
      const abbrev = normalizeAbbrev(abbrevMatch[1]);
      const num = Number.parseInt(abbrevMatch[2], 10);
      const mappedTeam = abbrevToTeam[abbrev];
      if (mappedTeam) {
        const found = collectionStickers.find((st) => normalizeAbbrev(getStickerEffectiveTeamName(st)) === normalizeAbbrev(mappedTeam) && getAlbumLocalNumber(st) === num);
        if (found) return found;
      }

      const found = collectionStickers.find((st) => isSimilarAbbrev(abbrev, normalizeAbbrev(getStickerEffectiveTeamName(st))) && getAlbumLocalNumber(st) === num);
      if (found) return found;
    }

    const candidates = getCodeNumberCandidates(rawValue);
    const sticker = Array.from(candidates)
      .map((number) => getStickerBySpokenNumber(number))
      .find(Boolean) || null;
    return sticker;
  };

  const clearScannedCodes = () => {
    setScannedCodes([]);
    codeLastSeenAtRef.current.clear();
    setCodeResult(null);
  };

  const markCodeSticker = async (text = codeText) => {
    await markStickerNumbersFromText(text, "have", setCodeResult, { codeMode: true, selectFirstMatch: true });
  };

  const markScannedCodes = async () => {
    if (scannedCodes.length === 0) {
      setError("Nenhum codigo detectado para adicionar.");
      return;
    }

    const text = scannedCodes
      .flatMap((item) => Array.from({ length: item.count }, () => item.rawValue))
      .join(" ");
    setError(null);
    setCodeResult(null);

    try {
      await markStickerNumbersFromText(text, "have", setCodeResult, { codeMode: true, selectFirstMatch: false });
      setScannedCodes([]);
      stopCodeScanner();
      setCodeText("");
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar os codigos detectados.");
    }
  };

  const stopCodeScanner = () => {
    if (codeOcrTimerRef.current !== null) {
      window.clearInterval(codeOcrTimerRef.current);
      codeOcrTimerRef.current = null;
    }
    codeOcrBusyRef.current = false;
    if (codeOcrWorkerRef.current) {
      void codeOcrWorkerRef.current.terminate();
      codeOcrWorkerRef.current = null;
    }
    codeLastSeenAtRef.current.clear();
    codeStreamRef.current?.getTracks().forEach((track) => track.stop());
    codeStreamRef.current = null;
    if (codeVideoRef.current) {
      codeVideoRef.current.srcObject = null;
    }
    setCodeScanning(false);
    setCodeReading(false);
  };

  const addDetectedCode = (rawValue: string) => {
    rawValue = getStickerCodesFromOcrText(rawValue)[0] || normalizeOcrCodeText(rawValue);
    const now = Date.now();
    const lastSeenAt = codeLastSeenAtRef.current.get(rawValue) || 0;
    if (now - lastSeenAt < 1600) return;
    codeLastSeenAtRef.current.set(rawValue, now);

    setCodeText(rawValue);
    setScannedCodes((current) => {
      const existing = current.find((item) => item.rawValue === rawValue);
      if (existing) {
        return current.map((item) =>
          item.rawValue === rawValue ? { ...item, count: item.count + 1 } : item
        );
      }
      return [...current, { rawValue, sticker: findStickerForScannedCode(rawValue), count: 1 }];
    });
  };

  const createCodeOcrCanvas = (
    video: HTMLVideoElement,
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
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 2.35 + 128));
      const value = mode === "inverted" ? (contrasted > 150 ? 0 : 255) : contrasted;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  };

  const buildCodeOcrCanvases = (video: HTMLVideoElement) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    const regions = [
      [0, 0, width, height],
      [0, 0, width, Math.round(height * 0.36)],
      [0, 0, width, Math.round(height * 0.48)],
      [Math.round(width * 0.34), 0, Math.round(width * 0.64), Math.round(height * 0.34)],
      [Math.round(width * 0.48), 0, Math.round(width * 0.52), Math.round(height * 0.52)],
      [Math.round(width * 0.38), 0, Math.round(width * 0.62), Math.round(height * 0.46)],
      [0, 0, Math.round(width * 0.55), Math.round(height * 0.52)],
      [Math.round(width * 0.18), Math.round(height * 0.04), Math.round(width * 0.78), Math.round(height * 0.36)],
      [Math.round(width * 0.28), Math.round(height * 0.08), Math.round(width * 0.68), Math.round(height * 0.34)],
      [Math.round(width * 0.15), Math.round(height * 0.12), Math.round(width * 0.7), Math.round(height * 0.72)],
    ] as const;
    const modes: CodeOcrCanvasMode[] = ["inverted", "normal"];

    return modes
      .flatMap((mode) =>
        regions.map(([sourceX, sourceY, sourceWidth, sourceHeight]) =>
          createCodeOcrCanvas(video, sourceX, sourceY, sourceWidth, sourceHeight, 1600, mode)
        )
      )
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
  };

  const readCodeFrame = async () => {
    if (codeOcrBusyRef.current) return;

    const video = codeVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    codeOcrBusyRef.current = true;
    setCodeReading(true);
    try {
      const canvases = buildCodeOcrCanvases(video);
      if (canvases.length === 0) return;

      if (!codeOcrWorkerRef.current) {
        const { createWorker, OEM } = await import("tesseract.js");
        codeOcrWorkerRef.current = await createWorker("eng", OEM.LSTM_ONLY, {}, {
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_/",
          tessedit_pageseg_mode: "6",
        } as any);
      }
      for (const canvas of canvases) {
        if (typeof codeOcrWorkerRef.current.setParameters === "function") {
          await codeOcrWorkerRef.current.setParameters({ tessedit_pageseg_mode: "6" } as any);
        }
        const result = await codeOcrWorkerRef.current.recognize(canvas);
        const codes = getStickerCodesFromOcrText(result.data.text);
        codes.forEach(addDetectedCode);
        if (codes.length > 0) break;
      }
    } catch (err) {
      console.error("Erro ao ler texto da camara.", err);
    } finally {
      codeOcrBusyRef.current = false;
      setCodeReading(false);
    }
  };

  const startCodeScanner = async () => {
    setError(null);
    setCodeResult(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este browser nao permite abrir a camara aqui. Experimenta em HTTPS/localhost ou escreve o codigo no campo.");
      }

      stopCodeScanner();
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

      window.setTimeout(() => {
        readCodeFrame();
        codeOcrTimerRef.current = window.setInterval(readCodeFrame, 2200);
      }, 500);
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
      if (window.location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        setError("A camara no telemovel precisa de HTTPS. Abre a app pelo endereco seguro ou instala/usa a versao Android.");
        return;
      }
      setError(err.message || "Erro ao iniciar leitura de codigos.");
    }
  };

  const isCollectionActive = (collectionId: string) => {
    return collectionPreferences.find((preference) => preference.collection_id === collectionId)?.is_active !== false;
  };

  const toggleCollectionActive = async (collectionId: string, nextActive: boolean) => {
    setError(null);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");

      const { error: upsertError } = await supabase.from("user_collection_preferences").upsert({
        user_id: user.id,
        collection_id: collectionId,
        is_active: nextActive,
      }, {
        onConflict: "user_id,collection_id",
      });
      if (upsertError) throw upsertError;

      setCollectionPreferences((current) => {
        const withoutCurrent = current.filter((preference) => preference.collection_id !== collectionId);
        return [...withoutCurrent, { collection_id: collectionId, is_active: nextActive }];
      });

      if (!nextActive && selectedCollectionId === collectionId) {
        setSelectedCollectionId(null);
        setSearch("");
        setFilter("all");
        setSelectedAlbumTeamName(null);
      }
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao alterar estado da colecao.");
    }
  };

  const toggleCollectionOnboardingSelection = (collectionId: string) => {
    setCollectionOnboardingSelection((current) =>
      current.includes(collectionId)
        ? current.filter((id) => id !== collectionId)
        : [...current, collectionId]
    );
  };

  const saveCollectionOnboarding = async (activateAll = false) => {
    if (!user?.id) return;
    const activeIds = new Set(activateAll ? collections.map((collection) => collection.id) : collectionOnboardingSelection);

    if (activeIds.size === 0) {
      setError("Seleciona pelo menos uma colecao ativa.");
      return;
    }

    setCollectionOnboardingSaving(true);
    setError(null);
    try {
      const nextPreferences = collections.map((collection) => ({
        user_id: user.id,
        collection_id: collection.id,
        is_active: activeIds.has(collection.id),
      }));

      const { error: upsertError } = await supabase.from("user_collection_preferences").upsert(nextPreferences, {
        onConflict: "user_id,collection_id",
      });
      if (upsertError) throw upsertError;

      setCollectionPreferences(nextPreferences.map(({ collection_id, is_active }) => ({ collection_id, is_active })));
      localStorage.setItem(`papacromos:collection-onboarding:${user.id}`, "done");
      setCollectionOnboardingOpen(false);
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao guardar colecoes ativas.");
    } finally {
      setCollectionOnboardingSaving(false);
    }
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setError(null);
    setVoiceResult(null);

    if (!SpeechRecognition) {
      setError("Este browser nao suporta reconhecimento de voz. Podes escrever os numeros na caixa.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ");
      setVoiceText((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => {
      setError("Nao foi possivel reconhecer a voz. Tenta novamente ou escreve os numeros.");
    };
    recognition.onend = () => {
      setVoiceListening(false);
    };
    recognition.start();
  };

  const uploadStickerImage = async (stickerId: string, file: File | null) => {
    if (!file || !user?.id) return;

    setUploadingImageId(stickerId);
    setError(null);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${stickerId}/${Date.now()}-${user.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("sticker-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("sticker-images").getPublicUrl(filePath);
      const { error: updateImageError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: stickerId,
        p_image_url: publicUrlData.publicUrl,
      });
      if (updateImageError) throw updateImageError;

      const existingHave = userStickers.find(
        (userSticker) => userSticker.user_id === user.id && userSticker.sticker_id === stickerId && userSticker.status === "have"
      );
      if (!existingHave) {
        const { error: insertHaveError } = await supabase.from("user_stickers").upsert({
          user_id: user.id,
          sticker_id: stickerId,
          status: "have",
          quantity: 1,
        }, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
        });
        if (insertHaveError) throw insertHaveError;
      }

      const existingWant = userStickers.find(
        (userSticker) => userSticker.user_id === user.id && userSticker.sticker_id === stickerId && userSticker.status === "want"
      );
      if (existingWant) {
        const { error: deleteWantError } = await supabase.from("user_stickers").delete().eq("id", existingWant.id);
        if (deleteWantError) throw deleteWantError;
      }

      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar imagem global do cromo.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const removeStickerImage = async (stickerId: string) => {
    if (!profile?.is_admin) return;

    setUploadingImageId(stickerId);
    setError(null);
    try {
      const { error: updateImageError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: stickerId,
        p_image_url: "",
      });
      if (updateImageError) throw updateImageError;

      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover imagem global do cromo.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const filteredStickers = stickers.filter((s) => {
    if (!selectedCollectionId || s.collection_id !== selectedCollectionId || !isCollectionActive(s.collection_id)) return false;
    const normalizedSearch = normalizeSearchText(search);
    if (normalizedSearch && !getStickerSearchText(s).includes(normalizedSearch)) return false;
    if (filter === "have") return hasUserStickerStatus(s.id, "have");
    if (filter === "repeated") {
      const ownHave = userStickers.find(
        (us) => us.user_id === user?.id && us.sticker_id === s.id && us.status === "have"
      );
      return Boolean(ownHave && ownHave.quantity > 1);
    }
    if (filter === "want") return !getUserSticker(s.id);
    if (filter === "missing") return !getUserSticker(s.id);
    return true;
  });

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const selectedCollectionActive = selectedCollectionId ? isCollectionActive(selectedCollectionId) : true;
  const activeCollections = collections.filter((collection) => isCollectionActive(collection.id));
  const activeCollectionIds = new Set(activeCollections.map((collection) => collection.id));
  const activeStickers = stickers.filter((sticker) => activeCollectionIds.has(sticker.collection_id));
  const activeStickerIds = new Set(activeStickers.map((sticker) => sticker.id));
  const ownHaveStickers = userStickers.filter((us) =>
    us.user_id === user?.id &&
    us.status === "have" &&
    (us.quantity || 0) > 0 &&
    activeStickerIds.has(us.sticker_id)
  );
  const ownHaveStickerIds = new Set(ownHaveStickers.map((us) => us.sticker_id));
  const repeatedUserStickers = ownHaveStickers.filter((us) => (us.quantity || 0) > 1);
  const missingPreviewStickers = activeStickers.filter((sticker) => !ownHaveStickerIds.has(sticker.id));
  const missingStickerKey = missingPreviewStickers.map((sticker) => sticker.id).join("|");
  const repeatedPreviewStickers = repeatedUserStickers
    .map((us) => ({ userSticker: us, sticker: stickers.find((sticker) => sticker.id === us.sticker_id) }))
    .filter((entry): entry is { userSticker: UserSticker; sticker: Sticker } => Boolean(entry.sticker));
  const ownedPreviewStickers = ownHaveStickers
    .map((us) => ({ userSticker: us, sticker: stickers.find((sticker) => sticker.id === us.sticker_id) }))
    .filter((entry): entry is { userSticker: UserSticker; sticker: Sticker } => Boolean(entry.sticker))
    .slice(0, 12);
  const activeCollectionSummaries = activeCollections.map((collection) => {
    const collectionStickers = stickers.filter((sticker) => sticker.collection_id === collection.id);
    const collectionStickerIds = new Set(collectionStickers.map((sticker) => sticker.id));
    const collectionHaveCount = ownHaveStickers.filter((us) => collectionStickerIds.has(us.sticker_id)).length;
    const collectionTotal = Math.max(collection.total_stickers || 0, collectionStickers.length);

    return {
      collection,
      total: collectionTotal,
      have: collectionHaveCount,
      progress: collectionTotal > 0 ? Math.round((collectionHaveCount / collectionTotal) * 100) : 0,
    };
  });
  const completedCollections = activeCollectionSummaries.filter((summary) => summary.total > 0 && summary.have >= summary.total).length;
  const completeCollectionSummaries = activeCollectionSummaries.filter((summary) => summary.total > 0 && summary.have >= summary.total);
  const totalActiveStickerCount = activeCollectionSummaries.reduce((total, summary) => total + summary.total, 0);
  const homeMissingCount = Math.max(0, totalActiveStickerCount - ownHaveStickerIds.size);
  const homeRepeatedCount = repeatedUserStickers.reduce((total, us) => total + Math.max(0, (us.quantity || 0) - 1), 0);
  const selectedStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
  const selectedStickerIds = new Set(selectedStickers.map((sticker) => sticker.id));
  const selectedUserStickers = userStickers.filter((us) => us.user_id === user?.id && selectedStickerIds.has(us.sticker_id));
  const haveCount = selectedUserStickers.filter((us) => us.status === "have").length;
  const repeatedCount = selectedUserStickers
    .filter((us) => us.status === "have")
    .reduce((total, us) => total + Math.max(0, (us.quantity || 0) - 1), 0);
  const totalCount = Math.max(selectedStickers.length, selectedCollection?.total_stickers || 0);
  const progress = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0;
  const isWorldAlbum = selectedCollection?.name.toLowerCase().includes("mundial") || false;
  const albumTeamButtons = isWorldAlbum ? buildAlbumTeamPages(selectedStickers) : [];
  const filteredAlbumTeamNames = new Set(
    isWorldAlbum ? buildAlbumTeamPages(filteredStickers).map((teamPage) => teamPage.teamName) : []
  );
  const visibleAlbumTeamButtons = isWorldAlbum
    ? albumTeamButtons.filter((teamPage) => filteredAlbumTeamNames.has(teamPage.teamName))
    : [];
  const albumTeamPages = isWorldAlbum
    ? buildAlbumTeamPages(filteredStickers).filter((teamPage) => !selectedAlbumTeamName || teamPage.teamName === selectedAlbumTeamName)
    : [];
  const selectedAlbumTeamIndex = albumTeamButtons.findIndex((teamPage) => teamPage.teamName === selectedAlbumTeamName);
  const previousAlbumTeam = selectedAlbumTeamIndex > 0 ? albumTeamButtons[selectedAlbumTeamIndex - 1] : null;
  const nextAlbumTeam =
    selectedAlbumTeamIndex >= 0 && selectedAlbumTeamIndex < albumTeamButtons.length - 1
      ? albumTeamButtons[selectedAlbumTeamIndex + 1]
      : null;
  const showVoiceMarkControls = !isWorldAlbum || Boolean(selectedAlbumTeamName);
  const showCodeMarkControls = Boolean(selectedCollectionId);
  const neededStickerHolderLoopItems =
    neededStickerHolders.length > 1 ? [...neededStickerHolders, ...neededStickerHolders] : neededStickerHolders;

  useEffect(() => {
    let cancelled = false;

    const loadNeededStickerHolders = async () => {
      if (!user?.id || selectedCollectionId || missingPreviewStickers.length === 0) {
        setNeededStickerHolders([]);
        setNeededStickerHoldersLoading(false);
        return;
      }

      setNeededStickerHoldersLoading(true);
      try {
        const holders = await fetchNeededStickerHolders(user.id, missingPreviewStickers);
        if (!cancelled) setNeededStickerHolders(holders);
      } catch (err) {
        console.error("Erro ao carregar utilizadores com cromos em falta.", err);
        if (!cancelled) setNeededStickerHolders([]);
      } finally {
        if (!cancelled) setNeededStickerHoldersLoading(false);
      }
    };

    loadNeededStickerHolders();

    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedCollectionId, missingStickerKey]);

  const openAlbumTeam = (teamName: string, direction: AlbumSlideDirection = null) => {
    setAlbumSlideDirection(direction);
    setSelectedAlbumTeamName(teamName);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(null);
  };

  const openStickerCollection = (sticker: Sticker) => {
    setSelectedCollectionId(sticker.collection_id);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(sticker.id);
    setSelectedAlbumTeamName(null);
  };

  const openMissingStickerCollection = (sticker: Sticker) => {
    const stickerCollection = collections.find((collection) => collection.id === sticker.collection_id);
    const isStickerWorldAlbum = stickerCollection?.name.toLowerCase().includes("mundial") || false;

    setSelectedCollectionId(sticker.collection_id);
    setSearch("");
    setFilter("want");
    setSelectedStickerId(sticker.id);
    setSelectedAlbumTeamName(isStickerWorldAlbum ? getStickerEffectiveTeamName(sticker) : null);
  };

  const openRepeatedStickerCollection = (sticker: Sticker) => {
    const stickerCollection = collections.find((collection) => collection.id === sticker.collection_id);
    const isStickerWorldAlbum = stickerCollection?.name.toLowerCase().includes("mundial") || false;

    setSelectedCollectionId(sticker.collection_id);
    setSearch("");
    setFilter("repeated");
    setSelectedStickerId(sticker.id);
    setSelectedAlbumTeamName(isStickerWorldAlbum ? getStickerEffectiveTeamName(sticker) : null);
  };

  const renderSticker = (sticker: Sticker, compact = false) => {
    const us = getUserSticker(sticker.id);
    const photoInputId = `photo-${sticker.id}`;

    return (
      <StickerCard
        key={sticker.id}
        number={isWorldAlbum ? getAlbumLocalNumber(sticker) : sticker.number}
        name={getStickerDisplayName(sticker)}
        imageUrl={getStickerImageSource(sticker)}
        fallbackImageUrl={getStickerFallbackImage(sticker)}
        rarity={sticker.rarity}
        status={us ? "have" : "want"}
        quantity={us?.quantity}
        stickerId={sticker.id}
        selected={selectedStickerId === sticker.id}
        compact={compact}
        onClick={() => {
          setSelectedStickerId(sticker.id);
          us ? addQuantity(us.id) : addSticker(sticker.id, "have");
        }}
        onReduceQuantity={us ? () => reduceQuantity(us.id) : undefined}
      >
        <label className="btn btn-photo btn-xs" htmlFor={photoInputId}>
          <Camera size={12} /> {uploadingImageId === sticker.id ? "A enviar..." : "Foto"}
        </label>
        {profile?.is_admin && sticker.image_url && (
          <button
            className="btn btn-danger-soft btn-xs"
            type="button"
            onClick={() => removeStickerImage(sticker.id)}
            disabled={uploadingImageId === sticker.id}
          >
            <X size={12} /> Remover foto
          </button>
        )}
        <input
          id={photoInputId}
          className="sticker-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={uploadingImageId === sticker.id}
          onChange={(event) => {
            uploadStickerImage(sticker.id, event.target.files?.[0] || null);
            event.target.value = "";
          }}
        />
      </StickerCard>
    );
  };

  const collectionOnboardingModal = collectionOnboardingOpen ? (
    <div className="collection-onboarding-backdrop" role="presentation">
      <div className="collection-onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="collection-onboarding-title">
        <div className="collection-onboarding-header">
          <span className="collection-home-kicker">Primeira configuracao</span>
          <h3 id="collection-onboarding-title">Escolhe as colecoes que queres ativar</h3>
          <p>As colecoes ativas aparecem na tua caderneta, nos cromos em falta e nas sugestoes de troca.</p>
        </div>
        <div className="collection-onboarding-grid">
          {collections.map((collection) => {
            const selected = collectionOnboardingSelection.includes(collection.id);
            return (
              <button
                className={`collection-onboarding-card ${selected ? "selected" : ""}`}
                key={collection.id}
                type="button"
                onClick={() => toggleCollectionOnboardingSelection(collection.id)}
              >
                <img
                  src={collection.image_url || collectionFallbackImage}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = collectionFallbackImage;
                  }}
                />
                <span>{collection.name}</span>
                <em>{selected ? "Ativa" : "Inativa"}</em>
              </button>
            );
          })}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="collection-onboarding-actions">
          <button className="btn btn-secondary" type="button" onClick={() => saveCollectionOnboarding(true)} disabled={collectionOnboardingSaving}>
            Ativar todas
          </button>
          <button className="btn btn-primary" type="button" onClick={() => saveCollectionOnboarding()} disabled={collectionOnboardingSaving || collectionOnboardingSelection.length === 0}>
            {collectionOnboardingSaving ? "A guardar..." : "Guardar selecao"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (loading) return <div className="loading">A carregar colecao...</div>;

  if (collections.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">!</span>
        <h3>Sem colecoes</h3>
        <p>Cria uma colecao na area Admin para comecar.</p>
      </div>
    );
  }

  if (!selectedCollectionId || !selectedCollectionActive) {
    return (
      <div className="collection-page collection-home">
        {collectionOnboardingModal}
        <section className="collection-home-hero">
          <div>
            <span className="collection-home-kicker">A minha colecao</span>
          </div>
          <div className="collection-home-stats">
            <button
              className={`collection-home-stat ${homeResultMode === "collections" ? "active" : ""}`}
              type="button"
              onClick={showHomeCollections}
            >
              <span className="collection-quick-stat-icon collections"><Album size={18} /></span>
              <span>Colecoes</span>
              <strong>{activeCollections.length}</strong>
            </button>
            <button
              className={`collection-home-stat ${homeResultMode === "owned" ? "active" : ""}`}
              type="button"
              onClick={() => setHomeResultMode("owned")}
            >
              <span className="collection-quick-stat-icon stickers"><Images size={18} /></span>
              <span>Cromos</span>
              <strong>{ownHaveStickerIds.size}</strong>
            </button>
            <button
              className={`collection-home-stat ${homeResultMode === "complete" ? "active" : ""}`}
              type="button"
              onClick={() => setHomeResultMode("complete")}
            >
              <span className="collection-quick-stat-icon complete"><Trophy size={18} /></span>
              <span>Completas</span>
              <strong>{completedCollections}</strong>
            </button>
          </div>
        </section>

        {error && <p className="error-message">{error}</p>}

        {homeResultMode === "owned" && (
          <section className="collection-home-section">
            <div className="collection-home-section-title">
              <h3>Cromos que tens</h3>
              <span>{ownHaveStickerIds.size}</span>
            </div>
            <CollectionHomeCarousel itemCount={ownedPreviewStickers.length} emptyText="Ainda nao marcaste cromos como teus.">
              {ownedPreviewStickers.map(({ userSticker, sticker }) => (
                <button className="collection-home-mini-card" key={userSticker.id} type="button" onClick={() => openStickerCollection(sticker)}>
                  <img src={getStickerImageSource(sticker)} alt={getStickerDisplayName(sticker)} loading="lazy" onError={(event) => applyFallbackImage(event, sticker)} />
                  <strong>{getStickerDisplayName(sticker)}</strong>
                  {userSticker.quantity > 1 && <em>{userSticker.quantity}</em>}
                </button>
              ))}
            </CollectionHomeCarousel>
          </section>
        )}

        {(neededStickerHoldersLoading || neededStickerHolders.length > 0) && (
          <section className="needed-users-carousel" aria-label="Utilizadores com cromos que precisas">
            {neededStickerHoldersLoading && neededStickerHolders.length === 0 ? (
              <div className="needed-user-card loading-card">
                <div className="needed-user-avatar skeleton-avatar" />
                <div>
                  <strong>A procurar...</strong>
                  <span>A verificar quem tem cromos que precisas.</span>
                </div>
              </div>
            ) : (
              <div className={`needed-users-track ${neededStickerHolders.length > 1 ? "is-looping" : ""}`}>
                {neededStickerHolderLoopItems.map((holder, index) => (
                  <button
                    className="needed-user-card"
                    key={`${holder.userId}-${index}`}
                    type="button"
                    onClick={() => onOpenSharedUser?.(holder.userId)}
                  >
                    <div className="needed-user-avatar" style={{ background: getAvatarColor(holder.avatarSeed) }}>
                      {getAvatarInitial(holder.username)}
                    </div>
                    <div className="needed-user-copy">
                      <strong>{holder.username}</strong>
                      <span>Tem {holder.count} {holder.count === 1 ? "cromo" : "cromos"} que precisas!</span>
                      {holder.sampleStickers.length > 0 && (
                        <small>
                          {holder.sampleStickers.map((sticker) => `#${String(sticker.number).padStart(3, "0")}`).join(", ")}
                        </small>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="collection-home-section">
          <div className="collection-home-section-title">
            <h3>Em falta</h3>
            <span className="missing">{homeMissingCount}</span>
          </div>
          <CollectionHomeCarousel itemCount={missingPreviewStickers.length} emptyText="Sem cromos em falta nas colecoes ativas.">
            {missingPreviewStickers.map((sticker) => (
              <button className="collection-home-mini-card" key={sticker.id} type="button" onClick={() => openMissingStickerCollection(sticker)}>
                <img src={getStickerImageSource(sticker)} alt={getStickerDisplayName(sticker)} loading="lazy" onError={(event) => applyFallbackImage(event, sticker)} />
                <strong>{getStickerDisplayName(sticker)}</strong>
              </button>
            ))}
          </CollectionHomeCarousel>
        </section>

        <section className="collection-home-section">
          <div className="collection-home-section-title">
            <h3>Repetidos</h3>
            <span className="repeated">{homeRepeatedCount}</span>
          </div>
          <CollectionHomeCarousel itemCount={repeatedPreviewStickers.length} emptyText="Ainda nao tens repetidos.">
            {repeatedPreviewStickers.map(({ userSticker, sticker }) => (
              <button className="collection-home-mini-card repeated" key={userSticker.id} type="button" onClick={() => openRepeatedStickerCollection(sticker)}>
                <img src={getStickerImageSource(sticker)} alt={getStickerDisplayName(sticker)} loading="lazy" onError={(event) => applyFallbackImage(event, sticker)} />
                <strong>{getStickerDisplayName(sticker)}</strong>
                <em>{Math.max(0, (userSticker.quantity || 0) - 1)}</em>
              </button>
            ))}
          </CollectionHomeCarousel>
        </section>

        <section className="collection-home-section" ref={collectionsSectionRef}>
          <div className="collection-home-section-title">
            <h3>{homeResultMode === "complete" ? "Colecoes completas" : "Colecoes"}</h3>
            <span>{homeResultMode === "complete" ? completedCollections : activeCollections.length}</span>
          </div>
        </section>

        <div className="collection-cover-grid">
          {(homeResultMode === "complete" ? completeCollectionSummaries.map((summary) => summary.collection) : collections).map((collection) => {
            const active = isCollectionActive(collection.id);
            const summary = activeCollectionSummaries.find((item) => item.collection.id === collection.id);

            return (
              <article key={collection.id} className={`collection-cover-card ${active ? "" : "inactive"}`}>
                <button
                  className="collection-cover-main"
                  type="button"
                  disabled={!active}
                  onClick={() => {
                    setSelectedCollectionId(collection.id);
                    setSearch("");
                    setFilter("all");
                    setSelectedAlbumTeamName(null);
                  }}
                >
                  <div className="collection-cover-image">
                    <img
                      src={collection.image_url || collectionFallbackImage}
                      alt={collection.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = collectionFallbackImage;
                      }}
                    />
                  </div>
                  <div className="collection-cover-body">
                    <strong>{collection.name}</strong>
                    <span>{summary ? `${summary.have}/${summary.total} cromos` : `${collection.total_stickers || 0} cromos`}</span>
                    {summary && (
                      <div className="collection-cover-progress">
                        <span style={{ width: `${summary.progress}%` }} />
                      </div>
                    )}
                  </div>
                </button>
                <div className="collection-cover-actions">
                  <span className={`collection-status-pill ${active ? "active" : "inactive"}`}>
                    {active ? "Ativa" : "Desativada"}
                  </span>
                  <button
                    className={`btn btn-xs ${active ? "btn-error" : "btn-primary"}`}
                    type="button"
                    onClick={() => toggleCollectionActive(collection.id, !active)}
                  >
                    {active ? <EyeOff size={12} /> : <Eye size={12} />}
                    {active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </article>
            );
          })}
          {homeResultMode === "complete" && completeCollectionSummaries.length === 0 && (
            <p className="muted-text">Ainda nao tens colecoes completas.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="collection-page">
      {collectionOnboardingModal}
      <section className="collection-detail-hero">
        <div className="collection-detail-main">
          <div className="collection-detail-cover">
            <img
              src={selectedCollection?.image_url || collectionFallbackImage}
              alt={selectedCollection?.name || "Colecao"}
              onError={(event) => {
                event.currentTarget.src = collectionFallbackImage;
              }}
            />
          </div>
          <div className="collection-detail-copy">
            <span className="collection-home-kicker">Caderneta ativa</span>
            <h2>{selectedCollection?.name || "Colecao"}</h2>
            <div className="collection-detail-progress-copy">
              <strong>{progress}%</strong>
              <span>completa</span>
            </div>
            <div className="progress-bar collection-detail-progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className="collection-header-side">
          <button
            className="btn btn-collection-back"
            type="button"
            onClick={() => {
              setSelectedCollectionId(null);
              setSearch("");
              setFilter("all");
              setSelectedAlbumTeamName(null);
            }}
          >
            <ArrowLeft size={16} /> Coleções
          </button>
        </div>
        <div className="collection-quick-stats">
          <button className={`collection-quick-stat ${filter === "have" ? "active" : ""}`} type="button" onClick={() => setFilter("have")}>
            <span className="collection-quick-stat-icon have"><CircleCheck size={18} /></span>
            <span>Tenho</span>
            <strong>{haveCount}</strong>
          </button>
          <button className={`collection-quick-stat ${filter === "missing" ? "active" : ""}`} type="button" onClick={() => setFilter("missing")}>
            <span className="collection-quick-stat-icon missing"><CircleHelp size={18} /></span>
            <span>Faltam</span>
            <strong>{Math.max(totalCount - haveCount, 0)}</strong>
          </button>
          <button className={`collection-quick-stat ${filter === "repeated" ? "active" : ""}`} type="button" onClick={() => setFilter("repeated")}>
            <span className="collection-quick-stat-icon repeated"><CopyPlus size={18} /></span>
            <span>Repetidos</span>
            <strong>{repeatedCount}</strong>
          </button>
        </div>
      </section>

      <div className="collection-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Procurar cromo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {showVoiceMarkControls && (
          <button className="btn btn-voice-toggle btn-sm" type="button" onClick={() => setVoicePanelOpen((open) => !open)}>
            <Mic size={14} /> Marcar por voz
          </button>
        )}
        {showCodeMarkControls && (
          <button
            className="btn btn-code-toggle btn-sm"
            type="button"
            onClick={() => setCodePanelOpen((open) => !open)}
          >
            <ScanLine size={14} /> Ler codigo
          </button>
        )}
      </div>

      {showVoiceMarkControls && voicePanelOpen && (
        <div className="voice-mark-panel">
          <div className="voice-mark-header">
            <div>
              <strong>Marcar cromos automaticamente</strong>
              <span>Diz ou escreve os numeros dos cromos, por exemplo: 48, 226, 98.</span>
            </div>
            <div className="voice-mark-mode">
              <button
                type="button"
                className={voiceMode === "have" ? "active" : ""}
                onClick={() => setVoiceMode("have")}
              >
                Tenho
              </button>
              <button
                type="button"
                className={voiceMode === "want" ? "active" : ""}
                onClick={() => setVoiceMode("want")}
              >
                Procuro
              </button>
            </div>
          </div>
          <textarea
            value={voiceText}
            placeholder="Ex.: 48 226 98"
            onChange={(event) => setVoiceText(event.target.value)}
          />
          <div className="voice-mark-actions">
            <button className="btn btn-voice-toggle btn-sm" type="button" onClick={startVoiceRecognition} disabled={voiceListening}>
              <Mic size={14} /> {voiceListening ? "A ouvir..." : "Ditar"}
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={markSpokenStickers} disabled={!voiceText.trim()}>
              <ClipboardCheck size={14} /> Marcar
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVoiceText("")}>
              Limpar
            </button>
          </div>
          {voiceResult && <p className="success-text">{voiceResult}</p>}
          {isWorldAlbum && selectedAlbumTeamName && (
            <p className="muted-text">Nesta selecao tambem podes dizer numeros locais de 1 a 20.</p>
          )}
        </div>
      )}

      {showCodeMarkControls && codePanelOpen && (
        <div className="code-scan-panel">
          <div className="voice-mark-header">
            <div>
              <strong>Scanner OCR</strong>
              <span>Aponta para os codigos das figurinhas. A app detecta varios de uma vez e adiciona-os em lote.</span>
            </div>
          </div>
          <div className="code-scan-reader">
            <video ref={codeVideoRef} muted playsInline />
            {!codeScanning && <span className="code-scan-empty">Camara desligada</span>}
            {codeScanning && <div className="code-scan-line" />}
            {codeReading && <span className="code-scan-status">A ler texto...</span>}
          </div>
          {scannedCodes.length > 0 && (
            <div className="code-scan-detected">
              <strong>{scannedCodes.reduce((total, item) => total + item.count, 0)} figurinha(s) detectada(s)</strong>
              <ul>
                {scannedCodes.map((item) => (
                  <li key={item.rawValue}>
                    <span className="code-scan-chip">{item.rawValue}{item.count > 1 ? ` x${item.count}` : ""}</span>
                    {item.sticker ? <span> — {getStickerDisplayName(item.sticker)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="code-scan-actions">
            <input
              type="text"
              value={codeText}
              placeholder="Ex.: 48, POR-13, 000226"
              onChange={(event) => setCodeText(event.target.value)}
            />
            <button className="btn btn-code-toggle btn-sm" type="button" onClick={startCodeScanner} disabled={codeScanning}>
              <ScanLine size={14} /> {codeScanning ? "Scanner ativo" : "Scanner OCR"}
            </button>
            {codeScanning && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={stopCodeScanner}>
                Parar
              </button>
            )}
            <button className="btn btn-primary btn-sm" type="button" onClick={markScannedCodes} disabled={scannedCodes.length === 0}>
              <ClipboardCheck size={14} /> Adicionar detectadas ({scannedCodes.reduce((total, item) => total + item.count, 0)})
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={clearScannedCodes} disabled={scannedCodes.length === 0}>
              Limpar lista
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => markCodeSticker()} disabled={!codeText.trim()}>
              <ClipboardCheck size={14} /> Marcar
            </button>
          </div>
          {codeResult && <p className="success-text">{codeResult}</p>}
          {isWorldAlbum && selectedAlbumTeamName && (
            <p className="muted-text">Nesta selecao tambem podes usar numeros locais de 1 a 20.</p>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {isWorldAlbum && !selectedAlbumTeamName ? (
        <div className="album-team-selector">
          {visibleAlbumTeamButtons.map((teamPage) => {
            const pageIndex = Math.max(0, albumTeamButtons.findIndex((albumTeam) => albumTeam.teamName === teamPage.teamName));
            const teamHaveCount = teamPage.stickers.filter((sticker) => getUserSticker(sticker.id)).length;
            const teamProgress = Math.round((teamHaveCount / Math.max(1, teamPage.stickers.length)) * 100);

            return (
              <button
                className="album-team-button"
                key={teamPage.teamName}
                type="button"
                onClick={() => {
                  openAlbumTeam(teamPage.teamName);
                }}
              >
                {teamPage.flagUrl && (
                  <img className="album-team-bg-flag" src={teamPage.flagUrl} alt="" loading="lazy" aria-hidden="true" />
                )}
                <span className="album-team-button-number">{String(pageIndex + 1).padStart(2, "0")}</span>
                <strong>
                  {teamPage.flagUrl && <img className="album-team-mini-flag" src={teamPage.flagUrl} alt="" loading="lazy" />}
                  {teamPage.teamName}
                </strong>
                <span>{teamPage.groupName}</span>
                <em>{teamHaveCount}/{teamPage.stickers.length}</em>
                <div className="album-team-button-progress">
                  <span style={{ width: `${teamProgress}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      ) : isWorldAlbum ? (
        <div className="album-page-list">
          <div className="album-page-nav">
            <button
              className="btn btn-album-back"
              type="button"
              onClick={() => {
                setSelectedAlbumTeamName(null);
                setSearch("");
                setFilter("all");
                setSelectedStickerId(null);
              }}
            >
              <ArrowLeft size={16} /> Seleções
            </button>
            <div className="album-page-nav-arrows">
              <button
                className="btn btn-album-nav"
                type="button"
                onClick={() => previousAlbumTeam && openAlbumTeam(previousAlbumTeam.teamName, "previous")}
                disabled={!previousAlbumTeam}
              >
                <ArrowLeft size={14} /> Anterior
              </button>
              <button
                className="btn btn-album-nav"
                type="button"
                onClick={() => nextAlbumTeam && openAlbumTeam(nextAlbumTeam.teamName, "next")}
                disabled={!nextAlbumTeam}
              >
                Seguinte <ArrowLeft className="icon-flip-horizontal" size={14} />
              </button>
            </div>
          </div>
          {albumTeamPages.map((teamPage) => {
            const pageIndex = Math.max(0, albumTeamButtons.findIndex((albumTeam) => albumTeam.teamName === teamPage.teamName));
            const teamHaveCount = teamPage.stickers.filter((sticker) => getUserSticker(sticker.id)).length;
            const teamProgress = Math.round((teamHaveCount / Math.max(1, teamPage.stickers.length)) * 100);
            const teamPhoto = teamPage.stickers.find((sticker) => getAlbumLocalNumber(sticker) === 13);
            const playerStickers = teamPage.stickers.filter((sticker) => !sticker.name.includes("Foto de equipa"));

            return (
              <section
                className={`album-spread ${albumSlideDirection ? `album-spread-slide-${albumSlideDirection}` : ""}`}
                key={teamPage.teamName}
                onAnimationEnd={() => setAlbumSlideDirection(null)}
              >
                <div className="album-team-hero">
                  <span className="album-page-number">{String(pageIndex + 1).padStart(2, "0")}</span>
                  <div>
                    <p>NOS SOMOS</p>
                    <h3>{teamPage.teamName}</h3>
                    <span>{teamPage.groupName}</span>
                  </div>
                  <div className="album-team-badge">
                    {teamPage.flagUrl ? <img src={teamPage.flagUrl} alt={`Bandeira ${teamPage.teamName}`} /> : teamPage.flag}
                  </div>
                </div>

                <div className="album-spread-body">
                  <aside className="album-team-info">
                    {teamPhoto && (
                      <div className="album-team-photo-slot">
                        {renderSticker(teamPhoto, true)}
                      </div>
                    )}
                    <div>
                      <strong>Federacao</strong>
                      <span>{teamPage.teamName} Football Association</span>
                    </div>
                    <div>
                      <strong>Progresso</strong>
                      <span>{teamHaveCount}/{teamPage.stickers.length} cromos</span>
                    </div>
                    <div className="album-team-progress">
                      <span style={{ width: `${teamProgress}%` }} />
                    </div>
                  </aside>
                  <div className="album-sticker-grid">
                    {playerStickers.map((sticker) => renderSticker(sticker, true))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="sticker-grid">
          {filteredStickers.map((sticker) => renderSticker(sticker))}
        </div>
      )}

      {filteredStickers.length === 0 && (
        <div className="empty-state">
          <p>Nenhum cromo encontrado</p>
        </div>
      )}
    </div>
  );
}
