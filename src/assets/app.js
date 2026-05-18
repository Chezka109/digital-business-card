import { SOCIAL_PLATFORMS, SOCIAL_ICON_PATHS } from "./social-icons.js";
import { buildPublicCardUrl, drawCardToCanvas, generateQrDataUrl, renderWebCard } from "./card-lib.js";

const DEFAULTS = {
    step: 1,
    style: "minimal",
    font: "serif",
    mainColor: "#f6f5f2",
    accentColor: "#c8c2ff",
    isBusinessCard: false,
    name: "",
    role: "",
    company: "",
    website: "",
    email: "",
    phone: "",
    location: "",
    socials: {}
};

const el = {
    form: document.getElementById("cardForm"),
    steps: Array.from(document.querySelectorAll(".step")),
    stepLabel: document.getElementById("stepLabel"),
    mainColor: document.getElementById("mainColor"),
    accentColor: document.getElementById("accentColor"),
    isBusinessCard: document.getElementById("isBusinessCard"),
    styleField: document.getElementById("styleField"),
    socialAddBtn: document.getElementById("socialAddBtn"),
    socialMenu: document.getElementById("socialMenu"),
    socialSelected: document.getElementById("socialSelected"),
    previewCanvas: document.getElementById("previewCanvas"),
    webPreview: document.getElementById("webPreview"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    downloadBtn: document.getElementById("downloadBtn"),
    downloadFormat: document.getElementById("downloadFormat")
};

let state = structuredClone(DEFAULTS);

let rememberedStyle = state.style;

function syncBusinessCardControls() {
    const isBc = Boolean(state.isBusinessCard);
    if (el.styleField) el.styleField.hidden = !isBc;

    const styleSelect = document.getElementById("style");
    if (styleSelect instanceof HTMLSelectElement) {
        styleSelect.disabled = !isBc;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buildPayloadUrl() {
    return buildPublicCardUrl(state);
}

function setOverlayVisible(visible) {
    el.loadingOverlay.hidden = !visible;
    el.loadingOverlay.setAttribute("aria-hidden", String(!visible));
}

function renderPaletteChoices() {
    // Palettes were replaced by main/accent color pickers.
}

function iconSvg(slug) {
    const path = SOCIAL_ICON_PATHS[slug];
    if (!path) return "";
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
}

function setSocialMenuOpen(open) {
    if (!el.socialMenu || !el.socialAddBtn) return;
    el.socialMenu.hidden = !open;
    el.socialAddBtn.setAttribute("aria-expanded", String(open));
    if (open) renderSocialMenu();
}

function renderSocialMenu() {
    if (!el.socialMenu) return;

    const selected = new Set(Object.keys(state.socials || {}));
    const available = SOCIAL_PLATFORMS.filter((p) => !selected.has(p.slug));

    el.socialMenu.innerHTML = "";

    if (!available.length) {
        const empty = document.createElement("div");
        empty.className = "socialMenuEmpty";
        empty.textContent = "All platforms added.";
        el.socialMenu.appendChild(empty);
        return;
    }

    for (const platform of available) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "socialMenuItem";
        btn.setAttribute("role", "menuitem");
        btn.dataset.slug = platform.slug;
        btn.innerHTML = `
            <span class="iconBadge" aria-hidden="true">${iconSvg(platform.slug)}</span>
            <span>${platform.title}</span>
        `;
        el.socialMenu.appendChild(btn);
    }
}

function renderSelectedSocials() {
    if (!el.socialSelected) return;
    const selectedSlugs = new Set(Object.keys(state.socials || {}));
    const selectedPlatforms = SOCIAL_PLATFORMS.filter((p) => selectedSlugs.has(p.slug));

    el.socialSelected.innerHTML = "";

    if (!selectedPlatforms.length) {
        const hint = document.createElement("div");
        hint.className = "muted";
        hint.style.margin = "10px 0 0";
        hint.textContent = "Click + Add a social to choose platforms.";
        el.socialSelected.appendChild(hint);
        return;
    }

    for (const platform of selectedPlatforms) {
        const row = document.createElement("div");
        row.className = "socialItem";
        row.innerHTML = `
            <div class="iconBadge" title="${platform.title}">${iconSvg(platform.slug)}</div>
            <label class="field" style="margin:0">
                <span class="label">${platform.title} URL</span>
                <input
                    name="social_${platform.slug}"
                    data-social="${platform.slug}"
                    placeholder="https://"
                    inputmode="url"
                />
            </label>
            <button type="button" class="iconBtn" data-remove-social="${platform.slug}" aria-label="Remove ${platform.title}">×</button>
        `;

        const input = row.querySelector("input");
        input.value = state.socials[platform.slug] || "";

        el.socialSelected.appendChild(row);
    }
}

function syncFormToState() {
    // Step label
    el.stepLabel.textContent = `Step ${state.step} of 4`;

    // Steps visibility
    for (const stepEl of el.steps) {
        const step = Number(stepEl.dataset.step);
        stepEl.hidden = step !== state.step;
    }

    // Style & font
    const styleSelect = document.getElementById("style");
    const fontSelect = document.getElementById("font");
    if (styleSelect && styleSelect.value !== state.style) styleSelect.value = state.style;
    if (fontSelect && fontSelect.value !== state.font) fontSelect.value = state.font;

    if (el.mainColor && el.mainColor.value !== state.mainColor) el.mainColor.value = state.mainColor;
    if (el.accentColor && el.accentColor.value !== state.accentColor) el.accentColor.value = state.accentColor;
    if (el.isBusinessCard && el.isBusinessCard.checked !== Boolean(state.isBusinessCard)) el.isBusinessCard.checked = Boolean(state.isBusinessCard);

    syncBusinessCardControls();

    // Details inputs
    for (const id of ["name", "role", "company", "website", "email", "phone", "location"]) {
        const input = document.getElementById(id);
        if (!input) continue;
        if (input.value !== state[id]) input.value = state[id];
    }
}

function readStateFromForm() {
    const style = document.getElementById("style")?.value;
    const font = document.getElementById("font")?.value;
    if (style) state.style = style;
    if (font) state.font = font;

    if (el.mainColor?.value) state.mainColor = el.mainColor.value;
    if (el.accentColor?.value) state.accentColor = el.accentColor.value;
    if (el.isBusinessCard) state.isBusinessCard = el.isBusinessCard.checked;

    for (const id of ["name", "role", "company", "website", "email", "phone", "location"]) {
        const input = document.getElementById(id);
        if (!input) continue;
        state[id] = input.value;
    }
}

function drawSoftBackground(ctx2, w, h) {
    ctx2.save();
    ctx2.globalAlpha = 0.55;
    ctx2.filter = "blur(60px)";
    ctx2.fillStyle = state.accentColor;
    ctx2.beginPath();
    ctx2.arc(w * 0.70, h * 0.30, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 0.35;
    ctx2.fillStyle = state.mainColor;
    ctx2.beginPath();
    ctx2.arc(w * 0.30, h * 0.20, Math.min(w, h) * 0.24, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
}

let renderQueued = false;
function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(async () => {
        renderQueued = false;
        readStateFromForm();

        if (state.isBusinessCard === false) {
            if (el.previewCanvas) el.previewCanvas.hidden = true;
            if (el.webPreview) {
                el.webPreview.hidden = false;
                renderWebCard(el.webPreview, state);
            }
            return;
        }

        if (el.webPreview) el.webPreview.hidden = true;
        if (el.previewCanvas) {
            el.previewCanvas.hidden = false;
            await drawCardToCanvas(el.previewCanvas, state, { outerPadRatio: 0.11 });
        }
    });
}

function goToStep(step) {
    state.step = clamp(step, 1, 4);
    syncFormToState();
    // Keep the preview fresh.
    queueRender();
    // Focus first input in the step for usability.
    const stepEl = el.steps.find((s) => Number(s.dataset.step) === state.step);
    const focusable = stepEl?.querySelector("select, input, button");
    focusable?.focus();
}

function wireStepperButtons() {
    el.form.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.matches("[data-next]")) {
            ev.preventDefault();
            goToStep(state.step + 1);
        }

        if (target.matches("[data-prev]")) {
            ev.preventDefault();
            goToStep(state.step - 1);
        }
    });
}

