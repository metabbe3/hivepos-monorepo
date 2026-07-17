import { createWorker, PSM } from "tesseract.js";

export interface ExtractedCustomer {
  name: string;
  phone: string;
  email: string;
  notes: string;
  confidence: number; // 0-100
}

// ── Image Loading ────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

/**
 * Advanced preprocessing: upscale 2x + grayscale + Otsu binarization + sharpen.
 * Tesseract works best at ~300 DPI — upscaling small screenshots helps
 * character recognition significantly.
 */
async function preprocessImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");

  // Upscale 2x for ~300 DPI (Tesseract optimal)
  const scale = 2;
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const totalPixels = w * h;

  // Step 1: Convert to grayscale
  const grayscale = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    grayscale[i] = Math.round(
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
    );
  }

  // Step 2: Otsu's binarization — find optimal threshold
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < totalPixels; i++) {
    histogram[grayscale[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let threshold = 0;
  let varMax = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  // Step 3: Apply binarization (dark text on light background)
  for (let i = 0; i < totalPixels; i++) {
    const val = grayscale[i] > threshold ? 255 : 0;
    const offset = i * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = val;
  }

  // Step 4: Sharpening (3x3 unsharp mask)
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c] * 5;
        const neighbors =
          copy[idx - 4 + c] +
          copy[idx + 4 + c] +
          copy[((y - 1) * w + x) * 4 + c] +
          copy[((y + 1) * w + x) * 4 + c];
        data[idx + c] = Math.min(255, Math.max(0, center - neighbors));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

// ── OCR Line Types ───────────────────────────────────────────────────────────

interface OcrLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: Array<{
    text: string;
    confidence: number;
    choices: Array<{ text: string; confidence: number }>;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

interface CustomerCluster {
  lines: OcrLine[];
  topY: number;
  bottomY: number;
}

interface ExtractedEntry {
  name: string;
  phone: string;
  customerId: string;
  email: string;
  address: string;
  confidence: number;
}

// ── Pattern Matchers ─────────────────────────────────────────────────────────

const PHONE_RE = /(\+?62|08)\d[\d\s\-]{7,14}/g;
const CUST_ID_RE = /\b(\d{6,8})\b/;

/** Normalize phone: +62xxx → 08xxx, remove spaces/dashes */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-]/g, "").replace(/^\+62/, "0");
}
const ADDRESS_KEYWORDS =
  /\b(?:no\.?|jl\.?|jln\.?|jalan|gang|rt\.?|rw\.?|kost|gereja|warteg|kos\b|perumahan|komplek|gedung)\b/i;
const TRANSAKSI_RE = /\btransaks/i;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const UI_LABELS =
  /Transaksi|Detail|Deposit|Pelanggan|Lihat|Edit|Hapus|WhatsApp|SMS|Call|Tambah|Cari|Filter|Sort|Status|Bayar|Riwayat|Saldo|Notifikasi|Pengaturan|Menu|Keluar|Logout|Masuk|Daftar|Homepage|Kembali|Beranda|Profil|Lainnya|Semua|Aktif|Nonaktif|Order|Pesanan|Layanan|Cabang|Pengguna|Laporan|Stok|Beban|Kategori|Scan|Foto|Buat|Simpan|Batal|Selesai|Proses|Ambil|Kirim|Tagihan|Kwitansi|Cetak|Bagikan|customer|laundry|app/i;

// ── OCR Text Cleaning ────────────────────────────────────────────────────────

