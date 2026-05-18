import { SOCIAL_ICON_PATHS } from "./social-icons.js";

const LEGACY_PALETTES = [
    {
        id: "mono",
        name: "Monochrome",
        bg: "#f6f5f2",
        fg: "#0b0b0b",
        a: "#ffffff",
        b: "#e9e7e1"
    },
    {
        id: "sand",
        name: "Sand",
        bg: "#f6f1e7",
        fg: "#0b0b0b",
        a: "#fff8ec",
        b: "#f0d9ab"
    },
    {
        id: "mint",
        name: "Mint",
        bg: "#eef6f1",
        fg: "#0b0b0b",
        a: "#f5fff9",
        b: "#bfe6d0"
    },
    {
        id: "lavender",
        name: "Lavender",
        bg: "#f2f0ff",
        fg: "#0b0b0b",
        a: "#fbfaff",
        b: "#c8c2ff"
    },
    {
        id: "night",
        name: "Night",
        bg: "#0b0b0b",
        fg: "#f6f5f2",
        a: "#151515",
        b: "#2a2a2a"
    }
];

let lastQrDataUrl = null;
let lastQrKey = "";

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function asUrl(value) {
    const v = (value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(mailto:|tel:)/i.test(v)) return v;
    return `https://${v}`;
}

function hexToRgb(hex) {
    const raw = String(hex || "").trim().replace(/^#/, "");
    if (raw.length === 3) {
        const r = parseInt(raw.slice(0, 1).repeat(2), 16);
        const g = parseInt(raw.slice(1, 2).repeat(2), 16);
        const b = parseInt(raw.slice(2, 3).repeat(2), 16);
        return { r, g, b };
    }
    if (raw.length === 6) {
        const r = parseInt(raw.slice(0, 2), 16);
        const g = parseInt(raw.slice(2, 4), 16);
        const b = parseInt(raw.slice(4, 6), 16);
        return { r, g, b };
    }
    return null;
}

function rgbToCss({ r, g, b }, a = 1) {
    return `rgba(${clamp(Math.round(r), 0, 255)}, ${clamp(Math.round(g), 0, 255)}, ${clamp(Math.round(b), 0, 255)}, ${clamp(a, 0, 1)})`;
}

function mixRgb(a, b, t) {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
    };
}

function relativeLuminance({ r, g, b }) {
    const srgb = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function pickForeground(bgRgb) {
    const lum = relativeLuminance(bgRgb);
    return lum < 0.42 ? "#f6f5f2" : "#0b0b0b";
}

function resolveColors(state) {
    const defaults = {
        main: "#f6f5f2",
        accent: "#c8c2ff"
    };

    const mainHex = (state?.mainColor || "").trim() || defaults.main;
    const accentHex = (state?.accentColor || "").trim() || defaults.accent;

    let mainRgb = hexToRgb(mainHex);
    let accentRgb = hexToRgb(accentHex);

    // Backwards compat: old shared links used palette id.
    if ((!mainRgb || !accentRgb) && state?.palette) {
        const legacy = LEGACY_PALETTES.find((p) => p.id === state.palette) || LEGACY_PALETTES[0];
        mainRgb = mainRgb || hexToRgb(legacy.bg);
        accentRgb = accentRgb || hexToRgb(legacy.b);
    }

    if (!mainRgb) mainRgb = hexToRgb(defaults.main);
    if (!accentRgb) accentRgb = hexToRgb(defaults.accent);

    const fgHex = pickForeground(mainRgb);
    const dark = fgHex === "#f6f5f2";

    return {
        mainHex,
        accentHex,
        mainRgb,
        accentRgb,
        fgHex,
        dark
    };
}

export function getFonts(font) {
    const FONT_FAMILY_SANS = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    const FONT_FAMILY_SERIF = "ui-serif, Georgia, 'Times New Roman', Times, serif";

    if (font === "sans") {
        return {
            title: `600 52px ${FONT_FAMILY_SANS}`,
            body: `400 22px ${FONT_FAMILY_SANS}`,
            small: `500 16px ${FONT_FAMILY_SANS}`
        };
    }

    return {
        title: `520 54px ${FONT_FAMILY_SERIF}`,
        body: `400 22px ${FONT_FAMILY_SANS}`,
        small: `500 16px ${FONT_FAMILY_SANS}`
    };
}

function drawBlur(ctx2, x, y, r, color) {
    ctx2.save();
    ctx2.globalAlpha = 0.75;
    ctx2.fillStyle = color;
    ctx2.filter = `blur(${Math.max(20, r / 3)}px)`;
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
}

function wrapText(ctx2, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    function pushLine(nextLine) {
        const trimmed = String(nextLine || "").trim();
        if (trimmed) lines.push(trimmed);
    }

    function pushLongToken(token) {
        const chars = Array.from(String(token || ""));
        let chunk = "";
        for (const ch of chars) {
            const test = chunk + ch;
            if (ctx2.measureText(test).width <= maxWidth || !chunk) {
                chunk = test;
                continue;
            }
            pushLine(chunk);
            chunk = ch;
        }
        if (chunk) {
            // Prefer continuing the current line if it fits.
            if (!line) {
                line = chunk;
                return;
            }
            const test = `${line} ${chunk}`;
            if (ctx2.measureText(test).width <= maxWidth) {
                line = test;
                return;
            }
            pushLine(line);
            line = chunk;
        }
    }

    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx2.measureText(test).width <= maxWidth) {
            line = test;
            continue;
        }

        // If the token itself is too long, break it into chunks.
        if (ctx2.measureText(w).width > maxWidth) {
            if (line) {
                pushLine(line);
                line = "";
            }
            pushLongToken(w);
            continue;
        }

        if (line) pushLine(line);
        line = w;
    }
    if (line) pushLine(line);
    return lines;
}