function wireInputs() {
    el.form.addEventListener("input", (ev) => {
        const target = ev.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

        if (target.id === "style") {
            state.style = target.value;
        }
        if (target.id === "font") {
            state.font = target.value;
        }

        if (target.id === "mainColor") {
            state.mainColor = target.value;
        }
        if (target.id === "accentColor") {
            state.accentColor = target.value;
        }
        if (target.id === "isBusinessCard") {
            const next = target.checked;
            if (!next) {
                rememberedStyle = state.style;
                state.style = "minimal";
            } else {
                state.style = rememberedStyle || state.style || "minimal";
            }
            state.isBusinessCard = next;
            syncFormToState();
        }

        queueRender();
    });
}


function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function handleDownload() {
    setOverlayVisible(true);

    // Let the overlay paint before heavy work.
    await new Promise((r) => setTimeout(r, 40));

    readStateFromForm();

    const format = el.downloadFormat.value;
    const safeName = (state.name || "digital-card").trim().replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "");
    const base = safeName || "digital-card";

    const qrText = buildPayloadUrl();

    try {
        if (format === "qr") {
            const qrDataUrl = await generateQrDataUrl(qrText, 1024);
            if (!qrDataUrl) throw new Error("QR generation unavailable");
            downloadDataUrl(qrDataUrl, `${base}-qr.png`);
            return;
        }

        const exportCanvas = document.createElement("canvas");

        if (format === "phone16x9") {
            // Portrait phone wallpaper: 9:16 (16h x 9w)
            exportCanvas.width = 1080;
            exportCanvas.height = 1920;

            // Draw a background + centered card.
            const ectx = exportCanvas.getContext("2d");
            ectx.fillStyle = state.mainColor;
            ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

            drawSoftBackground(ectx, exportCanvas.width, exportCanvas.height);

            const cardCanvas = document.createElement("canvas");
            cardCanvas.width = 1000;
            cardCanvas.height = 600;
            await drawCardToCanvas(cardCanvas, { ...state, isBusinessCard: true }, { outerPadRatio: 0.12 });

            const maxW = exportCanvas.width * 0.90;
            const maxH = exportCanvas.height * 0.58;
            const scale = Math.min(maxW / cardCanvas.width, maxH / cardCanvas.height);
            const drawW = Math.round(cardCanvas.width * scale);
            const drawH = Math.round(cardCanvas.height * scale);
            const x = Math.round((exportCanvas.width - drawW) / 2);
            const y = Math.round((exportCanvas.height - drawH) / 2);
            ectx.drawImage(cardCanvas, x, y, drawW, drawH);

            downloadDataUrl(exportCanvas.toDataURL("image/png"), `${base}-9x16.png`);
            return;
        }

        if (format === "business") {
            exportCanvas.width = 1050;
            exportCanvas.height = 600;
            await drawCardToCanvas(exportCanvas, { ...state, isBusinessCard: true }, { outerPadRatio: 0.12 });
            downloadDataUrl(exportCanvas.toDataURL("image/png"), `${base}-business-card.png`);
            return;
        }
    } finally {
        setOverlayVisible(false);
    }
}