function cleanOcrText(text: string): string {
  let cleaned = text.trim();

  // Remove common OCR noise characters
  cleaned = cleaned.replace(/[|[\]{}<>]/g, "");

  // Fix common OCR letter/number substitutions in names
  cleaned = cleaned.replace(/0(?=[a-zA-Z])/g, "O");
  cleaned = cleaned.replace(/(?<=[a-zA-Z])0/g, "o");

  // Remove isolated special characters (but keep periods, apostrophes, hyphens)
  cleaned = cleaned.replace(/\s*[^\w\s.'\-]\s*/g, " ").trim();

  // Strip garbled prefixes before a capitalized word (e.g. "oS Baron" → "Baron", "in Kemayoran" → "Kemayoran")
  cleaned = cleaned.replace(/^[a-zA-Z]{1,3}\s+(?=[A-Z])/g, "");

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  return cleaned;
}

function isPossibleName(candidate: string): boolean {
  const cleaned = cleanOcrText(candidate);
  return (
    cleaned.length >= 2 &&
    cleaned.length <= 40 &&
    !/\d{3,}/.test(cleaned) &&
    !UI_LABELS.test(cleaned) &&
    !/(?:08|\+62)\d/.test(cleaned) &&
    !cleaned.includes("@") &&
    /^[A-Za-z]/.test(cleaned) &&
    !ADDRESS_KEYWORDS.test(cleaned)
  );
}

// ── Word-level Name Recovery ─────────────────────────────────────────────────

function recoverNameFromWords(line: OcrLine): string {
  const parts: string[] = [];
  for (const word of line.words) {
    if (word.confidence >= 60) {
      parts.push(word.text);
    } else {
      // Try alternative readings from Tesseract's choices
      const better = word.choices
        ?.filter((c) => c.confidence > word.confidence)
        .sort((a, b) => b.confidence - a.confidence)[0];
      parts.push(better?.text ?? word.text);
    }
  }
  return cleanOcrText(parts.join(" "));
}

// ── Flatten Blocks to Lines ──────────────────────────────────────────────────

function flattenToLines(blocks: any[]): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        lines.push({
          text: (line.text ?? "").trim(),
          confidence: line.confidence ?? 0,
          bbox: line.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
          words: (line.words ?? []).map((w: any) => ({
            text: w.text ?? "",
            confidence: w.confidence ?? 0,
            choices: w.choices ?? [],
            bbox: w.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
          })),
        });
      }
    }
  }
  // Sort by vertical position (top to bottom), then horizontal (left to right)
  lines.sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(dy) > 5) return dy;
    return a.bbox.x0 - b.bbox.x0;
  });
  return lines;
}

// ── Cluster Lines into Customer Entries ───────────────────────────────────────

function clusterLines(lines: OcrLine[]): CustomerCluster[] {
  if (lines.length === 0) return [];
  if (lines.length <= 2) return [{ lines, topY: lines[0].bbox.y0, bottomY: lines[lines.length - 1].bbox.y1 }];

  // Calculate average line height
  const avgHeight =
    lines.reduce((sum, l) => sum + (l.bbox.y1 - l.bbox.y0), 0) / lines.length;

  // Calculate vertical gaps between consecutive lines
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i].bbox.y0 - lines[i - 1].bbox.y1);
  }

  // Adaptive threshold: find the natural gap between entries
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 5;
  const threshold = Math.max(avgHeight * 0.8, medianGap * 2, 10);

  // Build clusters by splitting at large gaps
  const clusters: CustomerCluster[] = [];
  let currentLines = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].bbox.y0 - lines[i - 1].bbox.y1;
    if (gap > threshold) {
      clusters.push({
        lines: currentLines,
        topY: currentLines[0].bbox.y0,
        bottomY: currentLines[currentLines.length - 1].bbox.y1,
      });
      currentLines = [lines[i]];
    } else {
      currentLines.push(lines[i]);
    }
  }
  clusters.push({
    lines: currentLines,
    topY: currentLines[0].bbox.y0,
    bottomY: currentLines[currentLines.length - 1].bbox.y1,
  });

  return clusters;
}

// ── Field Extraction from Cluster ────────────────────────────────────────────

