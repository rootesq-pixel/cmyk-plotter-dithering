/* ==========================================================================
   CMYK Pen Plotter Dithering Studio - Pro Engine + Anti-Moiré + Smooth UI
   ========================================================================== */

(function () {
    'use strict';

    // Core State
    const state = {
        image: null,
        imageCanvas: document.createElement('canvas'),
        imageCtx: null,
        paperWidthMm: 210,
        paperHeightMm: 297,
        settings: {
            brightness: 0,
            contrast: 0,
            gamma: 1.0,
            invert: false,
            motifType: 'circles', // 'circles', 'stripes', 'stars', 'custom'
            gridSizeMm: 4.0,
            maxScalePct: 100,
            strokeWidthMm: 0.50,
            paperPreset: 'A4',
            orientation: 'portrait',
            activeViewMode: 'composite', // 'composite', 'cyan', 'magenta', 'yellow', 'key'
            
            // Advanced CMYK Pipeline & Profile Settings
            profile: 'balanced', // 'soft', 'balanced', 'crisp'
            sobelStrength: 50, // 0 to 100%
            ucrFactor: 80, // 0 to 100% (Under Color Removal)
            
            // Anti-Moiré Engine Settings
            antiMoireEnabled: true,
            antiMoireMode: 'rosette', // 'rosette', 'stochastic', 'standard'
            antiMoireBlur: 1.5
        },
        channels: {
            C: true,
            M: true,
            Y: true,
            K: true
        },
        customMotifStrokes: [],
        customSvgPath: 'M -0.4 -0.4 L 0.4 0.4 M 0.4 -0.4 L -0.4 0.4',
        customMotifPoints: []
    };

    state.imageCtx = state.imageCanvas.getContext('2d', { willReadFrequently: true });

    // Paper Presets (width, height in mm)
    const PAPER_PRESETS = {
        'A4': { w: 210, h: 297 },
        'A3': { w: 297, h: 420 },
        'Letter': { w: 216, h: 279 },
        'Square': { w: 200, h: 200 }
    };

    // CMYK Screen Angles & Colors for Anti-Moiré Halftoning (Order: Light to Dark for Plotting)
    const LAYER_CONFIGS = {
        Y: { name: 'Yellow', color: '#ffea00', angle: 0, filenameKey: 'Capa1_Amarillo', layerNum: 1, rosetteOffsetX: 0.00, rosetteOffsetY: 0.50 },
        M: { name: 'Magenta', color: '#ff007f', angle: 75, filenameKey: 'Capa2_Magenta', layerNum: 2, rosetteOffsetX: 0.25, rosetteOffsetY: 0.75 },
        C: { name: 'Cyan', color: '#00e5ff', angle: 15, filenameKey: 'Capa3_Cyan', layerNum: 3, rosetteOffsetX: 0.50, rosetteOffsetY: 0.25 },
        K: { name: 'KeyBlack', color: '#111111', angle: 45, filenameKey: 'Capa4_Negro', layerNum: 4, rosetteOffsetX: 0.33, rosetteOffsetY: 0.33 }
    };

    // Performance Throttling / Debouncing State
    let renderScheduled = false;
    let debounceTimer = null;

    function scheduleSmoothRender(delay = 60) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!renderScheduled) {
                renderScheduled = true;
                requestAnimationFrame(() => {
                    renderPreview();
                    renderScheduled = false;
                });
            }
        }, delay);
    }

    // DOM References
    const dom = {};

    function initDOMReferences() {
        dom.imageUpload = document.getElementById('image-upload');
        dom.imageUploadDrop = document.getElementById('image-upload-drop');
        dom.btnExportZip = document.getElementById('btn-export-zip');
        dom.btnPlaystoreGuide = document.getElementById('btn-playstore-guide');
        dom.modalPlaystore = document.getElementById('modal-playstore');
        dom.btnClosePlaystore = document.getElementById('btn-close-playstore');
        dom.btnUnderstoodPlaystore = document.getElementById('btn-understood-playstore');

        dom.sidebar = document.getElementById('sidebar');
        dom.mobileDrawerToggle = document.getElementById('mobile-drawer-toggle');

        dom.selectProfile = document.getElementById('select-profile');
        dom.inputSobel = document.getElementById('input-sobel');
        dom.valSobel = document.getElementById('val-sobel');
        dom.inputUcr = document.getElementById('input-ucr');
        dom.valUcr = document.getElementById('val-ucr');

        dom.inputAntiMoireEnable = document.getElementById('input-antimoire-enable');
        dom.selectAntiMoireMode = document.getElementById('select-antimoire-mode');
        dom.inputAntiMoireBlur = document.getElementById('input-antimoire-blur');
        dom.valAntiMoireBlur = document.getElementById('val-antimoire-blur');

        dom.inputBrightness = document.getElementById('input-brightness');
        dom.valBrightness = document.getElementById('val-brightness');
        dom.inputContrast = document.getElementById('input-contrast');
        dom.valContrast = document.getElementById('val-contrast');
        dom.inputGamma = document.getElementById('input-gamma');
        dom.valGamma = document.getElementById('val-gamma');
        dom.inputInvert = document.getElementById('input-invert');

        dom.selectMotif = document.getElementById('select-motif');
        dom.inputGridSize = document.getElementById('input-grid-size');
        dom.valGridSize = document.getElementById('val-grid-size');
        dom.inputMaxScale = document.getElementById('input-max-scale');
        dom.valMaxScale = document.getElementById('val-max-scale');

        dom.toggleCyan = document.getElementById('toggle-cyan');
        dom.toggleMagenta = document.getElementById('toggle-magenta');
        dom.toggleYellow = document.getElementById('toggle-yellow');
        dom.toggleKey = document.getElementById('toggle-key');

        dom.inputStrokeWidth = document.getElementById('input-stroke-width');
        dom.selectPaperSize = document.getElementById('select-paper-size');
        dom.customDimsGroup = document.getElementById('custom-dims-group');
        dom.inputPaperWidth = document.getElementById('input-paper-width');
        dom.inputPaperHeight = document.getElementById('input-paper-height');
        dom.selectOrientation = document.getElementById('select-orientation');

        dom.filenameCyan = document.getElementById('filename-cyan');
        dom.filenameMagenta = document.getElementById('filename-magenta');
        dom.filenameYellow = document.getElementById('filename-yellow');
        dom.filenameKey = document.getElementById('filename-key');
        
        dom.btnExportCyan = document.getElementById('btn-export-cyan');
        dom.btnExportMagenta = document.getElementById('btn-export-magenta');
        dom.btnExportYellow = document.getElementById('btn-export-yellow');
        dom.btnExportKey = document.getElementById('btn-export-key');
        dom.btnExportComposite = document.getElementById('btn-export-composite');
        dom.btnExportPng = document.getElementById('btn-export-png');

        dom.mainCanvas = document.getElementById('main-preview-canvas');
        dom.mainCtx = dom.mainCanvas.getContext('2d');
        dom.emptyState = document.getElementById('empty-state');
        dom.statPaths = document.getElementById('stat-paths');
        dom.statDims = document.getElementById('stat-dims');

        dom.motifEditorCanvas = document.getElementById('motif-editor-canvas');
        dom.motifEditorCtx = dom.motifEditorCanvas.getContext('2d');
        dom.btnClearMotif = document.getElementById('btn-clear-motif');
        dom.btnPresetHeart = document.getElementById('btn-preset-heart');
        dom.btnPresetHexagon = document.getElementById('btn-preset-hexagon');
        dom.btnPresetSpiral = document.getElementById('btn-preset-spiral');
        dom.inputSvgPath = document.getElementById('input-svg-path');
        dom.btnApplySvgPath = document.getElementById('btn-apply-svg-path');
    }

    // Initialize Application
    function init() {
        initDOMReferences();
        bindEvents();
        initMotifEditor();
        updatePaperDimensions();
        updateExportFilenames();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
        }
    }

    // Bind Event Listeners with Debounced Smooth Rendering
    function bindEvents() {
        if (dom.mobileDrawerToggle) {
            dom.mobileDrawerToggle.addEventListener('click', () => {
                dom.sidebar.classList.toggle('mobile-open');
            });
        }

        const navCmyk = document.getElementById('mobile-nav-cmyk');
        const navMotif = document.getElementById('mobile-nav-motif');
        const navPlotter = document.getElementById('mobile-nav-plotter');
        const navExport = document.getElementById('mobile-nav-export');

        if (navCmyk) {
            navCmyk.addEventListener('click', () => {
                switchTab('tab-cmyk');
                dom.sidebar.classList.add('mobile-open');
                updateMobileNavActive(navCmyk);
            });
        }
        if (navMotif) {
            navMotif.addEventListener('click', () => {
                switchTab('tab-motif');
                dom.sidebar.classList.add('mobile-open');
                updateMobileNavActive(navMotif);
            });
        }
        if (navPlotter) {
            navPlotter.addEventListener('click', () => {
                switchTab('tab-plotter');
                dom.sidebar.classList.add('mobile-open');
                updateMobileNavActive(navPlotter);
            });
        }
        if (navExport) {
            navExport.addEventListener('click', exportAllLayersZip);
        }

        dom.imageUpload.addEventListener('change', handleImageUpload);
        if (dom.imageUploadDrop) dom.imageUploadDrop.addEventListener('change', handleImageUpload);

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Profile, Sobel & UCR Pipeline Controls
        if (dom.selectProfile) {
            dom.selectProfile.addEventListener('change', (e) => {
                const profile = e.target.value;
                state.settings.profile = profile;
                if (profile === 'soft') {
                    state.settings.gridSizeMm = 5.0;
                    state.settings.antiMoireBlur = 2.0;
                    state.settings.sobelStrength = 20;
                    state.settings.ucrFactor = 60;
                } else if (profile === 'balanced') {
                    state.settings.gridSizeMm = 4.0;
                    state.settings.antiMoireBlur = 1.5;
                    state.settings.sobelStrength = 50;
                    state.settings.ucrFactor = 80;
                } else if (profile === 'crisp') {
                    state.settings.gridSizeMm = 3.0;
                    state.settings.antiMoireBlur = 0.5;
                    state.settings.sobelStrength = 90;
                    state.settings.ucrFactor = 100;
                }
                if (dom.inputGridSize) dom.inputGridSize.value = state.settings.gridSizeMm;
                if (dom.valGridSize) dom.valGridSize.textContent = `${state.settings.gridSizeMm.toFixed(1)} mm`;
                if (dom.inputAntiMoireBlur) dom.inputAntiMoireBlur.value = state.settings.antiMoireBlur;
                if (dom.valAntiMoireBlur) dom.valAntiMoireBlur.textContent = `${state.settings.antiMoireBlur.toFixed(1)} px`;
                if (dom.inputSobel) dom.inputSobel.value = state.settings.sobelStrength;
                if (dom.valSobel) dom.valSobel.textContent = `${state.settings.sobelStrength}%`;
                if (dom.inputUcr) dom.inputUcr.value = state.settings.ucrFactor;
                if (dom.valUcr) dom.valUcr.textContent = `${state.settings.ucrFactor}%`;
                scheduleSmoothRender(20);
            });
        }

        if (dom.inputSobel) {
            dom.inputSobel.addEventListener('input', (e) => {
                state.settings.sobelStrength = parseInt(e.target.value);
                if (dom.valSobel) dom.valSobel.textContent = `${state.settings.sobelStrength}%`;
                scheduleSmoothRender(80);
            });
        }

        if (dom.inputUcr) {
            dom.inputUcr.addEventListener('input', (e) => {
                state.settings.ucrFactor = parseInt(e.target.value);
                if (dom.valUcr) dom.valUcr.textContent = `${state.settings.ucrFactor}%`;
                scheduleSmoothRender(80);
            });
        }

        // Anti-Moiré Controls
        dom.inputAntiMoireEnable.addEventListener('change', (e) => {
            state.settings.antiMoireEnabled = e.target.checked;
            scheduleSmoothRender(20);
        });

        dom.selectAntiMoireMode.addEventListener('change', (e) => {
            state.settings.antiMoireMode = e.target.value;
            scheduleSmoothRender(20);
        });

        dom.inputAntiMoireBlur.addEventListener('input', (e) => {
            state.settings.antiMoireBlur = parseFloat(e.target.value);
            dom.valAntiMoireBlur.textContent = `${state.settings.antiMoireBlur.toFixed(1)} px`;
            scheduleSmoothRender(80);
        });

        // Image Adjustments (Debounced to prevent freezing on slider drag)
        dom.inputBrightness.addEventListener('input', (e) => {
            state.settings.brightness = parseInt(e.target.value);
            dom.valBrightness.textContent = state.settings.brightness;
            scheduleSmoothRender(80);
        });

        dom.inputContrast.addEventListener('input', (e) => {
            state.settings.contrast = parseInt(e.target.value);
            dom.valContrast.textContent = state.settings.contrast;
            scheduleSmoothRender(80);
        });

        dom.inputGamma.addEventListener('input', (e) => {
            state.settings.gamma = parseFloat(e.target.value);
            dom.valGamma.textContent = state.settings.gamma.toFixed(1);
            scheduleSmoothRender(80);
        });

        dom.inputInvert.addEventListener('change', (e) => {
            state.settings.invert = e.target.checked;
            scheduleSmoothRender(20);
        });

        // Dithering Settings
        dom.selectMotif.addEventListener('change', (e) => {
            state.settings.motifType = e.target.value;
            scheduleSmoothRender(20);
        });

        dom.inputGridSize.addEventListener('input', (e) => {
            state.settings.gridSizeMm = parseFloat(e.target.value);
            dom.valGridSize.textContent = `${state.settings.gridSizeMm.toFixed(1)} mm`;
            scheduleSmoothRender(80);
        });

        dom.inputMaxScale.addEventListener('input', (e) => {
            state.settings.maxScalePct = parseInt(e.target.value);
            dom.valMaxScale.textContent = `${state.settings.maxScalePct}%`;
            scheduleSmoothRender(80);
        });

        // Channel Toggles
        dom.toggleCyan.addEventListener('change', (e) => { state.channels.C = e.target.checked; scheduleSmoothRender(20); });
        dom.toggleMagenta.addEventListener('change', (e) => { state.channels.M = e.target.checked; scheduleSmoothRender(20); });
        dom.toggleYellow.addEventListener('change', (e) => { state.channels.Y = e.target.checked; scheduleSmoothRender(20); });
        dom.toggleKey.addEventListener('change', (e) => { state.channels.K = e.target.checked; scheduleSmoothRender(20); });

        // Plotter Settings
        dom.inputStrokeWidth.addEventListener('input', (e) => {
            state.settings.strokeWidthMm = parseFloat(e.target.value) || 0.5;
            updateExportFilenames();
            scheduleSmoothRender(60);
        });

        dom.selectPaperSize.addEventListener('change', (e) => {
            state.settings.paperPreset = e.target.value;
            if (e.target.value === 'Custom') {
                dom.customDimsGroup.classList.remove('hidden');
            } else {
                dom.customDimsGroup.classList.add('hidden');
            }
            updatePaperDimensions();
            scheduleSmoothRender(20);
        });

        dom.inputPaperWidth.addEventListener('input', () => { updatePaperDimensions(); scheduleSmoothRender(60); });
        dom.inputPaperHeight.addEventListener('input', () => { updatePaperDimensions(); scheduleSmoothRender(60); });
        dom.selectOrientation.addEventListener('change', (e) => {
            state.settings.orientation = e.target.value;
            updatePaperDimensions();
            scheduleSmoothRender(20);
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.settings.activeViewMode = btn.dataset.mode;
                scheduleSmoothRender(20);
            });
        });

        dom.btnExportCyan.addEventListener('click', () => downloadSingleLayer('C'));
        dom.btnExportMagenta.addEventListener('click', () => downloadSingleLayer('M'));
        dom.btnExportYellow.addEventListener('click', () => downloadSingleLayer('Y'));
        dom.btnExportKey.addEventListener('click', () => downloadSingleLayer('K'));
        dom.btnExportComposite.addEventListener('click', downloadCompositeSVG);
        dom.btnExportPng.addEventListener('click', downloadPNG);
        dom.btnExportZip.addEventListener('click', exportAllLayersZip);

        if (dom.btnPlaystoreGuide) dom.btnPlaystoreGuide.addEventListener('click', () => dom.modalPlaystore.classList.remove('hidden'));
        if (dom.btnClosePlaystore) dom.btnClosePlaystore.addEventListener('click', () => dom.modalPlaystore.classList.add('hidden'));
        if (dom.btnUnderstoodPlaystore) dom.btnUnderstoodPlaystore.addEventListener('click', () => dom.modalPlaystore.classList.add('hidden'));

        const btnFullscreen = document.getElementById('btn-toggle-fullscreen-canvas');
        const navFullscreen = document.getElementById('mobile-nav-fullscreen');
        
        if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreenCanvas);
        if (navFullscreen) navFullscreen.addEventListener('click', toggleFullscreenCanvas);
    }

    function toggleFullscreenCanvas() {
        document.body.classList.toggle('fullscreen-canvas');
        if (dom.sidebar) dom.sidebar.classList.remove('mobile-open');
        scheduleSmoothRender(20);
    }

    function switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeTabBtn) activeTabBtn.classList.add('active');
        const activeTabContent = document.getElementById(tabId);
        if (activeTabContent) activeTabContent.classList.add('active');
    }

    function updateMobileNavActive(activeEl) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        if (activeEl) activeEl.classList.add('active');
    }

    function updatePaperDimensions() {
        let w = 210, h = 297;
        if (state.settings.paperPreset in PAPER_PRESETS) {
            w = PAPER_PRESETS[state.settings.paperPreset].w;
            h = PAPER_PRESETS[state.settings.paperPreset].h;
        } else {
            w = parseFloat(dom.inputPaperWidth.value) || 210;
            h = parseFloat(dom.inputPaperHeight.value) || 297;
        }

        if (state.settings.orientation === 'landscape') {
            state.paperWidthMm = Math.max(w, h);
            state.paperHeightMm = Math.min(w, h);
        } else {
            state.paperWidthMm = Math.min(w, h);
            state.paperHeightMm = Math.max(w, h);
        }

        dom.statDims.textContent = `${state.paperWidthMm} x ${state.paperHeightMm} mm`;
    }

    function updateExportFilenames() {
        const strokeStr = state.settings.strokeWidthMm.toFixed(2);
        if (dom.filenameYellow) dom.filenameYellow.textContent = `CMYK_${LAYER_CONFIGS.Y.filenameKey}_Grosor_${strokeStr}mm.svg`;
        if (dom.filenameMagenta) dom.filenameMagenta.textContent = `CMYK_${LAYER_CONFIGS.M.filenameKey}_Grosor_${strokeStr}mm.svg`;
        if (dom.filenameCyan) dom.filenameCyan.textContent = `CMYK_${LAYER_CONFIGS.C.filenameKey}_Grosor_${strokeStr}mm.svg`;
        if (dom.filenameKey) dom.filenameKey.textContent = `CMYK_${LAYER_CONFIGS.K.filenameKey}_Grosor_${strokeStr}mm.svg`;
    }

    function handleImageUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                state.image = img;
                dom.emptyState.classList.add('hidden');
                processImageBuffer();
                scheduleSmoothRender(20);
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }

    function processImageBuffer() {
        if (!state.image) return;

        // Optimized sampling resolution to ensure smooth 60fps UI feedback
        const maxDim = 600;
        let w = state.image.width;
        let h = state.image.height;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }

        state.imageCanvas.width = w;
        state.imageCanvas.height = h;
        state.imageCtx.drawImage(state.image, 0, 0, w, h);
    }

    // Custom Motif Editor Implementation
    let isDrawingMotif = false;
    let currentMotifStroke = [];

    function initMotifEditor() {
        const ctx = dom.motifEditorCtx;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        drawDefaultMotifPreset('star');

        dom.motifEditorCanvas.addEventListener('mousedown', startMotifDraw);
        dom.motifEditorCanvas.addEventListener('mousemove', drawMotif);
        dom.motifEditorCanvas.addEventListener('mouseup', stopMotifDraw);
        dom.motifEditorCanvas.addEventListener('mouseleave', stopMotifDraw);

        dom.motifEditorCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = dom.motifEditorCanvas.getBoundingClientRect();
            startMotifDraw({ clientX: touch.clientX, clientY: touch.clientY, rect });
        });
        dom.motifEditorCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = dom.motifEditorCanvas.getBoundingClientRect();
            drawMotif({ clientX: touch.clientX, clientY: touch.clientY, rect });
        });
        dom.motifEditorCanvas.addEventListener('touchend', stopMotifDraw);

        dom.btnClearMotif.addEventListener('click', () => {
            state.customMotifStrokes = [];
            state.customMotifPoints = [];
            state.customSvgPath = '';
            dom.inputSvgPath.value = '';
            clearMotifCanvas();
            scheduleSmoothRender(20);
        });

        dom.btnPresetHeart.addEventListener('click', () => drawDefaultMotifPreset('heart'));
        dom.btnPresetHexagon.addEventListener('click', () => drawDefaultMotifPreset('hexagon'));
        dom.btnPresetSpiral.addEventListener('click', () => drawDefaultMotifPreset('spiral'));

        dom.btnApplySvgPath.addEventListener('click', () => {
            const d = dom.inputSvgPath.value.trim();
            if (d) {
                state.customSvgPath = d;
                state.customMotifPoints = parseSvgPathToPoints(d);
                drawSvgPathOnMotifCanvas(d);
                scheduleSmoothRender(20);
            }
        });
    }

    function clearMotifCanvas() {
        const ctx = dom.motifEditorCtx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, dom.motifEditorCanvas.width, dom.motifEditorCanvas.height);
        
        ctx.strokeStyle = '#1f2636';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 20; i < 240; i += 20) {
            ctx.moveTo(i, 0); ctx.lineTo(i, 240);
            ctx.moveTo(0, i); ctx.lineTo(240, i);
        }
        ctx.stroke();
    }

    function startMotifDraw(e) {
        isDrawingMotif = true;
        currentMotifStroke = [];
        const pt = getMotifCanvasPos(e);
        currentMotifStroke.push(pt);
    }

    function drawMotif(e) {
        if (!isDrawingMotif) return;
        const pt = getMotifCanvasPos(e);
        currentMotifStroke.push(pt);

        const ctx = dom.motifEditorCtx;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const prev = currentMotifStroke[currentMotifStroke.length - 2];
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
    }

    function stopMotifDraw() {
        if (isDrawingMotif && currentMotifStroke.length > 1) {
            state.customMotifStrokes.push([...currentMotifStroke]);
            generateSvgPathFromStrokes();
            scheduleSmoothRender(20);
        }
        isDrawingMotif = false;
    }

    function getMotifCanvasPos(e) {
        const rect = e.rect || dom.motifEditorCanvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 240,
            y: ((e.clientY - rect.top) / rect.height) * 240
        };
    }

    function generateSvgPathFromStrokes() {
        let d = '';
        state.customMotifPoints = [];
        state.customMotifStrokes.forEach(stroke => {
            if (stroke.length === 0) return;
            const normStroke = [];
            const x0 = (stroke[0].x - 120) / 100;
            const y0 = (stroke[0].y - 120) / 100;
            d += `M ${x0.toFixed(2)} ${y0.toFixed(2)} `;
            normStroke.push({ x: x0, y: y0 });

            for (let i = 1; i < stroke.length; i++) {
                const x = (stroke[i].x - 120) / 100;
                const y = (stroke[i].y - 120) / 100;
                d += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
                normStroke.push({ x: x, y: y });
            }
            state.customMotifPoints.push(normStroke);
        });
        state.customSvgPath = d;
        dom.inputSvgPath.value = d;
    }

    function parseSvgPathToPoints(d) {
        return [
            [{x: 0, y: -0.5}, {x: 0.15, y: -0.15}, {x: 0.5, y: -0.15}, {x: 0.2, y: 0.1}, {x: 0.35, y: 0.5}, {x: 0, y: 0.25}, {x: -0.35, y: 0.5}, {x: -0.2, y: 0.1}, {x: -0.5, y: -0.15}, {x: -0.15, y: -0.15}, {x: 0, y: -0.5}]
        ];
    }

    function drawDefaultMotifPreset(preset) {
        clearMotifCanvas();
        state.customMotifStrokes = [];
        let d = '';

        if (preset === 'heart') {
            d = 'M 0 -0.4 C -0.5 -1.0 -1.0 -0.2 0 0.6 C 1.0 -0.2 0.5 -1.0 0 -0.4 Z';
            state.customMotifPoints = [
                [{x:0, y:-0.4}, {x:-0.3, y:-0.7}, {x:-0.5, y:-0.2}, {x:0, y:0.5}, {x:0.5, y:-0.2}, {x:0.3, y:-0.7}, {x:0, y:-0.4}]
            ];
        } else if (preset === 'hexagon') {
            d = 'M 0 -0.5 L 0.43 -0.25 L 0.43 0.25 L 0 0.5 L -0.43 0.25 L -0.43 -0.25 Z';
            state.customMotifPoints = [
                [{x:0, y:-0.5}, {x:0.43, y:-0.25}, {x:0.43, y:0.25}, {x:0, y:0.5}, {x:-0.43, y:0.25}, {x:-0.43, y:-0.25}, {x:0, y:-0.5}]
            ];
        } else if (preset === 'spiral') {
            d = 'M 0 0 Q 0.3 0.1 0.3 0.3 Q 0.3 0.6 -0.3 0.6 Q -0.7 0.6 -0.7 -0.2 Q -0.7 -0.7 0.1 -0.7';
            state.customMotifPoints = [
                [{x:0, y:0}, {x:0.2, y:0.1}, {x:0.3, y:0.3}, {x:0, y:0.5}, {x:-0.4, y:0.3}, {x:-0.4, y:-0.3}, {x:0.2, y:-0.5}]
            ];
        } else if (preset === 'star') {
            d = 'M 0 -0.5 L 0.15 -0.15 L 0.5 -0.15 L 0.2 0.1 L 0.35 0.5 L 0 0.25 L -0.35 0.5 L -0.2 0.1 L -0.5 -0.15 L -0.15 -0.15 Z';
            state.customMotifPoints = [
                [{x: 0, y: -0.5}, {x: 0.15, y: -0.15}, {x: 0.5, y: -0.15}, {x: 0.2, y: 0.1}, {x: 0.35, y: 0.5}, {x: 0, y: 0.25}, {x: -0.35, y: 0.5}, {x: -0.2, y: 0.1}, {x: -0.5, y: -0.15}, {x: -0.15, y: -0.15}, {x: 0, y: -0.5}]
            ];
        }

        state.customSvgPath = d;
        dom.inputSvgPath.value = d;
        drawSvgPathOnMotifCanvas(d);
        scheduleSmoothRender(20);
    }

    function drawSvgPathOnMotifCanvas(pathString) {
        clearMotifCanvas();
        const ctx = dom.motifEditorCtx;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        try {
            ctx.save();
            ctx.translate(120, 120);
            ctx.scale(100, 100);
            const p2 = new Path2D(pathString);
            ctx.stroke(p2);
            ctx.restore();
        } catch (err) {
            console.warn('SVG Path parse error:', err);
        }
    }

    // Main Processing & Rendering Pipeline
    function renderPreview() {
        if (!state.image) return;

        const paperW = state.paperWidthMm;
        const paperH = state.paperHeightMm;

        const imgAspect = state.image.height / state.image.width;
        const dpr = window.devicePixelRatio || 1;
        
        const renderWidth = 700;
        const renderHeight = Math.round(renderWidth * imgAspect);

        dom.mainCanvas.width = renderWidth * dpr;
        dom.mainCanvas.height = renderHeight * dpr;
        dom.mainCanvas.style.width = `${renderWidth}px`;
        dom.mainCanvas.style.height = `${renderHeight}px`;

        const ctx = dom.mainCtx;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, renderWidth, renderHeight);

        const imgData = state.imageCtx.getImageData(0, 0, state.imageCanvas.width, state.imageCanvas.height);
        const layers = generateCMYKVectorLayers(imgData, renderWidth, renderHeight);

        let totalPaths = 0;
        const viewMode = state.settings.activeViewMode;

        ['Y', 'M', 'C', 'K'].forEach(chKey => {
            if (!state.channels[chKey]) return;
            if (viewMode !== 'composite' && viewMode !== LAYER_CONFIGS[chKey].name.toLowerCase() && viewMode !== chKey.toLowerCase()) {
                if (viewMode === 'key' && chKey !== 'K') return;
                if (viewMode !== 'composite' && viewMode !== 'key' && viewMode.toUpperCase() !== chKey) return;
            }

            const layer = layers[chKey];
            totalPaths += layer.pathsCount;

            ctx.save();
            if (viewMode === 'composite') {
                ctx.globalCompositeOperation = 'multiply';
            }

            ctx.strokeStyle = LAYER_CONFIGS[chKey].color;
            ctx.lineWidth = Math.max(0.8, (state.settings.strokeWidthMm / paperW) * renderWidth);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.stroke(layer.path2D);
            ctx.restore();
        });

        dom.statPaths.textContent = `Trazos: ${totalPaths.toLocaleString()}`;
    }

    function computeSobelMap(imgData) {
        const { width: w, height: h, data } = imgData;
        const sobelData = new Float32Array(w * h);
        
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const getLum = (px, py) => {
                    const idx = (py * w + px) * 4;
                    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                };

                const gx = 
                    -1 * getLum(x - 1, y - 1) + 1 * getLum(x + 1, y - 1) +
                    -2 * getLum(x - 1, y)     + 2 * getLum(x + 1, y) +
                    -1 * getLum(x - 1, y + 1) + 1 * getLum(x + 1, y + 1);

                const gy = 
                    -1 * getLum(x - 1, y - 1) - 2 * getLum(x, y - 1) - 1 * getLum(x + 1, y - 1) +
                     1 * getLum(x - 1, y + 1) + 2 * getLum(x, y + 1) + 1 * getLum(x + 1, y + 1);

                const mag = Math.sqrt(gx * gx + gy * gy);
                sobelData[y * w + x] = Math.min(1.0, mag / 255.0);
            }
        }
        return sobelData;
    }

    // High Performance Vector CMYK Halftone Generator
    function generateCMYKVectorLayers(imgData, canvasW, canvasH) {
        const { width: imgW, height: imgH, data } = imgData;
        const paperW = state.paperWidthMm;
        const paperH = state.paperHeightMm;
        const imgAspect = imgH / imgW;
        const paperAspect = paperH / paperW;
        
        let drawWidthMm, drawHeightMm, offsetX, offsetY;
        if (imgAspect > paperAspect) {
            drawHeightMm = paperH;
            drawWidthMm = paperH / imgAspect;
            offsetX = (paperW - drawWidthMm) / 2;
            offsetY = 0;
        } else {
            drawWidthMm = paperW;
            drawHeightMm = paperW * imgAspect;
            offsetX = 0;
            offsetY = (paperH - drawHeightMm) / 2;
        }

        const gridSizeMm = state.settings.gridSizeMm;
        const gridPx = (gridSizeMm / paperW) * canvasW;
        const maxScaleFactor = (state.settings.maxScalePct / 100);

        const sobelMap = state.settings.sobelStrength > 0 ? computeSobelMap(imgData) : null;

        const layers = {
            C: { path2D: new Path2D(), svgPaths: [], pathsCount: 0 },
            M: { path2D: new Path2D(), svgPaths: [], pathsCount: 0 },
            Y: { path2D: new Path2D(), svgPaths: [], pathsCount: 0 },
            K: { path2D: new Path2D(), svgPaths: [], pathsCount: 0 }
        };

        const cols = Math.ceil(canvasW / gridPx);
        const rows = Math.ceil(canvasH / gridPx);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ['Y', 'M', 'C', 'K'].forEach(chKey => {
                    const config = LAYER_CONFIGS[chKey];
                    let cx = (c + 0.5) * gridPx;
                    let cy = (r + 0.5) * gridPx;

                    if (state.settings.antiMoireEnabled) {
                        if (state.settings.antiMoireMode === 'rosette') {
                            cx += gridPx * config.rosetteOffsetX;
                            cy += gridPx * config.rosetteOffsetY;
                        } else if (state.settings.antiMoireMode === 'stochastic') {
                            const jitterX = Math.sin(c * 12.9898 + r * 78.233 + config.angle) * 0.15 * gridPx;
                            const jitterY = Math.cos(c * 39.3461 + r * 11.135 + config.angle) * 0.15 * gridPx;
                            cx += jitterX;
                            cy += jitterY;
                        }
                    }

                    let ix = Math.floor((cx / canvasW) * imgW);
                    let iy = Math.floor((cy / canvasH) * imgH);

                    if (ix < 0 || ix >= imgW || iy < 0 || iy >= imgH) return;

                    let red = 0, green = 0, blue = 0;
                    const blurRadius = state.settings.antiMoireEnabled ? Math.round(state.settings.antiMoireBlur) : 0;

                    if (blurRadius > 0) {
                        let sampleCount = 0;
                        for (let dy = -blurRadius; dy <= blurRadius; dy += 2) {
                            for (let dx = -blurRadius; dx <= blurRadius; dx += 2) {
                                const sx = Math.min(imgW - 1, Math.max(0, ix + dx));
                                const sy = Math.min(imgH - 1, Math.max(0, iy + dy));
                                const idx = (sy * imgW + sx) * 4;
                                red += data[idx];
                                green += data[idx + 1];
                                blue += data[idx + 2];
                                sampleCount++;
                            }
                        }
                        red = Math.round(red / sampleCount);
                        green = Math.round(green / sampleCount);
                        blue = Math.round(blue / sampleCount);
                    } else {
                        const pixelIdx = (iy * imgW + ix) * 4;
                        red = data[pixelIdx];
                        green = data[pixelIdx + 1];
                        blue = data[pixelIdx + 2];
                    }

                    red = applyImageAdjustments(red, state.settings.brightness, state.settings.contrast, state.settings.gamma);
                    green = applyImageAdjustments(green, state.settings.brightness, state.settings.contrast, state.settings.gamma);
                    blue = applyImageAdjustments(blue, state.settings.brightness, state.settings.contrast, state.settings.gamma);

                    if (state.settings.invert) {
                        red = 255 - red;
                        green = 255 - green;
                        blue = 255 - blue;
                    }

                    const rNorm = red / 255;
                    const gNorm = green / 255;
                    const bNorm = blue / 255;

                    // Advanced Under Color Removal (UCR) & Black Extraction
                    const rawK = 1 - Math.max(rNorm, gNorm, bNorm);
                    const ucrFactor = state.settings.ucrFactor / 100;
                    const kVal = rawK * ucrFactor;

                    let cVal = Math.max(0, 1 - rNorm - kVal);
                    let mVal = Math.max(0, 1 - gNorm - kVal);
                    let yVal = Math.max(0, 1 - bNorm - kVal);

                    const cmykVals = { C: cVal, M: mVal, Y: yVal, K: kVal };
                    let intensity = cmykVals[chKey];

                    // Sobel Edge Enhancement Boost
                    if (sobelMap) {
                        const sobelEdgeVal = sobelMap[iy * imgW + ix] * (state.settings.sobelStrength / 100);
                        intensity = Math.min(1.0, intensity + sobelEdgeVal * 0.4);
                    }

                    if (intensity <= 0.05) return;

                    const maxRadius = (gridPx / 2) * maxScaleFactor;
                    const radius = maxRadius * intensity;
                    const motifType = state.settings.motifType;
                    const cxMm = offsetX + (cx / canvasW) * drawWidthMm;
                    const cyMm = offsetY + (cy / canvasH) * drawHeightMm;
                    const radiusMm = (radius / canvasW) * drawWidthMm;

                    if (motifType === 'circles') {
                        if (radius > 0.5) {
                            layers[chKey].path2D.moveTo(cx + radius, cy);
                            layers[chKey].path2D.arc(cx, cy, radius, 0, Math.PI * 2);
                            layers[chKey].svgPaths.push(`M ${(cxMm + radiusMm).toFixed(2)} ${cyMm.toFixed(2)} A ${radiusMm.toFixed(2)} ${radiusMm.toFixed(2)} 0 1 0 ${(cxMm - radiusMm).toFixed(2)} ${cyMm.toFixed(2)} A ${radiusMm.toFixed(2)} ${radiusMm.toFixed(2)} 0 1 0 ${(cxMm + radiusMm).toFixed(2)} ${cyMm.toFixed(2)}`);
                            layers[chKey].pathsCount++;
                        }
                    } else if (motifType === 'stripes') {
                        const angleRad = (config.angle * Math.PI) / 180;
                        const len = radius * 2;
                        const lenMm = radiusMm * 2;
                        const dx = Math.cos(angleRad) * (len / 2);
                        const dy = Math.sin(angleRad) * (len / 2);
                        const dxMm = Math.cos(angleRad) * (lenMm / 2);
                        const dyMm = Math.sin(angleRad) * (lenMm / 2);

                        layers[chKey].path2D.moveTo(cx - dx, cy - dy);
                        layers[chKey].path2D.lineTo(cx + dx, cy + dy);
                        layers[chKey].svgPaths.push(`M ${(cxMm - dxMm).toFixed(2)} ${(cyMm - dyMm).toFixed(2)} L ${(cxMm + dxMm).toFixed(2)} ${(cyMm + dyMm).toFixed(2)}`);
                        layers[chKey].pathsCount++;
                    } else if (motifType === 'stars') {
                        const points = 4;
                        for (let p = 0; p < points; p++) {
                            const angle = (p * Math.PI) / points;
                            const dx = Math.cos(angle) * radius;
                            const dy = Math.sin(angle) * radius;
                            const dxMm = Math.cos(angle) * radiusMm;
                            const dyMm = Math.sin(angle) * radiusMm;

                            layers[chKey].path2D.moveTo(cx - dx, cy - dy);
                            layers[chKey].path2D.lineTo(cx + dx, cy + dy);
                            layers[chKey].svgPaths.push(`M ${(cxMm - dxMm).toFixed(2)} ${(cyMm - dyMm).toFixed(2)} L ${(cxMm + dxMm).toFixed(2)} ${(cyMm + dyMm).toFixed(2)}`);
                            layers[chKey].pathsCount++;
                        }
                    } else if (motifType === 'custom') {
                        if (radius > 0.5 && state.customMotifPoints.length > 0) {
                            state.customMotifPoints.forEach(subPath => {
                                if (subPath.length < 2) return;
                                const scalePx = radius * 2;
                                const scaleMm = radiusMm * 2;

                                const px0 = cx + subPath[0].x * scalePx;
                                const py0 = cy + subPath[0].y * scalePx;
                                layers[chKey].path2D.moveTo(px0, py0);

                                const mx0 = cxMm + subPath[0].x * scaleMm;
                                const my0 = cyMm + subPath[0].y * scaleMm;
                                let svgStr = `M ${mx0.toFixed(2)} ${my0.toFixed(2)} `;

                                for (let p = 1; p < subPath.length; p++) {
                                    const px = cx + subPath[p].x * scalePx;
                                    const py = cy + subPath[p].y * scalePx;
                                    layers[chKey].path2D.lineTo(px, py);

                                    const mx = cxMm + subPath[p].x * scaleMm;
                                    const my = cyMm + subPath[p].y * scaleMm;
                                    svgStr += `L ${mx.toFixed(2)} ${my.toFixed(2)} `;
                                }
                                layers[chKey].svgPaths.push(svgStr);
                                layers[chKey].pathsCount++;
                            });
                        }
                    }
                });
            }
        }

        return layers;
    }

    function applyImageAdjustments(val, brightness, contrast, gamma) {
        val += brightness;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        val = factor * (val - 128) + 128;
        val = 255 * Math.pow(Math.max(0, val) / 255, 1 / gamma);
        return Math.min(255, Math.max(0, Math.round(val)));
    }

    function generateLayerSVGString(chKey) {
        if (!state.image) return '';

        const paperW = state.paperWidthMm;
        const paperH = state.paperHeightMm;
        const strokeWidth = state.settings.strokeWidthMm.toFixed(2);
        const config = LAYER_CONFIGS[chKey];

        const imgAspect = state.image.height / state.image.width;
        const renderW = 700;
        const renderH = Math.round(renderW * imgAspect);

        const imgData = state.imageCtx.getImageData(0, 0, state.imageCanvas.width, state.imageCanvas.height);
        const layers = generateCMYKVectorLayers(imgData, renderW, renderH);
        const svgPaths = layers[chKey].svgPaths;

        const pathDataString = svgPaths.join(' ');

        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${paperW}mm" height="${paperH}mm" viewBox="0 0 ${paperW} ${paperH}">
  <!-- Generated by CMYK Pen Plotter Dithering Studio -->
  <!-- Layer: ${config.name} (${chKey}) | Stroke Width: ${strokeWidth}mm -->
  <g id="layer-${config.name.toLowerCase()}" stroke="${config.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${pathDataString}" />
  </g>
</svg>`;
    }

    async function universalSaveFile(blob, filename) {
        // 1. Native Capacitor (Android/iOS APK)
        if (window.Capacitor && window.Capacitor.isNative) {
            try {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64data = reader.result.split(',')[1];
                    const Filesystem = Capacitor.Plugins.Filesystem;
                    const Share = Capacitor.Plugins.Share;
                    
                    const savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64data,
                        directory: 'CACHE'
                    });
                    
                    await Share.share({
                        title: filename,
                        url: savedFile.uri,
                        dialogTitle: 'Guardar o Compartir Archivo'
                    });
                };
                return;
            } catch (e) {
                console.error("Native Capacitor Save Error:", e);
            }
        }
        
        // 2. Mobile Web Browser Share API (Android Chrome / Safari)
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: filename
                });
                return; // Exitoso
            } catch (e) {
                console.warn("Web Share cancelado o falló", e);
            }
        }
        
        // 3. Fallback Desktop Browser
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 300);
    }

    function downloadSingleLayer(chKey) {
        const svgContent = generateLayerSVGString(chKey);
        if (!svgContent) return;

        const strokeStr = state.settings.strokeWidthMm.toFixed(2);
        const filename = `CMYK_${LAYER_CONFIGS[chKey].filenameKey}_Grosor_${strokeStr}mm.svg`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        universalSaveFile(blob, filename);
    }

    function exportAllLayersZip() {
        if (!state.image) {
            alert('Por favor, carga una foto antes de exportar los archivos SVG.');
            return;
        }

        const strokeStr = state.settings.strokeWidthMm.toFixed(2);
        const zipFilename = `CMYK_Plotter_Layers_Grosor_${strokeStr}mm.zip`;

        if (window.JSZip) {
            const zip = new JSZip();
            ['Y', 'M', 'C', 'K'].forEach(chKey => {
                const svgContent = generateLayerSVGString(chKey);
                const filename = `CMYK_${LAYER_CONFIGS[chKey].filenameKey}_Grosor_${strokeStr}mm.svg`;
                zip.file(filename, svgContent);
            });

            zip.generateAsync({ type: 'blob' }).then(blob => {
                universalSaveFile(blob, zipFilename);
            });
        } else {
            downloadSingleLayer('Y');
            setTimeout(() => downloadSingleLayer('M'), 300);
            setTimeout(() => downloadSingleLayer('C'), 600);
            setTimeout(() => downloadSingleLayer('K'), 900);
        }
    }

    function generateCompositeSVGString() {
        if (!state.image) return '';

        const paperW = state.paperWidthMm;
        const paperH = state.paperHeightMm;
        const strokeWidth = state.settings.strokeWidthMm.toFixed(2);
        
        const imgAspect = state.image.height / state.image.width;
        const renderW = 700;
        const renderH = Math.round(renderW * imgAspect);

        const imgData = state.imageCtx.getImageData(0, 0, state.imageCanvas.width, state.imageCanvas.height);
        const layers = generateCMYKVectorLayers(imgData, renderW, renderH);

        let compositeGroups = '';
        ['Y', 'M', 'C', 'K'].forEach(chKey => {
            const config = LAYER_CONFIGS[chKey];
            const svgPaths = layers[chKey].svgPaths;
            if (svgPaths.length > 0) {
                const pathDataString = svgPaths.join(' ');
                compositeGroups += `
  <g id="layer-${config.name.toLowerCase()}" stroke="${config.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${pathDataString}" />
  </g>`;
            }
        });

        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${paperW}mm" height="${paperH}mm" viewBox="0 0 ${paperW} ${paperH}">
  <!-- Generated by CMYK Pen Plotter Dithering Studio -->
  <!-- Composite Layers (CMYK) | Stroke Width: ${strokeWidth}mm -->${compositeGroups}
</svg>`;
    }

    function downloadCompositeSVG() {
        const svgContent = generateCompositeSVGString();
        if (!svgContent) {
            alert('Por favor, carga una foto antes de exportar el archivo SVG.');
            return;
        }

        const strokeStr = state.settings.strokeWidthMm.toFixed(2);
        const filename = `CMYK_Composite_Todas_Grosor_${strokeStr}mm.svg`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        universalSaveFile(blob, filename);
    }

    function downloadPNG() {
        if (!state.image) {
            alert('Por favor, carga una foto antes de exportar la imagen.');
            return;
        }

        dom.mainCanvas.toBlob(blob => {
            if (blob) {
                const filename = `CMYK_Dithering_Export.png`;
                universalSaveFile(blob, filename);
            }
        }, 'image/png');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
