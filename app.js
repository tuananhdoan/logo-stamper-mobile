/**
 * Logo Stamper Mobile - Logic & Canvas Engine for iOS
 * 100% Client-Side Processing • No Server Required
 */

(() => {
    'use strict';

    // State
    const state = {
        logo: null,             // HTMLImageElement
        logoDataUrl: null,      // Data URL for caching
        logoFileName: '',
        images: [],             // Array of { id, file, name, imgElement, thumbUrl, settings }
        currentPreviewIndex: 0,
        
        // Active image settings (relative 0..100)
        logoXPct: 75,
        logoYPct: 75,
        logoSizePct: 18,        // Width of logo as % of base image width
        logoRotation: 0,        // Degrees (-180..180)
        opacity: 100,           // 10..100
        quality: 95,            // 60..100

        // Drag tracking (1 finger)
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartXPct: 0,
        dragStartYPct: 0,

        // Pinch tracking (2 fingers)
        isPinching: false,
        pinchStartDist: 0,
        pinchStartAngle: 0,
        pinchStartSize: 18,
        pinchStartRotation: 0,

        // Corner handle tracking (1 finger on handle)
        activeCorner: null,
        cornerStartX: 0,
        cornerStartY: 0,
        cornerStartSize: 18,

        processedResults: []    // Array of { name, blob, url }
    };

    // DOM Elements Cache
    const DOM = {};

    function initElements() {
        DOM.logoInput = document.getElementById('logoInput');
        DOM.logoUploadBox = document.getElementById('logoUploadBox');
        DOM.logoSelectedBar = document.getElementById('logoSelectedBar');
        DOM.logoThumb = document.getElementById('logoThumb');
        DOM.logoFileName = document.getElementById('logoFileName');
        DOM.logoDimensions = document.getElementById('logoDimensions');
        DOM.btnChangeLogo = document.getElementById('btnChangeLogo');

        DOM.imageInput = document.getElementById('imageInput');
        DOM.imageUploadBox = document.getElementById('imageUploadBox');
        DOM.imageCountPill = document.getElementById('imageCountPill');
        DOM.imageIndicatorPill = document.getElementById('imageIndicatorPill');
        DOM.thumbStripContainer = document.getElementById('thumbStripContainer');
        DOM.thumbStrip = document.getElementById('thumbStrip');
        DOM.btnAddMoreImages = document.getElementById('btnAddMoreImages');
        DOM.btnApplyAll = document.getElementById('btnApplyAll');
        DOM.btnClearImages = document.getElementById('btnClearImages');

        DOM.cardPreview = document.getElementById('cardPreview');
        DOM.previewViewport = document.getElementById('previewViewport');
        DOM.canvasWrapper = document.getElementById('canvasWrapper');
        DOM.baseImagePreview = document.getElementById('baseImagePreview');
        DOM.interactiveLogo = document.getElementById('interactiveLogo');
        DOM.interactiveLogoImg = document.getElementById('interactiveLogoImg');
        DOM.resizeHandles = document.querySelectorAll('.resize-handle');

        DOM.presetBtns = document.querySelectorAll('.preset-btn');
        DOM.sizeSlider = document.getElementById('sizeSlider');
        DOM.sizeVal = document.getElementById('sizeVal');
        DOM.btnSizeMinus = document.getElementById('btnSizeMinus');
        DOM.btnSizePlus = document.getElementById('btnSizePlus');

        DOM.rotateSlider = document.getElementById('rotateSlider');
        DOM.rotateVal = document.getElementById('rotateVal');
        DOM.btnResetRotate = document.getElementById('btnResetRotate');
        DOM.angleBtns = document.querySelectorAll('.angle-btn');

        DOM.opacitySlider = document.getElementById('opacitySlider');
        DOM.opacityVal = document.getElementById('opacityVal');
        DOM.qualitySlider = document.getElementById('qualitySlider');
        DOM.qualityVal = document.getElementById('qualityVal');

        DOM.actionDock = document.getElementById('actionDock');
        DOM.btnProcessAll = document.getElementById('btnProcessAll');
        DOM.processBtnSub = document.getElementById('processBtnSub');

        DOM.progressCard = document.getElementById('progressCard');
        DOM.progressTitle = document.getElementById('progressTitle');
        DOM.progressStatus = document.getElementById('progressStatus');
        DOM.progressBar = document.getElementById('progressBar');

        DOM.cardResults = document.getElementById('cardResults');
        DOM.resultCountPill = document.getElementById('resultCountPill');
        DOM.resultsGrid = document.getElementById('resultsGrid');
        DOM.btnDownloadZip = document.getElementById('btnDownloadZip');
        DOM.btnShareAll = document.getElementById('btnShareAll');

        DOM.btnHelp = document.getElementById('btnHelp');
        DOM.helpModal = document.getElementById('helpModal');
        DOM.btnCloseHelp = document.getElementById('btnCloseHelp');
        DOM.btnModalOk = document.getElementById('btnModalOk');

        DOM.exportCanvas = document.getElementById('exportCanvas');
    }

    // Register Service Worker for Offline PWA
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // Persistence in localStorage
    const STORAGE_KEY = 'stamper_mobile_config_v2';
    function saveConfig() {
        try {
            const config = {
                logoXPct: state.logoXPct,
                logoYPct: state.logoYPct,
                logoSizePct: state.logoSizePct,
                logoRotation: state.logoRotation,
                opacity: state.opacity,
                quality: state.quality,
                logoDataUrl: state.logoDataUrl,
                logoFileName: state.logoFileName
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {}
    }

    function restoreConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const config = JSON.parse(raw);
            if (config.logoSizePct) state.logoSizePct = config.logoSizePct;
            if (typeof config.logoXPct === 'number') state.logoXPct = config.logoXPct;
            if (typeof config.logoYPct === 'number') state.logoYPct = config.logoYPct;
            if (typeof config.logoRotation === 'number') state.logoRotation = config.logoRotation;
            if (config.opacity) state.opacity = config.opacity;
            if (config.quality) state.quality = config.quality;

            // Restore sliders UI
            syncSlidersUI();

            // Restore Logo if cached
            if (config.logoDataUrl) {
                const img = new Image();
                img.onload = () => {
                    state.logo = img;
                    state.logoDataUrl = config.logoDataUrl;
                    state.logoFileName = config.logoFileName || 'logo_saved.png';
                    showLogoSelectedUI();
                    updatePreviewLayout();
                };
                img.src = config.logoDataUrl;
            }
        } catch (e) {}
    }

    function syncSlidersUI() {
        if (DOM.sizeSlider) {
            DOM.sizeSlider.value = state.logoSizePct;
            DOM.sizeVal.textContent = `${state.logoSizePct}%`;
        }
        if (DOM.rotateSlider) {
            DOM.rotateSlider.value = state.logoRotation;
            DOM.rotateVal.textContent = `${state.logoRotation}°`;
        }
        if (DOM.opacitySlider) {
            DOM.opacitySlider.value = state.opacity;
            DOM.opacityVal.textContent = `${state.opacity}%`;
        }
        if (DOM.qualitySlider) {
            DOM.qualitySlider.value = state.quality;
            DOM.qualityVal.textContent = `${state.quality}%`;
        }
    }

    // Per-image settings management
    function saveCurrentImageSettings() {
        const curImg = state.images[state.currentPreviewIndex];
        if (!curImg) return;
        curImg.settings = {
            xPct: state.logoXPct,
            yPct: state.logoYPct,
            sizePct: state.logoSizePct,
            rotation: state.logoRotation,
            opacity: state.opacity,
            isCustom: true
        };
        updateThumbnailCustomBadges();
    }

    function loadCurrentImageSettings() {
        const curImg = state.images[state.currentPreviewIndex];
        if (!curImg || !curImg.settings) return;

        state.logoXPct = curImg.settings.xPct;
        state.logoYPct = curImg.settings.yPct;
        state.logoSizePct = curImg.settings.sizePct;
        state.logoRotation = curImg.settings.rotation;
        state.opacity = curImg.settings.opacity;

        syncSlidersUI();
        if (DOM.imageIndicatorPill) {
            DOM.imageIndicatorPill.textContent = `Ảnh ${state.currentPreviewIndex + 1}/${state.images.length}`;
        }
    }

    function updateThumbnailCustomBadges() {
        const items = DOM.thumbStrip.querySelectorAll('.thumb-item');
        state.images.forEach((img, idx) => {
            const itemEl = items[idx];
            if (!itemEl) return;
            let badge = itemEl.querySelector('.thumb-custom-badge');
            if (img.settings && img.settings.isCustom) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'thumb-custom-badge';
                    badge.textContent = '✓ Vị trí riêng';
                    itemEl.appendChild(badge);
                }
            } else if (badge) {
                badge.remove();
            }
        });
    }

    // Event Bindings
    function bindEvents() {
        // Logo Upload
        DOM.logoUploadBox.addEventListener('click', () => DOM.logoInput.click());
        DOM.btnChangeLogo.addEventListener('click', () => DOM.logoInput.click());
        DOM.logoInput.addEventListener('change', handleLogoFileSelect);

        // Images Upload
        DOM.imageUploadBox.addEventListener('click', () => DOM.imageInput.click());
        DOM.btnAddMoreImages.addEventListener('click', () => DOM.imageInput.click());
        DOM.btnClearImages.addEventListener('click', clearAllImages);
        DOM.imageInput.addEventListener('change', handleImagesFileSelect);

        // Apply To All Images Button
        if (DOM.btnApplyAll) {
            DOM.btnApplyAll.addEventListener('click', applyCurrentSettingsToAll);
        }

        // Sliders & Controls
        DOM.sizeSlider.addEventListener('input', e => {
            state.logoSizePct = parseInt(e.target.value, 10);
            DOM.sizeVal.textContent = `${state.logoSizePct}%`;
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.btnSizeMinus.addEventListener('click', () => {
            state.logoSizePct = Math.max(3, state.logoSizePct - 2);
            DOM.sizeSlider.value = state.logoSizePct;
            DOM.sizeVal.textContent = `${state.logoSizePct}%`;
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.btnSizePlus.addEventListener('click', () => {
            state.logoSizePct = Math.min(150, state.logoSizePct + 2);
            DOM.sizeSlider.value = state.logoSizePct;
            DOM.sizeVal.textContent = `${state.logoSizePct}%`;
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.rotateSlider.addEventListener('input', e => {
            state.logoRotation = parseInt(e.target.value, 10);
            DOM.rotateVal.textContent = `${state.logoRotation}°`;
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.btnResetRotate.addEventListener('click', () => {
            state.logoRotation = 0;
            DOM.rotateSlider.value = 0;
            DOM.rotateVal.textContent = '0°';
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.angleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const ang = parseInt(btn.dataset.angle, 10);
                state.logoRotation = ang;
                DOM.rotateSlider.value = ang;
                DOM.rotateVal.textContent = `${ang}°`;
                saveCurrentImageSettings();
                updatePreviewLayout();
                saveConfig();
            });
        });

        DOM.opacitySlider.addEventListener('input', e => {
            state.opacity = parseInt(e.target.value, 10);
            DOM.opacityVal.textContent = `${state.opacity}%`;
            saveCurrentImageSettings();
            updatePreviewLayout();
            saveConfig();
        });

        DOM.qualitySlider.addEventListener('input', e => {
            state.quality = parseInt(e.target.value, 10);
            DOM.qualityVal.textContent = `${state.quality}%`;
            saveConfig();
        });

        // Position Presets
        DOM.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyPreset(btn.dataset.pos);
                saveCurrentImageSettings();
                saveConfig();
            });
        });

        // Advanced Multi-touch & Drag System
        setupTouchAndGestureEngine();

        // Process Action
        DOM.btnProcessAll.addEventListener('click', processBatch);

        // Download & Share Actions
        DOM.btnDownloadZip.addEventListener('click', downloadAsZip);
        DOM.btnShareAll.addEventListener('click', shareResults);

        // Help Modal
        DOM.btnHelp.addEventListener('click', () => DOM.helpModal.style.display = 'flex');
        DOM.btnCloseHelp.addEventListener('click', () => DOM.helpModal.style.display = 'none');
        DOM.btnModalOk.addEventListener('click', () => DOM.helpModal.style.display = 'none');
        DOM.helpModal.addEventListener('click', e => {
            if (e.target === DOM.helpModal) DOM.helpModal.style.display = 'none';
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (state.images.length > 0) updatePreviewLayout();
        });
    }

    // Apply current settings to all images
    function applyCurrentSettingsToAll() {
        if (state.images.length === 0) return;
        saveCurrentImageSettings();
        const current = state.images[state.currentPreviewIndex].settings;
        state.images.forEach(img => {
            img.settings = { ...current, isCustom: true };
        });
        renderThumbnails();
        showToast('✓ Đã áp dụng vị trí cho toàn bộ ảnh!');
    }

    function showToast(msg) {
        let toast = document.getElementById('stamperToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'stamperToast';
            toast.style.cssText = `
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                background: rgba(16, 185, 129, 0.95);
                color: #fff;
                font-size: 13px;
                font-weight: 600;
                padding: 8px 18px;
                border-radius: 9999px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                z-index: 9999;
                opacity: 0;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
                white-space: nowrap;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
        }, 2200);
    }

    // Handle Logo selection
    function handleLogoFileSelect(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
            const dataUrl = evt.target.result;
            const img = new Image();
            img.onload = () => {
                state.logo = img;
                state.logoDataUrl = dataUrl;
                state.logoFileName = file.name;
                showLogoSelectedUI();
                updatePreviewLayout();
                checkReadyState();
                saveConfig();
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    function showLogoSelectedUI() {
        DOM.logoUploadBox.style.display = 'none';
        DOM.logoSelectedBar.style.display = 'flex';
        DOM.logoThumb.src = state.logoDataUrl;
        DOM.logoFileName.textContent = state.logoFileName;
        DOM.logoDimensions.textContent = `${state.logo.naturalWidth} × ${state.logo.naturalHeight} px`;
        DOM.interactiveLogoImg.src = state.logoDataUrl;
        DOM.interactiveLogo.style.display = 'block';
    }

    // Handle Images selection
    function handleImagesFileSelect(e) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        let loadedCount = 0;
        files.forEach(file => {
            const id = 'img_' + Math.random().toString(36).substring(2, 9);
            const thumbUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                state.images.push({
                    id,
                    file,
                    name: file.name,
                    imgElement: img,
                    thumbUrl,
                    settings: {
                        xPct: state.logoXPct,
                        yPct: state.logoYPct,
                        sizePct: state.logoSizePct,
                        rotation: state.logoRotation,
                        opacity: state.opacity,
                        isCustom: false
                    }
                });
                loadedCount++;
                if (loadedCount === files.length) {
                    renderThumbnails();
                    selectPreviewImage(state.images.length - files.length); // select first newly added
                    checkReadyState();
                }
            };
            img.src = thumbUrl;
        });

        DOM.imageInput.value = '';
    }

    function clearAllImages() {
        state.images.forEach(item => URL.revokeObjectURL(item.thumbUrl));
        state.images = [];
        state.currentPreviewIndex = 0;
        DOM.thumbStripContainer.style.display = 'none';
        DOM.imageCountPill.textContent = '0 ảnh';
        DOM.cardPreview.style.display = 'none';
        DOM.actionDock.style.display = 'none';
        DOM.cardResults.style.display = 'none';
    }

    function renderThumbnails() {
        DOM.thumbStrip.innerHTML = '';
        state.images.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = `thumb-item ${index === state.currentPreviewIndex ? 'active' : ''}`;
            
            let customBadgeHtml = '';
            if (item.settings && item.settings.isCustom) {
                customBadgeHtml = `<span class="thumb-custom-badge">✓ Vị trí riêng</span>`;
            }

            thumb.innerHTML = `
                <img src="${item.thumbUrl}" alt="Thumb">
                ${customBadgeHtml}
                <button type="button" class="thumb-del" title="Xóa ảnh" data-index="${index}">✕</button>
            `;
            thumb.addEventListener('click', e => {
                if (e.target.classList.contains('thumb-del')) {
                    e.stopPropagation();
                    removeImage(index);
                } else {
                    selectPreviewImage(index);
                }
            });
            DOM.thumbStrip.appendChild(thumb);
        });

        DOM.thumbStripContainer.style.display = state.images.length > 0 ? 'block' : 'none';
        DOM.imageCountPill.textContent = `${state.images.length} ảnh`;
    }

    function removeImage(index) {
        URL.revokeObjectURL(state.images[index].thumbUrl);
        state.images.splice(index, 1);
        if (state.currentPreviewIndex >= state.images.length) {
            state.currentPreviewIndex = Math.max(0, state.images.length - 1);
        }
        renderThumbnails();
        if (state.images.length > 0) {
            selectPreviewImage(state.currentPreviewIndex);
        } else {
            clearAllImages();
        }
    }

    function selectPreviewImage(index) {
        if (!state.images[index]) return;
        
        // Save current image settings before switching
        saveCurrentImageSettings();

        state.currentPreviewIndex = index;
        const active = state.images[index];

        // Load settings of newly selected image
        loadCurrentImageSettings();

        DOM.baseImagePreview.src = active.thumbUrl;
        DOM.baseImagePreview.onload = () => {
            updatePreviewLayout();
        };

        // Update active class in strip
        const items = DOM.thumbStrip.querySelectorAll('.thumb-item');
        items.forEach((it, idx) => {
            it.classList.toggle('active', idx === index);
        });

        DOM.cardPreview.style.display = 'block';
        DOM.actionDock.style.display = 'block';
        updateActionDockCount();
    }

    function checkReadyState() {
        if (state.logo && state.images.length > 0) {
            DOM.cardPreview.style.display = 'block';
            DOM.actionDock.style.display = 'block';
            updateActionDockCount();
            updatePreviewLayout();
        }
    }

    function updateActionDockCount() {
        DOM.processBtnSub.textContent = `Đóng dấu ${state.images.length} ảnh trên iPhone`;
    }

    // Apply Quick Presets
    function applyPreset(preset) {
        if (!state.logo) return;
        const logoAr = state.logo.naturalWidth / state.logo.naturalHeight;
        const baseImg = state.images[state.currentPreviewIndex]?.imgElement;
        const baseAr = baseImg ? (baseImg.naturalWidth / baseImg.naturalHeight) : 1;

        const logoHeightPct = (state.logoSizePct / logoAr) * baseAr;
        const margin = 2; // Closer to edges for cleaner look

        switch (preset) {
            case 'tl':
                state.logoXPct = margin;
                state.logoYPct = margin;
                break;
            case 'tr':
                state.logoXPct = Math.max(-10, 100 - margin - state.logoSizePct);
                state.logoYPct = margin;
                break;
            case 'bl':
                state.logoXPct = margin;
                state.logoYPct = Math.max(-10, 100 - margin - logoHeightPct);
                break;
            case 'br':
                state.logoXPct = Math.max(-10, 100 - margin - state.logoSizePct);
                state.logoYPct = Math.max(-10, 100 - margin - logoHeightPct);
                break;
            case 'center':
                state.logoXPct = (100 - state.logoSizePct) / 2;
                state.logoYPct = (100 - logoHeightPct) / 2;
                break;
        }

        saveCurrentImageSettings();
        updatePreviewLayout();
    }

    // Update Interactive Visual Overlay Layout
    function updatePreviewLayout() {
        if (!state.logo || state.images.length === 0) return;

        const baseImg = DOM.baseImagePreview;
        const logoEl = DOM.interactiveLogo;

        const displayW = baseImg.clientWidth;
        const displayH = baseImg.clientHeight;
        if (!displayW || !displayH) {
            requestAnimationFrame(updatePreviewLayout);
            return;
        }

        const logoAr = state.logo.naturalWidth / state.logo.naturalHeight;
        const targetW = (state.logoSizePct / 100) * displayW;
        const targetH = targetW / logoAr;

        const posX = (state.logoXPct / 100) * displayW;
        const posY = (state.logoYPct / 100) * displayH;

        logoEl.style.width = `${targetW}px`;
        logoEl.style.height = `${targetH}px`;
        logoEl.style.left = `${posX}px`;
        logoEl.style.top = `${posY}px`;
        logoEl.style.opacity = state.opacity / 100;
        logoEl.style.transform = `rotate(${state.logoRotation}deg)`;
        logoEl.style.display = 'block';
    }

    // Advanced Touch, Drag, Pinch & Handle Engine
    function setupTouchAndGestureEngine() {
        const logoEl = DOM.interactiveLogo;
        const viewport = DOM.previewViewport;

        // 1. Touch Start (Handles 1 finger drag, 2 finger pinch, or corner handle resize)
        viewport.addEventListener('touchstart', e => {
            if (state.images.length === 0 || !state.logo) return;

            // Two fingers: Pinch to zoom & rotate
            if (e.touches.length === 2) {
                e.preventDefault();
                state.isPinching = true;
                state.isDragging = false;
                state.activeCorner = null;

                const t1 = e.touches[0];
                const t2 = e.touches[1];
                state.pinchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                state.pinchStartAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                state.pinchStartSize = state.logoSizePct;
                state.pinchStartRotation = state.logoRotation;

                logoEl.classList.add('pinching');
                return;
            }

            // One finger touch
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const target = touch.target;

                // Check if touching a corner resize handle
                if (target.classList.contains('resize-handle')) {
                    e.preventDefault();
                    e.stopPropagation();
                    state.activeCorner = target.dataset.corner;
                    state.cornerStartX = touch.clientX;
                    state.cornerStartY = touch.clientY;
                    state.cornerStartSize = state.logoSizePct;
                    logoEl.classList.add('dragging');
                    return;
                }

                // Check if touching the interactive logo itself
                if (logoEl.contains(target)) {
                    e.preventDefault();
                    state.isDragging = true;
                    state.activeCorner = null;
                    state.dragStartX = touch.clientX;
                    state.dragStartY = touch.clientY;
                    state.dragStartXPct = state.logoXPct;
                    state.dragStartYPct = state.logoYPct;
                    logoEl.classList.add('dragging');
                }
            }
        }, { passive: false });

        // 2. Touch Move
        window.addEventListener('touchmove', e => {
            // A. Two fingers: Pinch to resize and rotate
            if (state.isPinching && e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

                if (state.pinchStartDist > 0) {
                    const scale = currentDist / state.pinchStartDist;
                    const newSize = Math.max(3, Math.min(150, Math.round(state.pinchStartSize * scale)));
                    state.logoSizePct = newSize;

                    let deltaAngle = Math.round(currentAngle - state.pinchStartAngle);
                    if (deltaAngle > 180) deltaAngle -= 360;
                    if (deltaAngle < -180) deltaAngle += 360;
                    let newRotation = state.pinchStartRotation + deltaAngle;
                    while (newRotation > 180) newRotation -= 360;
                    while (newRotation < -180) newRotation += 360;
                    state.logoRotation = newRotation;

                    DOM.sizeSlider.value = state.logoSizePct;
                    DOM.sizeVal.textContent = `${state.logoSizePct}%`;
                    DOM.rotateSlider.value = state.logoRotation;
                    DOM.rotateVal.textContent = `${state.logoRotation}°`;

                    saveCurrentImageSettings();
                    updatePreviewLayout();
                }
                return;
            }

            // B. One finger corner handle resizing
            if (state.activeCorner && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const displayW = DOM.baseImagePreview.clientWidth;
                if (!displayW) return;

                const dx = touch.clientX - state.cornerStartX;
                // For SE / NE corners, moving right increases size; for SW / NW, moving left increases size
                const directionFactor = (state.activeCorner === 'se' || state.activeCorner === 'ne') ? 1 : -1;
                const deltaSize = (dx * directionFactor / displayW) * 100;
                
                const newSize = Math.max(3, Math.min(150, Math.round(state.cornerStartSize + deltaSize)));
                state.logoSizePct = newSize;

                DOM.sizeSlider.value = state.logoSizePct;
                DOM.sizeVal.textContent = `${state.logoSizePct}%`;

                saveCurrentImageSettings();
                updatePreviewLayout();
                return;
            }

            // C. One finger dragging (allows moving flush to top edge or slightly outside)
            if (state.isDragging && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const displayW = DOM.baseImagePreview.clientWidth;
                const displayH = DOM.baseImagePreview.clientHeight;
                if (!displayW || !displayH) return;

                const deltaX = touch.clientX - state.dragStartX;
                const deltaY = touch.clientY - state.dragStartY;

                const deltaXPct = (deltaX / displayW) * 100;
                const deltaYPct = (deltaY / displayH) * 100;

                // Generous limits: allows dragging completely flush to top edge (down to -25%)
                state.logoXPct = Math.min(110, Math.max(-25, state.dragStartXPct + deltaXPct));
                state.logoYPct = Math.min(110, Math.max(-25, state.dragStartYPct + deltaYPct));

                DOM.presetBtns.forEach(b => b.classList.remove('active'));

                saveCurrentImageSettings();
                updatePreviewLayout();
            }
        }, { passive: false });

        // 3. Touch End
        function onTouchEnd() {
            if (state.isDragging || state.isPinching || state.activeCorner) {
                state.isDragging = false;
                state.isPinching = false;
                state.activeCorner = null;
                logoEl.classList.remove('dragging', 'pinching');
                saveCurrentImageSettings();
                saveConfig();
            }
        }

        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);

        // Mouse events (for desktop mouse fallback)
        logoEl.addEventListener('mousedown', e => {
            if (e.target.classList.contains('resize-handle')) {
                e.preventDefault();
                state.activeCorner = e.target.dataset.corner;
                state.cornerStartX = e.clientX;
                state.cornerStartY = e.clientY;
                state.cornerStartSize = state.logoSizePct;
                logoEl.classList.add('dragging');
                return;
            }
            e.preventDefault();
            state.isDragging = true;
            state.dragStartX = e.clientX;
            state.dragStartY = e.clientY;
            state.dragStartXPct = state.logoXPct;
            state.dragStartYPct = state.logoYPct;
            logoEl.classList.add('dragging');
        });

        window.addEventListener('mousemove', e => {
            if (state.activeCorner) {
                e.preventDefault();
                const displayW = DOM.baseImagePreview.clientWidth;
                if (!displayW) return;
                const dx = e.clientX - state.cornerStartX;
                const factor = (state.activeCorner === 'se' || state.activeCorner === 'ne') ? 1 : -1;
                const deltaSize = (dx * factor / displayW) * 100;
                state.logoSizePct = Math.max(3, Math.min(150, Math.round(state.cornerStartSize + deltaSize)));
                DOM.sizeSlider.value = state.logoSizePct;
                DOM.sizeVal.textContent = `${state.logoSizePct}%`;
                saveCurrentImageSettings();
                updatePreviewLayout();
                return;
            }

            if (state.isDragging) {
                e.preventDefault();
                const displayW = DOM.baseImagePreview.clientWidth;
                const displayH = DOM.baseImagePreview.clientHeight;
                if (!displayW || !displayH) return;

                const deltaX = e.clientX - state.dragStartX;
                const deltaY = e.clientY - state.dragStartY;
                state.logoXPct = Math.min(110, Math.max(-25, state.dragStartXPct + (deltaX / displayW) * 100));
                state.logoYPct = Math.min(110, Math.max(-25, state.dragStartYPct + (deltaY / displayH) * 100));
                DOM.presetBtns.forEach(b => b.classList.remove('active'));
                saveCurrentImageSettings();
                updatePreviewLayout();
            }
        });

        window.addEventListener('mouseup', () => {
            if (state.isDragging || state.activeCorner) {
                state.isDragging = false;
                state.activeCorner = null;
                logoEl.classList.remove('dragging');
                saveCurrentImageSettings();
                saveConfig();
            }
        });
    }

    // High-Resolution Batch Processing via HTML5 Canvas
    async function processBatch() {
        if (!state.logo || state.images.length === 0) return;

        // Ensure current active image settings are saved
        saveCurrentImageSettings();

        // Show progress UI
        DOM.progressCard.style.display = 'flex';
        DOM.cardResults.style.display = 'none';
        DOM.btnProcessAll.disabled = true;

        const total = state.images.length;
        state.processedResults = [];
        DOM.resultsGrid.innerHTML = '';

        const canvas = DOM.exportCanvas;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });

        for (let i = 0; i < total; i++) {
            const item = state.images[i];
            DOM.progressTitle.textContent = `Đang xử lý ảnh (${i + 1}/${total})...`;
            DOM.progressStatus.textContent = item.name;
            DOM.progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

            // Use each image's individual custom settings!
            const imgSettings = item.settings || {
                xPct: state.logoXPct,
                yPct: state.logoYPct,
                sizePct: state.logoSizePct,
                rotation: state.logoRotation,
                opacity: state.opacity
            };

            const blob = await renderSingleImageOnCanvas(canvas, ctx, item.imgElement, imgSettings);
            const blobUrl = URL.createObjectURL(blob);
            
            const ext = 'jpg';
            const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
            const outputName = `${baseName}_logo.${ext}`;

            state.processedResults.push({
                name: outputName,
                blob,
                url: blobUrl
            });

            await new Promise(resolve => setTimeout(resolve, 30));
        }

        DOM.progressCard.style.display = 'none';
        DOM.btnProcessAll.disabled = false;
        showResultsUI();
    }

    // Core Canvas Stamping Algorithm with Per-Image Settings
    function renderSingleImageOnCanvas(canvas, ctx, baseImg, settings) {
        return new Promise(resolve => {
            const iw = baseImg.naturalWidth;
            const ih = baseImg.naturalHeight;

            canvas.width = iw;
            canvas.height = ih;

            // Draw base image
            ctx.drawImage(baseImg, 0, 0, iw, ih);

            // Compute target logo dimensions based on this image's specific settings
            const logoAr = state.logo.naturalWidth / state.logo.naturalHeight;
            const tw = Math.max(1, Math.round(iw * (settings.sizePct / 100)));
            const th = Math.max(1, Math.round(tw / logoAr));

            // Position
            const px = Math.round(iw * (settings.xPct / 100));
            const py = Math.round(ih * (settings.yPct / 100));

            // Center of the logo
            const cx = px + tw / 2;
            const cy = py + th / 2;

            ctx.save();

            // Set Opacity
            ctx.globalAlpha = settings.opacity / 100;

            // Translate to center of logo & rotate
            ctx.translate(cx, cy);
            if (settings.rotation !== 0) {
                ctx.rotate((settings.rotation * Math.PI) / 180);
            }

            // Draw logo centered
            ctx.drawImage(state.logo, -tw / 2, -th / 2, tw, th);

            ctx.restore();

            // Export full-quality JPEG
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', state.quality / 100);
        });
    }

    // Render Results Section
    function showResultsUI() {
        DOM.cardResults.style.display = 'block';
        DOM.resultCountPill.textContent = `${state.processedResults.length} ảnh`;
        DOM.resultsGrid.innerHTML = '';

        state.processedResults.forEach((res, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <img class="result-thumb" src="${res.url}" alt="${res.name}">
                <div class="result-info">
                    <span class="result-title" title="${res.name}">${res.name}</span>
                    <button type="button" class="result-dl-btn" data-index="${index}">Lưu</button>
                </div>
            `;
            card.querySelector('.result-dl-btn').addEventListener('click', () => {
                saveSingleResult(res);
            });
            DOM.resultsGrid.appendChild(card);
        });

        DOM.cardResults.scrollIntoView({ behavior: 'smooth' });
    }

    // Download / Save Single Image
    function saveSingleResult(res) {
        if (navigator.canShare && navigator.canShare({ files: [new File([res.blob], res.name, { type: res.blob.type })] })) {
            const file = new File([res.blob], res.name, { type: res.blob.type });
            navigator.share({
                files: [file],
                title: res.name
            }).catch(() => {
                triggerDirectDownload(res.url, res.name);
            });
        } else {
            triggerDirectDownload(res.url, res.name);
        }
    }

    function triggerDirectDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Batch Download as ZIP
    async function downloadAsZip() {
        if (!state.processedResults.length) return;

        if (typeof JSZip === 'undefined') {
            alert('Đang nạp thư viện nén zip, vui lòng thử lại...');
            return;
        }

        DOM.btnDownloadZip.textContent = '⏳ Đang nén file ZIP...';
        DOM.btnDownloadZip.disabled = true;

        try {
            const zip = new JSZip();
            state.processedResults.forEach(item => {
                zip.file(item.name, item.blob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipBlob);
            const zipName = `stamped_images_${new Date().toISOString().slice(0,10)}.zip`;

            triggerDirectDownload(zipUrl, zipName);

            setTimeout(() => URL.revokeObjectURL(zipUrl), 15000);
        } catch (err) {
            alert('Lỗi nén zip: ' + err.message);
        } finally {
            DOM.btnDownloadZip.textContent = '📦 Tải tất cả file ZIP';
            DOM.btnDownloadZip.disabled = false;
        }
    }

    // Share All to iOS Photos / Share Sheet
    async function shareResults() {
        if (!state.processedResults.length) return;

        const files = state.processedResults.map(r => new File([r.blob], r.name, { type: r.blob.type }));

        if (navigator.canShare && navigator.canShare({ files })) {
            try {
                await navigator.share({
                    files,
                    title: 'Ảnh đã đóng logo'
                });
            } catch (e) {
                // cancelled
            }
        } else {
            alert('Trình duyệt hiện tại không hỗ trợ chia sẻ hàng loạt trực tiếp. Sẽ tải về file ZIP thay thế.');
            downloadAsZip();
        }
    }

    // Bootstrap
    function init() {
        initElements();
        registerServiceWorker();
        restoreConfig();
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
