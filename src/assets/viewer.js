import { decodeCardState, drawCardToCanvas, renderWebCard } from "./card-lib.js";

const canvas = document.getElementById("publicCanvas");
const web = document.getElementById("publicWeb");
const errorEl = document.getElementById("viewerError");

function setError(message) {
    if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = message;
    }
}

function getHashPayload() {
    const hash = (globalThis.location?.hash || "").replace(/^#/, "");
    return hash.trim();
}

function resizeCanvasToCssPixels(targetCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor((globalThis.devicePixelRatio || 1) * 100) / 100);
    const nextW = Math.max(1, Math.round(rect.width * dpr));
    const nextH = Math.max(1, Math.round(rect.height * dpr));

    if (targetCanvas.width !== nextW) targetCanvas.width = nextW;
    if (targetCanvas.height !== nextH) targetCanvas.height = nextH;
}

let lastPayload = "";
let renderQueued = false;
function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(async () => {
        renderQueued = false;

        const payload = getHashPayload();
        if (!payload) {
            setError("Missing card data in this URL.");
            return;
        }

        if (payload !== lastPayload && errorEl) {
            errorEl.hidden = true;
        }

        try {
            const state = decodeCardState(payload);
            lastPayload = payload;

            if (state.isBusinessCard === false) {
                if (canvas) canvas.hidden = true;
                if (web) {
                    web.hidden = false;
                    renderWebCard(web, state);
                }
                return;
            }

            if (web) web.hidden = true;
            if (canvas) {
                canvas.hidden = false;
                resizeCanvasToCssPixels(canvas);
                await drawCardToCanvas(canvas, state, { outerPadRatio: 0.11 });
            }
        } catch (err) {
            console.error(err);
            setError("Invalid card data in this URL.");
        }
    });
}

if (!canvas && !web) {
    setError("Viewer is missing its output elements.");
} else {
    queueRender();
    globalThis.addEventListener("hashchange", queueRender);
    globalThis.addEventListener("resize", queueRender);
}