function init() {
    renderSelectedSocials();
    wireStepperButtons();
    wireInputs();
    syncFormToState();
    queueRender();

    if (el.socialAddBtn && el.socialMenu) {
        el.socialAddBtn.setAttribute("aria-haspopup", "menu");
        el.socialAddBtn.setAttribute("aria-expanded", "false");
        el.socialMenu.setAttribute("role", "menu");
        el.socialMenu.hidden = true;

        el.socialAddBtn.addEventListener("click", (e) => {
            e.preventDefault();
            setSocialMenuOpen(el.socialMenu.hidden);
        });

        el.socialMenu.addEventListener("click", (e) => {
            const target = e.target;
            const btn = target instanceof HTMLElement ? target.closest("button[data-slug]") : null;
            if (!(btn instanceof HTMLButtonElement)) return;
            const slug = btn.dataset.slug;
            if (!slug) return;
            if (!state.socials) state.socials = {};
            if (state.socials[slug] === undefined) state.socials[slug] = "";
            renderSelectedSocials();
            setSocialMenuOpen(false);
            queueRender();

            const input = el.socialSelected?.querySelector(`input[data-social="${slug}"]`);
            if (input instanceof HTMLInputElement) input.focus();
        });

        document.addEventListener("click", (e) => {
            if (el.socialMenu.hidden) return;
            const target = e.target;
            if (!(target instanceof Node)) return;
            if (el.socialMenu.contains(target) || el.socialAddBtn.contains(target)) return;
            setSocialMenuOpen(false);
        });

        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            if (el.socialMenu.hidden) return;
            setSocialMenuOpen(false);
            el.socialAddBtn.focus();
        });
    }

    if (el.socialSelected) {
        el.socialSelected.addEventListener("input", (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            const slug = target.dataset.social;
            if (!slug) return;
            if (!state.socials) state.socials = {};
            state.socials[slug] = target.value;
            queueRender();
        });

        el.socialSelected.addEventListener("click", (e) => {
            const target = e.target;
            const btn = target instanceof HTMLElement ? target.closest("button[data-remove-social]") : null;
            if (!(btn instanceof HTMLButtonElement)) return;
            const slug = btn.dataset.removeSocial;
            if (!slug) return;
            delete state.socials[slug];
            renderSelectedSocials();
            renderSocialMenu();
            queueRender();
        });
    }

    el.downloadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleDownload().catch((err) => {
            console.error(err);
            setOverlayVisible(false);
            alert("Could not generate download. Try again.");
        });
    });
}

init();