function extractFieldsFromCluster(cluster: CustomerCluster): ExtractedEntry {
  const entry: ExtractedEntry = {
    name: "",
    phone: "",
    customerId: "",
    email: "",
    address: "",
    confidence: Math.round(
      cluster.lines.reduce((s, l) => s + l.confidence, 0) / cluster.lines.length
    ),
  };

  // Tag each line with a field type
  const tagged: { text: string; type: string; confidence: number; line: OcrLine }[] = [];

  for (const line of cluster.lines) {
    const text = line.text.trim();
    if (!text) continue;

    // Phone number
    const phoneClean = text.replace(/[\s\-]/g, "");
    const phoneMatch = phoneClean.match(/^(.*?)(\+?62|08)\d{8,12}(.*)$/);
    if (phoneMatch && phoneMatch[2]) {
      const fullPhone = text.match(PHONE_RE);
      if (fullPhone) {
        entry.phone = normalizePhone(fullPhone[0]);
        tagged.push({ text, type: "phone", confidence: line.confidence, line });
        continue;
      }
    }

    // Customer ID + optional email: "1464010  -" or "1464010  email@x.com"
    const idEmailMatch = text.match(/^(\d{6,8})\s+(.+)$/);
    if (idEmailMatch) {
      entry.customerId = idEmailMatch[1];
      const rest = idEmailMatch[2].trim();
      if (rest && rest !== "-") {
        const emailM = rest.match(EMAIL_RE);
        if (emailM) entry.email = emailM[0];
      }
      tagged.push({ text, type: "id_email", confidence: line.confidence, line });
      continue;
    }

    // Standalone customer ID
    if (/^\d{6,8}$/.test(text.replace(/\s/g, ""))) {
      entry.customerId = text.replace(/\s/g, "");
      tagged.push({ text, type: "id", confidence: line.confidence, line });
      continue;
    }

    // Total Transaksi — skip (also catches "23 Transaksi" or garbled "7 1 Transaks")
    if (TRANSAKSI_RE.test(text) || /^\d+\s*\d*\s*transaks/i.test(text)) {
      tagged.push({ text, type: "transaksi", confidence: line.confidence, line });
      continue;
    }

    // Address line: must contain known address keywords
    if (ADDRESS_KEYWORDS.test(text)) {
      entry.address = cleanOcrText(text);
      tagged.push({ text, type: "address", confidence: line.confidence, line });
      continue;
    }

    // Email only
    if (EMAIL_RE.test(text)) {
      const emailM = text.match(EMAIL_RE);
      if (emailM) entry.email = emailM[0];
      tagged.push({ text, type: "email", confidence: line.confidence, line });
      continue;
    }

    // Name candidate
    tagged.push({ text, type: "candidate_name", confidence: line.confidence, line });
  }

  // Find the name: pick first candidate_name that passes isPossibleName
  for (const t of tagged) {
    if (t.type === "candidate_name") {
      // Try recovered text first (using word choices)
      const recovered = recoverNameFromWords(t.line);
      if (isPossibleName(recovered)) {
        entry.name = recovered;
        break;
      }
      // Try cleaned raw text
      const cleaned = cleanOcrText(t.text);
      if (isPossibleName(cleaned)) {
        entry.name = cleaned;
        break;
      }
    }
  }

  // Fallback: use first candidate_name raw — but only if the entry has a phone or ID
  // (prevents phantom entries from UI chrome)
  if (!entry.name && (entry.phone || entry.customerId)) {
    for (const t of tagged) {
      if (t.type === "candidate_name") {
        const recovered = recoverNameFromWords(t.line);
        const cleaned = recovered || cleanOcrText(t.text);
        // Still filter out obvious UI labels
        if (!UI_LABELS.test(cleaned) && cleaned.length >= 2) {
          entry.name = cleaned;
        }
        break;
      }
    }
  }

  // Last fallback: use first line of cluster if it looks like a name
  if (!entry.name && cluster.lines.length > 0) {
    const first = cleanOcrText(cluster.lines[0].text);
    if (first.length >= 2 && !UI_LABELS.test(first) && (entry.phone || entry.customerId)) {
      entry.name = first;
    }
  }

  return entry;
}

// ── Fallback: Raw Text Extraction ───────────────────────────────────────────

function extractAllPhones(text: string): string[] {
  const matches = text.match(PHONE_RE);
  if (!matches) return [];
  return [...new Set(matches.map(normalizePhone))];
}

function extractEmail(text: string): string {
  const match = text.match(EMAIL_RE);
  return match ? match[0] : "";
}