export async function generateQrDataUrl(text, sizePx) {
    const payload = String(text || "");
    if (!payload) return null;
    const key = `${payload}||${sizePx}`;
    if (key === lastQrKey && lastQrDataUrl) return lastQrDataUrl;

    const makeQr = globalThis.qrcode;
    if (typeof makeQr !== "function") return null;

    const qr = makeQr(0, "M");
    qr.addData(payload);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const margin = 2;
    const cellSize = Math.max(2, Math.floor(sizePx / (moduleCount + margin * 2)));
    const dataUrl = qr.createDataURL(cellSize, margin);

    lastQrKey = key;
    lastQrDataUrl = dataUrl;
    return dataUrl;
}

function roundedRect(ctx2, x, y, w, h, r) {
    const radius = clamp(r, 0, Math.min(w, h) / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + radius, y);
    ctx2.arcTo(x + w, y, x + w, y + h, radius);
    ctx2.arcTo(x + w, y + h, x, y + h, radius);
    ctx2.arcTo(x, y + h, x, y, radius);
    ctx2.arcTo(x, y, x + w, y, radius);
    ctx2.closePath();
}

function svgToDataUrl(svg) {
    const encoded = encodeURIComponent(svg).replaceAll("'", "%27").replaceAll('"', "%22");
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}

