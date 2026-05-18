import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, ScanLine } from "lucide-react";
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

const DATA_PAGE_SIZE = 1000;

const abbrevToTeam: Record<string, string> = {
  ALG: "Argelia",
  POR: "Portugal",
  BRA: "Brasil",
  BRAZ: "Brasil",
  CPV: "Cabo Verde",
  SWE: "Suecia",
  SUE: "Suecia",
  SUI: "Suica",
  CHE: "Suica",
  MEX: "Mexico",
  ARG: "Argentina",
  ENG: "Inglaterra",
  IRN: "Ira",
  FRA: "Franca",
  GER: "Alemanha",
  DEU: "Alemanha",
  GHA: "Gana",
  COD: "RD do Congo",
  DRC: "RD do Congo",
  USA: "Estados Unidos",
  EUS: "Estados Unidos",
  NZL: "Nova Zelandia",
  SEN: "Senegal",
  SCO: "Escocia",
  ECU: "Equador",
  UZB: "Uzbequistao",
  TUN: "Tunisia",
};

function getStickerTeamName(stickerName: string) {
  return stickerName.includes(" - ") ? stickerName.split(" - ")[0].trim() : "Cromos";
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
    .replace(/\bC[O0]V\b/g, "CPV")
    .replace(/\bCPY\b/g, "CPV")
    .replace(/\bN[2Z]L\b/g, "NZL")
    .replace(/\bNZI\b/g, "NZL")
    .replace(/\b5EN\b/g, "SEN")
    .replace(/\b5CO\b/g, "SCO")
    .replace(/\bSC0\b/g, "SCO")
    .replace(/\bEC[O0]\b/g, "ECU")
    .replace(/\bE[CO]U\b/g, "ECU")
    .replace(/\bU[2Z]8\b/g, "UZB")
    .replace(/\bUZ8\b/g, "UZB")
    .replace(/\bT[UO]M\b/g, "TUN")
    .replace(/\b1RN\b/g, "IRN")
    .replace(/\bIR[NM]\b/g, "IRN")
    .replace(/\bA1G\b/g, "ALG")
    .replace(/\bAL6\b/g, "ALG")
    .replace(/\bEN6\b/g, "ENG")
    .replace(/\b6HA\b/g, "GHA")
    .replace(/\bC0D\b/g, "COD")
    .replace(/\s+/g, " ")
    .trim();
}