function extractNameGeneric(text: string, phone: string, email: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (phone && line.includes(phone.replace(/\D/g, "").slice(-8))) continue;
    if (email && line.toLowerCase().includes(email.toLowerCase())) continue;

    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const hasDigit = (line.match(/\d/g) || []).length > 1;
      if (!hasDigit && /^[A-Z]/.test(line) && line.length < 50) {
        return line;
      }
    }
  }

  return "";
}

function extractMultipleCustomersFromText(text: string): { name: string; phone: string; notes: string }[] {
  const phones = extractAllPhones(text);
  if (phones.length === 0) return [];

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const customers: { name: string; phone: string; notes: string }[] = [];

  for (const phone of phones) {
    const candidates: { name: string; distance: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(phone) || lines[i].includes(phone.slice(-8))) {
        for (let j = Math.max(0, i - 6); j < i; j++) {
          if (isPossibleName(lines[j])) {
            candidates.push({ name: lines[j], distance: i - j });
          }
        }
        break;
      }
    }

    let name = "";
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.name.length - b.name.length;
      });
      name = candidates[0].name;
    }

    customers.push({ name, phone, notes: "" });
  }

  return customers;
}

// ── Main Exports ─────────────────────────────────────────────────────────────

export async function extractCustomerFromImage(
  file: File
): Promise<ExtractedCustomer> {
  const result = await extractMultipleFromImage(file);
  const first = result.customers[0];
  return {
    name: first?.name || "",
    phone: first?.phone || "",
    email: extractEmail(result.rawText),
    notes: first?.notes || "",
    confidence: result.confidence,
  };
}

export async function extractMultipleFromImage(file: File): Promise<{
  customers: { name: string; phone: string; notes?: string }[];
  rawText: string;
  confidence: number;
}> {
  const preprocessed = await preprocessImage(file);

  const worker = await createWorker("ind+eng", 1, {
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      // Disable dictionaries — prevents Tesseract from "correcting"
      // characters to dictionary words (important for names & phone numbers)
      load_system_dawg: "0",
      load_freq_dawg: "0",
      load_punc_dawg: "0",
      load_number_dawg: "0",
    });

    // Request blocks output for bounding box data
    const { data } = await worker.recognize(preprocessed, {}, { text: true, blocks: true });
    const text = data.text;
    const confidence = Math.round(data.confidence);

    // Try spatial extraction using bounding boxes
    let customers: { name: string; phone: string; notes: string }[] = [];

    if (data.blocks && data.blocks.length > 0) {
      const lines = flattenToLines(data.blocks);
      const clusters = clusterLines(lines);

      for (const cluster of clusters) {
        // Skip tiny clusters (likely noise or UI chrome)
        if (cluster.lines.length < 1) continue;

        const entry = extractFieldsFromCluster(cluster);

        // Skip if no useful data at all
        if (!entry.name && !entry.phone && !entry.customerId) continue;

        // Skip entries with only an address but no name/phone (likely noise)
        if (!entry.name && !entry.phone && entry.address) continue;

        // Skip pure UI chrome
        if (!entry.name && !entry.phone && entry.confidence < 40) continue;

        // Generate fallback phone from customer ID if no phone
        let phone = entry.phone;
        if (!phone && entry.customerId) {
          phone = "000-" + entry.customerId;
        }

        customers.push({
          name: entry.name || "Unknown",
          phone,
          notes: entry.address || "",
        });
      }
    }

    // Fallback: if spatial extraction found nothing, use raw text matching
    if (customers.length === 0) {
      customers = extractMultipleCustomersFromText(text).map((c) => ({
        ...c,
        notes: "",
      }));
    }

    // Second fallback: generic extraction
    if (customers.length === 0) {
      const phone = extractAllPhones(text)[0] || "";
      const email = extractEmail(text);
      const name = extractNameGeneric(text, phone, email);
      if (name || phone) {
        customers.push({ name, phone, notes: "" });
      }
    }

    return { customers, rawText: text, confidence };
  } finally {
    await worker.terminate();
  }
}