function toBase64Url(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const base64 = btoa(bin);
    return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(base64url) {
    const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url || "").replaceAll("-", "+").replaceAll("_", "/") + pad;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export function encodeCardState(cardState) {
    // Compact key map to keep URLs reasonably short.
    const s = cardState || {};
    const compact = {};

    if (s.style && s.style !== "minimal") compact.st = s.style;
    if (s.font && s.font !== "serif") compact.f = s.font;
    if (s.isBusinessCard === false) compact.bc = 0;

    const mainColor = (s.mainColor || "").trim();
    const accentColor = (s.accentColor || "").trim();
    if (mainColor && mainColor.toLowerCase() !== "#f6f5f2") compact.mc = mainColor;
    if (accentColor && accentColor.toLowerCase() !== "#c8c2ff") compact.ac = accentColor;

    // Legacy palette ids (kept for backwards compat)
    if (s.palette && s.palette !== "mono") compact.p = s.palette;

    const name = (s.name || "").trim();
    const role = (s.role || "").trim();
    const company = (s.company || "").trim();
    const website = (s.website || "").trim();
    const email = (s.email || "").trim();
    const phone = (s.phone || "").trim();
    const location = (s.location || "").trim();

    if (name) compact.n = name;
    if (role) compact.r = role;
    if (company) compact.c = company;
    if (website) compact.w = website;
    if (email) compact.e = email;
    if (phone) compact.ph = phone;
    if (location) compact.l = location;

    const socials = {};
    for (const [slug, url] of Object.entries(s.socials || {})) {
        const v = (url || "").trim();
        if (!v) continue;
        socials[slug] = v;
    }
    if (Object.keys(socials).length) compact.s = socials;

    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    return toBase64Url(bytes);
}

export function decodeCardState(encoded) {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    const compact = JSON.parse(json);

    const legacyPalette = compact.p || "mono";
    const legacy = LEGACY_PALETTES.find((p) => p.id === legacyPalette) || LEGACY_PALETTES[0];

    const styleRaw = compact.st || "minimal";
    const style = styleRaw === "soft" ? "minimal" : styleRaw;

    return {
        style,
        font: compact.f || "serif",
        palette: legacyPalette,
        mainColor: compact.mc || legacy.bg || "#f6f5f2",
        accentColor: compact.ac || legacy.b || "#c8c2ff",
        isBusinessCard: compact.bc === 0 ? false : true,
        name: compact.n || "",
        role: compact.r || "",
        company: compact.c || "",
        website: compact.w || "",
        email: compact.e || "",
        phone: compact.ph || "",
        location: compact.l || "",
        socials: compact.s || {}
    };
}

export function buildPublicCardUrl(cardState, origin = globalThis.location?.origin) {
    const rawBasePath = typeof globalThis.__CARD_APP_BASE_PATH__ === "string" ? globalThis.__CARD_APP_BASE_PATH__ : "/";

    let basePath = String(rawBasePath || "/");
    if (!basePath.startsWith("/")) basePath = `/${basePath}`;
    basePath = basePath.replace(/\/{2,}/g, "/");
    if (!basePath.endsWith("/")) basePath += "/";

    const cardPath = `${basePath}card/`;

    const base = new URL(cardPath, origin || "https://example.com");
    const encoded = encodeCardState(cardState);
    base.hash = encoded;
    return base.toString();
}

export async function drawCardToCanvas(targetCanvas, cardState, options = {}) {
    const s = cardState || {};
    const c = targetCanvas;
    const w = c.width;
    const h = c.height;
    const ctx2 = c.getContext("2d");
    ctx2.clearRect(0, 0, w, h);

    const colors = resolveColors(s);
    const fonts = getFonts(s.font);
    const family = s.style || "minimal";

    // Background
    ctx2.fillStyle = colors.mainHex;
    ctx2.fillRect(0, 0, w, h);

    const accentSoft = rgbToCss(mixRgb(colors.accentRgb, colors.mainRgb, 0.45), 0.9);
    const accentHard = rgbToCss(colors.accentRgb, 0.25);

    if (family === "minimal") {
        drawBlur(ctx2, w * 0.70, h * 0.32, Math.min(w, h) * 0.34, accentSoft);
        drawBlur(ctx2, w * 0.30, h * 0.22, Math.min(w, h) * 0.30, rgbToCss(mixRgb(colors.mainRgb, colors.accentRgb, 0.25), 0.65));
    }

    // Bold will be handled as its own "black metal" card layout.

    // Card surface
    const outerPadRatio = typeof options.outerPadRatio === "number" ? options.outerPadRatio : 0.09;
    const pad = Math.round(Math.min(w, h) * outerPadRatio);
    const cardX = pad;
    const cardY = pad;
    const cardW = w - pad * 2;
    const cardH = h - pad * 2;

    const isBusinessCard = s.isBusinessCard !== false;
    const radius = isBusinessCard ? 0 : 26;

    if (family === "bold" && isBusinessCard) {
        // Black metal inspired layout (reference): dark gradient surface, left divider, stacked details, big vertical word.
        const baseRgb = colors.mainRgb;
        const base2Rgb = mixRgb(colors.mainRgb, colors.accentRgb, 0.55);
        const fgRgb = hexToRgb(colors.fgHex) || { r: 11, g: 11, b: 11 };
        const fg = rgbToCss(fgRgb, 0.92);
        const fg2 = rgbToCss(fgRgb, 0.74);

        // Card background gradient
        const grad = ctx2.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
        grad.addColorStop(0, rgbToCss(baseRgb, 1));
        grad.addColorStop(0.55, rgbToCss(mixRgb(baseRgb, base2Rgb, 0.35), 1));
        grad.addColorStop(1, rgbToCss(base2Rgb, 1));

        ctx2.save();
        roundedRect(ctx2, cardX, cardY, cardW, cardH, radius);
        ctx2.clip();
        ctx2.fillStyle = grad;
        ctx2.fillRect(cardX, cardY, cardW, cardH);

        // Subtle sheen
        ctx2.globalAlpha = colors.dark ? 0.22 : 0.10;
        ctx2.fillStyle = colors.dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,11,0.10)";
        ctx2.fillRect(cardX - cardW * 0.2, cardY + cardH * 0.08, cardW * 0.65, cardH * 0.08);
        ctx2.globalAlpha = 1;
        ctx2.restore();

        // Outer stroke
        ctx2.save();
        ctx2.strokeStyle = rgbToCss(fgRgb, 0.18);
        ctx2.lineWidth = 1;
        roundedRect(ctx2, cardX, cardY, cardW, cardH, radius);
        ctx2.stroke();
        ctx2.restore();

        const inset = Math.round(cardW * 0.06);
        const innerX = cardX + inset;
        const innerY = cardY + Math.round(cardH * 0.14);
        const rightStripW = Math.round(cardW * 0.18);
        const leftW = cardW - inset * 2 - rightStripW;

        // Left divider line
        ctx2.save();
        ctx2.strokeStyle = rgbToCss(fgRgb, 0.65);
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.moveTo(innerX, innerY - 18);
        ctx2.lineTo(innerX, cardY + cardH - Math.round(cardH * 0.16));
        ctx2.stroke();
        ctx2.restore();

        const textX = innerX + 22;
        const leftTextW = Math.max(1, leftW - 22);
        let y = innerY;

        const name = (s.name || "Your Name").trim().toUpperCase();
        const role = (s.role || "").trim().toUpperCase();
        const company = (s.company || "").trim().toUpperCase();

        const boldFamily = s.font === "sans"
            ? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
            : "ui-serif, Georgia, 'Times New Roman', Times, serif";

        ctx2.save();
        // Keep bold text confined to the left area (prevents spill into the right strip).
        ctx2.beginPath();
        ctx2.rect(textX, cardY, leftTextW, cardH);
        ctx2.clip();

        ctx2.fillStyle = fg;
        ctx2.font = `800 44px ${boldFamily}`;
        const nameLines = wrapText(ctx2, name, leftTextW);
        const nameLineH = 48;
        for (const line of nameLines.slice(0, 2)) {
            ctx2.fillText(line, textX, y);
            y += nameLineH;
        }

        y += 10;
        ctx2.fillStyle = fg2;
        ctx2.font = `800 22px ${boldFamily}`;
        if (role) {
            ctx2.fillText(role, textX, y);
            y += 28;
        }

        // Details
        const lines = [];
        if (company) lines.push(company);
        if (s.phone) lines.push(String(s.phone).trim());
        if (s.email) lines.push(String(s.email).trim());
        if (s.website) lines.push(asUrl(s.website));

        ctx2.font = `650 18px ${boldFamily}`;
        ctx2.fillStyle = rgbToCss(fgRgb, 0.68);
        for (const line of lines.slice(0, 5)) {
            ctx2.fillText(line, textX, y);
            y += 24;
        }
        ctx2.restore();

        // Vertical big word on the right (use company, else name)
        const vertical = (company || name || "CARD").replaceAll(/\s+/g, " ").trim();
        ctx2.save();
        ctx2.translate(cardX + cardW - Math.round(rightStripW * 0.45), cardY + cardH - Math.round(cardH * 0.10));
        ctx2.rotate(-Math.PI / 2);
        ctx2.font = `900 62px ${boldFamily}`;
        ctx2.fillStyle = rgbToCss(fgRgb, 0.86);
        ctx2.fillText(vertical, 0, 0);
        ctx2.restore();

        // QR: small, bottom-left
        const qrText = buildPublicCardUrl(s);
        const qrSize = Math.round(Math.min(cardW, cardH) * 0.18);
        const qrX = cardX + Math.round(cardW * 0.06);
        const qrY = cardY + cardH - Math.round(cardH * 0.06) - qrSize;
        const qrDataUrl = await generateQrDataUrl(qrText, qrSize * 2);
        if (qrDataUrl) {
            const img = await loadImage(qrDataUrl);
            ctx2.save();
            roundedRect(ctx2, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
            ctx2.fillStyle = colors.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.78)";
            ctx2.fill();
            ctx2.strokeStyle = colors.dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,11,0.12)";
            ctx2.stroke();
            ctx2.restore();
            ctx2.drawImage(img, qrX, qrY, qrSize, qrSize);
        }

        return;
    }

    ctx2.save();
    roundedRect(ctx2, cardX, cardY, cardW, cardH, radius);
    ctx2.clip();
    ctx2.fillStyle = colors.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.62)";
    ctx2.fillRect(cardX, cardY, cardW, cardH);
    ctx2.restore();

    ctx2.save();
    ctx2.strokeStyle = colors.dark ? "rgba(255,255,255,0.25)" : "rgba(11,11,11,0.18)";
    ctx2.lineWidth = 1;
    roundedRect(ctx2, cardX, cardY, cardW, cardH, radius);
    ctx2.stroke();
    ctx2.restore();

    const fg = colors.fgHex;

    // Text block
    const left = cardX + Math.round(cardW * 0.06);
    const topPadRatio = family === "minimal" ? 0.16 : 0.12;
    const top = cardY + Math.round(cardH * topPadRatio);
    const rightColumnW = Math.round(cardW * 0.28);
    const maxTextW = cardW - Math.round(cardW * 0.06) * 2 - rightColumnW;

    ctx2.fillStyle = fg;

    const name = (s.name || "Your Name").trim();
    const role = (s.role || "Your role / title").trim();
    const company = (s.company || "Company").trim();

    ctx2.font = fonts.title;
    const titleLines = wrapText(ctx2, name, maxTextW);
    const titleLineH = s.font === "sans" ? 56 : 58;
    let cursorY = top;

    for (const line of titleLines.slice(0, 3)) {
        ctx2.fillText(line, left, cursorY);
        cursorY += titleLineH;
    }

    cursorY += 6;
    ctx2.font = fonts.body;
    ctx2.globalAlpha = s.style === "night" ? 0.9 : 0.8;
    ctx2.fillText(role, left, cursorY);
    cursorY += 30;
    ctx2.fillText(company, left, cursorY);
    ctx2.globalAlpha = 1;

    // Contact
    const contact = [];
    if (s.email) contact.push(s.email);
    if (s.phone) contact.push(s.phone);
    if (s.website) contact.push(asUrl(s.website));
    if (s.location) contact.push(s.location);

    ctx2.font = fonts.small;
    ctx2.globalAlpha = s.style === "night" ? 0.85 : 0.7;
    const contactStartY = cardY + cardH - Math.round(cardH * 0.18);
    let contactY = contactStartY;
    for (const line of contact.slice(0, 4)) {
        ctx2.fillText(line, left, contactY);
        contactY += 22;
    }
    ctx2.globalAlpha = 1;

    // QR points to the public card URL
    const qrText = buildPublicCardUrl(s);
    const qrSize = Math.round(Math.min(cardW, cardH) * 0.24);
    const qrX = cardX + cardW - Math.round(cardW * 0.06) - qrSize;
    const qrY = cardY + Math.round(cardH * 0.12);

    const qrDataUrl = await generateQrDataUrl(qrText, qrSize * 2);
    if (qrDataUrl) {
        const img = await loadImage(qrDataUrl);

        ctx2.save();
        roundedRect(ctx2, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16);
        ctx2.fillStyle = colors.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.8)";
        ctx2.fill();
        ctx2.strokeStyle = colors.dark ? "rgba(255,255,255,0.20)" : "rgba(11,11,11,0.16)";
        ctx2.stroke();
        ctx2.restore();

        ctx2.drawImage(img, qrX, qrY, qrSize, qrSize);

        ctx2.save();
        ctx2.font = fonts.small;
        ctx2.fillStyle = fg;
        ctx2.globalAlpha = colors.dark ? 0.85 : 0.65;
        ctx2.fillText("Scan", qrX + 6, qrY + qrSize + 28);
        ctx2.restore();
    } else {
        ctx2.save();
        ctx2.strokeStyle = colors.dark ? "rgba(255,255,255,0.25)" : "rgba(11,11,11,0.25)";
        ctx2.setLineDash([6, 6]);
        roundedRect(ctx2, qrX, qrY, qrSize, qrSize, 12);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.font = fonts.small;
        ctx2.globalAlpha = 0.6;
        ctx2.fillText("QR", qrX + 10, qrY + 26);
        ctx2.restore();
    }

    // Socials: tiny row under QR
    const activeSocials = Object.entries(s.socials || {})
        .filter(([, url]) => (url || "").trim())
        .map(([slug]) => slug)
        .slice(0, 8);

    const iconSize = 16;
    const gap = 10;
    let sx = qrX;
    let sy = qrY + qrSize + 50;

    for (const slug of activeSocials) {
        const svgPath = SOCIAL_ICON_PATHS[slug];
        if (!svgPath) continue;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fg}" d="${svgPath}"/></svg>`;
        const img = await loadImage(svgToDataUrl(svg));
        ctx2.globalAlpha = colors.dark ? 0.85 : 0.7;
        ctx2.drawImage(img, sx, sy, iconSize, iconSize);
        sx += iconSize + gap;
        if (sx > qrX + qrSize - iconSize) break;
    }

    ctx2.globalAlpha = 1;

}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function renderWebCard(container, cardState) {
    const s = cardState || {};
    const colors = resolveColors(s);
    const name = (s.name || "").trim() || "Your Name";
    const role = (s.role || "").trim();
    const company = (s.company || "").trim();

    const websiteUrl = asUrl(s.website);
    const emailUrl = (s.email || "").trim() ? `mailto:${(s.email || "").trim()}` : "";
    const phoneUrl = (s.phone || "").trim() ? `tel:${(s.phone || "").trim()}` : "";

    const socials = Object.entries(s.socials || {})
        .filter(([, url]) => (url || "").trim())
        .map(([slug, url]) => {
            const title = slug;
            const href = asUrl(url);
            const iconPath = SOCIAL_ICON_PATHS[slug];
            const icon = iconPath
                ? `<svg class="webIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}"></path></svg>`
                : "";
            return { slug, title, href, icon };
        });

    container.hidden = false;
    container.classList.add("webCardHost");
    container.style.setProperty("--cardMainColor", colors.mainHex);
    container.style.setProperty("--cardAccentColor", colors.accentHex);
    container.style.setProperty("--cardFgColor", colors.fgHex);

    const theme = colors.dark ? "dark" : "light";

    container.innerHTML = `
        <div class="webCard" data-style="${escapeHtml(s.style || "minimal")}" data-font="${escapeHtml(s.font || "serif")}" data-theme="${theme}">
            <div class="webCardHero">
                <div class="webCardTopline"></div>
                <h2 class="webCardName">${escapeHtml(name)}</h2>
                ${role || company ? `<div class="webCardSub">${escapeHtml([role, company].filter(Boolean).join(" • "))}</div>` : ""}
            </div>

            <div class="webCardSection">
                <div class="webCardLabel">Contact</div>
                <div class="webCardLinks">
                    ${websiteUrl ? `<a class="webLink" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noreferrer">Website</a>` : ""}
                    ${emailUrl ? `<a class="webLink" href="${escapeHtml(emailUrl)}">Email</a>` : ""}
                    ${phoneUrl ? `<a class="webLink" href="${escapeHtml(phoneUrl)}">Phone</a>` : ""}
                    ${s.location ? `<div class="webMeta">${escapeHtml(s.location)}</div>` : ""}
                </div>
            </div>

            ${socials.length ? `
            <div class="webCardSection">
                <div class="webCardLabel">Links</div>
                <div class="webCardSocials">
                    ${socials
                .map(
                    (it) => `
                        <a class="webSocial" href="${escapeHtml(it.href)}" target="_blank" rel="noreferrer">
                            ${it.icon}
                            <span>${escapeHtml(it.slug)}</span>
                        </a>`
                )
                .join("")}
                </div>
            </div>`
            : ""}
        </div>
    `;
}