function getStickerCodesFromOcrText(text: string) {
  const normalizedText = normalizeOcrCodeText(text).replace(/\b([A-Z]{3})([0-9]{1,2})\b/g, "$1 $2");
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

export default function ScannerPage({ onCollectionChange }: { onCollectionChange?: () => void }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeScanning, setCodeScanning] = useState(false);
  const [codeReading, setCodeReading] = useState(false);
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const [scannedCodes, setScannedCodes] = useState<ScannedCodeItem[]>([]);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const codeVideoRef = useRef<HTMLVideoElement | null>(null);
  const codeStreamRef = useRef<MediaStream | null>(null);
  const codeOcrBusyRef = useRef(false);
  const codeOcrWorkerRef = useRef<any | null>(null);
  const codeOcrWorkerPromiseRef = useRef<Promise<any> | null>(null);
  const codeLastSeenAtRef = useRef<Map<string, number>>(new Map());

  const collectionStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);

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
        supabase.from("collections").select("id, name").order("created_at", { ascending: false }),
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

  const findStickerForScannedCode = (rawValue: string): Sticker | null => {
    const abbrevMatch = normalizeOcrCodeText(rawValue).match(/^([A-Z0-9]{2,4})\s*[-_\\/]?\s*0*([1-9][0-9]?)$/);
    if (abbrevMatch) {
      const abbrev = normalizeAbbrev(abbrevMatch[1]);
      const num = Number.parseInt(abbrevMatch[2], 10);
      const mappedTeam = abbrevToTeam[abbrev];
      if (mappedTeam) {
        const mappedTeamNorm = normalizeAbbrev(mappedTeam);
        const found = collectionStickers.find((sticker) =>
          normalizeAbbrev(getStickerTeamName(sticker.name)) === mappedTeamNorm &&
          getAlbumLocalNumber(sticker) === num
        );
        if (found) return found;
      }

      const found = collectionStickers.find((sticker) =>
        isSimilarAbbrev(abbrev, normalizeAbbrev(getStickerTeamName(sticker.name))) &&
        getAlbumLocalNumber(sticker) === num
      );
      if (found) return found;
    }

    const number = Number.parseInt(rawValue.replace(/\D/g, ""), 10);
    if (Number.isFinite(number)) {
      return collectionStickers.find((sticker) => sticker.number === number || getAlbumLocalNumber(sticker) === number) || null;
    }

    return null;
  };

  const stopCodeScanner = (options?: { keepWorker?: boolean }) => {
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

  const addDetectedCode = (rawValue: string) => {
    const normalized = getStickerCodesFromOcrText(rawValue)[0] || normalizeOcrCodeText(rawValue);
    const now = Date.now();
    const lastSeenAt = codeLastSeenAtRef.current.get(normalized) || 0;
    if (now - lastSeenAt < 1600) return;
    codeLastSeenAtRef.current.set(normalized, now);

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

  const createCodeOcrCanvas = (
    source: CanvasImageSource,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth = 900,
  ) => {
    const scale = Math.min(1, targetWidth / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.imageSmoothingEnabled = true;
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.9 + 128));
      data[index] = contrasted;
      data[index + 1] = contrasted;
      data[index + 2] = contrasted;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  };

  const buildCodeOcrCanvasesFromSource = (
    source: CanvasImageSource,
    width: number,
    height: number,
    exhaustive = false,
  ) => {
    const fastRegions = [
      [0, 0, width, height],
    ] as const;
    const exhaustiveRegions = [
      [0, 0, width, Math.round(height * 0.48)],
      [Math.round(width * 0.48), 0, Math.round(width * 0.52), Math.round(height * 0.52)],
      [0, 0, Math.round(width * 0.55), Math.round(height * 0.52)],
      [Math.round(width * 0.15), Math.round(height * 0.12), Math.round(width * 0.7), Math.round(height * 0.72)],
    ] as const;
    const regions = exhaustive ? [...fastRegions, ...exhaustiveRegions] : fastRegions;

    return regions
      .map(([sourceX, sourceY, sourceWidth, sourceHeight]) =>
        createCodeOcrCanvas(source, sourceX, sourceY, sourceWidth, sourceHeight)
      )
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
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

  const recognizeCodeCanvases = async (canvases: HTMLCanvasElement[]) => {
    if (canvases.length === 0) return;
    const worker = await prepareCodeOcrWorker();

    for (const canvas of canvases) {
      const result = await worker.recognize(canvas);
      const codes = getStickerCodesFromOcrText(result.data.text);
      codes.forEach(addDetectedCode);
      if (codes.length > 0) break;
    }
  };

  const startCodeScanner = async () => {
    setError(null);
    setCodeResult(null);
    try {
      if (!selectedCollectionId) throw new Error("Escolhe uma colecao primeiro.");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este browser nao permite abrir a camara aqui.");
      }

      stopCodeScanner();
      setCapturedImageUrl(null);
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

  const captureCodeFrame = async () => {
    if (codeOcrBusyRef.current) return;
    setError(null);
    setCodeResult(null);
    const video = codeVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Nao consegui capturar a imagem da camara.");
      return;
    }

    codeOcrBusyRef.current = true;
    setCodeReading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Nao consegui preparar a imagem capturada.");

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImageUrl(canvas.toDataURL("image/jpeg", 0.86));
      stopCodeScanner({ keepWorker: true });

      const canvases = buildCodeOcrCanvasesFromSource(canvas, canvas.width, canvas.height, true);
      await recognizeCodeCanvases(canvases);
    } catch (err: any) {
      setError(err.message || "Erro ao ler a imagem capturada.");
    } finally {
      codeOcrBusyRef.current = false;
      setCodeReading(false);
    }
  };

  const clearScannedCodes = () => {
    setScannedCodes([]);
    codeLastSeenAtRef.current.clear();
    setCodeText("");
    setCodeResult(null);
    setCapturedImageUrl(null);
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

  const markManualCode = async () => {
    setError(null);
    setCodeResult(null);
    try {
      await markCodes([codeText]);
      setCodeText("");
    } catch (err: any) {
      setError(err.message || "Erro ao marcar codigo.");
    }
  };

  const markScannedCodes = async () => {
    setError(null);
    setCodeResult(null);
    try {
      const codes = scannedCodes.flatMap((item) => Array.from({ length: item.count }, () => item.rawValue));
      await markCodes(codes);
      clearScannedCodes();
      stopCodeScanner();
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar os codigos detectados.");
    }
  };

  return (
    <div className="scanner-page">
      <section className="collection-header scanner-header">
        <div>
          <h2>Scanner</h2>
          <p>Le codigos dos cromos e adiciona-os diretamente a colecao escolhida.</p>
        </div>
        <label className="scanner-collection-picker">
          <span>Colecao</span>
          <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)} disabled={loading || codeScanning}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </label>
      </section>

      {error && <p className="error-message">{error}</p>}
      {codeResult && <p className="success-text">{codeResult}</p>}

      <section className="code-scan-panel scanner-panel">
        <div className="voice-mark-header">
          <div>
            <strong>Scanner OCR</strong>
            <span>Aponta para o codigo no canto do cromo, por exemplo ALG 7, CPV 10 ou COD 13.</span>
          </div>
        </div>
        <div className="code-scan-reader">
          {capturedImageUrl && !codeScanning ? (
            <img className="code-scan-capture" src={capturedImageUrl} alt="Imagem capturada para leitura" />
          ) : (
            <video ref={codeVideoRef} muted playsInline />
          )}
          {!codeScanning && !capturedImageUrl && <span className="code-scan-empty">Camara desligada</span>}
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
                  {item.sticker ? <span>- {item.sticker.name}</span> : <span>Sem correspondencia</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="code-scan-actions">
          <input
            type="text"
            value={codeText}
            placeholder="Ex.: CPV 10"
            onChange={(event) => setCodeText(event.target.value)}
          />
          <button className="btn btn-code-toggle btn-sm" type="button" onClick={startCodeScanner} disabled={codeScanning || !selectedCollectionId}>
            <ScanLine size={14} /> {codeScanning ? "Scanner ativo" : "Abrir scanner"}
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={captureCodeFrame} disabled={!codeScanning || codeReading}>
            <ScanLine size={14} /> Capturar agora
          </button>
          {codeScanning && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => stopCodeScanner()}>
              Parar
            </button>
          )}
          <button className="btn btn-primary btn-sm" type="button" onClick={markScannedCodes} disabled={scannedCodes.length === 0}>
            <ClipboardCheck size={14} /> Adicionar detectadas ({scannedCodes.reduce((total, item) => total + item.count, 0)})
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={clearScannedCodes} disabled={scannedCodes.length === 0}>
            Limpar lista
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={markManualCode} disabled={!codeText.trim() || !selectedCollectionId}>
            <ClipboardCheck size={14} /> Marcar codigo
          </button>
        </div>
      </section>
    </div>
  );
}
