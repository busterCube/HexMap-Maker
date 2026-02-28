import * as THREE from './lib/three.module.js';

// Initialize Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff);

// Canvas size
let canvasWidth = 2000;
let canvasHeight = 2000;

// Background state
let bgColor = '#ffffff';
let bgImageData = null; // Base64 image data

// Camera panning state
let cameraOffsetX = 0;
let cameraOffsetY = 0;
let viewBounds = { width: 40, height: 40 };

function updateCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 20;
    if (aspect > 1) {
        camera.left = -viewSize;
        camera.right = viewSize;
        camera.top = viewSize / aspect;
        camera.bottom = -viewSize / aspect;
        viewBounds.width = viewSize * 2;
        viewBounds.height = (viewSize / aspect) * 2;
    } else {
        camera.left = -viewSize * aspect;
        camera.right = viewSize * aspect;
        camera.top = viewSize;
        camera.bottom = -viewSize;
        viewBounds.width = (viewSize * aspect) * 2;
        viewBounds.height = viewSize * 2;
    }
    camera.near = 1;
    camera.far = 1000;
    camera.position.set(cameraOffsetX, cameraOffsetY, 10);
    camera.lookAt(cameraOffsetX, cameraOffsetY, 0);
    camera.updateProjectionMatrix();
}

updateCamera();

// Menu and tools
const menu = document.getElementById('menu');
const menuToggle = document.getElementById('menu-toggle');
const systemMenu = document.getElementById('system-menu');
const systemToggle = document.getElementById('system-toggle');
let isDrawing = false;
let isErasing = false;
let drawingPoints = [];
let currentLine = null;
let textElements = [];
let isTextMode = false;
let textFrameEnabled = true;
let textFrameOpacity = 100;

// Icons state
let iconLibrary = []; // Array of {data: base64, name: string}
let mapIcons = []; // Icons placed on the map
let selectedIconIndex = -1; // Currently selected icon from library
let activeMapIcon = null; // Currently active (selected) map icon
let isIconMode = false; // Icon placement mode
const MAX_ICONS = 40;

// RNG state
let rngList = []; // Array of {name, min, max, result, linkedRngs: [id1, id2, ...]}
let nextRngId = 1;

// Frame state
let frameElements = [];
let isFrameMode = false;
let activeFrame = null;

// Number entry state
let numberEntries = [];
let isNumberEntryMode = false;
let activeNumberEntry = null;

// Label state
let labelElements = [];
let isLabelMode = false;
let activeLabel = null;

// Button tool state
let buttonElements = [];
let isButtonMode = false;
let activeButton = null;
let nextButtonId = 1;

// List box state
let listBoxElements = [];
let isListBoxMode = false;
let activeListBox = null;
let nextListBoxId = 1;

// Checkbox state
let checkboxElements = [];
let isCheckboxMode = false;
let activeCheckbox = null;

// Clipboard for copy/paste
let clipboard = null; // {type: 'frame'|'text'|'numberEntry'|'label', data: {...}}

// Variable state for button event system
let eventVariables = []; // Array of {name, value, varType: 'integer'|'float'|'string'|'boolean'}
let nextVariableId = 1;

// Grid state
let showGrid = false;
let snapToGrid = false;
let gridSize = 20; // pixels

menuToggle.addEventListener('click', () => {
    menu.classList.toggle('open');
});

systemToggle.addEventListener('click', () => {
    systemMenu.classList.toggle('open');
});

// Collapsible tool sections
document.querySelectorAll('.tool-section h3').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    });
});

// Canvas size controls
document.getElementById('apply-canvas-size').addEventListener('click', () => {
    canvasWidth = parseInt(document.getElementById('canvas-width').value) || 2000;
    canvasHeight = parseInt(document.getElementById('canvas-height').value) || 2000;
    applyCanvasSize();
});

function applyCanvasSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const needsScroll = canvasWidth > vw || canvasHeight > vh;

    if (needsScroll) {
        document.body.style.overflow = 'auto';
        let spacer = document.getElementById('import-spacer');
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.id = 'import-spacer';
            spacer.style.position = 'absolute';
            spacer.style.pointerEvents = 'none';
            spacer.style.zIndex = '-1';
            document.body.appendChild(spacer);
        }
        spacer.style.left = '0px';
        spacer.style.top = '0px';
        spacer.style.width = canvasWidth + 'px';
        spacer.style.height = canvasHeight + 'px';
    } else {
        document.body.style.overflow = 'hidden';
        const spacer = document.getElementById('import-spacer');
        if (spacer) spacer.remove();
    }

    // Resize drawing and grid canvases to cover the full canvas area
    const fullW = Math.max(canvasWidth, vw);
    const fullH = Math.max(canvasHeight, vh);
    if (drawingCanvas) {
        // Preserve existing drawing content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawingCanvas.width;
        tempCanvas.height = drawingCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(drawingCanvas, 0, 0);

        drawingCanvas.width = fullW;
        drawingCanvas.height = fullH;
        drawingCanvas.style.width = fullW + 'px';
        drawingCanvas.style.height = fullH + 'px';
        drawingCtx.drawImage(tempCanvas, 0, 0);
    }
    if (gridCanvas) {
        gridCanvas.width = fullW;
        gridCanvas.height = fullH;
        gridCanvas.style.width = fullW + 'px';
        gridCanvas.style.height = fullH + 'px';
        drawGrid();
    }

    // Resize renderer and background image to match
    renderer.setSize(fullW, fullH);
    renderer.domElement.style.width = fullW + 'px';
    renderer.domElement.style.height = fullH + 'px';
    updateCamera();

    const bgImg = document.getElementById('bg-image-element');
    if (bgImg) {
        bgImg.style.width = fullW + 'px';
        bgImg.style.height = fullH + 'px';
    }
}

// Background controls
document.getElementById('bg-color').addEventListener('input', (e) => {
    document.getElementById('bg-color-text').value = e.target.value;
    bgColor = e.target.value;
    renderer.setClearColor(bgColor);
});

document.getElementById('bg-color-text').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('bg-color').value = value;
    bgColor = value;
    renderer.setClearColor(bgColor);
});

document.getElementById('upload-background-image').addEventListener('click', () => {
    document.getElementById('background-image-file').click();
});

document.getElementById('background-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        bgImageData = event.target.result;
        // Create a background image element
        let bgImageElement = document.getElementById('bg-image-element');
        if (!bgImageElement) {
            bgImageElement = document.createElement('img');
            bgImageElement.id = 'bg-image-element';
            bgImageElement.style.position = 'fixed';
            bgImageElement.style.top = '0';
            bgImageElement.style.left = '0';
            bgImageElement.style.width = '100%';
            bgImageElement.style.height = '100%';
            bgImageElement.style.objectFit = 'contain';
            bgImageElement.style.zIndex = '-1';
            document.body.insertBefore(bgImageElement, document.body.firstChild);
        }
        bgImageElement.src = bgImageData;
        bgImageElement.style.display = 'block';
        renderer.setClearColor(0x000000, 0); // Make canvas transparent
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

document.getElementById('clear-background-image').addEventListener('click', () => {
    bgImageData = null;
    const bgImageElement = document.getElementById('bg-image-element');
    if (bgImageElement) {
        bgImageElement.style.display = 'none';
    }
    renderer.setClearColor(bgColor);
});

document.getElementById('line-color').addEventListener('input', (e) => {
    document.getElementById('line-color-text').value = e.target.value;
});

document.getElementById('line-color-text').addEventListener('input', (e) => {
    document.getElementById('line-color').value = e.target.value;
});

document.getElementById('text-color').addEventListener('input', (e) => {
    document.getElementById('text-color-text').value = e.target.value;
});

document.getElementById('text-color-text').addEventListener('input', (e) => {
    document.getElementById('text-color').value = e.target.value;
});

// Frame opacity slider
document.getElementById('text-frame-opacity').addEventListener('input', (e) => {
    textFrameOpacity = parseInt(e.target.value);
    document.getElementById('text-frame-opacity-value').textContent = textFrameOpacity + '%';
    
    // Update all existing text elements
    textElements.forEach(textEl => {
        if (textFrameEnabled) {
            const alpha = textFrameOpacity / 100;
            textEl.element.style.background = `rgba(255, 255, 255, ${alpha})`;
        }
    });
});

// Unsaved changes tracking
let hasUnsavedChanges = false;

// Update element tooltip with its name
function updateElementTooltip(element, name, fallback) {
    element.title = name || fallback || '';
}

function markUnsaved() {
    if (!hasUnsavedChanges) {
        hasUnsavedChanges = true;
        const dot = document.getElementById('unsaved-dot');
        if (dot) dot.style.display = 'inline-block';
    }
}
function clearUnsaved() {
    hasUnsavedChanges = false;
    const dot = document.getElementById('unsaved-dot');
    if (dot) dot.style.display = 'none';
}

// Helper: deactivate all tools and reset UI
const toolButtonMap = {
    'toggle-drawing': { flag: 'isDrawing', enable: 'Enable Drawing', disable: 'Disable Drawing', cursor: 'cursor-crosshair' },
    'toggle-eraser': { flag: 'isErasing', enable: 'Enable Eraser', disable: 'Disable Eraser', cursor: 'cursor-eraser' },
    'toggle-text': { flag: 'isTextMode', enable: 'Enable TextBox Tool', disable: 'Disable TextBox Tool', cursor: 'cursor-text' },
    'toggle-frame-tool': { flag: 'isFrameMode', enable: 'Enable Frame Tool', disable: 'Disable Frame Tool', cursor: 'cursor-cell' },
    'toggle-number-entry-tool': { flag: 'isNumberEntryMode', enable: 'Enable Number Entry Tool', disable: 'Disable Number Entry Tool', cursor: 'cursor-cell' },
    'toggle-label-tool': { flag: 'isLabelMode', enable: 'Enable Label Tool', disable: 'Disable Label Tool', cursor: 'cursor-text' },
    'toggle-icon-tool': { flag: 'isIconMode', enable: 'Enable Image Placement', disable: 'Disable Image Placement', cursor: 'cursor-cell' },
    'toggle-button-tool': { flag: 'isButtonMode', enable: 'Enable Button Tool', disable: 'Disable Button Tool', cursor: 'cursor-cell' },
    'toggle-listbox-tool': { flag: 'isListBoxMode', enable: 'Enable List Box Tool', disable: 'Disable List Box Tool', cursor: 'cursor-cell' },
    'toggle-checkbox-tool': { flag: 'isCheckboxMode', enable: 'Enable Checkbox Tool', disable: 'Disable Checkbox Tool', cursor: 'cursor-cell' }
};

function deactivateAllTools() {
    isDrawing = false;
    isErasing = false;
    isTextMode = false;
    isFrameMode = false;
    isNumberEntryMode = false;
    isLabelMode = false;
    isIconMode = false;
    isButtonMode = false;
    isListBoxMode = false;
    isCheckboxMode = false;
    selectedIconIndex = -1;
    renderIconLibrary();
    // Remove placement preview
    const preview = document.querySelector('.placement-preview');
    if (preview) preview.remove();
    // Reset all button text and active classes
    for (const [btnId, info] of Object.entries(toolButtonMap)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.textContent = info.enable;
            btn.classList.remove('tool-active');
        }
    }
    // Remove all cursor classes
    document.body.classList.remove('cursor-crosshair', 'cursor-eraser', 'cursor-text', 'cursor-cell');
}

function updateToolUI(activeButtonId) {
    for (const [btnId, info] of Object.entries(toolButtonMap)) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        if (btnId === activeButtonId) {
            btn.textContent = info.disable;
            btn.classList.add('tool-active');
            document.body.classList.add(info.cursor);
        } else {
            btn.textContent = info.enable;
            btn.classList.remove('tool-active');
        }
    }
}

document.getElementById('toggle-drawing').addEventListener('click', () => {
    const wasActive = isDrawing;
    deactivateAllTools();
    if (!wasActive) {
        isDrawing = true;
        updateToolUI('toggle-drawing');
    }
});

document.getElementById('toggle-eraser').addEventListener('click', () => {
    const wasActive = isErasing;
    deactivateAllTools();
    if (!wasActive) {
        isErasing = true;
        updateToolUI('toggle-eraser');
    }
});

document.getElementById('clear-all-drawing').addEventListener('click', () => {
    if (drawingCanvas && drawingCtx) {
        if (!confirm('Clear all drawing? This cannot be undone.')) return;
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        markUnsaved();
    }
});

document.getElementById('toggle-text').addEventListener('click', () => {
    const wasActive = isTextMode;
    deactivateAllTools();
    if (!wasActive) {
        isTextMode = true;
        updateToolUI('toggle-text');
    }
});

// Frame Tool controls
document.getElementById('frame-title-color').addEventListener('input', (e) => {
    document.getElementById('frame-title-color-text').value = e.target.value;
});

document.getElementById('frame-title-color-text').addEventListener('input', (e) => {
    document.getElementById('frame-title-color').value = e.target.value;
});

document.getElementById('frame-border-color').addEventListener('input', (e) => {
    document.getElementById('frame-border-color-text').value = e.target.value;
});

document.getElementById('frame-border-color-text').addEventListener('input', (e) => {
    document.getElementById('frame-border-color').value = e.target.value;
});

document.getElementById('frame-bg-color').addEventListener('input', (e) => {
    document.getElementById('frame-bg-color-text').value = e.target.value;
});

document.getElementById('frame-bg-color-text').addEventListener('input', (e) => {
    document.getElementById('frame-bg-color').value = e.target.value;
});

document.getElementById('frame-bg-opacity').addEventListener('input', (e) => {
    document.getElementById('frame-bg-opacity-value').textContent = e.target.value + '%';
});

document.getElementById('toggle-frame-tool').addEventListener('click', () => {
    const wasActive = isFrameMode;
    deactivateAllTools();
    if (!wasActive) {
        isFrameMode = true;
        updateToolUI('toggle-frame-tool');
    }
});

// Number Entry Tool controls
document.getElementById('toggle-number-entry-tool').addEventListener('click', () => {
    const wasActive = isNumberEntryMode;
    deactivateAllTools();
    if (!wasActive) {
        isNumberEntryMode = true;
        updateToolUI('toggle-number-entry-tool');
    }
});

// Number Entry Tool color controls
document.getElementById('number-entry-text-color').addEventListener('input', (e) => {
    document.getElementById('number-entry-text-color-text').value = e.target.value;
});

document.getElementById('number-entry-text-color-text').addEventListener('input', (e) => {
    document.getElementById('number-entry-text-color').value = e.target.value;
});

document.getElementById('number-entry-bg-color').addEventListener('input', (e) => {
    document.getElementById('number-entry-bg-color-text').value = e.target.value;
});

document.getElementById('number-entry-bg-color-text').addEventListener('input', (e) => {
    document.getElementById('number-entry-bg-color').value = e.target.value;
});

// Label Tool controls
document.getElementById('label-color').addEventListener('input', (e) => {
    document.getElementById('label-color-text').value = e.target.value;
});

document.getElementById('label-color-text').addEventListener('input', (e) => {
    document.getElementById('label-color').value = e.target.value;
});

document.getElementById('toggle-label-tool').addEventListener('click', () => {
    const wasActive = isLabelMode;
    deactivateAllTools();
    if (!wasActive) {
        isLabelMode = true;
        updateToolUI('toggle-label-tool');
    }
});

// Icon tool toggle
document.getElementById('toggle-icon-tool').addEventListener('click', () => {
    const wasActive = isIconMode;
    deactivateAllTools();
    if (!wasActive) {
        isIconMode = true;
        updateToolUI('toggle-icon-tool');
    }
});

// Button Tool controls
document.getElementById('button-text-color').addEventListener('input', (e) => {
    document.getElementById('button-text-color-text').value = e.target.value;
});

document.getElementById('button-text-color-text').addEventListener('input', (e) => {
    document.getElementById('button-text-color').value = e.target.value;
});

document.getElementById('button-bg-color').addEventListener('input', (e) => {
    document.getElementById('button-bg-color-text').value = e.target.value;
});

document.getElementById('button-bg-color-text').addEventListener('input', (e) => {
    document.getElementById('button-bg-color').value = e.target.value;
});

document.getElementById('toggle-button-tool').addEventListener('click', () => {
    const wasActive = isButtonMode;
    deactivateAllTools();
    if (!wasActive) {
        isButtonMode = true;
        updateToolUI('toggle-button-tool');
    }
});

// List Box Tool controls
document.getElementById('listbox-title-color').addEventListener('input', (e) => {
    document.getElementById('listbox-title-color-text').value = e.target.value;
});
document.getElementById('listbox-title-color-text').addEventListener('input', (e) => {
    document.getElementById('listbox-title-color').value = e.target.value;
});
document.getElementById('listbox-text-color').addEventListener('input', (e) => {
    document.getElementById('listbox-text-color-text').value = e.target.value;
});
document.getElementById('listbox-text-color-text').addEventListener('input', (e) => {
    document.getElementById('listbox-text-color').value = e.target.value;
});
document.getElementById('listbox-bg-color').addEventListener('input', (e) => {
    document.getElementById('listbox-bg-color-text').value = e.target.value;
});
document.getElementById('listbox-bg-color-text').addEventListener('input', (e) => {
    document.getElementById('listbox-bg-color').value = e.target.value;
});
document.getElementById('listbox-button-color').addEventListener('input', (e) => {
    document.getElementById('listbox-button-color-text').value = e.target.value;
});
document.getElementById('listbox-button-color-text').addEventListener('input', (e) => {
    document.getElementById('listbox-button-color').value = e.target.value;
});
document.getElementById('listbox-border-color').addEventListener('input', (e) => {
    document.getElementById('listbox-border-color-text').value = e.target.value;
});
document.getElementById('listbox-border-color-text').addEventListener('input', (e) => {
    document.getElementById('listbox-border-color').value = e.target.value;
});

document.getElementById('toggle-listbox-tool').addEventListener('click', () => {
    const wasActive = isListBoxMode;
    deactivateAllTools();
    if (!wasActive) {
        isListBoxMode = true;
        updateToolUI('toggle-listbox-tool');
    }
});

// Checkbox Tool controls
document.getElementById('checkbox-text-color').addEventListener('input', (e) => {
    document.getElementById('checkbox-text-color-text').value = e.target.value;
});
document.getElementById('checkbox-text-color-text').addEventListener('input', (e) => {
    document.getElementById('checkbox-text-color').value = e.target.value;
});
document.getElementById('checkbox-check-color').addEventListener('input', (e) => {
    document.getElementById('checkbox-check-color-text').value = e.target.value;
});
document.getElementById('checkbox-check-color-text').addEventListener('input', (e) => {
    document.getElementById('checkbox-check-color').value = e.target.value;
});

document.getElementById('toggle-checkbox-tool').addEventListener('click', () => {
    const wasActive = isCheckboxMode;
    deactivateAllTools();
    if (!wasActive) {
        isCheckboxMode = true;
        updateToolUI('toggle-checkbox-tool');
    }
});

// Placement preview ghost
let placementPreview = null;
function getPlacementSize() {
    if (isTextMode) return { w: 100, h: 30, label: 'Text' };
    if (isFrameMode) return { w: 200, h: 150, label: 'Frame' };
    if (isNumberEntryMode) return { w: 80, h: 40, label: 'Number' };
    if (isLabelMode) return { w: 80, h: 24, label: 'Label' };
    if (isButtonMode) return { w: 120, h: 40, label: 'Button' };
    if (isListBoxMode) return { w: 200, h: 200, label: 'List Box' };
    if (isCheckboxMode) return { w: 80, h: 20, label: 'Checkbox' };
    if (isIconMode && selectedIconIndex !== -1) return { w: 64, h: 64, label: 'Image' };
    return null;
}

document.addEventListener('mousemove', (e) => {
    const size = getPlacementSize();
    if (!size) {
        if (placementPreview) {
            placementPreview.remove();
            placementPreview = null;
        }
        return;
    }
    
    if (!placementPreview) {
        placementPreview = document.createElement('div');
        placementPreview.className = 'placement-preview';
        document.body.appendChild(placementPreview);
    }
    
    placementPreview.style.width = size.w + 'px';
    placementPreview.style.height = size.h + 'px';
    placementPreview.style.left = (e.clientX - size.w / 2) + 'px';
    placementPreview.style.top = (e.clientY - size.h / 2) + 'px';
    placementPreview.textContent = size.label;
    placementPreview.style.display = 'flex';
    placementPreview.style.alignItems = 'center';
    placementPreview.style.justifyContent = 'center';
    placementPreview.style.fontSize = '11px';
    placementPreview.style.color = 'rgba(99, 102, 241, 0.6)';
});

// Drawing canvas setup
let drawingCanvas = document.createElement('canvas');
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;
drawingCanvas.style.position = 'absolute';
drawingCanvas.style.top = '0';
drawingCanvas.style.left = '0';
drawingCanvas.style.pointerEvents = 'none';
drawingCanvas.style.zIndex = '100';
document.body.appendChild(drawingCanvas);
let drawingCtx = drawingCanvas.getContext('2d');

// Grid canvas setup
let gridCanvas = document.createElement('canvas');
gridCanvas.width = window.innerWidth;
gridCanvas.height = window.innerHeight;
gridCanvas.style.position = 'absolute';
gridCanvas.style.top = '0';
gridCanvas.style.left = '0';
gridCanvas.style.pointerEvents = 'none';
gridCanvas.style.zIndex = '50';
gridCanvas.style.display = 'none';
document.body.appendChild(gridCanvas);
let gridCtx = gridCanvas.getContext('2d');

function drawGrid() {
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    if (!showGrid) return;
    
    gridCtx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    gridCtx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= gridCanvas.width; x += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x + 0.5, 0);
        gridCtx.lineTo(x + 0.5, gridCanvas.height);
        gridCtx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= gridCanvas.height; y += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y + 0.5);
        gridCtx.lineTo(gridCanvas.width, y + 0.5);
        gridCtx.stroke();
    }
}

function snapToGridValue(value) {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
}

// Grid event handlers
document.getElementById('toggle-grid').addEventListener('change', (e) => {
    showGrid = e.target.checked;
    gridCanvas.style.display = showGrid ? 'block' : 'none';
    drawGrid();
});

document.getElementById('toggle-snap').addEventListener('change', (e) => {
    snapToGrid = e.target.checked;
});

document.getElementById('grid-size').addEventListener('change', (e) => {
    gridSize = parseInt(e.target.value) || 20;
    if (gridSize < 5) gridSize = 5;
    if (gridSize > 100) gridSize = 100;
    e.target.value = gridSize;
    drawGrid();
});

window.addEventListener('resize', () => {
    const fullW = Math.max(canvasWidth, window.innerWidth);
    const fullH = Math.max(canvasHeight, window.innerHeight);
    // Preserve existing drawing content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawingCanvas.width;
    tempCanvas.height = drawingCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(drawingCanvas, 0, 0);
    drawingCanvas.width = fullW;
    drawingCanvas.height = fullH;
    drawingCanvas.style.width = fullW + 'px';
    drawingCanvas.style.height = fullH + 'px';
    drawingCtx.drawImage(tempCanvas, 0, 0);
    gridCanvas.width = fullW;
    gridCanvas.height = fullH;
    gridCanvas.style.width = fullW + 'px';
    gridCanvas.style.height = fullH + 'px';
    drawGrid();
    renderer.setSize(fullW, fullH);
    renderer.domElement.style.width = fullW + 'px';
    renderer.domElement.style.height = fullH + 'px';
    updateCamera();
    adjustOverflowForImport();
});

// Icon functionality
const iconContainer = document.getElementById('icon-container');
const iconAddBtn = document.getElementById('icon-add');

iconAddBtn.addEventListener('click', () => {
    if (iconLibrary.length >= MAX_ICONS) {
        alert('Icon library is full! Maximum ' + MAX_ICONS + ' icons allowed.');
        return;
    }
    document.getElementById('icon-file').click();
});

document.getElementById('icon-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const iconData = event.target.result;
        const iconName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        iconLibrary.push({ data: iconData, name: iconName });
        renderIconLibrary();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

function renderIconLibrary() {
    iconContainer.innerHTML = '';
    iconLibrary.forEach((icon, index) => {
        const iconItem = document.createElement('div');
        iconItem.className = 'icon-item';
        
        const iconPreview = document.createElement('div');
        iconPreview.className = 'icon-preview';
        if (selectedIconIndex === index) {
            iconPreview.classList.add('selected');
        }
        
        const img = document.createElement('img');
        img.src = icon.data;
        iconPreview.appendChild(img);
        
        iconPreview.addEventListener('click', () => {
            if (!isIconMode) {
                alert('Enable Image Placement mode first to select and place icons.');
                return;
            }
            selectedIconIndex = index;
            renderIconLibrary();
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'ÃƒÆ’Ã¢â‚¬â€';
        deleteBtn.title = 'Remove from library';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Remove this icon from the library?')) {
                iconLibrary.splice(index, 1);
                if (selectedIconIndex === index) {
                    selectedIconIndex = -1;
                } else if (selectedIconIndex > index) {
                    selectedIconIndex--;
                }
                renderIconLibrary();
            }
        });
        iconPreview.appendChild(deleteBtn);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'icon-name';
        nameSpan.textContent = icon.name;
        nameSpan.title = 'Click to rename';
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new name for this icon:', icon.name);
            if (newName !== null && newName.trim() !== '') {
                iconLibrary[index].name = newName.trim();
                renderIconLibrary();
            }
        });
        
        iconItem.appendChild(iconPreview);
        iconItem.appendChild(nameSpan);
        iconContainer.appendChild(iconItem);
    });
}

// RNG functionality
document.getElementById('add-rng').addEventListener('click', () => {
    const name = prompt('Enter a name for this RNG:', 'RNG ' + nextRngId);
    if (name === null) return;
    
    const rng = {
        id: nextRngId++,
        name: name.trim() || 'RNG ' + (nextRngId - 1),
        min: 1,
        max: 100,
        result: '-',
        linkedRngs: []
    };
    
    rngList.push(rng);
    renderRNG();
});

function renderRNG() {
    const rngContainer = document.getElementById('rng-container');
    rngContainer.innerHTML = '';
    
    rngList.forEach((rng, index) => {
        const rngItem = document.createElement('div');
        rngItem.className = 'rng-item';
        
        // Header with name and delete button
        const header = document.createElement('div');
        header.className = 'rng-item-header';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'rng-name';
        nameSpan.textContent = rng.name;
        nameSpan.addEventListener('click', () => {
            const newName = prompt('Enter new name:', rng.name);
            if (newName !== null && newName.trim() !== '') {
                rng.name = newName.trim();
                renderRNG();
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rng-delete-btn';
        deleteBtn.textContent = 'ÃƒÆ’Ã¢â‚¬â€';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this RNG?')) {
                // Remove this RNG from other RNGs' linked lists
                rngList.forEach(otherRng => {
                    const idx = otherRng.linkedRngs.indexOf(rng.id);
                    if (idx !== -1) {
                        otherRng.linkedRngs.splice(idx, 1);
                    }
                });
                rngList.splice(index, 1);
                renderRNG();
            }
        });
        
        header.appendChild(nameSpan);
        header.appendChild(deleteBtn);
        
        // Inputs for min/max
        const inputsDiv = document.createElement('div');
        inputsDiv.className = 'rng-inputs';
        
        const minLabel = document.createElement('label');
        minLabel.textContent = 'Min:';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.value = rng.min;
        minInput.addEventListener('change', () => {
            rng.min = parseInt(minInput.value) || 1;
        });
        
        const maxLabel = document.createElement('label');
        maxLabel.textContent = 'Max:';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.value = rng.max;
        maxInput.addEventListener('change', () => {
            rng.max = parseInt(maxInput.value) || 20;
        });
        
        inputsDiv.appendChild(minLabel);
        inputsDiv.appendChild(minInput);
        inputsDiv.appendChild(maxLabel);
        inputsDiv.appendChild(maxInput);
        
        // Result and generate button
        const resultRow = document.createElement('div');
        resultRow.className = 'rng-result-row';
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'rng-result';
        resultDiv.textContent = rng.result;
        
        const generateBtn = document.createElement('button');
        generateBtn.className = 'rng-generate-btn';
        generateBtn.textContent = 'RNG';
        generateBtn.addEventListener('click', () => {
            const min = parseInt(minInput.value) || 0;
            const max = parseInt(maxInput.value) || 100;
            
            if (min > max) {
                alert('Minimum value cannot be greater than maximum value!');
                return;
            }
            
            // Add animation effect - show ... on this and all linked RNGs
            resultDiv.style.backgroundColor = '#e0e0e0';
            resultDiv.style.color = '#999';
            resultDiv.textContent = '...';
            generateBtn.disabled = true;
            
            // Also animate linked RNGs
            const linkedDisplays = [];
            rng.linkedRngs.forEach(linkedId => {
                const linkedRng = rngList.find(r => r.id === linkedId);
                if (linkedRng) {
                    const rngContainer = document.getElementById('rng-container');
                    const linkedItem = rngContainer.children[rngList.indexOf(linkedRng)];
                    if (linkedItem) {
                        const linkedDisplay = linkedItem.querySelector('.rng-result');
                        const linkedBtn = linkedItem.querySelector('.rng-generate-btn');
                        if (linkedDisplay) {
                            linkedDisplay.style.backgroundColor = '#e0e0e0';
                            linkedDisplay.style.color = '#999';
                            linkedDisplay.textContent = '...';
                            linkedDisplays.push({ display: linkedDisplay, rng: linkedRng, btn: linkedBtn });
                        }
                        if (linkedBtn) linkedBtn.disabled = true;
                    }
                }
            });
            
            setTimeout(() => {
                // Roll this RNG
                rng.result = Math.floor(Math.random() * (max - min + 1)) + min;
                resultDiv.textContent = rng.result;
                resultDiv.style.backgroundColor = 'white';
                resultDiv.style.color = '#333';
                generateBtn.disabled = false;
                
                // Roll all linked RNGs
                linkedDisplays.forEach(({ display, rng: linkedRng, btn }) => {
                    linkedRng.result = Math.floor(Math.random() * (linkedRng.max - linkedRng.min + 1)) + linkedRng.min;
                    display.textContent = linkedRng.result;
                    display.style.backgroundColor = 'white';
                    display.style.color = '#333';
                    if (btn) btn.disabled = false;
                });
            }, 1000);
        });
        
        resultRow.appendChild(resultDiv);
        resultRow.appendChild(generateBtn);
        
        // Link button
        const linkBtn = document.createElement('button');
        linkBtn.className = 'rng-link-btn';
        linkBtn.textContent = '+';
        linkBtn.title = 'Link RNGs';
        linkBtn.style.cssText = 'width: 24px; height: 24px; margin-left: 5px; cursor: pointer; font-size: 14px; font-weight: bold; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5;';
        linkBtn.addEventListener('click', () => {
            showRngLinkDialog(rng);
        });
        resultRow.appendChild(linkBtn);
        
        rngItem.appendChild(header);
        rngItem.appendChild(inputsDiv);
        rngItem.appendChild(resultRow);
        
        // Show linked RNG info
        if (rng.linkedRngs.length > 0) {
            const linkInfo = document.createElement('div');
            linkInfo.style.fontSize = '10px';
            linkInfo.style.color = '#666';
            linkInfo.style.marginTop = '4px';
            const linkedNames = rng.linkedRngs.map(id => {
                const linkedRng = rngList.find(r => r.id === id);
                return linkedRng ? linkedRng.name : '?';
            }).join(', ');
            linkInfo.textContent = 'Linked with: ' + linkedNames;
            rngItem.appendChild(linkInfo);
        }
        
        rngContainer.appendChild(rngItem);
    });
}

function showRngLinkDialog(rng) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    // Create dialog box
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: white; padding: 20px; border-radius: 8px; max-width: 400px; max-height: 500px; overflow-y: auto;';
    
    const title = document.createElement('h3');
    title.textContent = 'Link RNGs to ' + rng.name;
    title.style.marginTop = '0';
    dialog.appendChild(title);
    
    const instructions = document.createElement('p');
    instructions.textContent = 'Select RNGs to link together. When one rolls, all linked RNGs roll together.';
    instructions.style.fontSize = '12px';
    instructions.style.color = '#666';
    dialog.appendChild(instructions);
    
    // Create checkboxes for each RNG (except current)
    const checkboxes = [];
    rngList.forEach(otherRng => {
        if (otherRng.id === rng.id) return; // Skip self
        
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginBottom = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = rng.linkedRngs.includes(otherRng.id);
        checkbox.dataset.rngId = otherRng.id;
        checkboxes.push(checkbox);
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + otherRng.name));
        dialog.appendChild(label);
    });
    
    // Buttons
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        // Clear current links
        rng.linkedRngs = [];
        
        // Add selected links (bidirectional)
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const otherId = parseInt(cb.dataset.rngId);
                
                // Add to this RNG's list
                if (!rng.linkedRngs.includes(otherId)) {
                    rng.linkedRngs.push(otherId);
                }
                
                // Add this RNG to the other RNG's list (bidirectional)
                const otherRng = rngList.find(r => r.id === otherId);
                if (otherRng && !otherRng.linkedRngs.includes(rng.id)) {
                    otherRng.linkedRngs.push(rng.id);
                }
            } else {
                // If unchecked, remove bidirectional link
                const otherId = parseInt(cb.dataset.rngId);
                const otherRng = rngList.find(r => r.id === otherId);
                if (otherRng) {
                    const idx = otherRng.linkedRngs.indexOf(rng.id);
                    if (idx !== -1) {
                        otherRng.linkedRngs.splice(idx, 1);
                    }
                }
            }
        });
        
        document.body.removeChild(overlay);
        renderRNG();
    });
    
    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    dialog.appendChild(buttonRow);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// Mouse interaction
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;
let isMouseDown = false;

const canvas = document.getElementById('canvas');

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    
    if (isTextMode && !isDrawing && !isErasing) {
        // Place text
        const text = prompt('Enter text:');
        if (text !== null && text.trim() !== '') {
            const fontSize = parseInt(document.getElementById('text-size').value);
            const color = document.getElementById('text-color').value;
            const textX = snapToGridValue(e.clientX);
            const textY = snapToGridValue(e.clientY);
            
            const textEl = document.createElement('div');
            textEl.className = 'text-input';
            textEl.style.position = 'absolute';
            textEl.style.left = textX + 'px';
            textEl.style.top = textY + 'px';
            textEl.style.fontSize = fontSize + 'px';
            textEl.style.color = color;
            textEl.style.padding = '5px';
            textEl.style.cursor = 'move';
            textEl.style.zIndex = '1001';
            textEl.style.whiteSpace = 'pre-wrap';
            textEl.textContent = text;
            
            if (textFrameEnabled) {
                const alpha = textFrameOpacity / 100;
                textEl.style.border = '1px solid #ccc';
                textEl.style.background = `rgba(255, 255, 255, ${alpha})`;
                textEl.setAttribute('contenteditable', 'true');
                textEl.style.minWidth = '100px';
                textEl.style.minHeight = '30px';
            } else {
                textEl.style.border = 'none';
                textEl.style.background = 'transparent';
                textEl.setAttribute('contenteditable', 'false');
            }
            
            // Add resize handles
            const handles = document.createElement('div');
            handles.className = 'resize-handles';
            handles.style.display = textFrameEnabled ? 'block' : 'none';
            ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                const handle = document.createElement('div');
                handle.className = 'resize-handle ' + pos;
                handles.appendChild(handle);
            });
            textEl.appendChild(handles);
            
            document.body.appendChild(textEl);
            
            const textData = {
                element: textEl,
                name: null,
                text: text,
                x: textX,
                y: textY,
                fontSize: fontSize,
                color: color,
                width: 100,
                height: 30,
                resizeEnabled: true
            };
            textElements.push(textData);
            markUnsaved();
            
            makeTextDraggable(textEl, textData);
            makeTextResizable(textEl, textData);
            makeTextEditable(textEl, textData);
            
            // Update text content on input
            textEl.addEventListener('input', () => {
                textData.text = textEl.textContent;
            });
        }
        return;
    }
    
    // Frame Tool - place frame
    if (isFrameMode) {
        placeFrame(e.clientX, e.clientY);
        return;
    }
    
    // Number Entry Tool - place number entry box
    if (isNumberEntryMode) {
        placeNumberEntry(e.clientX, e.clientY);
        return;
    }
    
    // Label Tool - place label
    if (isLabelMode) {
        const text = prompt('Enter label text:');
        if (text !== null && text.trim() !== '') {
            placeLabel(e.clientX, e.clientY, text);
        }
        return;
    }
    
    // Button Tool - place button
    if (isButtonMode) {
        placeButton(e.clientX, e.clientY);
        return;
    }
    
    // List Box Tool - place list box
    if (isListBoxMode) {
        placeListBox(e.clientX, e.clientY);
        return;
    }
    
    // Checkbox Tool - place checkbox
    if (isCheckboxMode) {
        placeCheckbox(e.clientX, e.clientY);
        return;
    }
    
    if (isIconMode && selectedIconIndex !== -1 && iconLibrary[selectedIconIndex]) {
        // Place icon on canvas
        placeIcon(e.clientX, e.clientY);
        return;
    }
    
    if (e.button === 2) return; // Right click
    if (e.button === 1 || e.ctrlKey) {
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
    }
    
    if (isDrawing || isErasing) {
        drawingPoints = [[e.clientX, e.clientY]];
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        
        const worldScale = viewBounds.width / window.innerWidth;
        cameraOffsetX -= dx * worldScale;
        cameraOffsetY += dy * worldScale;
        
        updateCamera();
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
    }
    
    if (isMouseDown && (isDrawing || isErasing)) {
        drawingPoints.push([e.clientX, e.clientY]);
        
        if (drawingPoints.length > 1) {
            const thickness = parseInt(document.getElementById('line-thickness').value);
            const color = document.getElementById('line-color').value;
            
            drawingCtx.lineWidth = isErasing ? thickness * 2 : thickness;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            
            if (isErasing) {
                drawingCtx.globalCompositeOperation = 'destination-out';
                drawingCtx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                drawingCtx.globalCompositeOperation = 'source-over';
                drawingCtx.strokeStyle = color;
            }
            
            const p1 = drawingPoints[drawingPoints.length - 2];
            const p2 = drawingPoints[drawingPoints.length - 1];
            
            drawingCtx.beginPath();
            drawingCtx.moveTo(p1[0], p1[1]);
            drawingCtx.lineTo(p2[0], p2[1]);
            drawingCtx.stroke();
            drawingCtx.globalCompositeOperation = 'source-over';
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
    isPanning = false;
    
    if (isDrawing || isErasing) {
        drawingPoints = [];
        markUnsaved();
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (clipboard) {
        lastContextMenuPosition = { x: e.clientX, y: e.clientY };
        positionContextMenu(canvasContextMenu, e.clientX, e.clientY);
    }
});

function placeIcon(x, y) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const icon = iconLibrary[selectedIconIndex];
    if (!icon) return;
    
    const iconEl = document.createElement('div');
    iconEl.className = 'map-icon';
    iconEl.style.left = x + 'px';
    iconEl.style.top = y + 'px';
    iconEl.style.width = '64px';
    iconEl.style.height = '64px';
    
    const img = document.createElement('img');
    img.src = icon.data;
    iconEl.appendChild(img);
    
    // Add resize handles
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    iconEl.appendChild(handles);
    
    document.body.appendChild(iconEl);
    
    const mapIcon = {
        element: iconEl,
        iconIndex: selectedIconIndex,
        x: x,
        y: y,
        width: 64,
        height: 64,
        rotation: 0
    };
    
    mapIcons.push(mapIcon);
    markUnsaved();
    
    makeIconDraggable(iconEl, mapIcon);
    makeIconResizable(iconEl, mapIcon);
    
    iconEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showIconContextMenu(e, mapIcon);
    });
    
    iconEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveMapIcon(mapIcon);
    });
}

function setActiveMapIcon(mapIcon) {
    // Deactivate previous
    if (activeMapIcon) {
        activeMapIcon.element.classList.remove('active');
    }
    
    activeMapIcon = mapIcon;
    if (!mapIcon.locked) {
        mapIcon.element.classList.add('active');
    }
}

function makeIconDraggable(element, mapIcon) {
    if (!mapIcon._ac) mapIcon._ac = new AbortController();
    const signal = mapIcon._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        if (mapIcon.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = mapIcon.x;
        startTop = mapIcon.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        mapIcon.x = snapToGridValue(startLeft + dx);
        mapIcon.y = snapToGridValue(startTop + dy);
        
        element.style.left = mapIcon.x + 'px';
        element.style.top = mapIcon.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeIconResizable(element, mapIcon) {
    const signal = mapIcon._ac ? mapIcon._ac.signal : undefined;
    const handles = element.querySelector('.resize-handles').children;
    
    Array.from(handles).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (mapIcon.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = mapIcon.width;
            startHeight = mapIcon.height;
            startLeft = mapIcon.x;
            startTop = mapIcon.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                mapIcon.width = Math.max(20, startWidth + dx);
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(20, startWidth - dx);
                if (newWidth >= 20) {
                    mapIcon.x = startLeft + (startWidth - newWidth);
                    mapIcon.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                mapIcon.height = Math.max(20, startHeight + dy);
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(20, startHeight - dy);
                if (newHeight >= 20) {
                    mapIcon.y = startTop + (startHeight - newHeight);
                    mapIcon.height = newHeight;
                }
            }
            
            element.style.left = mapIcon.x + 'px';
            element.style.top = mapIcon.y + 'px';
            element.style.width = mapIcon.width + 'px';
            element.style.height = mapIcon.height + 'px';
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

// ============== FRAME TOOL FUNCTIONS ==============
function placeFrame(x, y) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const title = document.getElementById('frame-title').value || 'Frame';
    const titleSize = parseInt(document.getElementById('frame-title-size').value) || 16;
    const titlePlacement = document.getElementById('frame-title-placement').value || 'center';
    const titleColor = document.getElementById('frame-title-color').value || '#333333';
    const borderThickness = parseInt(document.getElementById('frame-border-thickness').value) || 2;
    const borderColor = document.getElementById('frame-border-color').value || '#333333';
    const bgColor = document.getElementById('frame-bg-color').value || '#ffffff';
    const bgOpacity = parseInt(document.getElementById('frame-bg-opacity').value) || 100;
    
    const frameEl = document.createElement('div');
    frameEl.className = 'sheet-frame';
    frameEl.style.left = x + 'px';
    frameEl.style.top = y + 'px';
    frameEl.style.width = '200px';
    frameEl.style.height = '150px';
    frameEl.style.border = `${borderThickness}px solid ${borderColor}`;
    
    // Convert hex to rgba for background
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    frameEl.style.background = `rgba(${r}, ${g}, ${b}, ${bgOpacity / 100})`;
    
    // Add title
    const titleEl = document.createElement('div');
    titleEl.className = 'frame-title ' + titlePlacement;
    titleEl.textContent = title;
    titleEl.style.fontSize = titleSize + 'px';
    titleEl.style.color = titleColor;
    frameEl.appendChild(titleEl);
    
    // Add resize handles
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    frameEl.appendChild(handles);
    
    document.body.appendChild(frameEl);
    
    const frameData = {
        element: frameEl,
        title: title,
        titleSize: titleSize,
        titlePlacement: titlePlacement,
        titleColor: titleColor,
        borderThickness: borderThickness,
        borderColor: borderColor,
        bgColor: bgColor,
        bgOpacity: bgOpacity,
        x: x,
        y: y,
        width: 200,
        height: 150,
        locked: false
    };
    
    frameElements.push(frameData);
    markUnsaved();
    
    makeFrameDraggable(frameEl, frameData);
    makeFrameResizable(frameEl, frameData);
    
    frameEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFrameContextMenu(e, frameData);
    });
    
    frameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveFrame(frameData);
    });
}

// Helper function for pasting frames with override data
function placeFrameWithData(x, y, data) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const title = data.title || 'Frame';
    const titleSize = data.titleSize || 16;
    const titlePlacement = data.titlePlacement || 'center';
    const titleColor = data.titleColor || '#333333';
    const borderThickness = data.borderThickness || 2;
    const borderColor = data.borderColor || '#333333';
    const bgColor = data.bgColor || '#ffffff';
    const bgOpacity = data.bgOpacity || 100;
    const width = data.width || 200;
    const height = data.height || 150;
    
    const frameEl = document.createElement('div');
    frameEl.className = 'sheet-frame';
    frameEl.style.left = x + 'px';
    frameEl.style.top = y + 'px';
    frameEl.style.width = width + 'px';
    frameEl.style.height = height + 'px';
    frameEl.style.border = `${borderThickness}px solid ${borderColor}`;
    
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    frameEl.style.background = `rgba(${r}, ${g}, ${b}, ${bgOpacity / 100})`;
    
    const titleEl = document.createElement('div');
    titleEl.className = 'frame-title ' + titlePlacement;
    titleEl.textContent = title;
    titleEl.style.fontSize = titleSize + 'px';
    titleEl.style.color = titleColor;
    frameEl.appendChild(titleEl);
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    frameEl.appendChild(handles);
    
    document.body.appendChild(frameEl);
    
    const frameData = {
        element: frameEl,
        title: title,
        titleSize: titleSize,
        titlePlacement: titlePlacement,
        titleColor: titleColor,
        borderThickness: borderThickness,
        borderColor: borderColor,
        bgColor: bgColor,
        bgOpacity: bgOpacity,
        x: x,
        y: y,
        width: width,
        height: height,
        locked: false
    };
    
    frameElements.push(frameData);
    markUnsaved();
    
    makeFrameDraggable(frameEl, frameData);
    makeFrameResizable(frameEl, frameData);
    
    frameEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFrameContextMenu(e, frameData);
    });
    
    frameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveFrame(frameData);
    });
}

// Helper function for pasting text elements with override data
function placeTextElement(x, y, text, data) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const fontSize = data?.fontSize || parseInt(document.getElementById('text-size').value) || 16;
    const color = data?.color || document.getElementById('text-color').value;
    const width = data?.width || 200;
    const height = data?.height || 100;
    
    const textEl = document.createElement('div');
    textEl.className = 'text-input';
    textEl.style.position = 'absolute';
    textEl.style.left = x + 'px';
    textEl.style.top = y + 'px';
    textEl.style.width = width + 'px';
    textEl.style.minHeight = height + 'px';
    textEl.style.fontSize = fontSize + 'px';
    textEl.style.color = color;
    textEl.style.padding = '5px';
    textEl.style.cursor = 'move';
    textEl.style.zIndex = '1001';
    textEl.style.whiteSpace = 'pre-wrap';
    textEl.textContent = text;
    
    if (textFrameEnabled) {
        const alpha = textFrameOpacity / 100;
        textEl.style.border = '1px solid #ccc';
        textEl.style.background = `rgba(255, 255, 255, ${alpha})`;
        textEl.setAttribute('contenteditable', 'true');
    } else {
        textEl.style.border = 'none';
        textEl.style.background = 'transparent';
        textEl.setAttribute('contenteditable', 'false');
    }
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    handles.style.display = textFrameEnabled ? 'block' : 'none';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    textEl.appendChild(handles);
    
    document.body.appendChild(textEl);
    
    const textData = {
        element: textEl,
        name: data?.name || null,
        text: text,
        x: x,
        y: y,
        fontSize: fontSize,
        color: color,
        width: width,
        height: height,
        resizeEnabled: true
    };
    textElements.push(textData);
    markUnsaved();
    
    makeTextDraggable(textEl, textData);
    makeTextResizable(textEl, textData);
    makeTextEditable(textEl, textData);
    
    textEl.addEventListener('input', () => {
        textData.text = textEl.textContent || textEl.innerText;
    });
    
    textEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTextContextMenu(e, textData);
    });
}

// Helper function for pasting labels with override data
function placeLabelWithData(x, y, data) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const fontSize = data.fontSize || 24;
    const color = data.color || '#000000';
    const letterSpacing = data.letterSpacing || 0;
    const isBold = data.bold || false;
    const isItalic = data.italic || false;
    const isUnderlined = data.underline || false;
    const text = data.text || 'Label';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'sheet-label';
    labelEl.style.left = x + 'px';
    labelEl.style.top = y + 'px';
    labelEl.style.fontSize = fontSize + 'px';
    labelEl.style.color = color;
    labelEl.style.letterSpacing = letterSpacing + 'px';
    if (isBold) labelEl.style.fontWeight = 'bold';
    if (isItalic) labelEl.style.fontStyle = 'italic';
    if (isUnderlined) labelEl.style.textDecoration = 'underline';
    labelEl.textContent = text;
    
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    labelEl.appendChild(handles);
    
    document.body.appendChild(labelEl);
    
    const labelData = {
        element: labelEl,
        name: data.name || null,
        text: text,
        fontSize: fontSize,
        color: color,
        letterSpacing: letterSpacing,
        bold: isBold,
        italic: isItalic,
        underline: isUnderlined,
        x: x,
        y: y
    };
    
    labelElements.push(labelData);
    markUnsaved();
    
    makeLabelDraggable(labelEl, labelData);
    
    labelEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLabelContextMenu(e, labelData);
    });
    
    labelEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newText = prompt('Edit label:', labelData.text);
        if (newText !== null && newText.trim() !== '') {
            labelData.text = newText;
            const handles = labelEl.querySelector('.resize-handles');
            labelEl.textContent = newText;
            if (handles) labelEl.appendChild(handles);
            markUnsaved();
        }
    });
    
    labelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveLabel(labelData);
    });
}

function setActiveFrame(frameData) {
    if (activeFrame) {
        activeFrame.element.classList.remove('active');
    }
    activeFrame = frameData;
    if (!frameData.locked) {
        frameData.element.classList.add('active');
    }
}

function makeFrameDraggable(element, frameData) {
    if (!frameData._ac) frameData._ac = new AbortController();
    const signal = frameData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.classList.contains('frame-title')) return; // Allow title click for editing
        if (e.button !== 0) return;
        if (frameData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = frameData.x;
        startTop = frameData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        frameData.x = snapToGridValue(startLeft + dx);
        frameData.y = snapToGridValue(startTop + dy);
        
        element.style.left = frameData.x + 'px';
        element.style.top = frameData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeFrameResizable(element, frameData) {
    const signal = frameData._ac ? frameData._ac.signal : undefined;
    const handlesContainer = element.querySelector('.resize-handles');
    if (!handlesContainer) return;
    
    const handles = handlesContainer.children;
    
    Array.from(handles).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (frameData.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = frameData.width;
            startHeight = frameData.height;
            startLeft = frameData.x;
            startTop = frameData.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                frameData.width = Math.max(50, startWidth + dx);
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(50, startWidth - dx);
                if (newWidth >= 50) {
                    frameData.x = startLeft + (startWidth - newWidth);
                    frameData.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                frameData.height = Math.max(50, startHeight + dy);
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(50, startHeight - dy);
                if (newHeight >= 50) {
                    frameData.y = startTop + (startHeight - newHeight);
                    frameData.height = newHeight;
                }
            }
            
            element.style.left = frameData.x + 'px';
            element.style.top = frameData.y + 'px';
            element.style.width = frameData.width + 'px';
            element.style.height = frameData.height + 'px';
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

function showFrameContextMenu(e, frameData) {
    currentFrameData = frameData;
    
    // Update lock menu item text
    document.getElementById('toggle-frame-lock').textContent = frameData.locked ? 'Unlock Frame' : 'Lock Frame';
    
    positionContextMenu(frameContextMenu, e.clientX, e.clientY);
}

// ============== NUMBER ENTRY TOOL FUNCTIONS ==============
function placeNumberEntry(x, y, overrideData = null) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const defaultValue = overrideData?.value ?? (parseFloat(document.getElementById('number-entry-default').value) || 0);
    const minValue = overrideData?.min ?? document.getElementById('number-entry-min').value;
    const maxValue = overrideData?.max ?? document.getElementById('number-entry-max').value;
    const fontSize = overrideData?.fontSize ?? (parseInt(document.getElementById('number-entry-font-size').value) || 16);
    const textColor = overrideData?.textColor ?? (document.getElementById('number-entry-text-color').value || '#000000');
    const bgColor = overrideData?.bgColor ?? (document.getElementById('number-entry-bg-color').value || '#ffffff');
    const isBold = overrideData?.bold ?? document.getElementById('number-entry-bold').checked;
    const isItalic = overrideData?.italic ?? document.getElementById('number-entry-italic').checked;
    const width = overrideData?.width ?? 80;
    const height = overrideData?.height ?? 40;
    
    const entryEl = document.createElement('div');
    entryEl.className = 'number-entry';
    entryEl.style.left = x + 'px';
    entryEl.style.top = y + 'px';
    entryEl.style.width = width + 'px';
    entryEl.style.height = height + 'px';
    entryEl.style.backgroundColor = bgColor;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.value = defaultValue;
    input.style.fontSize = fontSize + 'px';
    input.style.color = textColor;
    input.style.backgroundColor = 'transparent';
    if (isBold) input.style.fontWeight = 'bold';
    if (isItalic) input.style.fontStyle = 'italic';
    if (minValue !== '' && minValue !== null) input.min = minValue;
    if (maxValue !== '' && maxValue !== null) input.max = maxValue;
    entryEl.appendChild(input);
    
    // Add resize handles
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    entryEl.appendChild(handles);
    
    document.body.appendChild(entryEl);
    
    const entryData = {
        element: entryEl,
        input: input,
        name: overrideData?.name || null,
        value: defaultValue,
        min: (minValue !== '' && minValue !== null) ? parseFloat(minValue) : null,
        max: (maxValue !== '' && maxValue !== null) ? parseFloat(maxValue) : null,
        fontSize: fontSize,
        textColor: textColor,
        bgColor: bgColor,
        bold: isBold,
        italic: isItalic,
        x: x,
        y: y,
        width: width,
        height: height
    };
    
    numberEntries.push(entryData);
    markUnsaved();
    
    // Update value when changed
    input.addEventListener('change', () => {
        entryData.value = parseFloat(input.value) || 0;
    });
    
    // Stop propagation to prevent canvas events
    input.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    makeNumberEntryDraggable(entryEl, entryData);
    makeNumberEntryResizable(entryEl, entryData);
    
    entryEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showNumberEntryContextMenu(e, entryData);
    });
    
    entryEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveNumberEntry(entryData);
    });
}

function setActiveNumberEntry(entryData) {
    if (activeNumberEntry) {
        activeNumberEntry.element.classList.remove('active');
    }
    activeNumberEntry = entryData;
    if (!entryData.locked) {
        entryData.element.classList.add('active');
    }
}

function makeNumberEntryDraggable(element, entryData) {
    if (!entryData._ac) entryData._ac = new AbortController();
    const signal = entryData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.tagName === 'INPUT') return; // Don't drag when clicking input
        if (e.button !== 0) return;
        if (entryData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = entryData.x;
        startTop = entryData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        entryData.x = snapToGridValue(startLeft + dx);
        entryData.y = snapToGridValue(startTop + dy);
        
        element.style.left = entryData.x + 'px';
        element.style.top = entryData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeNumberEntryResizable(element, entryData) {
    const signal = entryData._ac ? entryData._ac.signal : undefined;
    const handlesContainer = element.querySelector('.resize-handles');
    if (!handlesContainer) return;
    
    const handles = handlesContainer.children;
    
    Array.from(handles).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (entryData.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = entryData.width;
            startHeight = entryData.height;
            startLeft = entryData.x;
            startTop = entryData.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                entryData.width = Math.max(40, startWidth + dx);
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(40, startWidth - dx);
                if (newWidth >= 40) {
                    entryData.x = startLeft + (startWidth - newWidth);
                    entryData.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                entryData.height = Math.max(25, startHeight + dy);
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(25, startHeight - dy);
                if (newHeight >= 25) {
                    entryData.y = startTop + (startHeight - newHeight);
                    entryData.height = newHeight;
                }
            }
            
            element.style.left = entryData.x + 'px';
            element.style.top = entryData.y + 'px';
            element.style.width = entryData.width + 'px';
            element.style.height = entryData.height + 'px';
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

function showNumberEntryContextMenu(e, entryData) {
    currentNumberEntryData = entryData;
    
    // Update lock menu item text
    document.getElementById('toggle-number-entry-lock').textContent = entryData.locked ? 'Unlock' : 'Lock';
    
    positionContextMenu(numberEntryContextMenu, e.clientX, e.clientY);
}

// ============== LABEL TOOL FUNCTIONS ==============
function placeLabel(x, y, text) {
    const fontSize = parseInt(document.getElementById('label-font-size').value) || 24;
    const color = document.getElementById('label-color').value || '#000000';
    const letterSpacing = parseInt(document.getElementById('label-letter-spacing').value) || 0;
    const isBold = document.getElementById('label-bold').checked;
    const isItalic = document.getElementById('label-italic').checked;
    const isUnderlined = document.getElementById('label-underline').checked;
    
    const labelEl = document.createElement('div');
    labelEl.className = 'sheet-label';
    labelEl.style.left = x + 'px';
    labelEl.style.top = y + 'px';
    labelEl.style.fontSize = fontSize + 'px';
    labelEl.style.color = color;
    labelEl.style.letterSpacing = letterSpacing + 'px';
    if (isBold) labelEl.style.fontWeight = 'bold';
    if (isItalic) labelEl.style.fontStyle = 'italic';
    if (isUnderlined) labelEl.style.textDecoration = 'underline';
    labelEl.textContent = text;
    
    // Add resize handles (for repositioning mostly)
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    labelEl.appendChild(handles);
    
    document.body.appendChild(labelEl);
    
    const labelData = {
        element: labelEl,
        name: null,
        text: text,
        fontSize: fontSize,
        color: color,
        letterSpacing: letterSpacing,
        bold: isBold,
        italic: isItalic,
        underline: isUnderlined,
        x: x,
        y: y
    };
    
    labelElements.push(labelData);
    markUnsaved();
    
    makeLabelDraggable(labelEl, labelData);
    
    labelEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLabelContextMenu(e, labelData);
    });
    
    labelEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newText = prompt('Edit label:', labelData.text);
        if (newText !== null && newText.trim() !== '') {
            labelData.text = newText;
            const handles = labelEl.querySelector('.resize-handles');
            labelEl.textContent = newText;
            if (handles) labelEl.appendChild(handles);
            markUnsaved();
        }
    });
    
    labelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveLabel(labelData);
    });
}

function setActiveLabel(labelData) {
    if (activeLabel) {
        activeLabel.element.classList.remove('active');
    }
    activeLabel = labelData;
    if (!labelData.locked) {
        labelData.element.classList.add('active');
    }
}

function makeLabelDraggable(element, labelData) {
    if (!labelData._ac) labelData._ac = new AbortController();
    const signal = labelData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        if (labelData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = labelData.x;
        startTop = labelData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        labelData.x = snapToGridValue(startLeft + dx);
        labelData.y = snapToGridValue(startTop + dy);
        
        element.style.left = labelData.x + 'px';
        element.style.top = labelData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function showLabelContextMenu(e, labelData) {
    currentLabelData = labelData;
    
    // Update lock menu item text
    document.getElementById('toggle-label-lock').textContent = labelData.locked ? 'Unlock' : 'Lock';
    
    positionContextMenu(labelContextMenu, e.clientX, e.clientY);
}

function makeTextDraggable(element, textData) {
    if (!textData._ac) textData._ac = new AbortController();
    const signal = textData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (textData.locked) return;
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        
        // If frame is enabled, allow drag only when clicking on the element border/padding
        // by checking if the click is close to the edge
        if (textFrameEnabled && element.getAttribute('contenteditable') === 'true') {
            const rect = element.getBoundingClientRect();
            const borderZone = 10; // pixels from edge to allow drag
            const inBorderZone = 
                e.clientX < rect.left + borderZone ||
                e.clientX > rect.right - borderZone ||
                e.clientY < rect.top + borderZone ||
                e.clientY > rect.bottom - borderZone;
            
            if (!inBorderZone) {
                return; // Click in content area, allow editing
            }
            // Click near border, prevent editing and allow drag
            e.preventDefault();
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = textData.x;
        startTop = textData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        textData.x = snapToGridValue(startLeft + dx);
        textData.y = snapToGridValue(startTop + dy);
        
        element.style.left = textData.x + 'px';
        element.style.top = textData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeTextResizable(element, textData) {
    const signal = textData._ac ? textData._ac.signal : undefined;
    const handles = element.querySelector('.resize-handles');
    if (!handles) return;
    
    Array.from(handles.children).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (textData.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = element.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startLeft = textData.x;
            startTop = textData.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                const newWidth = Math.max(50, startWidth + dx);
                element.style.width = newWidth + 'px';
                textData.width = newWidth;
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(50, startWidth - dx);
                if (newWidth >= 50) {
                    textData.x = startLeft + (startWidth - newWidth);
                    element.style.left = textData.x + 'px';
                    element.style.width = newWidth + 'px';
                    textData.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                const newHeight = Math.max(30, startHeight + dy);
                element.style.height = newHeight + 'px';
                textData.height = newHeight;
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(30, startHeight - dy);
                if (newHeight >= 30) {
                    textData.y = startTop + (startHeight - newHeight);
                    element.style.top = textData.y + 'px';
                    element.style.height = newHeight + 'px';
                    textData.height = newHeight;
                }
            }
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

function makeTextEditable(element, textData) {
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showTextContextMenu(e, textData);
    });
    
    // Double-click to edit text inline
    element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newText = prompt('Edit text:', textData.text);
        if (newText !== null) {
            textData.text = newText;
            const handles = element.querySelector('.resize-handles');
            element.textContent = newText;
            if (handles) element.appendChild(handles);
            markUnsaved();
        }
    });
}

// Context menus
const textContextMenu = document.getElementById('text-context-menu');
const iconContextMenu = document.getElementById('icon-context-menu');
const frameContextMenu = document.getElementById('frame-context-menu');
const numberEntryContextMenu = document.getElementById('number-entry-context-menu');
const labelContextMenu = document.getElementById('label-context-menu');
const buttonContextMenu = document.getElementById('button-context-menu');
const listboxContextMenu = document.getElementById('listbox-context-menu');
const listboxItemContextMenu = document.getElementById('listbox-item-context-menu');
const canvasContextMenu = document.getElementById('canvas-context-menu');
const checkboxContextMenu = document.getElementById('checkbox-context-menu');

let currentTextData = null;
let currentIconData = null;
let currentFrameData = null;
let currentNumberEntryData = null;
let currentLabelData = null;
let currentButtonData = null;
let currentListBoxData = null;
let currentListBoxItemData = null;
let lastContextMenuPosition = { x: 0, y: 0 };

function showTextContextMenu(e, textData) {
    currentTextData = textData;
    
    // Update lock menu item text
    document.getElementById('toggle-text-lock').textContent = textData.locked ? 'Unlock' : 'Lock';
    
    positionContextMenu(textContextMenu, e.clientX, e.clientY);
}

function showIconContextMenu(e, mapIcon) {
    currentIconData = mapIcon;
    
    // Update lock menu item text
    document.getElementById('toggle-icon-lock').textContent = mapIcon.locked ? 'Unlock Image' : 'Lock Image';
    
    positionContextMenu(iconContextMenu, e.clientX, e.clientY);
}

document.addEventListener('click', () => {
    textContextMenu.classList.remove('visible');
    iconContextMenu.classList.remove('visible');
    frameContextMenu.classList.remove('visible');
    numberEntryContextMenu.classList.remove('visible');
    labelContextMenu.classList.remove('visible');
    buttonContextMenu.classList.remove('visible');
    listboxContextMenu.classList.remove('visible');
    listboxItemContextMenu.classList.remove('visible');
    canvasContextMenu.classList.remove('visible');
    checkboxContextMenu.classList.remove('visible');
});

// Escape key handler: close menus, deactivate tools, close panels
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close all context menus
        textContextMenu.classList.remove('visible');
        iconContextMenu.classList.remove('visible');
        frameContextMenu.classList.remove('visible');
        numberEntryContextMenu.classList.remove('visible');
        labelContextMenu.classList.remove('visible');
        buttonContextMenu.classList.remove('visible');
        listboxContextMenu.classList.remove('visible');
        listboxItemContextMenu.classList.remove('visible');
        canvasContextMenu.classList.remove('visible');
        checkboxContextMenu.classList.remove('visible');
        // Deactivate all tools
        deactivateAllTools();
        // Close side panels
        menu.classList.remove('open');
        systemMenu.classList.remove('open');
    }
});

// Helper: position a context menu within viewport bounds
function positionContextMenu(menuEl, x, y) {
    // Temporarily show to measure
    menuEl.style.left = '-9999px';
    menuEl.style.top = '-9999px';
    menuEl.classList.add('visible');
    const rect = menuEl.getBoundingClientRect();
    menuEl.classList.remove('visible');
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    if (x + rect.width > vw) x = vw - rect.width - 5;
    if (y + rect.height > vh) y = vh - rect.height - 5;
    if (x < 0) x = 5;
    if (y < 0) y = 5;
    
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
    menuEl.classList.add('visible');
}

document.getElementById('edit-text').addEventListener('click', () => {
    if (currentTextData) {
        const newText = prompt('Edit text:', currentTextData.text);
        if (newText !== null) {
            currentTextData.text = newText;
            // Preserve resize handles when updating text
            const handles = currentTextData.element.querySelector('.resize-handles');
            currentTextData.element.textContent = newText;
            if (handles) {
                currentTextData.element.appendChild(handles);
            }
            markUnsaved();
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('rename-text').addEventListener('click', () => {
    if (currentTextData) {
        const index = textElements.indexOf(currentTextData);
        const currentName = currentTextData.name || `Textbox ${index + 1}`;
        const newName = prompt('Enter a name for this Textbox:', currentName);
        if (newName !== null && newName.trim() !== '') {
            currentTextData.name = newName.trim();
            updateElementTooltip(currentTextData.element, currentTextData.name, 'Textbox');
            markUnsaved();
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('toggle-text-lock').addEventListener('click', () => {
    if (currentTextData) {
        currentTextData.locked = !currentTextData.locked;
        if (currentTextData.locked) {
            currentTextData.element.classList.add('locked');
        } else {
            currentTextData.element.classList.remove('locked');
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('delete-text').addEventListener('click', () => {
    if (currentTextData) {
        const index = textElements.indexOf(currentTextData);
        if (index !== -1) {
            textElements.splice(index, 1);
            if (currentTextData._ac) currentTextData._ac.abort();
            markUnsaved();
            currentTextData.element.remove();
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('delete-icon').addEventListener('click', () => {
    if (currentIconData) {
        const index = mapIcons.indexOf(currentIconData);
        if (index !== -1) {
            mapIcons.splice(index, 1);
            if (currentIconData._ac) currentIconData._ac.abort();
            markUnsaved();
            currentIconData.element.remove();
            if (activeMapIcon === currentIconData) {
                activeMapIcon = null;
            }
        }
    }
    iconContextMenu.classList.remove('visible');
});

document.getElementById('bring-to-front').addEventListener('click', () => {
    if (currentIconData) {
        currentIconData.element.style.zIndex = '501';
    }
    iconContextMenu.classList.remove('visible');
});

document.getElementById('send-to-back').addEventListener('click', () => {
    if (currentIconData) {
        currentIconData.element.style.zIndex = '499';
    }
    iconContextMenu.classList.remove('visible');
});

// Image rotate handler
document.getElementById('rotate-icon').addEventListener('click', () => {
    if (currentIconData) {
        currentIconData.rotation = ((currentIconData.rotation || 0) + 90) % 360;
        const img = currentIconData.element.querySelector('img');
        if (img) {
            img.style.transform = `rotate(${currentIconData.rotation}deg)`;
        }
    }
    iconContextMenu.classList.remove('visible');
});

// Icon lock handler
document.getElementById('toggle-icon-lock').addEventListener('click', () => {
    if (currentIconData) {
        currentIconData.locked = !currentIconData.locked;
        if (currentIconData.locked) {
            currentIconData.element.classList.add('locked');
            currentIconData.element.classList.remove('active');
        } else {
            currentIconData.element.classList.remove('locked');
        }
    }
    iconContextMenu.classList.remove('visible');
});

// Frame context menu handlers
document.getElementById('edit-frame-title').addEventListener('click', () => {
    if (currentFrameData) {
        const newTitle = prompt('Edit frame title:', currentFrameData.title);
        if (newTitle !== null) {
            currentFrameData.title = newTitle;
            const titleEl = currentFrameData.element.querySelector('.frame-title');
            if (titleEl) {
                titleEl.textContent = newTitle;
            }
        }
    }
    frameContextMenu.classList.remove('visible');
});

document.getElementById('toggle-frame-lock').addEventListener('click', () => {
    if (currentFrameData) {
        currentFrameData.locked = !currentFrameData.locked;
        if (currentFrameData.locked) {
            currentFrameData.element.classList.add('locked');
            currentFrameData.element.classList.remove('active');
        } else {
            currentFrameData.element.classList.remove('locked');
        }
    }
    frameContextMenu.classList.remove('visible');
});

document.getElementById('frame-bring-to-front').addEventListener('click', () => {
    if (currentFrameData) {
        currentFrameData.element.style.zIndex = '450';
    }
    frameContextMenu.classList.remove('visible');
});

document.getElementById('frame-send-to-back').addEventListener('click', () => {
    if (currentFrameData) {
        currentFrameData.element.style.zIndex = '350';
    }
    frameContextMenu.classList.remove('visible');
});

document.getElementById('delete-frame').addEventListener('click', () => {
    if (currentFrameData) {
        const index = frameElements.indexOf(currentFrameData);
        if (index !== -1) {
            frameElements.splice(index, 1);
            if (currentFrameData._ac) currentFrameData._ac.abort();
            markUnsaved();
            currentFrameData.element.remove();
            if (activeFrame === currentFrameData) {
                activeFrame = null;
            }
        }
    }
    frameContextMenu.classList.remove('visible');
});

// Number entry context menu handlers
document.getElementById('rename-number-entry').addEventListener('click', () => {
    if (currentNumberEntryData) {
        const index = numberEntries.indexOf(currentNumberEntryData);
        const currentName = currentNumberEntryData.name || `Number Entry ${index + 1}`;
        const newName = prompt('Enter a name for this Number Box:', currentName);
        if (newName !== null && newName.trim() !== '') {
            currentNumberEntryData.name = newName.trim();
            updateElementTooltip(currentNumberEntryData.element, currentNumberEntryData.name, 'Number Entry');
        }
    }
    numberEntryContextMenu.classList.remove('visible');
});

document.getElementById('rename-label').addEventListener('click', () => {
    if (currentLabelData) {
        const index = labelElements.indexOf(currentLabelData);
        const currentName = currentLabelData.name || `Label ${index + 1}`;
        const newName = prompt('Enter a name for this Label:', currentName);
        if (newName !== null && newName.trim() !== '') {
            currentLabelData.name = newName.trim();
            updateElementTooltip(currentLabelData.element, currentLabelData.name, 'Label');
        }
    }
    labelContextMenu.classList.remove('visible');
});

document.getElementById('edit-number-entry').addEventListener('click', () => {
    if (currentNumberEntryData) {
        const newValue = prompt('Edit value:', currentNumberEntryData.value);
        if (newValue !== null) {
            const numVal = parseFloat(newValue) || 0;
            currentNumberEntryData.value = numVal;
            currentNumberEntryData.input.value = numVal;
        }
    }
    numberEntryContextMenu.classList.remove('visible');
});

document.getElementById('delete-number-entry').addEventListener('click', () => {
    if (currentNumberEntryData) {
        const index = numberEntries.indexOf(currentNumberEntryData);
        if (index !== -1) {
            numberEntries.splice(index, 1);
            if (currentNumberEntryData._ac) currentNumberEntryData._ac.abort();
            markUnsaved();
            currentNumberEntryData.element.remove();
            if (activeNumberEntry === currentNumberEntryData) {
                activeNumberEntry = null;
            }
        }
    }
    numberEntryContextMenu.classList.remove('visible');
});

// Number entry lock handler
document.getElementById('toggle-number-entry-lock').addEventListener('click', () => {
    if (currentNumberEntryData) {
        currentNumberEntryData.locked = !currentNumberEntryData.locked;
        if (currentNumberEntryData.locked) {
            currentNumberEntryData.element.classList.add('locked');
            currentNumberEntryData.element.classList.remove('active');
        } else {
            currentNumberEntryData.element.classList.remove('locked');
        }
    }
    numberEntryContextMenu.classList.remove('visible');
});

// Label context menu handlers
document.getElementById('edit-label').addEventListener('click', () => {
    if (currentLabelData) {
        const newText = prompt('Edit label text:', currentLabelData.text);
        if (newText !== null) {
            currentLabelData.text = newText;
            // Preserve any resize handles
            const handles = currentLabelData.element.querySelector('.resize-handles');
            currentLabelData.element.textContent = newText;
            if (handles) {
                currentLabelData.element.appendChild(handles);
            }
        }
    }
    labelContextMenu.classList.remove('visible');
});

document.getElementById('delete-label').addEventListener('click', () => {
    if (currentLabelData) {
        const index = labelElements.indexOf(currentLabelData);
        if (index !== -1) {
            labelElements.splice(index, 1);
            if (currentLabelData._ac) currentLabelData._ac.abort();
            markUnsaved();
            currentLabelData.element.remove();
            if (activeLabel === currentLabelData) {
                activeLabel = null;
            }
        }
    }
    labelContextMenu.classList.remove('visible');
});

// Label lock handler
document.getElementById('toggle-label-lock').addEventListener('click', () => {
    if (currentLabelData) {
        currentLabelData.locked = !currentLabelData.locked;
        if (currentLabelData.locked) {
            currentLabelData.element.classList.add('locked');
            currentLabelData.element.classList.remove('active');
        } else {
            currentLabelData.element.classList.remove('locked');
        }
    }
    labelContextMenu.classList.remove('visible');
});

// Copy handlers
document.getElementById('copy-text').addEventListener('click', () => {
    if (currentTextData) {
        clipboard = {
            type: 'text',
            data: {
                name: currentTextData.name,
                text: currentTextData.text,
                fontSize: currentTextData.fontSize,
                width: currentTextData.width || 200,
                height: currentTextData.height || 100
            }
        };
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('copy-frame').addEventListener('click', () => {
    if (currentFrameData) {
        clipboard = {
            type: 'frame',
            data: {
                title: currentFrameData.title,
                titleSize: currentFrameData.titleSize,
                titlePlacement: currentFrameData.titlePlacement,
                titleColor: currentFrameData.titleColor,
                borderThickness: currentFrameData.borderThickness,
                borderColor: currentFrameData.borderColor,
                bgColor: currentFrameData.bgColor,
                bgOpacity: currentFrameData.bgOpacity,
                width: currentFrameData.width,
                height: currentFrameData.height
            }
        };
    }
    frameContextMenu.classList.remove('visible');
});

document.getElementById('copy-number-entry').addEventListener('click', () => {
    if (currentNumberEntryData) {
        clipboard = {
            type: 'numberEntry',
            data: {
                name: currentNumberEntryData.name,
                value: currentNumberEntryData.value,
                min: currentNumberEntryData.min,
                max: currentNumberEntryData.max,
                fontSize: currentNumberEntryData.fontSize,
                textColor: currentNumberEntryData.textColor,
                bgColor: currentNumberEntryData.bgColor,
                bold: currentNumberEntryData.bold,
                italic: currentNumberEntryData.italic,
                width: currentNumberEntryData.width,
                height: currentNumberEntryData.height
            }
        };
    }
    numberEntryContextMenu.classList.remove('visible');
});

document.getElementById('copy-label').addEventListener('click', () => {
    if (currentLabelData) {
        clipboard = {
            type: 'label',
            data: {
                name: currentLabelData.name,
                text: currentLabelData.text,
                fontSize: currentLabelData.fontSize,
                color: currentLabelData.color,
                letterSpacing: currentLabelData.letterSpacing,
                bold: currentLabelData.bold,
                italic: currentLabelData.italic,
                underline: currentLabelData.underline
            }
        };
    }
    labelContextMenu.classList.remove('visible');
});

// Paste handler
document.getElementById('paste-element').addEventListener('click', () => {
    if (!clipboard) return;
    
    const x = lastContextMenuPosition.x;
    const y = lastContextMenuPosition.y;
    
    switch (clipboard.type) {
        case 'text':
            placeTextElement(x, y, clipboard.data.text, clipboard.data);
            break;
        case 'frame':
            placeFrameWithData(x, y, clipboard.data);
            break;
        case 'numberEntry':
            placeNumberEntry(x, y, clipboard.data);
            break;
        case 'label':
            placeLabelWithData(x, y, clipboard.data);
            break;
        case 'button':
            placeButtonWithData(x, y, clipboard.data);
            break;
        case 'listbox':
            placeListBoxWithData(x, y, clipboard.data);
            break;
        case 'checkbox':
            placeCheckbox(x, y, clipboard.data);
            break;
    }
    
    canvasContextMenu.classList.remove('visible');
});

// ============== BUTTON TOOL FUNCTIONS ==============
function placeButton(x, y) {
    const text = document.getElementById('button-text').value || 'Button';
    const fontSize = parseInt(document.getElementById('button-font-size').value) || 16;
    const textColor = document.getElementById('button-text-color').value || '#ffffff';
    const bgColor = document.getElementById('button-bg-color').value || '#4a90d9';
    const isBold = document.getElementById('button-bold').checked;
    const isItalic = document.getElementById('button-italic').checked;
    
    const buttonData = {
        id: nextButtonId++,
        text: text,
        fontSize: fontSize,
        textColor: textColor,
        bgColor: bgColor,
        bold: isBold,
        italic: isItalic,
        x: snapToGridValue(x),
        y: snapToGridValue(y),
        width: 120,
        height: 40,
        locked: false,
        tasks: []
    };
    
    createButtonElement(buttonData);
    buttonElements.push(buttonData);
    markUnsaved();
}

function placeButtonWithData(x, y, data) {
    const buttonData = {
        id: data.id || nextButtonId++,
        text: data.text || 'Button',
        fontSize: data.fontSize || 16,
        textColor: data.textColor || '#ffffff',
        bgColor: data.bgColor || '#4a90d9',
        bold: data.bold || false,
        italic: data.italic || false,
        x: snapToGridValue(x),
        y: snapToGridValue(y),
        width: data.width || 120,
        height: data.height || 40,
        locked: data.locked || false,
        tasks: data.tasks || []
    };
    
    createButtonElement(buttonData);
    buttonElements.push(buttonData);
    markUnsaved();
}

function createButtonElement(buttonData) {
    const buttonEl = document.createElement('div');
    buttonEl.className = 'action-button';
    buttonEl.style.left = buttonData.x + 'px';
    buttonEl.style.top = buttonData.y + 'px';
    buttonEl.style.width = buttonData.width + 'px';
    buttonEl.style.height = buttonData.height + 'px';
    buttonEl.style.fontSize = buttonData.fontSize + 'px';
    buttonEl.style.color = buttonData.textColor;
    buttonEl.style.backgroundColor = buttonData.bgColor;
    if (buttonData.bold) buttonEl.style.fontWeight = 'bold';
    if (buttonData.italic) buttonEl.style.fontStyle = 'italic';
    if (buttonData.locked) buttonEl.classList.add('locked');
    buttonEl.textContent = buttonData.text;
    
    // Add resize handles
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    buttonEl.appendChild(handles);
    
    document.body.appendChild(buttonEl);
    buttonData.element = buttonEl;
    
    // If loading, update nextButtonId
    if (buttonData.id >= nextButtonId) {
        nextButtonId = buttonData.id + 1;
    }
    
    makeButtonDraggable(buttonEl, buttonData);
    makeButtonResizable(buttonEl, buttonData);
    
    // Context menu
    buttonEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showButtonContextMenu(e, buttonData);
    });
    
    // Click: locked buttons execute tasks, unlocked buttons are selected for editing
    buttonEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (buttonData.locked) {
            executeButtonTasks(buttonData);
        } else {
            setActiveButton(buttonData);
        }
    });
}

function setActiveButton(buttonData) {
    if (activeButton) {
        activeButton.element.classList.remove('active');
    }
    activeButton = buttonData;
    if (!buttonData.locked) {
        buttonData.element.classList.add('active');
    }
}

function makeButtonDraggable(element, buttonData) {
    if (!buttonData._ac) buttonData._ac = new AbortController();
    const signal = buttonData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        if (buttonData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = buttonData.x;
        startTop = buttonData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        buttonData.x = snapToGridValue(startLeft + dx);
        buttonData.y = snapToGridValue(startTop + dy);
        
        element.style.left = buttonData.x + 'px';
        element.style.top = buttonData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeButtonResizable(element, buttonData) {
    const signal = buttonData._ac ? buttonData._ac.signal : undefined;
    const handles = element.querySelector('.resize-handles');
    if (!handles) return;
    
    Array.from(handles.children).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (buttonData.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            
            startWidth = buttonData.width;
            startHeight = buttonData.height;
            startLeft = buttonData.x;
            startTop = buttonData.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                const newWidth = Math.max(60, startWidth + dx);
                element.style.width = newWidth + 'px';
                buttonData.width = newWidth;
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(60, startWidth - dx);
                if (newWidth >= 60) {
                    buttonData.x = startLeft + (startWidth - newWidth);
                    element.style.left = buttonData.x + 'px';
                    element.style.width = newWidth + 'px';
                    buttonData.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                const newHeight = Math.max(24, startHeight + dy);
                element.style.height = newHeight + 'px';
                buttonData.height = newHeight;
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(24, startHeight - dy);
                if (newHeight >= 24) {
                    buttonData.y = startTop + (startHeight - newHeight);
                    element.style.top = buttonData.y + 'px';
                    element.style.height = newHeight + 'px';
                    buttonData.height = newHeight;
                }
            }
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

function showButtonContextMenu(e, buttonData) {
    currentButtonData = buttonData;
    
    // Update lock menu item text
    document.getElementById('toggle-button-lock').textContent = buttonData.locked ? 'Unlock' : 'Lock';
    
    positionContextMenu(buttonContextMenu, e.clientX, e.clientY);
}

// Button context menu handlers
document.getElementById('edit-button-text').addEventListener('click', () => {
    if (currentButtonData) {
        const newText = prompt('Enter button text:', currentButtonData.text);
        if (newText !== null && newText.trim() !== '') {
            currentButtonData.text = newText;
            // Keep resize handles when updating text
            const handles = currentButtonData.element.querySelector('.resize-handles');
            currentButtonData.element.textContent = newText;
            if (handles) currentButtonData.element.appendChild(handles);
        }
    }
    buttonContextMenu.classList.remove('visible');
});

document.getElementById('edit-button-actions').addEventListener('click', () => {
    if (currentButtonData) {
        showTaskEditor(currentButtonData);
    }
    buttonContextMenu.classList.remove('visible');
});

document.getElementById('toggle-button-lock').addEventListener('click', () => {
    if (currentButtonData) {
        currentButtonData.locked = !currentButtonData.locked;
        if (currentButtonData.locked) {
            currentButtonData.element.classList.add('locked');
            currentButtonData.element.classList.remove('active');
        } else {
            currentButtonData.element.classList.remove('locked');
        }
    }
    buttonContextMenu.classList.remove('visible');
});

document.getElementById('copy-button').addEventListener('click', () => {
    if (currentButtonData) {
        clipboard = {
            type: 'button',
            data: {
                text: currentButtonData.text,
                fontSize: currentButtonData.fontSize,
                textColor: currentButtonData.textColor,
                bgColor: currentButtonData.bgColor,
                bold: currentButtonData.bold,
                italic: currentButtonData.italic,
                width: currentButtonData.width,
                height: currentButtonData.height,
                tasks: JSON.parse(JSON.stringify(currentButtonData.tasks))
            }
        };
    }
    buttonContextMenu.classList.remove('visible');
});

document.getElementById('delete-button').addEventListener('click', () => {
    if (currentButtonData) {
        const index = buttonElements.indexOf(currentButtonData);
        if (index !== -1) {
            buttonElements.splice(index, 1);
            if (currentButtonData._ac) currentButtonData._ac.abort();
            markUnsaved();
            currentButtonData.element.remove();
            if (activeButton === currentButtonData) {
                activeButton = null;
            }
        }
    }
    buttonContextMenu.classList.remove('visible');
});

// ============== LIST BOX TOOL FUNCTIONS ==============
function placeListBox(x, y) {
    const title = document.getElementById('listbox-title').value || 'Items';
    const titleSize = parseInt(document.getElementById('listbox-title-size').value) || 16;
    const titleColor = document.getElementById('listbox-title-color').value || '#1f2937';
    const fontSize = parseInt(document.getElementById('listbox-font-size').value) || 14;
    const textColor = document.getElementById('listbox-text-color').value || '#374151';
    const bgColor = document.getElementById('listbox-bg-color').value || '#ffffff';
    const buttonColor = document.getElementById('listbox-button-color').value || '#6366f1';
    const borderSize = parseInt(document.getElementById('listbox-border-size').value) || 1;
    const borderColor = document.getElementById('listbox-border-color').value || '#d1d5db';
    const isBold = document.getElementById('listbox-bold').checked;
    const isItalic = document.getElementById('listbox-italic').checked;
    
    const listBoxData = {
        id: nextListBoxId++,
        title: title,
        titleSize: titleSize,
        titleColor: titleColor,
        fontSize: fontSize,
        textColor: textColor,
        bgColor: bgColor,
        buttonColor: buttonColor,
        borderSize: borderSize,
        borderColor: borderColor,
        bold: isBold,
        italic: isItalic,
        x: snapToGridValue(x),
        y: snapToGridValue(y),
        width: 220,
        height: 250,
        locked: false,
        items: []
    };
    
    createListBoxElement(listBoxData);
    listBoxElements.push(listBoxData);
    markUnsaved();
}

function placeListBoxWithData(x, y, data) {
    const listBoxData = {
        id: data.id || nextListBoxId++,
        title: data.title || 'Items',
        titleSize: data.titleSize || 16,
        titleColor: data.titleColor || '#1f2937',
        fontSize: data.fontSize || 14,
        textColor: data.textColor || '#374151',
        bgColor: data.bgColor || '#ffffff',
        buttonColor: data.buttonColor || '#6366f1',
        borderSize: data.borderSize || 1,
        borderColor: data.borderColor || '#d1d5db',
        bold: data.bold || false,
        italic: data.italic || false,
        x: snapToGridValue(x),
        y: snapToGridValue(y),
        width: data.width || 220,
        height: data.height || 250,
        locked: data.locked || false,
        items: JSON.parse(JSON.stringify(data.items || []))
    };
    
    createListBoxElement(listBoxData);
    listBoxElements.push(listBoxData);
    markUnsaved();
}

function createListBoxElement(listBoxData) {
    const container = document.createElement('div');
    container.className = 'list-box-widget';
    container.style.left = listBoxData.x + 'px';
    container.style.top = listBoxData.y + 'px';
    container.style.width = listBoxData.width + 'px';
    container.style.height = listBoxData.height + 'px';
    container.style.backgroundColor = listBoxData.bgColor;
    container.style.border = `${listBoxData.borderSize}px solid ${listBoxData.borderColor}`;
    if (listBoxData.locked) container.classList.add('locked');
    
    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'list-box-title';
    titleEl.textContent = listBoxData.title;
    titleEl.style.fontSize = listBoxData.titleSize + 'px';
    titleEl.style.color = listBoxData.titleColor;
    titleEl.style.backgroundColor = listBoxData.bgColor;
    container.appendChild(titleEl);
    
    // Input row
    const inputRow = document.createElement('div');
    inputRow.className = 'list-box-input-row';
    inputRow.style.backgroundColor = listBoxData.bgColor;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add item...';
    input.style.fontSize = listBoxData.fontSize + 'px';
    input.style.color = listBoxData.textColor;
    if (listBoxData.bold) input.style.fontWeight = 'bold';
    if (listBoxData.italic) input.style.fontStyle = 'italic';
    inputRow.appendChild(input);
    
    const addBtn = document.createElement('button');
    addBtn.className = 'list-box-add-btn';
    addBtn.textContent = '+';
    addBtn.style.backgroundColor = listBoxData.buttonColor;
    inputRow.appendChild(addBtn);
    
    container.appendChild(inputRow);
    
    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'list-box-items';
    itemsContainer.style.backgroundColor = listBoxData.bgColor;
    container.appendChild(itemsContainer);
    
    // Add resize handles
    const handles = document.createElement('div');
    handles.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handles.appendChild(handle);
    });
    container.appendChild(handles);
    
    document.body.appendChild(container);
    
    listBoxData.element = container;
    listBoxData.titleEl = titleEl;
    listBoxData.itemsContainer = itemsContainer;
    listBoxData.input = input;
    
    // If loading, update nextListBoxId
    if (listBoxData.id >= nextListBoxId) {
        nextListBoxId = listBoxData.id + 1;
    }
    
    // Render existing items
    renderListBoxItems(listBoxData);
    
    // Event: Add item
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = input.value.trim();
        if (text) {
            const duplicate = listBoxData.items.some(it => it.name.toLowerCase() === text.toLowerCase());
            if (duplicate) {
                input.style.outline = '2px solid #ef4444';
                input.setAttribute('placeholder', 'Item on list already');
                input.value = '';
                setTimeout(() => { input.style.outline = ''; input.setAttribute('placeholder', ''); }, 2000);
                return;
            }
            listBoxData.items.push({ name: text, count: 1 });
            input.value = '';
            renderListBoxItems(listBoxData);
        }
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const text = input.value.trim();
            if (text) {
                const duplicate = listBoxData.items.some(it => it.name.toLowerCase() === text.toLowerCase());
                if (duplicate) {
                    input.style.outline = '2px solid #ef4444';
                    input.setAttribute('placeholder', 'Item on list already');
                    input.value = '';
                    setTimeout(() => { input.style.outline = ''; input.setAttribute('placeholder', ''); }, 2000);
                    return;
                }
                listBoxData.items.push({ name: text, count: 1 });
                input.value = '';
                renderListBoxItems(listBoxData);
            }
        }
    });
    
    // Stop propagation on input
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    addBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    
    makeListBoxDraggable(container, listBoxData);
    makeListBoxResizable(container, listBoxData);
    
    // Context menu for the widget
    container.addEventListener('contextmenu', (e) => {
        if (e.target.classList.contains('list-box-item') || e.target.closest('.list-box-item')) {
            return; // Let item context menu handle it
        }
        e.preventDefault();
        e.stopPropagation();
        showListBoxContextMenu(e, listBoxData);
    });
    
    container.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveListBox(listBoxData);
    });
}

function renderListBoxItems(listBoxData) {
    const container = listBoxData.itemsContainer;
    container.innerHTML = '';
    
    listBoxData.items.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'list-box-item';
        itemEl.style.fontSize = listBoxData.fontSize + 'px';
        itemEl.style.color = listBoxData.textColor;
        if (listBoxData.bold) itemEl.style.fontWeight = 'bold';
        if (listBoxData.italic) itemEl.style.fontStyle = 'italic';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'list-box-item-name';
        nameSpan.textContent = item.name;
        itemEl.appendChild(nameSpan);
        
        if (item.count > 1) {
            const countSpan = document.createElement('span');
            countSpan.className = 'list-box-item-count';
            countSpan.textContent = '+' + (item.count - 1);
            itemEl.appendChild(countSpan);
        }
        
        // Right-click context menu
        itemEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentListBoxData = listBoxData;
            currentListBoxItemData = { item: item, index: index };
            showListBoxItemContextMenu(e);
        });
        
        itemEl.addEventListener('mousedown', (e) => e.stopPropagation());
        
        container.appendChild(itemEl);
    });
}

function setActiveListBox(listBoxData) {
    if (activeListBox) {
        activeListBox.element.classList.remove('active');
    }
    activeListBox = listBoxData;
    if (!listBoxData.locked) {
        listBoxData.element.classList.add('active');
    }
}

function makeListBoxDraggable(element, listBoxData) {
    if (!listBoxData._ac) listBoxData._ac = new AbortController();
    const signal = listBoxData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        if (e.target.classList.contains('list-box-item') || e.target.closest('.list-box-item')) return;
        if (e.button !== 0) return;
        if (listBoxData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = listBoxData.x;
        startTop = listBoxData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        listBoxData.x = snapToGridValue(startLeft + dx);
        listBoxData.y = snapToGridValue(startTop + dy);
        
        element.style.left = listBoxData.x + 'px';
        element.style.top = listBoxData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function makeListBoxResizable(element, listBoxData) {
    const signal = listBoxData._ac ? listBoxData._ac.signal : undefined;
    const handles = element.querySelector('.resize-handles');
    if (!handles) return;
    
    Array.from(handles.children).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (listBoxData.locked) return;
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            
            startWidth = listBoxData.width;
            startHeight = listBoxData.height;
            startLeft = listBoxData.x;
            startTop = listBoxData.y;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (direction.includes('e')) {
                const newWidth = Math.max(150, startWidth + dx);
                element.style.width = newWidth + 'px';
                listBoxData.width = newWidth;
            }
            if (direction.includes('w')) {
                const newWidth = Math.max(150, startWidth - dx);
                if (newWidth >= 150) {
                    listBoxData.x = startLeft + (startWidth - newWidth);
                    element.style.left = listBoxData.x + 'px';
                    element.style.width = newWidth + 'px';
                    listBoxData.width = newWidth;
                }
            }
            if (direction.includes('s')) {
                const newHeight = Math.max(120, startHeight + dy);
                element.style.height = newHeight + 'px';
                listBoxData.height = newHeight;
            }
            if (direction.includes('n')) {
                const newHeight = Math.max(120, startHeight - dy);
                if (newHeight >= 120) {
                    listBoxData.y = startTop + (startHeight - newHeight);
                    element.style.top = listBoxData.y + 'px';
                    element.style.height = newHeight + 'px';
                    listBoxData.height = newHeight;
                }
            }
        }, { signal });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        }, { signal });
    });
}

function showListBoxContextMenu(e, listBoxData) {
    currentListBoxData = listBoxData;
    
    document.getElementById('toggle-listbox-lock').textContent = listBoxData.locked ? 'Unlock' : 'Lock';
    
    positionContextMenu(listboxContextMenu, e.clientX, e.clientY);
}

function showListBoxItemContextMenu(e) {
    positionContextMenu(listboxItemContextMenu, e.clientX, e.clientY);
}

// List box context menu handlers
document.getElementById('edit-listbox-title').addEventListener('click', () => {
    if (currentListBoxData) {
        const newTitle = prompt('Enter list box title:', currentListBoxData.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            currentListBoxData.title = newTitle.trim();
            currentListBoxData.titleEl.textContent = newTitle.trim();
        }
    }
    listboxContextMenu.classList.remove('visible');
});

document.getElementById('toggle-listbox-lock').addEventListener('click', () => {
    if (currentListBoxData) {
        currentListBoxData.locked = !currentListBoxData.locked;
        if (currentListBoxData.locked) {
            currentListBoxData.element.classList.add('locked');
            currentListBoxData.element.classList.remove('active');
        } else {
            currentListBoxData.element.classList.remove('locked');
        }
    }
    listboxContextMenu.classList.remove('visible');
});

document.getElementById('copy-listbox').addEventListener('click', () => {
    if (currentListBoxData) {
        clipboard = {
            type: 'listbox',
            data: {
                title: currentListBoxData.title,
                titleSize: currentListBoxData.titleSize,
                titleColor: currentListBoxData.titleColor,
                fontSize: currentListBoxData.fontSize,
                textColor: currentListBoxData.textColor,
                bgColor: currentListBoxData.bgColor,
                buttonColor: currentListBoxData.buttonColor,
                borderSize: currentListBoxData.borderSize,
                borderColor: currentListBoxData.borderColor,
                bold: currentListBoxData.bold,
                italic: currentListBoxData.italic,
                width: currentListBoxData.width,
                height: currentListBoxData.height,
                items: JSON.parse(JSON.stringify(currentListBoxData.items))
            }
        };
    }
    listboxContextMenu.classList.remove('visible');
});

document.getElementById('delete-listbox').addEventListener('click', () => {
    if (currentListBoxData) {
        const index = listBoxElements.indexOf(currentListBoxData);
        if (index !== -1) {
            listBoxElements.splice(index, 1);
            if (currentListBoxData._ac) currentListBoxData._ac.abort();
            markUnsaved();
            currentListBoxData.element.remove();
            if (activeListBox === currentListBoxData) {
                activeListBox = null;
            }
        }
    }
    listboxContextMenu.classList.remove('visible');
});

// List box item context menu handlers
document.getElementById('listbox-item-add').addEventListener('click', () => {
    if (currentListBoxItemData && currentListBoxData) {
        currentListBoxItemData.item.count++;
        renderListBoxItems(currentListBoxData);
    }
    listboxItemContextMenu.classList.remove('visible');
});

document.getElementById('listbox-item-remove').addEventListener('click', () => {
    if (currentListBoxItemData && currentListBoxData) {
        if (currentListBoxItemData.item.count > 1) {
            currentListBoxItemData.item.count--;
            renderListBoxItems(currentListBoxData);
        }
    }
    listboxItemContextMenu.classList.remove('visible');
});

document.getElementById('listbox-item-delete').addEventListener('click', () => {
    if (currentListBoxItemData && currentListBoxData) {
        currentListBoxData.items.splice(currentListBoxItemData.index, 1);
        renderListBoxItems(currentListBoxData);
    }
    listboxItemContextMenu.classList.remove('visible');
});

document.getElementById('listbox-item-set').addEventListener('click', () => {
    if (currentListBoxItemData && currentListBoxData) {
        const newAmount = prompt('Set amount for "' + currentListBoxItemData.item.name + '":', currentListBoxItemData.item.count);
        if (newAmount !== null) {
            const parsed = parseInt(newAmount);
            if (!isNaN(parsed) && parsed >= 1) {
                currentListBoxItemData.item.count = parsed;
                renderListBoxItems(currentListBoxData);
            }
        }
    }
    listboxItemContextMenu.classList.remove('visible');
});

// ============== CHECKBOX TOOL FUNCTIONS ==============
let currentCheckboxData = null;

function placeCheckbox(x, y, overrideData = null) {
    x = snapToGridValue(x);
    y = snapToGridValue(y);
    const labelText = overrideData?.label ?? (document.getElementById('checkbox-label-text').value || 'Option');
    const fontSize = overrideData?.fontSize ?? (parseInt(document.getElementById('checkbox-font-size').value) || 14);
    const textColor = overrideData?.textColor ?? (document.getElementById('checkbox-text-color').value || '#1f2937');
    const boxSize = overrideData?.boxSize ?? (parseInt(document.getElementById('checkbox-box-size').value) || 18);
    const checkColor = overrideData?.checkColor ?? (document.getElementById('checkbox-check-color').value || '#6366f1');
    const checked = overrideData?.checked ?? document.getElementById('checkbox-default-checked').checked;
    
    const el = document.createElement('div');
    el.className = 'checkbox-element';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    
    const box = document.createElement('div');
    box.className = 'cb-box' + (checked ? ' checked' : '');
    box.style.width = boxSize + 'px';
    box.style.height = boxSize + 'px';
    box.style.color = checkColor;
    
    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    checkmark.textContent = 'âœ“';
    checkmark.style.fontSize = (boxSize - 4) + 'px';
    checkmark.style.color = checkColor;
    box.appendChild(checkmark);
    
    const label = document.createElement('span');
    label.className = 'cb-label';
    label.textContent = labelText;
    label.style.fontSize = fontSize + 'px';
    label.style.color = textColor;
    
    el.appendChild(box);
    el.appendChild(label);
    document.body.appendChild(el);
    
    const cbData = {
        element: el,
        boxEl: box,
        labelEl: label,
        name: overrideData?.name || null,
        label: labelText,
        checked: checked,
        fontSize: fontSize,
        textColor: textColor,
        boxSize: boxSize,
        checkColor: checkColor,
        x: x,
        y: y,
        locked: overrideData?.locked || false
    };
    
    checkboxElements.push(cbData);
    markUnsaved();
    
    // Toggle checked on box click
    box.addEventListener('click', (e) => {
        e.stopPropagation();
        cbData.checked = !cbData.checked;
        if (cbData.checked) {
            box.classList.add('checked');
        } else {
            box.classList.remove('checked');
        }
        markUnsaved();
    });
    
    makeCheckboxDraggable(el, cbData);
    
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showCheckboxContextMenu(e, cbData);
    });
    
    if (overrideData?.locked) {
        el.classList.add('locked');
    }
    
    return cbData;
}

function makeCheckboxDraggable(element, cbData) {
    if (!cbData._ac) cbData._ac = new AbortController();
    const signal = cbData._ac.signal;
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('cb-box') || e.target.classList.contains('checkmark')) return;
        if (e.button !== 0) return;
        if (cbData.locked) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = cbData.x;
        startTop = cbData.y;
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        cbData.x = snapToGridValue(startLeft + (e.clientX - startX));
        cbData.y = snapToGridValue(startTop + (e.clientY - startY));
        element.style.left = cbData.x + 'px';
        element.style.top = cbData.y + 'px';
    }, { signal });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    }, { signal });
}

function showCheckboxContextMenu(e, cbData) {
    currentCheckboxData = cbData;
    document.getElementById('toggle-checkbox-lock').textContent = cbData.locked ? 'Unlock' : 'Lock';
    positionContextMenu(checkboxContextMenu, e.clientX, e.clientY);
}

document.getElementById('rename-checkbox').addEventListener('click', () => {
    if (currentCheckboxData) {
        const idx = checkboxElements.indexOf(currentCheckboxData);
        const currentName = currentCheckboxData.name || `Checkbox ${idx + 1}`;
        const newName = prompt('Enter a name for this Checkbox:', currentName);
        if (newName !== null && newName.trim() !== '') {
            currentCheckboxData.name = newName.trim();
            updateElementTooltip(currentCheckboxData.element, currentCheckboxData.name, 'Checkbox');
            markUnsaved();
        }
    }
    checkboxContextMenu.classList.remove('visible');
});

document.getElementById('edit-checkbox-label').addEventListener('click', () => {
    if (currentCheckboxData) {
        const newLabel = prompt('Edit label:', currentCheckboxData.label);
        if (newLabel !== null && newLabel.trim() !== '') {
            currentCheckboxData.label = newLabel.trim();
            currentCheckboxData.labelEl.textContent = newLabel.trim();
            markUnsaved();
        }
    }
    checkboxContextMenu.classList.remove('visible');
});

document.getElementById('toggle-checkbox-lock').addEventListener('click', () => {
    if (currentCheckboxData) {
        currentCheckboxData.locked = !currentCheckboxData.locked;
        if (currentCheckboxData.locked) {
            currentCheckboxData.element.classList.add('locked');
        } else {
            currentCheckboxData.element.classList.remove('locked');
        }
    }
    checkboxContextMenu.classList.remove('visible');
});

document.getElementById('copy-checkbox').addEventListener('click', () => {
    if (currentCheckboxData) {
        clipboard = {
            type: 'checkbox',
            data: {
                label: currentCheckboxData.label,
                fontSize: currentCheckboxData.fontSize,
                textColor: currentCheckboxData.textColor,
                boxSize: currentCheckboxData.boxSize,
                checkColor: currentCheckboxData.checkColor,
                checked: currentCheckboxData.checked
            }
        };
    }
    checkboxContextMenu.classList.remove('visible');
});

document.getElementById('delete-checkbox').addEventListener('click', () => {
    if (currentCheckboxData) {
        const index = checkboxElements.indexOf(currentCheckboxData);
        if (index !== -1) {
            checkboxElements.splice(index, 1);
            if (currentCheckboxData._ac) currentCheckboxData._ac.abort();
            markUnsaved();
            currentCheckboxData.element.remove();
            if (activeCheckbox === currentCheckboxData) {
                activeCheckbox = null;
            }
        }
    }
    checkboxContextMenu.classList.remove('visible');
});

// ============== TASK EDITOR ==============
let currentEditingButton = null;
let tempTasks = [];

function showTaskEditor(buttonData) {
    currentEditingButton = buttonData;
    tempTasks = JSON.parse(JSON.stringify(buttonData.tasks || []));
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'task-editor-overlay';
    overlay.id = 'task-editor-overlay';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'task-editor-modal';
    
    // Header
    const header = document.createElement('div');
    header.className = 'task-editor-header';
    header.innerHTML = `<h3>Edit Button Actions: ${buttonData.text}</h3>`;
    modal.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.className = 'task-editor-content';
    
    // Left side - palette
    const palette = document.createElement('div');
    palette.className = 'task-palette';
    palette.innerHTML = `
        <h4>Available Actions</h4>
        <div class="palette-category">
            <div class="palette-category-header" data-category="basic">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Basic Actions</div>
            <div class="palette-category-items" id="palette-basic" style="display:none;">
                <div class="task-block-template" data-type="run-rng" draggable="true" title="Roll the dice using the RNG element to generate a random number">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â²</span> Run RNG
                </div>
                <div class="task-block-template" data-type="add" draggable="true" title="Add a value to a Number Entry box">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬Â¢</span> Add to Number
                </div>
                <div class="task-block-template" data-type="subtract" draggable="true" title="Subtract a value from a Number Entry box">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬â€œ</span> Subtract from Number
                </div>
                <div class="task-block-template" data-type="set" draggable="true" title="Set a Number Entry box to a specific value">
                    <span class="task-icon">ÃƒÂ¢Ã…â€œÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â</span> Set Number
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="variables">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Variables</div>
            <div class="palette-category-items" id="palette-variables" style="display:none;">
                <div class="task-block-template" data-type="create-var" draggable="true" title="Create a new variable to store values during execution">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦</span> Create Variable
                </div>
                <div class="task-block-template" data-type="set-var" draggable="true" title="Set a variable to a specific value, number entry, or another variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â</span> Set Variable
                </div>
                <div class="task-block-template" data-type="add-var" draggable="true" title="Add a value to an existing variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‹â€ </span> Add to Variable
                </div>
                <div class="task-block-template" data-type="subtract-var" draggable="true" title="Subtract a value from an existing variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â°</span> Subtract from Variable
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="compare">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Compare (IF)</div>
            <div class="palette-category-items" id="palette-compare" style="display:none;">
                <div class="task-block-template" data-type="if" draggable="true" title="Start a conditional block that only runs if the condition is true">
                    <span class="task-icon">ÃƒÂ¢Ã‚ÂÃ¢â‚¬Å“</span> IF
                </div>
                <div class="task-block-template" data-type="elseif" draggable="true" title="Check an alternate condition if the previous IF was false">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â€šÂ¬</span> ELSE IF
                </div>
                <div class="task-block-template" data-type="else" draggable="true" title="Runs if all previous IF and ELSE IF conditions were false">
                    <span class="task-icon">ÃƒÂ¢Ã¢â‚¬Â Ã‚Â©ÃƒÂ¯Ã‚Â¸Ã‚Â</span> ELSE
                </div>
                <div class="task-block-template" data-type="endif" draggable="true" title="Marks the end of an IF / ELSE IF / ELSE block">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â¡</span> END IF
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="loop">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Loop</div>
            <div class="palette-category-items" id="palette-loop" style="display:none;">
                <div class="task-block-template" data-type="loop" draggable="true" title="Repeat a set of tasks a specified number of times">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â</span> Loop
                </div>
                <div class="task-block-template" data-type="loop-exit" draggable="true" title="Exit the current loop early, skipping any remaining iterations">
                    <span class="task-icon">ÃƒÂ¢Ã‚ÂÃ‚Â©</span> Loop Exit
                </div>
                <div class="task-block-template" data-type="loop-end" draggable="true" title="Marks the end of a loop block">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â¡</span> Loop End
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="functions">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Functions</div>
            <div class="palette-category-items" id="palette-functions" style="display:none;">
                <div class="task-block-template" data-type="func-min" draggable="true" title="Returns the lower value of the entries">
                    <span class="task-icon">ÃƒÂ¢Ã‚Â¬Ã¢â‚¬Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Min
                </div>
                <div class="task-block-template" data-type="func-max" draggable="true" title="Returns the higher value of the entries">
                    <span class="task-icon">ÃƒÂ¢Ã‚Â¬Ã¢â‚¬Â ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Max
                </div>
                <div class="task-block-template" data-type="func-rand" draggable="true" title="Generate a random number between two values and store it in a variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¢</span> Rand
                </div>
                <div class="task-block-template" data-type="func-print" draggable="true" title="Display a message in a popup alert dialog">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¨ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Print
                </div>
                <div class="task-block-template" data-type="func-math" draggable="true" title="Perform arithmetic (add, subtract, multiply, divide) on two values and store the result">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â®</span> Math
                </div>
                <div class="task-block-template" data-type="func-sum" draggable="true" title="Add up to 6 values together and store the total in a variable">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬Â¢</span> Sum
                </div>
                <div class="task-block-template" data-type="func-concat" draggable="true" title="Join up to 6 text or number values together into a single string">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€</span> Concat
                </div>
                <div class="task-block-template" data-type="func-round" draggable="true" title="Round a variable's value up, down, or to the nearest whole number">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾</span> Round
                </div>
                <div class="task-block-template" data-type="func-tolower" draggable="true" title="Convert a variable's text to all lowercase letters">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¡</span> ToLower
                </div>
                <div class="task-block-template" data-type="func-toupper" draggable="true" title="Convert a variable's text to all uppercase letters">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â </span> ToUpper
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="itemlists">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Item Lists</div>
            <div class="palette-category-items" id="palette-itemlists" style="display:none;">
                <div class="task-block-template" data-type="list-add-item" draggable="true" title="Add a new item to an Item List with a starting amount">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹</span> Add Item to List
                </div>
                <div class="task-block-template" data-type="list-add-amount" draggable="true" title="Increase the count of an existing item in an Item List">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‹â€ </span> Add Amount to Item
                </div>
                <div class="task-block-template" data-type="list-remove-amount" draggable="true" title="Decrease the count of an existing item in an Item List">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â°</span> Remove Amount from Item
                </div>
                <div class="task-block-template" data-type="list-remove-item" draggable="true" title="Remove an item entirely from an Item List">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â</span> Remove Item from List
                </div>
                <div class="task-block-template" data-type="func-checklist" draggable="true" title="Check if an item exists in an Item List and store true or false in a variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â</span> Check for Item in List
                </div>
                <div class="task-block-template" data-type="list-get-amount" draggable="true" title="Get the count of an item in an Item List and store it in a variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¢</span> Get Item Amount
                </div>
            </div>
        </div>
        <div class="palette-category">
            <div class="palette-category-header" data-category="textfields">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Textfields</div>
            <div class="palette-category-items" id="palette-textfields" style="display:none;">
                <div class="task-block-template" data-type="textfield-read" draggable="true" title="Read the text from a Textbox or Label into a variable">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬â€œ</span> Read
                </div>
                <div class="task-block-template" data-type="textfield-write" draggable="true" title="Write text or a variable's value to a Textbox or Label">
                    <span class="task-icon">ÃƒÂ¢Ã…â€œÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â</span> Write
                </div>
            </div>
        </div>
    `;
    content.appendChild(palette);
    
    // Setup palette category toggles
    setTimeout(() => {
        palette.querySelectorAll('.palette-category-header').forEach(header => {
            header.addEventListener('click', () => {
                const cat = header.dataset.category;
                const items = document.getElementById('palette-' + cat);
                if (items) {
                    const isOpen = items.style.display !== 'none';
                    items.style.display = isOpen ? 'none' : 'block';
                    header.textContent = (isOpen ? 'ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ ' : 'ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¼ ') + header.textContent.substring(2);
                }
            });
        });
    }, 0);
    
    // Right side - sequence
    const sequenceContainer = document.createElement('div');
    sequenceContainer.className = 'task-sequence-container';
    sequenceContainer.innerHTML = `
        <h4>Action Sequence (runs top to bottom)</h4>
        <div class="task-sequence" id="task-sequence"></div>
    `;
    content.appendChild(sequenceContainer);
    
    modal.appendChild(content);
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'task-editor-footer';
    footer.innerHTML = `
        <button class="btn-cancel" id="task-editor-cancel">Cancel</button>
        <button class="btn-save" id="task-editor-save">Save Actions</button>
    `;
    modal.appendChild(footer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Render existing tasks
    renderTaskSequence();
    
    // Setup drag and drop
    setupTaskDragDrop();
    
    // Setup buttons
    document.getElementById('task-editor-cancel').addEventListener('click', () => {
        closeTaskEditor();
    });
    
    document.getElementById('task-editor-save').addEventListener('click', () => {
        currentEditingButton.tasks = tempTasks;
        closeTaskEditor();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeTaskEditor();
        }
    });
}

function closeTaskEditor() {
    const overlay = document.getElementById('task-editor-overlay');
    if (overlay) {
        overlay.remove();
    }
    currentEditingButton = null;
    tempTasks = [];
}

function renderTaskSequence() {
    const sequence = document.getElementById('task-sequence');
    if (!sequence) return;
    
    sequence.innerHTML = '';
    
    if (tempTasks.length === 0) {
        sequence.innerHTML = '<div class="task-empty">Drag actions here to build the sequence</div>';
        return;
    }
    
    tempTasks.forEach((task, index) => {
        const block = createTaskBlock(task, index);
        sequence.appendChild(block);
    });
    
    // Setup drag-to-reorder on the rendered blocks
    setupTaskReorderDrag();
}

function setupTaskReorderDrag() {
    const sequence = document.getElementById('task-sequence');
    if (!sequence) return;
    
    const blocks = sequence.querySelectorAll('.task-block');
    
    blocks.forEach(block => {
        // Dragstart: store the source index
        block.addEventListener('dragstart', (e) => {
            // Only initiate drag from the header area (not from inputs/selects)
            const target = e.target;
            if (target !== block) return;
            
            e.dataTransfer.setData('isNew', 'false');
            e.dataTransfer.setData('sourceIndex', block.dataset.index);
            e.dataTransfer.effectAllowed = 'move';
            block.classList.add('task-dragging');
            
            // Slight delay so the browser renders the drag image before we dim it
            setTimeout(() => {
                block.style.opacity = '0.4';
            }, 0);
        });
        
        block.addEventListener('dragend', (e) => {
            block.classList.remove('task-dragging');
            block.style.opacity = '';
            // Remove all drop indicators
            clearDropIndicators();
        });
        
        // Dragover on each block: determine if drop should go above or below
        block.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = block.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            // Clear existing indicators
            clearDropIndicators();
            
            if (e.clientY < midY) {
                block.classList.add('task-drop-above');
            } else {
                block.classList.add('task-drop-below');
            }
        });
        
        block.addEventListener('dragleave', (e) => {
            block.classList.remove('task-drop-above');
            block.classList.remove('task-drop-below');
        });
        
        // Drop on a block: reorder or insert new
        block.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearDropIndicators();
            
            const isNew = e.dataTransfer.getData('isNew');
            const targetIndex = parseInt(block.dataset.index);
            
            const rect = block.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertAfter = e.clientY >= midY;
            let insertAt = insertAfter ? targetIndex + 1 : targetIndex;
            
            if (isNew === 'true') {
                // New palette item dropped onto a specific block position
                const type = e.dataTransfer.getData('taskType');
                const newTask = createNewTaskFromType(type);
                if (newTask) {
                    tempTasks.splice(insertAt, 0, newTask);
                    renderTaskSequence();
                }
                return;
            }
            
            const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'));
            if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
            
            // Remove the task from its old position
            const [movedTask] = tempTasks.splice(sourceIndex, 1);
            
            // Adjust insert position if the source was before the target
            if (sourceIndex < insertAt) {
                insertAt--;
            }
            
            // Insert at the new position
            tempTasks.splice(insertAt, 0, movedTask);
            renderTaskSequence();
        });
    });
}

function clearDropIndicators() {
    const sequence = document.getElementById('task-sequence');
    if (!sequence) return;
    sequence.querySelectorAll('.task-drop-above, .task-drop-below').forEach(el => {
        el.classList.remove('task-drop-above');
        el.classList.remove('task-drop-below');
    });
}

function createTaskBlock(task, index) {
    const block = document.createElement('div');
    block.className = 'task-block ' + task.type;
    block.dataset.index = index;
    block.draggable = true;
    
    // Apply indentation for tasks inside IF blocks
    const indentLevel = getTaskIndentLevel(index);
    if (indentLevel > 0) {
        block.style.marginLeft = (indentLevel * 24) + 'px';
        block.style.borderLeft = '3px solid #f59e0b';
    }
    
    let blockContent = '';
    
    switch (task.type) {
        case 'run-rng':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â²</span> Run RNG
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <select class="task-rng-select" data-index="${index}">
                        <option value="">Select RNG...</option>
                        ${rngList.map((rng, i) => `<option value="${i}" ${task.rngIndex === i ? 'selected' : ''}>${rng.name || 'RNG ' + (i+1)}</option>`).join('')}
                    </select>
                    <label><input type="checkbox" class="task-store-result" data-index="${index}" ${task.storeResult ? 'checked' : ''}> Store result</label>
                </div>
            `;
            break;
        case 'add':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬Â¢</span> Add to Number
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Target:</label>
                    <select class="task-target-select" data-index="${index}">
                        <option value="">Select Number Entry...</option>
                        ${numberEntries.map((ne, i) => `<option value="${i}" ${task.targetIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)} (${ne.value})</option>`).join('')}
                    </select>
                    <label>Add:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'subtract':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬â€œ</span> Subtract from Number
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Target:</label>
                    <select class="task-target-select" data-index="${index}">
                        <option value="">Select Number Entry...</option>
                        ${numberEntries.map((ne, i) => `<option value="${i}" ${task.targetIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)} (${ne.value})</option>`).join('')}
                    </select>
                    <label>Subtract:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'set':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã…â€œÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â</span> Set Number
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Target:</label>
                    <select class="task-target-select" data-index="${index}">
                        <option value="">Select Number Entry...</option>
                        ${numberEntries.map((ne, i) => `<option value="${i}" ${task.targetIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)} (${ne.value})</option>`).join('')}
                    </select>
                    <label>Set to:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        // ===== VARIABLE TASKS =====
        case 'create-var':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦</span> Create Variable
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Name:</label>
                    <input type="text" class="task-var-name" data-index="${index}" value="${task.varName || ''}" placeholder="Variable name">
                    <label>Type:</label>
                    <select class="task-var-type" data-index="${index}">
                        <option value="integer" ${task.varType === 'integer' ? 'selected' : ''}>Integer</option>
                        <option value="float" ${task.varType === 'float' ? 'selected' : ''}>Float</option>
                        <option value="string" ${task.varType === 'string' ? 'selected' : ''}>String</option>
                        <option value="boolean" ${task.varType === 'boolean' ? 'selected' : ''}>Boolean</option>
                    </select>
                    <label>Initial Value:</label>
                    ${getVarInitialValueInput(task, index)}
                </div>
            `;
            break;
        case 'set-var':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â</span> Set Variable
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Variable:</label>
                    <select class="task-var-select" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.varName)}
                    </select>
                    <label>Set to:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="boolean" ${task.sourceType === 'boolean' ? 'selected' : ''}>Boolean</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'add-var':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‹â€ </span> Add to Variable
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Variable:</label>
                    <select class="task-var-select" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.varName)}
                    </select>
                    <label>Add:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'subtract-var':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â°</span> Subtract from Variable
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Variable:</label>
                    <select class="task-var-select" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.varName)}
                    </select>
                    <label>Subtract:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        // ===== IF / ELSE / ELSEIF / END =====
        case 'if':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã‚ÂÃ¢â‚¬Å“</span> IF
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    ${buildConditionUI(task, index)}
                </div>
            `;
            break;
        case 'elseif':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â€šÂ¬</span> ELSE IF
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    ${buildConditionUI(task, index)}
                </div>
            `;
            break;
        case 'else':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã¢â‚¬Â Ã‚Â©ÃƒÂ¯Ã‚Â¸Ã‚Â</span> ELSE
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
            `;
            break;
        case 'endif':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â¡</span> END IF
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
            `;
            break;
        // ===== LOOP =====
        case 'loop':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â</span> LOOP
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    ${buildLoopConditionUI(task, index)}
                </div>
            `;
            break;
        case 'loop-exit':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã‚ÂÃ‚Â©</span> LOOP EXIT
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    ${buildLoopSetValueUI(task, index, 'loop-exit')}
                </div>
            `;
            break;
        case 'loop-end':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â¡</span> LOOP END
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    ${buildLoopSetValueUI(task, index, 'loop-end')}
                </div>
            `;
            break;
        // ===== FUNCTIONS =====
        case 'func-min':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã‚Â¬Ã¢â‚¬Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Min
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Value A:</label>
                    <select class="task-func-a-type" data-index="${index}">
                        <option value="static" ${task.inputAType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputAType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputAType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputAType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'A')}
                    <label>Value B:</label>
                    <select class="task-func-b-type" data-index="${index}">
                        <option value="static" ${task.inputBType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputBType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputBType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputBType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'B')}
                    <label>Store result in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${getFuncOutputSelect(task, index)}
                </div>
            `;
            break;
        case 'func-max':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã‚Â¬Ã¢â‚¬Â ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Max
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Value A:</label>
                    <select class="task-func-a-type" data-index="${index}">
                        <option value="static" ${task.inputAType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputAType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputAType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputAType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'A')}
                    <label>Value B:</label>
                    <select class="task-func-b-type" data-index="${index}">
                        <option value="static" ${task.inputBType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputBType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputBType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputBType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'B')}
                    <label>Store result in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${getFuncOutputSelect(task, index)}
                </div>
            `;
            break;
        case 'func-rand':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¢</span> Rand
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Minimum:</label>
                    <input type="number" class="task-rand-min" data-index="${index}" value="${task.randMin ?? 1}">
                    <label>Maximum:</label>
                    <input type="number" class="task-rand-max" data-index="${index}" value="${task.randMax ?? 100}">
                    <label><input type="checkbox" class="task-store-result" data-index="${index}" ${task.storeResult ? 'checked' : ''}> Store as Last RNG result</label>
                    <label>Also store in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="none" ${task.outputType === 'none' || !task.outputType ? 'selected' : ''}>None</option>
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${task.outputType && task.outputType !== 'none' ? getFuncOutputSelect(task, index) : ''}
                </div>
            `;
            break;
        case 'func-print':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¨ÃƒÂ¯Ã‚Â¸Ã‚Â</span> Print
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Label (optional):</label>
                    <input type="text" class="task-print-label" data-index="${index}" value="${task.printLabel || ''}" placeholder="Display label">
                    <label>Value from:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'func-math':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â®</span> Math
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Value A:</label>
                    <select class="task-func-a-type" data-index="${index}">
                        <option value="static" ${task.inputAType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputAType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputAType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputAType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'A')}
                    <label>Operation:</label>
                    <select class="task-math-op" data-index="${index}">
                        <option value="add" ${task.mathOp === 'add' ? 'selected' : ''}>Add (+)</option>
                        <option value="subtract" ${task.mathOp === 'subtract' ? 'selected' : ''}>Subtract (-)</option>
                        <option value="multiply" ${task.mathOp === 'multiply' ? 'selected' : ''}>Multiply (ÃƒÆ’Ã¢â‚¬â€)</option>
                        <option value="divide" ${task.mathOp === 'divide' ? 'selected' : ''}>Divide (ÃƒÆ’Ã‚Â·)</option>
                        <option value="modulo" ${task.mathOp === 'modulo' ? 'selected' : ''}>Modulo (%)</option>
                    </select>
                    <label>Value B:</label>
                    <select class="task-func-b-type" data-index="${index}">
                        <option value="static" ${task.inputBType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputBType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputBType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputBType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'B')}
                    <label>Store result in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${getFuncOutputSelect(task, index)}
                </div>
            `;
            break;
        case 'func-sum':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã…Â¾Ã¢â‚¬Â¢</span> Sum
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <div class="sum-values-container">
                        ${buildSumValuesUI(task, index)}
                    </div>
                    <button class="sum-value-add" data-index="${index}">+ Add Value</button>
                    <label>Store result in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${getFuncOutputSelect(task, index)}
                </div>
            `;
            break;
        case 'func-concat':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€</span> Concat
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <div class="concat-values-container">
                        ${buildConcatValuesUI(task, index)}
                    </div>
                    ${(!task.concatValues || task.concatValues.length < 6) ? `<button class="concat-value-add" data-index="${index}">+ Add Value</button>` : ''}
                    <label>Store result in variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        case 'func-round':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾</span> Round
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Value:</label>
                    <select class="task-func-a-type" data-index="${index}">
                        <option value="static" ${task.inputAType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.inputAType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.inputAType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                        <option value="variable" ${task.inputAType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getFuncValueInput(task, index, 'A')}
                    <label>Round:</label>
                    <select class="task-round-dir" data-index="${index}">
                        <option value="down" ${task.roundDir === 'down' ? 'selected' : ''}>Round Down (Floor)</option>
                        <option value="up" ${task.roundDir === 'up' ? 'selected' : ''}>Round Up (Ceil)</option>
                    </select>
                    <label>Store result in:</label>
                    <select class="task-func-output-type" data-index="${index}">
                        <option value="variable" ${task.outputType === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="numberEntry" ${task.outputType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    </select>
                    ${getFuncOutputSelect(task, index)}
                </div>
            `;
            break;
        case 'func-checklist':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â</span> Check for Item in List
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name to find:</label>
                    <select class="task-checklist-source" data-index="${index}">
                        <option value="static" ${task.checkSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.checkSource === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.checkSource === 'variable' ?
                        `<select class="task-checklist-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.checkVarName)}
                        </select>` :
                        `<input type="text" class="task-checklist-text" data-index="${index}" value="${task.checkText || ''}" placeholder="Item name">`
                    }
                    <label>Store result (True/False) in variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        case 'func-tolower':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¡</span> ToLower
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        case 'func-toupper':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â </span> ToUpper
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        // ===== ITEM LIST TASKS =====
        case 'list-add-item':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹</span> Add Item to List
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name:</label>
                    <select class="task-list-name-source" data-index="${index}">
                        <option value="static" ${task.nameSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.nameSource === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.nameSource === 'variable' ?
                        `<select class="task-list-name-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.nameVarName)}
                        </select>` :
                        `<input type="text" class="task-list-name-text" data-index="${index}" value="${task.itemName || ''}" placeholder="Item name">`
                    }
                    <label>Initial amount:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'list-add-amount':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‹â€ </span> Add Amount to Item
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name:</label>
                    <select class="task-list-name-source" data-index="${index}">
                        <option value="static" ${task.nameSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.nameSource === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.nameSource === 'variable' ?
                        `<select class="task-list-name-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.nameVarName)}
                        </select>` :
                        `<input type="text" class="task-list-name-text" data-index="${index}" value="${task.itemName || ''}" placeholder="Item name">`
                    }
                    <label>Amount to add:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'list-remove-amount':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â°</span> Remove Amount from Item
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name:</label>
                    <select class="task-list-name-source" data-index="${index}">
                        <option value="static" ${task.nameSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.nameSource === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.nameSource === 'variable' ?
                        `<select class="task-list-name-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.nameVarName)}
                        </select>` :
                        `<input type="text" class="task-list-name-text" data-index="${index}" value="${task.itemName || ''}" placeholder="Item name">`
                    }
                    <label>Amount to remove:</label>
                    <select class="task-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Value</option>
                        <option value="lastRng" ${task.sourceType === 'lastRng' ? 'selected' : ''}>Last RNG Result</option>
                        <option value="numberEntry" ${task.sourceType === 'numberEntry' ? 'selected' : ''}>Number Entry Value</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'list-remove-item':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â</span> Remove Item from List
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name:</label>
                    <select class="task-list-name-source" data-index="${index}">
                        <option value="static" ${task.nameSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.nameSource === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.nameSource === 'variable' ?
                        `<select class="task-list-name-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.nameVarName)}
                        </select>` :
                        `<input type="text" class="task-list-name-text" data-index="${index}" value="${task.itemName || ''}" placeholder="Item name">`
                    }
                </div>
            `;
            break;
        case 'list-get-amount':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¢</span> Get Item Amount
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>List Box:</label>
                    <select class="task-listbox-select" data-index="${index}">
                        <option value="">Select List Box...</option>
                        ${getListBoxOptions(task.listBoxIndex)}
                    </select>
                    <label>Item name:</label>
                    <select class="task-getamt-source" data-index="${index}">
                        <option value="static" ${task.nameSource === 'static' ? 'selected' : ''}>Text</option>
                        <option value="variable" ${task.nameSource === 'variable' ? 'selected' : ''}>Variable</option>
                        <option value="textbox" ${task.nameSource === 'textbox' ? 'selected' : ''}>Textbox</option>
                        <option value="label" ${task.nameSource === 'label' ? 'selected' : ''}>Label</option>
                    </select>
                    ${getGetAmountNameInput(task, index)}
                    <label>Store amount in variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        // ===== TEXTFIELD TASKS =====
        case 'textfield-read':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬â€œ</span> Read
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Read from:</label>
                    <select class="task-textfield-target-type" data-index="${index}">
                        <option value="textbox" ${task.targetType === 'textbox' ? 'selected' : ''}>Textbox</option>
                        <option value="label" ${task.targetType === 'label' ? 'selected' : ''}>Label</option>
                    </select>
                    <select class="task-textfield-target" data-index="${index}">
                        <option value="">Select...</option>
                        ${getTextfieldTargetOptions(task.targetType, task.targetIndex)}
                    </select>
                    <label>Store text in variable:</label>
                    <select class="task-func-output-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.outputVarName)}
                    </select>
                </div>
            `;
            break;
        case 'textfield-write':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">ÃƒÂ¢Ã…â€œÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â</span> Write
                    <button class="task-delete" data-index="${index}">ÃƒÆ’Ã¢â‚¬â€</button>
                </div>
                <div class="task-block-config">
                    <label>Write to:</label>
                    <select class="task-textfield-target-type" data-index="${index}">
                        <option value="textbox" ${task.targetType === 'textbox' ? 'selected' : ''}>Textbox</option>
                        <option value="label" ${task.targetType === 'label' ? 'selected' : ''}>Label</option>
                    </select>
                    <select class="task-textfield-target" data-index="${index}">
                        <option value="">Select...</option>
                        ${getTextfieldTargetOptions(task.targetType, task.targetIndex)}
                    </select>
                    <label>Value source:</label>
                    <select class="task-textfield-source-type" data-index="${index}">
                        <option value="static" ${task.sourceType === 'static' ? 'selected' : ''}>Static Text</option>
                        <option value="variable" ${task.sourceType === 'variable' ? 'selected' : ''}>Variable</option>
                    </select>
                    ${task.sourceType === 'variable' ?
                        `<select class="task-textfield-source-var" data-index="${index}">
                            <option value="">Select Variable...</option>
                            ${getVariableOptions(task.sourceVarName)}
                        </select>` :
                        `<input type="text" class="task-textfield-source-text" data-index="${index}" value="${(task.staticText || '').replace(/"/g, '&quot;')}" placeholder="Enter text...">`
                    }
                </div>
            `;
            break;
    }
    
    block.innerHTML = blockContent;
    
    // Add event listeners
    setTimeout(() => {
        // Delete button
        const deleteBtn = block.querySelector('.task-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.index);
                tempTasks.splice(idx, 1);
                renderTaskSequence();
            });
        }
        
        // RNG select
        const rngSelect = block.querySelector('.task-rng-select');
        if (rngSelect) {
            rngSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].rngIndex = parseInt(e.target.value);
            });
        }
        
        // Store result checkbox
        const storeResult = block.querySelector('.task-store-result');
        if (storeResult) {
            storeResult.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].storeResult = e.target.checked;
            });
        }
        
        // Target select
        const targetSelect = block.querySelector('.task-target-select');
        if (targetSelect) {
            targetSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].targetIndex = parseInt(e.target.value);
            });
        }
        
        // Source type select
        const sourceType = block.querySelector('.task-source-type');
        if (sourceType) {
            sourceType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].sourceType = e.target.value;
                // When switching to boolean, initialize staticValue to true
                // (matches the first option shown in the boolean select dropdown)
                if (e.target.value === 'boolean') {
                    tempTasks[idx].staticValue = true;
                }
                renderTaskSequence();
            });
        }
        
        // Static value input
        const staticValue = block.querySelector('.task-static-value');
        if (staticValue) {
            staticValue.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].staticValue = parseFloat(e.target.value) || 0;
            });
        }
        
        // Source number entry select
        const sourceNe = block.querySelector('.task-source-ne-select');
        if (sourceNe) {
            sourceNe.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].sourceIndex = parseInt(e.target.value);
            });
        }
        
        // Source variable select
        const sourceVar = block.querySelector('.task-source-var-select');
        if (sourceVar) {
            sourceVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].sourceVarName = e.target.value;
            });
        }
        
        // Variable name input (create-var)
        const varName = block.querySelector('.task-var-name');
        if (varName) {
            varName.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].varName = e.target.value;
            });
        }
        
        // Variable type select (create-var)
        const varType = block.querySelector('.task-var-type');
        if (varType) {
            varType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].varType = e.target.value;
                renderTaskSequence();
            });
        }
        
        // Variable initial value
        const varInitVal = block.querySelector('.task-var-init-value');
        if (varInitVal) {
            varInitVal.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const t = tempTasks[idx];
                if (t.varType === 'boolean') {
                    t.varInitValue = e.target.value === 'true';
                } else if (t.varType === 'integer') {
                    t.varInitValue = parseInt(e.target.value) || 0;
                } else if (t.varType === 'float') {
                    t.varInitValue = parseFloat(e.target.value) || 0;
                } else {
                    t.varInitValue = e.target.value;
                }
            });
            // Handle select (boolean type)
            varInitVal.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const t = tempTasks[idx];
                if (t.varType === 'boolean') {
                    t.varInitValue = e.target.value === 'true';
                }
            });
        }
        
        // Variable select (for set-var, add-var, subtract-var)
        const varSelect = block.querySelector('.task-var-select');
        if (varSelect) {
            varSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].varName = e.target.value;
            });
        }
        
        // Boolean value select (for set-var with boolean source)
        const boolSelect = block.querySelector('.task-source-bool-select');
        if (boolSelect) {
            boolSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].staticValue = e.target.value === 'true';
            });
        }
        
        // Static value for string type
        const staticStr = block.querySelector('.task-static-string');
        if (staticStr) {
            staticStr.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].staticValue = e.target.value;
            });
        }
        
        // IF condition selects
        setupConditionListeners(block, index);
        
        // Loop configuration listeners
        setupLoopListeners(block, index);
        
        // Function input type selects
        const funcAType = block.querySelector('.task-func-a-type');
        if (funcAType) {
            funcAType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].inputAType = e.target.value;
                renderTaskSequence();
            });
        }
        const funcBType = block.querySelector('.task-func-b-type');
        if (funcBType) {
            funcBType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].inputBType = e.target.value;
                renderTaskSequence();
            });
        }
        
        // Function value inputs
        const funcAVal = block.querySelector('.task-func-a-value');
        if (funcAVal) {
            funcAVal.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].inputAValue = parseFloat(e.target.value) || 0;
            });
            funcAVal.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (tempTasks[idx].inputAType === 'numberEntry') {
                    tempTasks[idx].inputAIndex = parseInt(e.target.value);
                } else if (tempTasks[idx].inputAType === 'variable') {
                    tempTasks[idx].inputAVarName = e.target.value;
                } else {
                    tempTasks[idx].inputAValue = parseFloat(e.target.value) || 0;
                }
            });
        }
        const funcBVal = block.querySelector('.task-func-b-value');
        if (funcBVal) {
            funcBVal.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].inputBValue = parseFloat(e.target.value) || 0;
            });
            funcBVal.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (tempTasks[idx].inputBType === 'numberEntry') {
                    tempTasks[idx].inputBIndex = parseInt(e.target.value);
                } else if (tempTasks[idx].inputBType === 'variable') {
                    tempTasks[idx].inputBVarName = e.target.value;
                } else {
                    tempTasks[idx].inputBValue = parseFloat(e.target.value) || 0;
                }
            });
        }
        
        // Function output type
        const funcOutType = block.querySelector('.task-func-output-type');
        if (funcOutType) {
            funcOutType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].outputType = e.target.value;
                renderTaskSequence();
            });
        }
        
        // Function output select
        const funcOutVar = block.querySelector('.task-func-output-var');
        if (funcOutVar) {
            funcOutVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].outputVarName = e.target.value;
            });
        }
        const funcOutNe = block.querySelector('.task-func-output-ne');
        if (funcOutNe) {
            funcOutNe.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].outputIndex = parseInt(e.target.value);
            });
        }
        
        // Rand min/max
        const randMin = block.querySelector('.task-rand-min');
        if (randMin) {
            randMin.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].randMin = parseInt(e.target.value) || 1;
            });
        }
        const randMax = block.querySelector('.task-rand-max');
        if (randMax) {
            randMax.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].randMax = parseInt(e.target.value) || 100;
            });
        }
        
        // Print label
        const printLabel = block.querySelector('.task-print-label');
        if (printLabel) {
            printLabel.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].printLabel = e.target.value;
            });
        }
        
        // Math operation select
        const mathOp = block.querySelector('.task-math-op');
        if (mathOp) {
            mathOp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].mathOp = e.target.value;
            });
        }
        
        // Round direction select
        const roundDir = block.querySelector('.task-round-dir');
        if (roundDir) {
            roundDir.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].roundDir = e.target.value;
            });
        }
        
        // Sum value add button
        const sumAddBtn = block.querySelector('.sum-value-add');
        if (sumAddBtn) {
            sumAddBtn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (!tempTasks[idx].sumValues) tempTasks[idx].sumValues = [];
                tempTasks[idx].sumValues.push({ type: 'static', value: 0, index: null, varName: '' });
                renderTaskSequence();
            });
        }
        
        // Sum value remove buttons
        block.querySelectorAll('.sum-value-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const si = parseInt(e.target.dataset.sumindex);
                tempTasks[idx].sumValues.splice(si, 1);
                renderTaskSequence();
            });
        });
        
        // Sum value type selects
        block.querySelectorAll('.sum-val-type').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const si = parseInt(e.target.dataset.sumindex);
                tempTasks[idx].sumValues[si].type = e.target.value;
                renderTaskSequence();
            });
        });
        
        // Sum value inputs
        block.querySelectorAll('.sum-val-input').forEach(el => {
            const handler = (e) => {
                const idx = parseInt(e.target.dataset.index);
                const si = parseInt(e.target.dataset.sumindex);
                const sv = tempTasks[idx].sumValues[si];
                if (sv.type === 'numberEntry') sv.index = parseInt(e.target.value);
                else if (sv.type === 'variable') sv.varName = e.target.value;
                else sv.value = parseFloat(e.target.value) || 0;
            };
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        
        // Concat value add button
        const concatAddBtn = block.querySelector('.concat-value-add');
        if (concatAddBtn) {
            concatAddBtn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (!tempTasks[idx].concatValues) tempTasks[idx].concatValues = [];
                if (tempTasks[idx].concatValues.length < 6) {
                    tempTasks[idx].concatValues.push({ type: 'static', value: '', index: null, varName: '' });
                    renderTaskSequence();
                }
            });
        }
        
        // Concat value remove buttons
        block.querySelectorAll('.concat-value-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const ci = parseInt(e.target.dataset.concatindex);
                tempTasks[idx].concatValues.splice(ci, 1);
                renderTaskSequence();
            });
        });
        
        // Concat value type selects
        block.querySelectorAll('.concat-val-type').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const ci = parseInt(e.target.dataset.concatindex);
                tempTasks[idx].concatValues[ci].type = e.target.value;
                tempTasks[idx].concatValues[ci].value = '';
                tempTasks[idx].concatValues[ci].index = null;
                tempTasks[idx].concatValues[ci].varName = '';
                renderTaskSequence();
            });
        });
        
        // Concat value inputs
        block.querySelectorAll('.concat-val-input').forEach(el => {
            const handler = (e) => {
                const idx = parseInt(e.target.dataset.index);
                const ci = parseInt(e.target.dataset.concatindex);
                const cv = tempTasks[idx].concatValues[ci];
                if (cv.type === 'numberEntry') cv.index = parseInt(e.target.value);
                else if (cv.type === 'variable') cv.varName = e.target.value;
                else if (cv.type === 'textbox') cv.index = parseInt(e.target.value);
                else if (cv.type === 'label') cv.index = parseInt(e.target.value);
                else cv.value = e.target.value;
            };
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        
        // List box select
        const listBoxSelect = block.querySelector('.task-listbox-select');
        if (listBoxSelect) {
            listBoxSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].listBoxIndex = parseInt(e.target.value);
            });
        }
        
        // List name source select
        const listNameSource = block.querySelector('.task-list-name-source');
        if (listNameSource) {
            listNameSource.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameSource = e.target.value;
                renderTaskSequence();
            });
        }
        
        // List name text input
        const listNameText = block.querySelector('.task-list-name-text');
        if (listNameText) {
            listNameText.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].itemName = e.target.value;
            });
        }
        
        // List name variable select
        const listNameVar = block.querySelector('.task-list-name-var');
        if (listNameVar) {
            listNameVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameVarName = e.target.value;
            });
        }
        
        // CheckList source select
        const checkSource = block.querySelector('.task-checklist-source');
        if (checkSource) {
            checkSource.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].checkSource = e.target.value;
                renderTaskSequence();
            });
        }
        
        // CheckList text input
        const checkText = block.querySelector('.task-checklist-text');
        if (checkText) {
            checkText.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].checkText = e.target.value;
            });
        }
        
        // CheckList variable select
        const checkVar = block.querySelector('.task-checklist-var');
        if (checkVar) {
            checkVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].checkVarName = e.target.value;
            });
        }
        
        // Get Item Amount source select
        const getAmtSource = block.querySelector('.task-getamt-source');
        if (getAmtSource) {
            getAmtSource.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameSource = e.target.value;
                renderTaskSequence();
            });
        }
        
        // Get Item Amount name inputs
        const getAmtText = block.querySelector('.task-getamt-text');
        if (getAmtText) {
            getAmtText.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].itemName = e.target.value;
            });
        }
        const getAmtVar = block.querySelector('.task-getamt-var');
        if (getAmtVar) {
            getAmtVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameVarName = e.target.value;
            });
        }
        const getAmtTextbox = block.querySelector('.task-getamt-textbox');
        if (getAmtTextbox) {
            getAmtTextbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameTextboxIndex = e.target.value !== '' ? parseInt(e.target.value) : null;
            });
        }
        const getAmtLabel = block.querySelector('.task-getamt-label');
        if (getAmtLabel) {
            getAmtLabel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].nameLabelIndex = e.target.value !== '' ? parseInt(e.target.value) : null;
            });
        }
        
        // Textfield target type select (textbox vs label)
        const tfTargetType = block.querySelector('.task-textfield-target-type');
        if (tfTargetType) {
            tfTargetType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].targetType = e.target.value;
                tempTasks[idx].targetIndex = null;
                renderTaskSequence();
            });
        }
        
        // Textfield target select (which textbox/label)
        const tfTarget = block.querySelector('.task-textfield-target');
        if (tfTarget) {
            tfTarget.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].targetIndex = e.target.value !== '' ? parseInt(e.target.value) : null;
            });
        }
        
        // Textfield write source type (static vs variable)
        const tfSourceType = block.querySelector('.task-textfield-source-type');
        if (tfSourceType) {
            tfSourceType.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].sourceType = e.target.value;
                renderTaskSequence();
            });
        }
        
        // Textfield write source text input
        const tfSourceText = block.querySelector('.task-textfield-source-text');
        if (tfSourceText) {
            tfSourceText.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].staticText = e.target.value;
            });
        }
        
        // Textfield write source variable select
        const tfSourceVar = block.querySelector('.task-textfield-source-var');
        if (tfSourceVar) {
            tfSourceVar.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempTasks[idx].sourceVarName = e.target.value;
            });
        }
    }, 0);
    
    return block;
}

function getSourceInput(task, index) {
    switch (task.sourceType) {
        case 'static':
            return `<input type="number" class="task-static-value" data-index="${index}" value="${task.staticValue || 0}">`;
        case 'lastRng':
            return `<span class="task-source-label">Uses the last RNG result</span>`;
        case 'numberEntry':
            return `
                <select class="task-source-ne-select" data-index="${index}">
                    <option value="">Select Number Entry...</option>
                    ${numberEntries.map((ne, i) => `<option value="${i}" ${task.sourceIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)} (${ne.value})</option>`).join('')}
                </select>
            `;
        case 'variable':
            return `
                <select class="task-source-var-select" data-index="${index}">
                    <option value="">Select Variable...</option>
                    ${getVariableOptions(task.sourceVarName)}
                </select>
            `;
        case 'boolean': {
            const boolVal = (task.staticValue === true || task.staticValue === 'true');
            return `
                <select class="task-source-bool-select" data-index="${index}">
                    <option value="true" ${boolVal ? 'selected' : ''}>True</option>
                    <option value="false" ${!boolVal ? 'selected' : ''}>False</option>
                </select>
            `;
        }
        default:
            return `<input type="number" class="task-static-value" data-index="${index}" value="${task.staticValue || 0}">`;
    }
}

// Helper to get variable options from both eventVariables and create-var tasks in the current sequence
function getVariableOptions(selectedName) {
    const varNames = new Set();
    // From global eventVariables
    eventVariables.forEach(v => varNames.add(v.name));
    // From create-var tasks in tempTasks
    if (tempTasks) {
        tempTasks.forEach(t => {
            if (t.type === 'create-var' && t.varName) {
                varNames.add(t.varName);
            }
        });
    }
    return Array.from(varNames).map(name =>
        `<option value="${name}" ${selectedName === name ? 'selected' : ''}>${name}</option>`
    ).join('');
}

// Helper to get list box options for dropdowns
function getListBoxOptions(selectedIndex) {
    return listBoxElements.map((lb, i) =>
        `<option value="${i}" ${selectedIndex === i ? 'selected' : ''}>${lb.title || 'List Box ' + (i+1)}</option>`
    ).join('');
}

// Helper to get textfield target options (textbox or label dropdowns)
function getTextfieldTargetOptions(targetType, selectedIndex) {
    if (targetType === 'label') {
        return labelElements.map((le, i) =>
            `<option value="${i}" ${selectedIndex === i ? 'selected' : ''}>${le.name || (le.text ? le.text.substring(0, 20) : 'Label ' + (i+1))}</option>`
        ).join('');
    }
    // Default: textbox
    return textElements.map((te, i) =>
        `<option value="${i}" ${selectedIndex === i ? 'selected' : ''}>${te.name || (te.text ? te.text.substring(0, 20) : 'Textbox ' + (i+1))}</option>`
    ).join('');
}

// Helper to build the name input for Get Item Amount block
function getGetAmountNameInput(task, index) {
    switch (task.nameSource) {
        case 'variable':
            return `<select class="task-getamt-var" data-index="${index}">
                <option value="">Select Variable...</option>
                ${getVariableOptions(task.nameVarName)}
            </select>`;
        case 'textbox':
            return `<select class="task-getamt-textbox" data-index="${index}">
                <option value="">Select Textbox...</option>
                ${textElements.map((te, i) => `<option value="${i}" ${task.nameTextboxIndex === i ? 'selected' : ''}>${te.name || (te.text ? te.text.substring(0, 20) : 'Textbox ' + (i+1))}</option>`).join('')}
            </select>`;
        case 'label':
            return `<select class="task-getamt-label" data-index="${index}">
                <option value="">Select Label...</option>
                ${labelElements.map((le, i) => `<option value="${i}" ${task.nameLabelIndex === i ? 'selected' : ''}>${le.name || (le.text ? le.text.substring(0, 20) : 'Label ' + (i+1))}</option>`).join('')}
            </select>`;
        default: // static
            return `<input type="text" class="task-getamt-text" data-index="${index}" value="${(task.itemName || '').replace(/"/g, '&quot;')}" placeholder="Item name">`;
    }
}

// Helper to resolve item name for Get Item Amount at execution time
function getGetAmountItemName(task) {
    switch (task.nameSource) {
        case 'variable':
            return String(getVariableValue(task.nameVarName) || '');
        case 'textbox':
            if (task.nameTextboxIndex !== null && textElements[task.nameTextboxIndex]) {
                return String(textElements[task.nameTextboxIndex].text || '');
            }
            return '';
        case 'label':
            if (task.nameLabelIndex !== null && labelElements[task.nameLabelIndex]) {
                return String(labelElements[task.nameLabelIndex].text || '');
            }
            return '';
        default: // static
            return task.itemName || '';
    }
}

// Build the concat values UI rows
function buildConcatValuesUI(task, index) {
    if (!task.concatValues || task.concatValues.length === 0) {
        task.concatValues = [
            { type: 'static', value: '', index: null, varName: '' },
            { type: 'static', value: '', index: null, varName: '' }
        ];
    }
    return task.concatValues.map((cv, ci) => `
        <div class="concat-value-row">
            <select class="concat-val-type" data-index="${index}" data-concatindex="${ci}">
                <option value="static" ${cv.type === 'static' ? 'selected' : ''}>Text</option>
                <option value="variable" ${cv.type === 'variable' ? 'selected' : ''}>Variable</option>
                <option value="numberEntry" ${cv.type === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                <option value="textbox" ${cv.type === 'textbox' ? 'selected' : ''}>Textbox</option>
                <option value="label" ${cv.type === 'label' ? 'selected' : ''}>Label</option>
                <option value="lastRng" ${cv.type === 'lastRng' ? 'selected' : ''}>Last RNG</option>
            </select>
            ${getConcatValueInput(cv, index, ci)}
            ${ci > 1 ? `<button class="concat-value-remove" data-index="${index}" data-concatindex="${ci}">ÃƒÆ’Ã¢â‚¬â€</button>` : ''}
        </div>
    `).join('');
}

// Get input for a single concat value
function getConcatValueInput(cv, index, ci) {
    switch (cv.type) {
        case 'static':
            return `<input type="text" class="concat-val-input" data-index="${index}" data-concatindex="${ci}" value="${(cv.value || '').replace(/"/g, '&quot;')}" placeholder="Enter text...">`;
        case 'lastRng':
            return `<span class="task-source-label">Last RNG</span>`;
        case 'numberEntry':
            return `<select class="concat-val-input" data-index="${index}" data-concatindex="${ci}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${cv.index === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<select class="concat-val-input" data-index="${index}" data-concatindex="${ci}">
                <option value="">Select...</option>
                ${getVariableOptions(cv.varName)}
            </select>`;
        case 'textbox':
            return `<select class="concat-val-input" data-index="${index}" data-concatindex="${ci}">
                <option value="">Select...</option>
                ${textElements.map((te, i) => `<option value="${i}" ${cv.index === i ? 'selected' : ''}>${te.name || (te.text ? te.text.substring(0, 20) : 'Textbox ' + (i+1))}</option>`).join('')}
            </select>`;
        case 'label':
            return `<select class="concat-val-input" data-index="${index}" data-concatindex="${ci}">
                <option value="">Select...</option>
                ${labelElements.map((le, i) => `<option value="${i}" ${cv.index === i ? 'selected' : ''}>${le.name || (le.text ? le.text.substring(0, 20) : 'Label ' + (i+1))}</option>`).join('')}
            </select>`;
        default:
            return `<input type="text" class="concat-val-input" data-index="${index}" data-concatindex="${ci}" value="${(cv.value || '').replace(/"/g, '&quot;')}" placeholder="Enter text...">`;
    }
}

// Build the sum values UI rows
function buildSumValuesUI(task, index) {
    if (!task.sumValues || task.sumValues.length === 0) {
        task.sumValues = [
            { type: 'static', value: 0, index: null, varName: '' },
            { type: 'static', value: 0, index: null, varName: '' }
        ];
    }
    return task.sumValues.map((sv, si) => `
        <div class="sum-value-row">
            <select class="sum-val-type" data-index="${index}" data-sumindex="${si}">
                <option value="static" ${sv.type === 'static' ? 'selected' : ''}>Static</option>
                <option value="lastRng" ${sv.type === 'lastRng' ? 'selected' : ''}>Last RNG</option>
                <option value="numberEntry" ${sv.type === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                <option value="variable" ${sv.type === 'variable' ? 'selected' : ''}>Variable</option>
            </select>
            ${getSumValueInput(sv, index, si)}
            ${si > 1 ? `<button class="sum-value-remove" data-index="${index}" data-sumindex="${si}">ÃƒÆ’Ã¢â‚¬â€</button>` : ''}
        </div>
    `).join('');
}

// Get input for a single sum value
function getSumValueInput(sv, index, si) {
    switch (sv.type) {
        case 'static':
            return `<input type="number" class="sum-val-input" data-index="${index}" data-sumindex="${si}" value="${sv.value || 0}">`;
        case 'lastRng':
            return `<span class="task-source-label">Last RNG</span>`;
        case 'numberEntry':
            return `<select class="sum-val-input" data-index="${index}" data-sumindex="${si}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${sv.index === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<select class="sum-val-input" data-index="${index}" data-sumindex="${si}">
                <option value="">Select...</option>
                ${getVariableOptions(sv.varName)}
            </select>`;
        default:
            return `<input type="number" class="sum-val-input" data-index="${index}" data-sumindex="${si}" value="${sv.value || 0}">`;
    }
}

// Helper to get initial value input for create-var task
function getVarInitialValueInput(task, index) {
    switch (task.varType) {
        case 'boolean':
            return `<select class="task-var-init-value" data-index="${index}">
                <option value="false" ${!task.varInitValue ? 'selected' : ''}>false</option>
                <option value="true" ${task.varInitValue ? 'selected' : ''}>true</option>
            </select>`;
        case 'string':
            return `<input type="text" class="task-var-init-value" data-index="${index}" value="${task.varInitValue || ''}" placeholder="Initial text">`;
        case 'float':
            return `<input type="number" step="0.01" class="task-var-init-value" data-index="${index}" value="${task.varInitValue || 0}">`;
        case 'integer':
        default:
            return `<input type="number" class="task-var-init-value" data-index="${index}" value="${task.varInitValue || 0}">`;
    }
}

// Helper to calculate indent level for IF blocks
function getTaskIndentLevel(index) {
    let level = 0;
    for (let i = 0; i < index; i++) {
        const t = tempTasks[i];
        if (t.type === 'if' || t.type === 'elseif' || t.type === 'else') {
            level++;
        }
        if (t.type === 'endif' || t.type === 'elseif' || t.type === 'else') {
            level--;
        }
        // Loop indentation
        if (t.type === 'loop') {
            level++;
        }
        if (t.type === 'loop-end') {
            level--;
        }
    }
    // Current task: if it's elseif, else, endif, or loop-end, it should be at the outer level
    const current = tempTasks[index];
    if (current.type === 'elseif' || current.type === 'else' || current.type === 'endif') {
        // These are at the same level as 'if', not indented
        return Math.max(0, level);
    }
    if (current.type === 'loop-end') {
        return Math.max(0, level);
    }
    return Math.max(0, level);
}

// ===== LOOP UI BUILDERS =====

// Build the Loop condition/configuration UI
function buildLoopConditionUI(task, index) {
    let html = '';
    
    // Re-occurrence type selector
    html += `
        <div class="loop-config-row">
            <label>Re-Occurrence Type:</label>
            <select class="task-loop-type" data-index="${index}">
                <option value="static" ${task.loopType === 'static' ? 'selected' : ''}>Static (Integer)</option>
                <option value="numberEntry" ${task.loopType === 'numberEntry' ? 'selected' : ''}>Number Entry (Integer)</option>
                <option value="variable" ${task.loopType === 'variable' ? 'selected' : ''}>Variable (Integer)</option>
                <option value="lastRng" ${task.loopType === 'lastRng' ? 'selected' : ''}>Last RNG (Integer)</option>
                <option value="boolean" ${task.loopType === 'boolean' ? 'selected' : ''}>Variable (Boolean)</option>
            </select>
        </div>
    `;
    
    if (task.loopType === 'boolean') {
        // Boolean mode: loop until variable is true/false
        html += `
            <div class="loop-config-row">
                <label>Variable:</label>
                <select class="task-loop-var" data-index="${index}">
                    <option value="">Select Variable...</option>
                    ${getVariableOptions(task.varName)}
                </select>
            </div>
            <div class="loop-config-row">
                <label>Loop Direction:</label>
                <select class="task-loop-direction" data-index="${index}">
                    <option value="until" ${task.loopDirection === 'until' ? 'selected' : ''}>Until</option>
                    <option value="while" ${task.loopDirection === 'while' ? 'selected' : ''}>While</option>
                </select>
            </div>
            <div class="loop-config-row">
                <label>Boolean Target:</label>
                <select class="task-loop-bool-target" data-index="${index}">
                    <option value="true" ${task.boolTarget === true || task.boolTarget === 'true' ? 'selected' : ''}>True</option>
                    <option value="false" ${task.boolTarget === false || task.boolTarget === 'false' ? 'selected' : ''}>False</option>
                </select>
            </div>
        `;
    } else {
        // Integer mode: loop until/while counter meets condition
        html += `<div class="loop-config-row">`;
        
        // Value input based on type
        switch (task.loopType) {
            case 'static':
                html += `
                    <label>Counter Value:</label>
                    <input type="number" class="task-loop-static-value" data-index="${index}" value="${task.staticValue || 0}">
                `;
                break;
            case 'numberEntry':
                html += `
                    <label>Number Entry:</label>
                    <select class="task-loop-ne-select" data-index="${index}">
                        <option value="">Select...</option>
                        ${numberEntries.map((ne, i) => `<option value="${i}" ${task.neIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
                    </select>
                `;
                break;
            case 'variable':
                html += `
                    <label>Variable:</label>
                    <select class="task-loop-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.varName)}
                    </select>
                `;
                break;
            case 'lastRng':
                html += `<label>Uses Last RNG Result as counter</label>`;
                break;
        }
        
        html += `</div>`;
        
        // Loop direction (until/while)
        html += `
            <div class="loop-config-row">
                <label>Loop Direction:</label>
                <select class="task-loop-direction" data-index="${index}">
                    <option value="until" ${task.loopDirection === 'until' ? 'selected' : ''}>Until</option>
                    <option value="while" ${task.loopDirection === 'while' ? 'selected' : ''}>While</option>
                </select>
            </div>
        `;
        
        // Comparison operator
        html += `
            <div class="loop-config-row">
                <label>Operator:</label>
                <select class="task-loop-operator" data-index="${index}">
                    <option value="==" ${task.loopOperator === '==' ? 'selected' : ''}>Equal</option>
                    <option value="!=" ${task.loopOperator === '!=' ? 'selected' : ''}>Not Equal</option>
                    <option value=">" ${task.loopOperator === '>' ? 'selected' : ''}>Greater Than</option>
                    <option value=">=" ${task.loopOperator === '>=' ? 'selected' : ''}>Greater/Equal</option>
                    <option value="<" ${task.loopOperator === '<' ? 'selected' : ''}>Less Than</option>
                    <option value="<=" ${task.loopOperator === '<=' ? 'selected' : ''}>Less/Equal</option>
                </select>
            </div>
        `;
        
        // Compare-to value
        html += `
            <div class="loop-config-row">
                <label>Compare To:</label>
                <select class="task-loop-compare-type" data-index="${index}">
                    <option value="static" ${task.compareType === 'static' ? 'selected' : ''}>Static (Integer)</option>
                    <option value="numberEntry" ${task.compareType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    <option value="variable" ${task.compareType === 'variable' ? 'selected' : ''}>Variable</option>
                    <option value="lastRng" ${task.compareType === 'lastRng' ? 'selected' : ''}>Last RNG</option>
                </select>
                ${getLoopCompareValueInput(task, index)}
            </div>
        `;
    }
    
    return html;
}

// Get the value input for loop compare-to
function getLoopCompareValueInput(task, index) {
    const type = task.compareType || 'static';
    switch (type) {
        case 'static':
            return `<input type="number" class="task-loop-compare-value" data-index="${index}" value="${task.compareValue || 0}">`;
        case 'lastRng':
            return `<span class="task-source-label">Last RNG</span>`;
        case 'numberEntry':
            return `<select class="task-loop-compare-ne" data-index="${index}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${task.compareNeIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<select class="task-loop-compare-var" data-index="${index}">
                <option value="">Select Variable...</option>
                ${getVariableOptions(task.compareVarName)}
            </select>`;
        default:
            return `<input type="number" class="task-loop-compare-value" data-index="${index}" value="${task.compareValue || 0}">`;
    }
}

// Build the optional set-value UI for Loop Exit and Loop End
function buildLoopSetValueUI(task, index, actionType) {
    const label = actionType === 'loop-exit' ? 'Set a value when exiting this loop iteration:' : 'Set a value when ending the loop:';
    
    let html = `
        <div class="loop-set-row">
            <label><input type="checkbox" class="task-loop-set-enabled" data-index="${index}" ${task.setValueEnabled ? 'checked' : ''}> ${label}</label>
        </div>
    `;
    
    if (task.setValueEnabled) {
        html += `
            <div class="loop-set-config">
                <div class="loop-config-row">
                    <label>Set Type:</label>
                    <select class="task-loop-set-type" data-index="${index}">
                        <option value="static" ${task.setType === 'static' ? 'selected' : ''}>Static (Integer)</option>
                        <option value="numberEntry" ${task.setType === 'numberEntry' ? 'selected' : ''}>Number Entry (Integer)</option>
                        <option value="variable" ${task.setType === 'variable' ? 'selected' : ''}>Variable (Integer)</option>
                        <option value="lastRng" ${task.setType === 'lastRng' ? 'selected' : ''}>Last RNG (Integer)</option>
                        <option value="boolean" ${task.setType === 'boolean' ? 'selected' : ''}>Variable (Boolean)</option>
                    </select>
                </div>
                <div class="loop-config-row">
                    <label>Target Variable:</label>
                    <select class="task-loop-set-target-var" data-index="${index}">
                        <option value="">Select Variable...</option>
                        ${getVariableOptions(task.setTargetVarName)}
                    </select>
                </div>
                <div class="loop-config-row">
                    ${getLoopSetValueInput(task, index)}
                </div>
            </div>
        `;
    }
    
    return html;
}

// Get the value input for loop set-value
function getLoopSetValueInput(task, index) {
    const type = task.setType || 'static';
    switch (type) {
        case 'static':
            return `<label>Value:</label> <input type="number" class="task-loop-set-value" data-index="${index}" value="${task.setValue || 0}">`;
        case 'lastRng':
            return `<label>Value:</label> <span class="task-source-label">Last RNG Result</span>`;
        case 'numberEntry':
            return `<label>From Number Entry:</label> <select class="task-loop-set-ne" data-index="${index}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${task.setNeIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<label>From Variable:</label> <select class="task-loop-set-source-var" data-index="${index}">
                <option value="">Select Variable...</option>
                ${getVariableOptions(task.setSourceVarName)}
            </select>`;
        case 'boolean':
            return `<label>Boolean Value:</label> <select class="task-loop-set-bool" data-index="${index}">
                <option value="true" ${task.setBoolValue === true || task.setBoolValue === 'true' ? 'selected' : ''}>True</option>
                <option value="false" ${task.setBoolValue === false || task.setBoolValue === 'false' ? 'selected' : ''}>False</option>
            </select>`;
        default:
            return `<label>Value:</label> <input type="number" class="task-loop-set-value" data-index="${index}" value="${task.setValue || 0}">`;
    }
}

// Build the condition UI for IF/ELSEIF blocks
function buildConditionUI(task, index) {
    // Initialize conditions array if not present
    if (!task.conditions) {
        task.conditions = [{
            leftType: 'lastRng', leftValue: '', leftIndex: null, leftVarName: '',
            operator: '==',
            rightType: 'static', rightValue: 0, rightIndex: null, rightVarName: ''
        }];
    }
    
    let html = '';
    task.conditions.forEach((cond, ci) => {
        if (ci > 0) {
            // AND/OR connector
            html += `
                <div class="condition-connector">
                    <select class="task-cond-logic" data-index="${index}" data-cond="${ci}">
                        <option value="and" ${cond.logic === 'and' ? 'selected' : ''}>AND</option>
                        <option value="or" ${cond.logic === 'or' ? 'selected' : ''}>OR</option>
                    </select>
                </div>
            `;
        }
        html += `
            <div class="condition-row" data-cond="${ci}">
                <select class="task-cond-left-type" data-index="${index}" data-cond="${ci}">
                    <option value="static" ${cond.leftType === 'static' ? 'selected' : ''}>Static</option>
                    <option value="lastRng" ${cond.leftType === 'lastRng' ? 'selected' : ''}>Last RNG</option>
                    <option value="numberEntry" ${cond.leftType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    <option value="variable" ${cond.leftType === 'variable' ? 'selected' : ''}>Variable</option>
                    <option value="boolean" ${cond.leftType === 'boolean' ? 'selected' : ''}>Boolean</option>
                </select>
                ${getConditionValueInput(cond, index, ci, 'left')}
                <select class="task-cond-operator" data-index="${index}" data-cond="${ci}">
                    <option value=">" ${cond.operator === '>' ? 'selected' : ''}>Greater Than</option>
                    <option value=">=" ${cond.operator === '>=' ? 'selected' : ''}>Greater/Equal</option>
                    <option value="<" ${cond.operator === '<' ? 'selected' : ''}>Less Than</option>
                    <option value="<=" ${cond.operator === '<=' ? 'selected' : ''}>Less/Equal</option>
                    <option value="==" ${cond.operator === '==' ? 'selected' : ''}>Equal</option>
                    <option value="!=" ${cond.operator === '!=' ? 'selected' : ''}>Not Equal</option>
                </select>
                <select class="task-cond-right-type" data-index="${index}" data-cond="${ci}">
                    <option value="static" ${cond.rightType === 'static' ? 'selected' : ''}>Static</option>
                    <option value="lastRng" ${cond.rightType === 'lastRng' ? 'selected' : ''}>Last RNG</option>
                    <option value="numberEntry" ${cond.rightType === 'numberEntry' ? 'selected' : ''}>Number Entry</option>
                    <option value="variable" ${cond.rightType === 'variable' ? 'selected' : ''}>Variable</option>
                    <option value="boolean" ${cond.rightType === 'boolean' ? 'selected' : ''}>Boolean</option>
                </select>
                ${getConditionValueInput(cond, index, ci, 'right')}
                ${ci > 0 ? `<button class="task-cond-remove" data-index="${index}" data-cond="${ci}">ÃƒÆ’Ã¢â‚¬â€</button>` : ''}
            </div>
        `;
    });
    html += `<button class="task-cond-add" data-index="${index}">+ Add Condition</button>`;
    return html;
}

// Get value input for a condition side (left or right)
function getConditionValueInput(cond, index, ci, side) {
    const type = side === 'left' ? cond.leftType : cond.rightType;
    const val = side === 'left' ? cond.leftValue : cond.rightValue;
    const neIdx = side === 'left' ? cond.leftIndex : cond.rightIndex;
    const varName = side === 'left' ? cond.leftVarName : cond.rightVarName;
    const cls = `task-cond-${side}-value`;
    
    switch (type) {
        case 'static':
            return `<input type="number" class="${cls}" data-index="${index}" data-cond="${ci}" value="${val || 0}">`;
        case 'lastRng':
            return `<span class="task-source-label">Last RNG</span>`;
        case 'numberEntry':
            return `<select class="${cls}" data-index="${index}" data-cond="${ci}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${neIdx === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<select class="${cls}" data-index="${index}" data-cond="${ci}">
                <option value="">Select...</option>
                ${getVariableOptions(varName)}
            </select>`;
        case 'boolean':
            return `<select class="${cls}" data-index="${index}" data-cond="${ci}">
                <option value="true" ${val === true || val === 'true' ? 'selected' : ''}>True</option>
                <option value="false" ${val === false || val === 'false' || !val ? 'selected' : ''}>False</option>
            </select>`;
        default:
            return `<input type="number" class="${cls}" data-index="${index}" data-cond="${ci}" value="${val || 0}">`;
    }
}

// Setup event listeners for condition UI elements
function setupConditionListeners(block, index) {
    // Left type selects
    block.querySelectorAll('.task-cond-left-type').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            tempTasks[idx].conditions[ci].leftType = e.target.value;
            renderTaskSequence();
        });
    });
    // Right type selects
    block.querySelectorAll('.task-cond-right-type').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            tempTasks[idx].conditions[ci].rightType = e.target.value;
            renderTaskSequence();
        });
    });
    // Operator selects
    block.querySelectorAll('.task-cond-operator').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            tempTasks[idx].conditions[ci].operator = e.target.value;
        });
    });
    // Logic (AND/OR) selects
    block.querySelectorAll('.task-cond-logic').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            tempTasks[idx].conditions[ci].logic = e.target.value;
        });
    });
    // Left value inputs
    block.querySelectorAll('.task-cond-left-value').forEach(el => {
        const handler = (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            const cond = tempTasks[idx].conditions[ci];
            if (cond.leftType === 'numberEntry') {
                cond.leftIndex = parseInt(e.target.value);
            } else if (cond.leftType === 'variable') {
                cond.leftVarName = e.target.value;
            } else if (cond.leftType === 'boolean') {
                cond.leftValue = e.target.value === 'true';
            } else {
                cond.leftValue = parseFloat(e.target.value) || 0;
            }
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    });
    // Right value inputs
    block.querySelectorAll('.task-cond-right-value').forEach(el => {
        const handler = (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            const cond = tempTasks[idx].conditions[ci];
            if (cond.rightType === 'numberEntry') {
                cond.rightIndex = parseInt(e.target.value);
            } else if (cond.rightType === 'variable') {
                cond.rightVarName = e.target.value;
            } else if (cond.rightType === 'boolean') {
                cond.rightValue = e.target.value === 'true';
            } else {
                cond.rightValue = parseFloat(e.target.value) || 0;
            }
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    });
    // Add condition button
    const addCondBtn = block.querySelector('.task-cond-add');
    if (addCondBtn) {
        addCondBtn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].conditions.push({
                logic: 'and',
                leftType: 'lastRng', leftValue: '', leftIndex: null, leftVarName: '',
                operator: '==',
                rightType: 'static', rightValue: 0, rightIndex: null, rightVarName: ''
            });
            renderTaskSequence();
        });
    }
    // Remove condition buttons
    block.querySelectorAll('.task-cond-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ci = parseInt(e.target.dataset.cond);
            tempTasks[idx].conditions.splice(ci, 1);
            renderTaskSequence();
        });
    });
}

// Setup event listeners for Loop UI elements
function setupLoopListeners(block, index) {
    // Loop type selector
    const loopType = block.querySelector('.task-loop-type');
    if (loopType) {
        loopType.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].loopType = e.target.value;
            renderTaskSequence();
        });
    }
    
    // Loop static value
    const loopStaticVal = block.querySelector('.task-loop-static-value');
    if (loopStaticVal) {
        loopStaticVal.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].staticValue = parseInt(e.target.value) || 0;
        });
    }
    
    // Loop number entry select
    const loopNeSelect = block.querySelector('.task-loop-ne-select');
    if (loopNeSelect) {
        loopNeSelect.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].neIndex = parseInt(e.target.value);
        });
    }
    
    // Loop variable select
    const loopVar = block.querySelector('.task-loop-var');
    if (loopVar) {
        loopVar.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].varName = e.target.value;
        });
    }
    
    // Loop direction (until/while)
    const loopDirection = block.querySelector('.task-loop-direction');
    if (loopDirection) {
        loopDirection.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].loopDirection = e.target.value;
        });
    }
    
    // Loop operator
    const loopOperator = block.querySelector('.task-loop-operator');
    if (loopOperator) {
        loopOperator.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].loopOperator = e.target.value;
        });
    }
    
    // Loop boolean target
    const loopBoolTarget = block.querySelector('.task-loop-bool-target');
    if (loopBoolTarget) {
        loopBoolTarget.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].boolTarget = e.target.value === 'true';
        });
    }
    
    // Loop compare-to type
    const loopCompareType = block.querySelector('.task-loop-compare-type');
    if (loopCompareType) {
        loopCompareType.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].compareType = e.target.value;
            renderTaskSequence();
        });
    }
    
    // Loop compare-to value
    const loopCompareVal = block.querySelector('.task-loop-compare-value');
    if (loopCompareVal) {
        loopCompareVal.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].compareValue = parseInt(e.target.value) || 0;
        });
    }
    
    // Loop compare-to number entry
    const loopCompareNe = block.querySelector('.task-loop-compare-ne');
    if (loopCompareNe) {
        loopCompareNe.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].compareNeIndex = parseInt(e.target.value);
        });
    }
    
    // Loop compare-to variable
    const loopCompareVar = block.querySelector('.task-loop-compare-var');
    if (loopCompareVar) {
        loopCompareVar.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].compareVarName = e.target.value;
        });
    }
    
    // Loop set-value enabled checkbox (for loop-exit and loop-end)
    const loopSetEnabled = block.querySelector('.task-loop-set-enabled');
    if (loopSetEnabled) {
        loopSetEnabled.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setValueEnabled = e.target.checked;
            renderTaskSequence();
        });
    }
    
    // Loop set-type selector
    const loopSetType = block.querySelector('.task-loop-set-type');
    if (loopSetType) {
        loopSetType.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setType = e.target.value;
            renderTaskSequence();
        });
    }
    
    // Loop set target variable
    const loopSetTargetVar = block.querySelector('.task-loop-set-target-var');
    if (loopSetTargetVar) {
        loopSetTargetVar.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setTargetVarName = e.target.value;
        });
    }
    
    // Loop set static value
    const loopSetValue = block.querySelector('.task-loop-set-value');
    if (loopSetValue) {
        loopSetValue.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setValue = parseInt(e.target.value) || 0;
        });
    }
    
    // Loop set number entry
    const loopSetNe = block.querySelector('.task-loop-set-ne');
    if (loopSetNe) {
        loopSetNe.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setNeIndex = parseInt(e.target.value);
        });
    }
    
    // Loop set source variable
    const loopSetSourceVar = block.querySelector('.task-loop-set-source-var');
    if (loopSetSourceVar) {
        loopSetSourceVar.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setSourceVarName = e.target.value;
        });
    }
    
    // Loop set boolean value
    const loopSetBool = block.querySelector('.task-loop-set-bool');
    if (loopSetBool) {
        loopSetBool.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            tempTasks[idx].setBoolValue = e.target.value === 'true';
        });
    }
}

// Get value input for function inputs (A or B)
function getFuncValueInput(task, index, side) {
    const type = side === 'A' ? task.inputAType : task.inputBType;
    const val = side === 'A' ? task.inputAValue : task.inputBValue;
    const neIdx = side === 'A' ? task.inputAIndex : task.inputBIndex;
    const varName = side === 'A' ? task.inputAVarName : task.inputBVarName;
    const cls = `task-func-${side.toLowerCase()}-value`;
    
    switch (type) {
        case 'static':
            return `<input type="number" class="${cls}" data-index="${index}" value="${val || 0}">`;
        case 'lastRng':
            return `<span class="task-source-label">Last RNG result</span>`;
        case 'numberEntry':
            return `<select class="${cls}" data-index="${index}">
                <option value="">Select...</option>
                ${numberEntries.map((ne, i) => `<option value="${i}" ${neIdx === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
            </select>`;
        case 'variable':
            return `<select class="${cls}" data-index="${index}">
                <option value="">Select...</option>
                ${getVariableOptions(varName)}
            </select>`;
        default:
            return `<input type="number" class="${cls}" data-index="${index}" value="${val || 0}">`;
    }
}

// Get output select for function results
function getFuncOutputSelect(task, index) {
    if (task.outputType === 'variable') {
        return `<select class="task-func-output-var" data-index="${index}">
            <option value="">Select Variable...</option>
            ${getVariableOptions(task.outputVarName)}
        </select>`;
    } else if (task.outputType === 'numberEntry') {
        return `<select class="task-func-output-ne" data-index="${index}">
            <option value="">Select Number Entry...</option>
            ${numberEntries.map((ne, i) => `<option value="${i}" ${task.outputIndex === i ? 'selected' : ''}>${ne.name || 'Number Entry ' + (i+1)}</option>`).join('')}
        </select>`;
    }
    return '';
}

function setupTaskDragDrop() {
    // Make palette items draggable
    const templates = document.querySelectorAll('.task-block-template');
    templates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('taskType', template.dataset.type);
            e.dataTransfer.setData('isNew', 'true');
        });
    });
    
    // Make sequence droppable
    const sequence = document.getElementById('task-sequence');
    if (sequence) {
        sequence.addEventListener('dragover', (e) => {
            e.preventDefault();
            sequence.classList.add('drag-over');
        });
        
        sequence.addEventListener('dragleave', (e) => {
            sequence.classList.remove('drag-over');
        });
        
        sequence.addEventListener('drop', (e) => {
            e.preventDefault();
            sequence.classList.remove('drag-over');
            
            const isNew = e.dataTransfer.getData('isNew') === 'true';
            
            if (isNew) {
                const type = e.dataTransfer.getData('taskType');
                const newTask = createNewTaskFromType(type);
                if (newTask) {
                    tempTasks.push(newTask);
                    renderTaskSequence();
                }
            } else {
                // Reorder: existing block dropped on the sequence container (not on a block)
                const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'));
                if (!isNaN(sourceIndex) && sourceIndex >= 0 && sourceIndex < tempTasks.length) {
                    const [movedTask] = tempTasks.splice(sourceIndex, 1);
                    tempTasks.push(movedTask); // Move to end
                    renderTaskSequence();
                }
            }
        });
    }
}

// Factory function to create a new task object from a type string
function createNewTaskFromType(type) {
    switch (type) {
        case 'run-rng':
            return {
                type: 'run-rng',
                rngIndex: null,
                storeResult: true,
                targetIndex: null,
                sourceType: 'static',
                staticValue: 0,
                sourceIndex: null
            };
        case 'add':
        case 'subtract':
        case 'set':
            return {
                type: type,
                rngIndex: null,
                storeResult: true,
                targetIndex: null,
                sourceType: 'static',
                staticValue: 0,
                sourceIndex: null,
                sourceVarName: ''
            };
        case 'create-var':
            return {
                type: 'create-var',
                varName: 'myVar',
                varType: 'integer',
                varInitValue: 0
            };
        case 'set-var':
        case 'add-var':
        case 'subtract-var':
            return {
                type: type,
                varName: '',
                sourceType: 'static',
                staticValue: 0,
                sourceIndex: null,
                sourceVarName: ''
            };
        case 'if':
        case 'elseif':
            return {
                type: type,
                conditions: [{
                    leftType: 'lastRng', leftValue: '', leftIndex: null, leftVarName: '',
                    operator: '==',
                    rightType: 'static', rightValue: 0, rightIndex: null, rightVarName: ''
                }]
            };
        case 'else':
            return { type: 'else' };
        case 'endif':
            return { type: 'endif' };
        case 'loop':
            return {
                type: 'loop',
                loopType: 'static',
                loopOperator: '==',
                loopDirection: 'until',
                staticValue: 5,
                varName: '',
                boolTarget: true
            };
        case 'loop-exit':
            return {
                type: 'loop-exit',
                setValueEnabled: false,
                setType: 'static',
                setValue: 0,
                setVarName: '',
                setBoolValue: true
            };
        case 'loop-end':
            return {
                type: 'loop-end',
                setValueEnabled: false,
                setType: 'static',
                setValue: 0,
                setVarName: '',
                setBoolValue: true
            };
        case 'func-min':
        case 'func-max':
            return {
                type: type,
                inputAType: 'static', inputAValue: 0, inputAIndex: null, inputAVarName: '',
                inputBType: 'static', inputBValue: 0, inputBIndex: null, inputBVarName: '',
                outputType: 'variable', outputVarName: '', outputIndex: null
            };
        case 'func-rand':
            return {
                type: 'func-rand',
                randMin: 1,
                randMax: 100,
                storeResult: true,
                outputType: 'none',
                outputVarName: '',
                outputIndex: null
            };
        case 'func-print':
            return {
                type: 'func-print',
                printLabel: '',
                sourceType: 'lastRng',
                staticValue: 0,
                sourceIndex: null,
                sourceVarName: ''
            };
        case 'func-math':
            return {
                type: 'func-math',
                inputAType: 'static', inputAValue: 0, inputAIndex: null, inputAVarName: '',
                mathOp: 'add',
                inputBType: 'static', inputBValue: 0, inputBIndex: null, inputBVarName: '',
                outputType: 'variable', outputVarName: '', outputIndex: null
            };
        case 'func-sum':
            return {
                type: 'func-sum',
                sumValues: [
                    { type: 'static', value: 0, index: null, varName: '' },
                    { type: 'static', value: 0, index: null, varName: '' }
                ],
                outputType: 'variable', outputVarName: '', outputIndex: null
            };
        case 'func-concat':
            return {
                type: 'func-concat',
                concatValues: [
                    { type: 'static', value: '', index: null, varName: '' },
                    { type: 'static', value: '', index: null, varName: '' }
                ],
                outputVarName: ''
            };
        case 'func-round':
            return {
                type: 'func-round',
                inputAType: 'static', inputAValue: 0, inputAIndex: null, inputAVarName: '',
                roundDir: 'down',
                outputType: 'variable', outputVarName: '', outputIndex: null
            };
        case 'func-checklist':
            return {
                type: 'func-checklist',
                listBoxIndex: null,
                checkSource: 'static',
                checkText: '',
                checkVarName: '',
                outputVarName: ''
            };
        case 'func-tolower':
            return {
                type: 'func-tolower',
                outputVarName: ''
            };
        case 'func-toupper':
            return {
                type: 'func-toupper',
                outputVarName: ''
            };
        case 'list-add-item':
            return {
                type: 'list-add-item',
                listBoxIndex: null,
                nameSource: 'static',
                itemName: '',
                nameVarName: '',
                sourceType: 'static',
                staticValue: 1,
                sourceIndex: null,
                sourceVarName: ''
            };
        case 'list-add-amount':
        case 'list-remove-amount':
            return {
                type: type,
                listBoxIndex: null,
                nameSource: 'static',
                itemName: '',
                nameVarName: '',
                sourceType: 'static',
                staticValue: 1,
                sourceIndex: null,
                sourceVarName: ''
            };
        case 'list-remove-item':
            return {
                type: 'list-remove-item',
                listBoxIndex: null,
                nameSource: 'static',
                itemName: '',
                nameVarName: ''
            };
        case 'list-get-amount':
            return {
                type: 'list-get-amount',
                listBoxIndex: null,
                nameSource: 'static',
                itemName: '',
                nameVarName: '',
                nameTextboxIndex: null,
                nameLabelIndex: null,
                outputVarName: ''
            };
        case 'textfield-read':
            return {
                type: 'textfield-read',
                targetType: 'textbox',
                targetIndex: null,
                outputVarName: ''
            };
        case 'textfield-write':
            return {
                type: 'textfield-write',
                targetType: 'textbox',
                targetIndex: null,
                sourceType: 'static',
                staticText: '',
                sourceVarName: ''
            };
        default:
            return {
                type: type,
                rngIndex: null,
                storeResult: true,
                targetIndex: null,
                sourceType: 'static',
                staticValue: 0,
                sourceIndex: null
            };
    }
}

// ============== TASK EXECUTION ==============
let lastRngResult = 0;
let eventRngResults = []; // Collect all RNG results during an event
let eventPrintResults = []; // Collect print outputs during an event

function executeButtonTasks(buttonData) {
    if (!buttonData.tasks || buttonData.tasks.length === 0) {
        return;
    }
    
    lastRngResult = 0;
    eventRngResults = []; // Reset results collection
    eventPrintResults = []; // Reset print collection
    
    // Execute tasks with IF/ELSE/LOOP control flow
    let i = 0;
    while (i < buttonData.tasks.length) {
        const task = buttonData.tasks[i];
        
        if (task.type === 'if') {
            i = executeIfBlock(buttonData.tasks, i);
        } else if (task.type === 'elseif' || task.type === 'else' || task.type === 'endif') {
            // These are handled by executeIfBlock, skip if encountered at top level
            i++;
        } else if (task.type === 'loop') {
            i = executeLoopBlock(buttonData.tasks, i);
        } else if (task.type === 'loop-exit' || task.type === 'loop-end') {
            // These are handled by executeLoopBlock, skip if encountered at top level
            i++;
        } else {
            executeTask(task);
            i++;
        }
    }
    
    // Show all results
    const allResults = [];
    eventRngResults.forEach(r => allResults.push(`${r.name}: ${r.result}`));
    eventPrintResults.forEach(r => allResults.push(`${r.label ? r.label + ': ' : ''}${r.value}`));
    
    if (allResults.length > 0) {
        showAllEventResults(allResults);
    }
}

// Execute an IF block and return the index after the matching END IF
function executeIfBlock(tasks, startIndex) {
    const conditionResult = evaluateConditions(tasks[startIndex]);
    let i = startIndex + 1;
    let depth = 0;
    let executed = conditionResult;
    let shouldExecute = conditionResult;
    
    while (i < tasks.length) {
        const task = tasks[i];
        
        if (task.type === 'if') {
            if (shouldExecute) {
                // Nested IF block
                i = executeIfBlock(tasks, i);
                continue;
            } else {
                // Skip nested IF block entirely
                depth = 1;
                i++;
                while (i < tasks.length && depth > 0) {
                    if (tasks[i].type === 'if') depth++;
                    if (tasks[i].type === 'endif') depth--;
                    i++;
                }
                continue;
            }
        }
        
        if (task.type === 'loop') {
            if (shouldExecute) {
                // Nested loop block
                i = executeLoopBlock(tasks, i);
                continue;
            } else {
                // Skip nested loop block entirely
                depth = 1;
                i++;
                while (i < tasks.length && depth > 0) {
                    if (tasks[i].type === 'loop') depth++;
                    if (tasks[i].type === 'loop-end') depth--;
                    i++;
                }
                continue;
            }
        }
        
        if (task.type === 'loop-exit' || task.type === 'loop-end') {
            // These belong to an outer loop, skip them in IF context
            i++;
            continue;
        }
        
        if (task.type === 'elseif') {
            if (executed) {
                // Already executed a branch, skip the rest
                shouldExecute = false;
            } else {
                shouldExecute = evaluateConditions(task);
                if (shouldExecute) executed = true;
            }
            i++;
            continue;
        }
        
        if (task.type === 'else') {
            shouldExecute = !executed;
            i++;
            continue;
        }
        
        if (task.type === 'endif') {
            return i + 1; // Return index past END IF
        }
        
        if (shouldExecute) {
            executeTask(task);
        }
        i++;
    }
    
    return i; // Reached end without finding endif
}

// Execute a LOOP block and return the index after the matching LOOP END
function executeLoopBlock(tasks, startIndex) {
    const loopTask = tasks[startIndex];
    const MAX_LOOP_ITERATIONS = 10000; // Safety guard
    let iterationCount = 0;
    
    // Find the matching loop-end to know the block boundaries
    let loopEndIndex = findMatchingLoopEnd(tasks, startIndex);
    if (loopEndIndex === -1) {
        // No matching loop-end found, skip the loop task
        return startIndex + 1;
    }
    
    // Loop execution
    while (iterationCount < MAX_LOOP_ITERATIONS) {
        iterationCount++;
        
        // Evaluate loop condition
        const shouldContinue = evaluateLoopCondition(loopTask, iterationCount);
        if (!shouldContinue) break;
        
        // Execute tasks inside the loop
        let i = startIndex + 1;
        let exitedLoop = false;
        let endedLoop = false;
        
        while (i < loopEndIndex) {
            const task = tasks[i];
            
            if (task.type === 'if') {
                i = executeIfBlock(tasks, i);
                continue;
            } else if (task.type === 'elseif' || task.type === 'else' || task.type === 'endif') {
                i++;
                continue;
            } else if (task.type === 'loop') {
                // Nested loop
                i = executeLoopBlock(tasks, i);
                continue;
            } else if (task.type === 'loop-exit') {
                // Exit this iteration (continue to next iteration)
                applyLoopSetValue(task);
                exitedLoop = true;
                break;
            } else if (task.type === 'loop-end') {
                // This should not happen since we stop before loopEndIndex
                break;
            } else {
                executeTask(task);
                i++;
            }
        }
        
        // If we hit loop-end normally (not via loop-exit), check the loop-end task
        if (!exitedLoop && !endedLoop) {
            // Reached loop-end naturally, continue to next iteration
        }
    }
    
    // Apply loop-end set value when loop finishes
    const loopEndTask = tasks[loopEndIndex];
    if (loopEndTask) {
        applyLoopSetValue(loopEndTask);
    }
    
    return loopEndIndex + 1;
}

// Find the matching loop-end for a loop at startIndex
function findMatchingLoopEnd(tasks, startIndex) {
    let depth = 1;
    let i = startIndex + 1;
    while (i < tasks.length && depth > 0) {
        if (tasks[i].type === 'loop') depth++;
        if (tasks[i].type === 'loop-end') {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    return -1;
}

// Evaluate the loop condition to determine if the loop should continue
function evaluateLoopCondition(loopTask, iterationCount) {
    if (loopTask.loopType === 'boolean') {
        // Boolean mode: check variable against target
        const varVal = getVariableValue(loopTask.varName);
        const boolVal = (varVal === true || varVal === 'true') ? true : false;
        const target = loopTask.boolTarget;
        
        if (loopTask.loopDirection === 'until') {
            // Loop UNTIL variable equals target => continue while NOT equal
            return boolVal !== target;
        } else {
            // Loop WHILE variable equals target => continue while equal
            return boolVal === target;
        }
    } else {
        // Integer mode: get the counter value
        let counterVal = 0;
        switch (loopTask.loopType) {
            case 'static':
                counterVal = parseInt(loopTask.staticValue) || 0;
                break;
            case 'numberEntry':
                if (loopTask.neIndex !== null && loopTask.neIndex !== undefined && numberEntries[loopTask.neIndex]) {
                    counterVal = numberEntries[loopTask.neIndex].value;
                }
                break;
            case 'variable':
                counterVal = getVariableValue(loopTask.varName);
                break;
            case 'lastRng':
                counterVal = lastRngResult;
                break;
        }
        counterVal = parseInt(counterVal) || 0;
        
        // Get compare-to value
        let compareVal = 0;
        switch (loopTask.compareType || 'static') {
            case 'static':
                compareVal = parseInt(loopTask.compareValue) || 0;
                break;
            case 'numberEntry':
                if (loopTask.compareNeIndex !== null && loopTask.compareNeIndex !== undefined && numberEntries[loopTask.compareNeIndex]) {
                    compareVal = numberEntries[loopTask.compareNeIndex].value;
                }
                break;
            case 'variable':
                compareVal = getVariableValue(loopTask.compareVarName);
                break;
            case 'lastRng':
                compareVal = lastRngResult;
                break;
        }
        compareVal = parseInt(compareVal) || 0;
        
        // Evaluate comparison
        let comparisonResult = false;
        switch (loopTask.loopOperator) {
            case '==':  comparisonResult = (counterVal == compareVal); break;
            case '!=':  comparisonResult = (counterVal != compareVal); break;
            case '>':   comparisonResult = (counterVal > compareVal); break;
            case '>=':  comparisonResult = (counterVal >= compareVal); break;
            case '<':   comparisonResult = (counterVal < compareVal); break;
            case '<=':  comparisonResult = (counterVal <= compareVal); break;
            default:    comparisonResult = false;
        }
        
        if (loopTask.loopDirection === 'until') {
            // Loop UNTIL condition is true => continue while condition is NOT true
            return !comparisonResult;
        } else {
            // Loop WHILE condition is true => continue while condition IS true
            return comparisonResult;
        }
    }
}

// Apply set-value from a loop-exit or loop-end task
function applyLoopSetValue(task) {
    if (!task.setValueEnabled) return;
    
    // Get the value to set
    let value;
    switch (task.setType) {
        case 'static':
            value = parseInt(task.setValue) || 0;
            break;
        case 'lastRng':
            value = lastRngResult;
            break;
        case 'numberEntry':
            if (task.setNeIndex !== null && task.setNeIndex !== undefined && numberEntries[task.setNeIndex]) {
                value = numberEntries[task.setNeIndex].value;
            } else {
                value = 0;
            }
            break;
        case 'variable':
            value = getVariableValue(task.setSourceVarName);
            break;
        case 'boolean':
            value = task.setBoolValue;
            break;
        default:
            value = 0;
    }
    
    // Set the target variable
    if (task.setTargetVarName) {
        setVariableValue(task.setTargetVarName, value);
    }
}

// Evaluate conditions for IF/ELSEIF tasks
function evaluateConditions(task) {
    if (!task.conditions || task.conditions.length === 0) return false;
    
    let result = evaluateSingleCondition(task.conditions[0]);
    
    for (let i = 1; i < task.conditions.length; i++) {
        const cond = task.conditions[i];
        const condResult = evaluateSingleCondition(cond);
        
        if (cond.logic === 'or') {
            result = result || condResult;
        } else {
            // AND (default)
            result = result && condResult;
        }
    }
    
    return result;
}

function evaluateSingleCondition(cond) {
    const leftVal = getConditionValue(cond.leftType, cond.leftValue, cond.leftIndex, cond.leftVarName);
    const rightVal = getConditionValue(cond.rightType, cond.rightValue, cond.rightIndex, cond.rightVarName);
    
    switch (cond.operator) {
        case '>':  return leftVal > rightVal;
        case '>=': return leftVal >= rightVal;
        case '<':  return leftVal < rightVal;
        case '<=': return leftVal <= rightVal;
        case '==': return leftVal == rightVal;
        case '!=': return leftVal != rightVal;
        default:   return false;
    }
}

function getConditionValue(type, value, index, varName) {
    switch (type) {
        case 'static':
            return parseFloat(value) || 0;
        case 'lastRng':
            return lastRngResult;
        case 'numberEntry':
            if (index !== null && numberEntries[index]) {
                return numberEntries[index].value;
            }
            return 0;
        case 'variable':
            return getVariableValue(varName);
        case 'boolean':
            return (value === true || value === 'true') ? true : false;
        default:
            return parseFloat(value) || 0;
    }
}

function executeTask(task) {
    switch (task.type) {
        case 'run-rng':
            if (task.rngIndex !== null && rngList[task.rngIndex]) {
                const rng = rngList[task.rngIndex];
                // Generate a result based on RNG settings
                let result = generateRngResult(rng);
                if (task.storeResult) {
                    lastRngResult = result;
                }
                // Collect result for display at end
                eventRngResults.push({ name: rng.name || 'RNG', result: result });
            }
            break;
        case 'add':
            if (task.targetIndex !== null && numberEntries[task.targetIndex]) {
                const target = numberEntries[task.targetIndex];
                const value = getTaskSourceValue(task);
                const min = target.min !== null ? target.min : -Infinity;
                const max = target.max !== null ? target.max : Infinity;
                const newValue = Math.min(Math.max(target.value + value, min), max);
                updateNumberEntry(target, newValue);
            }
            break;
        case 'subtract':
            if (task.targetIndex !== null && numberEntries[task.targetIndex]) {
                const target = numberEntries[task.targetIndex];
                const value = getTaskSourceValue(task);
                const min = target.min !== null ? target.min : -Infinity;
                const max = target.max !== null ? target.max : Infinity;
                const newValue = Math.min(Math.max(target.value - value, min), max);
                updateNumberEntry(target, newValue);
            }
            break;
        case 'set':
            if (task.targetIndex !== null && numberEntries[task.targetIndex]) {
                const target = numberEntries[task.targetIndex];
                const value = getTaskSourceValue(task);
                const min = target.min !== null ? target.min : -Infinity;
                const max = target.max !== null ? target.max : Infinity;
                const newValue = Math.min(Math.max(value, min), max);
                updateNumberEntry(target, newValue);
            }
            break;
        // ===== VARIABLE TASKS =====
        case 'create-var':
            createOrResetVariable(task.varName, task.varType, task.varInitValue);
            break;
        case 'set-var':
            if (task.varName) {
                const val = getTaskSourceValue(task);
                setVariableValue(task.varName, val);
            }
            break;
        case 'add-var':
            if (task.varName) {
                const currentVal = getVariableValue(task.varName);
                const addVal = getTaskSourceValue(task);
                setVariableValue(task.varName, currentVal + addVal);
            }
            break;
        case 'subtract-var':
            if (task.varName) {
                const currentVal2 = getVariableValue(task.varName);
                const subVal = getTaskSourceValue(task);
                setVariableValue(task.varName, currentVal2 - subVal);
            }
            break;
        // ===== FUNCTIONS =====
        case 'func-min': {
            const a = getFuncInputValue(task, 'A');
            const b = getFuncInputValue(task, 'B');
            const result = Math.min(a, b);
            storeFuncOutput(task, result);
            break;
        }
        case 'func-max': {
            const a = getFuncInputValue(task, 'A');
            const b = getFuncInputValue(task, 'B');
            const result = Math.max(a, b);
            storeFuncOutput(task, result);
            break;
        }
        case 'func-rand': {
            const min = parseInt(task.randMin) || 1;
            const max = parseInt(task.randMax) || 100;
            const result = Math.floor(Math.random() * (max - min + 1)) + min;
            if (task.storeResult) {
                lastRngResult = result;
            }
            eventRngResults.push({ name: 'Rand', result: result });
            if (task.outputType && task.outputType !== 'none') {
                storeFuncOutput(task, result);
            }
            break;
        }
        case 'func-print': {
            const val = getTaskSourceValue(task);
            eventPrintResults.push({ label: task.printLabel || '', value: val });
            break;
        }
        // ===== NEW FUNCTIONS =====
        case 'func-math': {
            const a = getFuncInputValue(task, 'A');
            const b = getFuncInputValue(task, 'B');
            let result = 0;
            switch (task.mathOp) {
                case 'add':      result = a + b; break;
                case 'subtract': result = a - b; break;
                case 'multiply': result = a * b; break;
                case 'divide':   result = b !== 0 ? a / b : 0; break;
                case 'modulo':   result = b !== 0 ? a % b : 0; break;
                default:         result = a + b;
            }
            storeFuncOutput(task, result);
            break;
        }
        case 'func-sum': {
            let total = 0;
            if (task.sumValues) {
                task.sumValues.forEach(sv => {
                    total += getSumInputValue(sv);
                });
            }
            storeFuncOutput(task, total);
            break;
        }
        case 'func-concat': {
            let concatResult = '';
            if (task.concatValues) {
                task.concatValues.forEach(cv => {
                    concatResult += getConcatInputValue(cv);
                });
            }
            if (task.outputVarName) {
                setVariableValue(task.outputVarName, concatResult);
            }
            break;
        }
        case 'func-round': {
            const val = getFuncInputValue(task, 'A');
            const result = task.roundDir === 'up' ? Math.ceil(val) : Math.floor(val);
            storeFuncOutput(task, result);
            break;
        }
        case 'func-checklist': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                let searchName = '';
                if (task.checkSource === 'variable') {
                    searchName = String(getVariableValue(task.checkVarName));
                } else {
                    searchName = task.checkText || '';
                }
                const found = lb.items.some(item => item.name.toLowerCase() === searchName.toLowerCase());
                if (task.outputVarName) {
                    setVariableValue(task.outputVarName, found);
                }
            }
            break;
        }
        case 'func-tolower': {
            if (task.outputVarName) {
                const val = String(getVariableValue(task.outputVarName));
                setVariableValue(task.outputVarName, val.toLowerCase());
            }
            break;
        }
        case 'func-toupper': {
            if (task.outputVarName) {
                const val = String(getVariableValue(task.outputVarName));
                setVariableValue(task.outputVarName, val.toUpperCase());
            }
            break;
        }
        // ===== ITEM LIST TASKS =====
        case 'list-add-item': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                const itemName = getListItemName(task);
                if (itemName) {
                    const existing = lb.items.find(it => it.name.toLowerCase() === itemName.toLowerCase());
                    if (existing) {
                        existing.count += Math.max(1, getTaskSourceValue(task));
                    } else {
                        lb.items.push({ name: itemName, count: Math.max(1, getTaskSourceValue(task)) });
                    }
                    renderListBoxItems(lb);
                }
            }
            break;
        }
        case 'list-add-amount': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                const itemName = getListItemName(task);
                if (itemName) {
                    const existing = lb.items.find(it => it.name.toLowerCase() === itemName.toLowerCase());
                    if (existing) {
                        existing.count += getTaskSourceValue(task);
                        if (existing.count < 1) existing.count = 1;
                        renderListBoxItems(lb);
                    }
                }
            }
            break;
        }
        case 'list-remove-amount': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                const itemName = getListItemName(task);
                if (itemName) {
                    const existing = lb.items.find(it => it.name.toLowerCase() === itemName.toLowerCase());
                    if (existing) {
                        existing.count -= getTaskSourceValue(task);
                        if (existing.count < 1) existing.count = 1;
                        renderListBoxItems(lb);
                    }
                }
            }
            break;
        }
        case 'list-remove-item': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                const itemName = getListItemName(task);
                if (itemName) {
                    const idx = lb.items.findIndex(it => it.name.toLowerCase() === itemName.toLowerCase());
                    if (idx !== -1) {
                        lb.items.splice(idx, 1);
                        renderListBoxItems(lb);
                    }
                }
            }
            break;
        }
        case 'list-get-amount': {
            if (task.listBoxIndex !== null && listBoxElements[task.listBoxIndex]) {
                const lb = listBoxElements[task.listBoxIndex];
                const itemName = getGetAmountItemName(task);
                if (itemName && task.outputVarName) {
                    const existing = lb.items.find(it => it.name.toLowerCase() === itemName.toLowerCase());
                    if (existing) {
                        setVariableValue(task.outputVarName, existing.count);
                    } else {
                        setVariableValue(task.outputVarName, 0);
                    }
                } else if (task.outputVarName) {
                    setVariableValue(task.outputVarName, 0);
                }
            }
            break;
        }
        // ===== TEXTFIELD TASKS =====
        case 'textfield-read': {
            const elements = task.targetType === 'label' ? labelElements : textElements;
            if (task.targetIndex !== null && elements[task.targetIndex]) {
                const text = String(elements[task.targetIndex].text || '');
                if (task.outputVarName) {
                    setVariableValue(task.outputVarName, text);
                }
            }
            break;
        }
        case 'textfield-write': {
            const elements = task.targetType === 'label' ? labelElements : textElements;
            if (task.targetIndex !== null && elements[task.targetIndex]) {
                let newText = '';
                if (task.sourceType === 'variable' && task.sourceVarName) {
                    newText = String(getVariableValue(task.sourceVarName));
                } else {
                    newText = task.staticText || '';
                }
                const el = elements[task.targetIndex];
                el.text = newText;
                // Update the DOM element
                const handles = el.element.querySelector('.resize-handles');
                el.element.textContent = newText;
                if (handles) {
                    el.element.appendChild(handles);
                }
            }
            break;
        }
    }
}

// Get the value of a function input (A or B side)
function getFuncInputValue(task, side) {
    const type = side === 'A' ? task.inputAType : task.inputBType;
    const val = side === 'A' ? task.inputAValue : task.inputBValue;
    const neIdx = side === 'A' ? task.inputAIndex : task.inputBIndex;
    const varName = side === 'A' ? task.inputAVarName : task.inputBVarName;
    
    switch (type) {
        case 'static':
            return parseFloat(val) || 0;
        case 'lastRng':
            return lastRngResult;
        case 'numberEntry':
            if (neIdx !== null && numberEntries[neIdx]) {
                return numberEntries[neIdx].value;
            }
            return 0;
        case 'variable':
            return getVariableValue(varName);
        default:
            return parseFloat(val) || 0;
    }
}

// Store a function output in a variable or number entry
function storeFuncOutput(task, value) {
    if (task.outputType === 'variable' && task.outputVarName) {
        setVariableValue(task.outputVarName, value);
    } else if (task.outputType === 'numberEntry' && task.outputIndex !== null && numberEntries[task.outputIndex]) {
        const target = numberEntries[task.outputIndex];
        const min = target.min !== null ? target.min : -Infinity;
        const max = target.max !== null ? target.max : Infinity;
        updateNumberEntry(target, Math.min(Math.max(value, min), max));
    }
}

// Get the resolved string value of a concat input entry
function getConcatInputValue(cv) {
    switch (cv.type) {
        case 'static':      return String(cv.value || '');
        case 'lastRng':     return String(lastRngResult);
        case 'numberEntry': return (cv.index !== null && numberEntries[cv.index]) ? String(numberEntries[cv.index].value) : '';
        case 'variable':    return String(getVariableValue(cv.varName));
        case 'textbox':     return (cv.index !== null && textElements[cv.index]) ? String(textElements[cv.index].text || '') : '';
        case 'label':       return (cv.index !== null && labelElements[cv.index]) ? String(labelElements[cv.index].text || '') : '';
        default:            return String(cv.value || '');
    }
}

// Get the resolved value of a sum input entry
function getSumInputValue(sv) {
    switch (sv.type) {
        case 'static':      return parseFloat(sv.value) || 0;
        case 'lastRng':     return lastRngResult;
        case 'numberEntry': return (sv.index !== null && numberEntries[sv.index]) ? numberEntries[sv.index].value : 0;
        case 'variable':    return getVariableValue(sv.varName);
        default:            return parseFloat(sv.value) || 0;
    }
}

// Get the resolved item name for list tasks
function getListItemName(task) {
    if (task.nameSource === 'variable') {
        return String(getVariableValue(task.nameVarName) || '');
    }
    return task.itemName || '';
}

// ===== VARIABLE MANAGEMENT =====
function createOrResetVariable(name, varType, initValue) {
    if (!name) return;
    const existing = eventVariables.find(v => v.name === name);
    if (existing) {
        // Variable already exists ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â do NOT overwrite its current value.
        // Only update varType if needed, but preserve the runtime value.
        return;
    } else {
        eventVariables.push({
            id: nextVariableId++,
            name: name,
            varType: varType || 'integer',
            value: castVariableValue(initValue, varType)
        });
    }
}

function castVariableValue(value, varType) {
    switch (varType) {
        case 'integer':  return parseInt(value) || 0;
        case 'float':    return parseFloat(value) || 0;
        case 'string':   return String(value ?? '');
        case 'boolean':  return (value === true || value === 'true') ? true : false;
        default:         return value;
    }
}

function getVariableValue(name) {
    if (!name) return 0;
    const v = eventVariables.find(v => v.name === name);
    return v ? v.value : 0;
}

function setVariableValue(name, value) {
    const v = eventVariables.find(v => v.name === name);
    if (v) {
        v.value = castVariableValue(value, v.varType);
    }
}

function getTaskSourceValue(task) {
    switch (task.sourceType) {
        case 'static':
            return task.staticValue || 0;
        case 'lastRng':
            return lastRngResult;
        case 'numberEntry':
            if (task.sourceIndex !== null && numberEntries[task.sourceIndex]) {
                return numberEntries[task.sourceIndex].value;
            }
            return 0;
        case 'variable':
            return getVariableValue(task.sourceVarName);
        case 'boolean':
            return (task.staticValue === true || task.staticValue === 'true') ? true : false;
        default:
            return task.staticValue || 0;
    }
}

function generateRngResult(rng) {
    // Use the RNG min/max values
    const min = parseInt(rng.min) || 1;
    const max = parseInt(rng.max) || 100;
    
    // Generate random number between min and max (inclusive)
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showAllEventResults(results) {
    const notification = document.createElement('div');
    notification.className = 'rng-result-notification';
    
    let content = results.join('<br>');
    notification.innerHTML = content;
    
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        color: #4fc3f7;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        text-align: center;
        animation: fadeOutResults 2.5s forwards;
    `;
    
    // Add animation style if not exists
    if (!document.getElementById('rng-notification-style')) {
        const style = document.createElement('style');
        style.id = 'rng-notification-style';
        style.textContent = `
            @keyframes fadeOutResults {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
}

function showRngResultNotification(name, result) {
    const notification = document.createElement('div');
    notification.className = 'rng-result-notification';
    notification.textContent = `${name}: ${result}`;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: #4fc3f7;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        animation: fadeOut 1.5s forwards;
    `;
    
    // Add animation style if not exists
    if (!document.getElementById('rng-notification-style')) {
        const style = document.createElement('style');
        style.id = 'rng-notification-style';
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                70% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
}

function updateNumberEntry(entry, newValue) {
    entry.value = newValue;
    // Update the input element directly using stored reference
    if (entry.input) {
        entry.input.value = newValue;
    }
    // Highlight the changed entry
    entry.element.style.transition = 'box-shadow 0.3s';
    entry.element.style.boxShadow = '0 0 10px 3px #4fc3f7';
    setTimeout(() => {
        entry.element.style.boxShadow = '';
    }, 500);
}

// Save/Load functionality
document.getElementById('save-map').addEventListener('click', () => {
    const drawingData = drawingCanvas.toDataURL();
    
    const data = {
        version: 2,
        type: 'dashboard',
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        bgColor: bgColor,
        bgImageData: bgImageData,
        drawing: drawingData,
        textElements: textElements.map(t => ({
            name: t.name || null,
            text: t.text,
            x: t.x,
            y: t.y,
            fontSize: t.fontSize,
            color: t.color,
            width: t.width || 100,
            height: t.height || 30,
            resizeEnabled: t.resizeEnabled !== false,
            locked: t.locked || false
        })),
        iconLibrary: iconLibrary,
        mapIcons: mapIcons.map(icon => ({
            iconIndex: icon.iconIndex,
            x: icon.x,
            y: icon.y,
            width: icon.width,
            height: icon.height,
            rotation: icon.rotation || 0,
            locked: icon.locked || false
        })),
        rngList: rngList.map(rng => ({
            id: rng.id,
            name: rng.name,
            min: rng.min,
            max: rng.max,
            result: rng.result,
            linkedRngs: rng.linkedRngs
        })),
        frameElements: frameElements.map(f => ({
            title: f.title,
            titleSize: f.titleSize,
            titlePlacement: f.titlePlacement,
            titleColor: f.titleColor,
            borderThickness: f.borderThickness,
            borderColor: f.borderColor,
            bgColor: f.bgColor,
            bgOpacity: f.bgOpacity,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            locked: f.locked
        })),
        numberEntries: numberEntries.map(n => ({
            name: n.name || null,
            value: n.value,
            min: n.min,
            max: n.max,
            fontSize: n.fontSize,
            textColor: n.textColor,
            bgColor: n.bgColor,
            bold: n.bold,
            italic: n.italic,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            locked: n.locked || false
        })),
        labelElements: labelElements.map(l => ({
            name: l.name || null,
            text: l.text,
            fontSize: l.fontSize,
            color: l.color,
            letterSpacing: l.letterSpacing,
            bold: l.bold,
            italic: l.italic,
            underline: l.underline,
            x: l.x,
            y: l.y,
            locked: l.locked || false
        })),
        buttonElements: buttonElements.map(b => ({
            id: b.id,
            text: b.text,
            fontSize: b.fontSize,
            textColor: b.textColor,
            bgColor: b.bgColor,
            bold: b.bold,
            italic: b.italic,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            locked: b.locked || false,
            tasks: b.tasks || []
        })),
        listBoxElements: listBoxElements.map(lb => ({
            id: lb.id,
            title: lb.title,
            titleSize: lb.titleSize,
            titleColor: lb.titleColor,
            fontSize: lb.fontSize,
            textColor: lb.textColor,
            bgColor: lb.bgColor,
            buttonColor: lb.buttonColor,
            borderSize: lb.borderSize,
            borderColor: lb.borderColor,
            bold: lb.bold,
            italic: lb.italic,
            x: lb.x,
            y: lb.y,
            width: lb.width,
            height: lb.height,
            locked: lb.locked || false,
            items: lb.items || []
        })),
        eventVariables: eventVariables.map(v => ({
            id: v.id,
            name: v.name,
            varType: v.varType,
            value: v.value
        })),
        checkboxElements: checkboxElements.map(cb => ({
            name: cb.name || null,
            label: cb.label,
            checked: cb.checked,
            fontSize: cb.fontSize,
            textColor: cb.textColor,
            boxSize: cb.boxSize,
            checkColor: cb.checkColor,
            x: cb.x,
            y: cb.y,
            locked: cb.locked || false
        }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    clearUnsaved();
});

document.getElementById('import-map').addEventListener('click', () => {
    document.getElementById('import-map-file').click();
});

document.getElementById('import-map-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!confirm('Loading a file will replace all current content. Continue?')) {
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (!data.type || (data.type !== 'dashboard' && data.type !== 'character-sheet')) {
                alert('Invalid dashboard file format.');
                return;
            }
            
            // Clear existing content
            textElements.forEach(t => t.element.remove());
            textElements = [];
            mapIcons.forEach(icon => icon.element.remove());
            mapIcons = [];
            frameElements.forEach(f => f.element.remove());
            frameElements = [];
            numberEntries.forEach(n => n.element.remove());
            numberEntries = [];
            labelElements.forEach(l => l.element.remove());
            labelElements = [];
            buttonElements.forEach(b => b.element.remove());
            buttonElements = [];
            nextButtonId = 1;
            listBoxElements.forEach(lb => lb.element.remove());
            listBoxElements = [];
            nextListBoxId = 1;
            checkboxElements.forEach(cb => cb.element.remove());
            checkboxElements = [];
            eventVariables = [];
            nextVariableId = 1;
            if (drawingCtx) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            }
            
            // Load data
            canvasWidth = data.canvasWidth || 2000;
            canvasHeight = data.canvasHeight || 2000;
            document.getElementById('canvas-width').value = canvasWidth;
            document.getElementById('canvas-height').value = canvasHeight;
            
            bgColor = data.bgColor || '#ffffff';
            document.getElementById('bg-color').value = bgColor;
            document.getElementById('bg-color-text').value = bgColor;
            renderer.setClearColor(bgColor);
            
            bgImageData = data.bgImageData || null;
            if (bgImageData) {
                let bgImageElement = document.getElementById('bg-image-element');
                if (!bgImageElement) {
                    bgImageElement = document.createElement('img');
                    bgImageElement.id = 'bg-image-element';
                    bgImageElement.style.position = 'fixed';
                    bgImageElement.style.top = '0';
                    bgImageElement.style.left = '0';
                    bgImageElement.style.width = '100%';
                    bgImageElement.style.height = '100%';
                    bgImageElement.style.objectFit = 'contain';
                    bgImageElement.style.zIndex = '-1';
                    document.body.insertBefore(bgImageElement, document.body.firstChild);
                }
                bgImageElement.src = bgImageData;
                bgImageElement.style.display = 'block';
                renderer.setClearColor(0x000000, 0);
            }
            
            // Load drawing
            if (data.drawing) {
                const img = new Image();
                img.onload = () => {
                    drawingCtx.drawImage(img, 0, 0);
                };
                img.src = data.drawing;
            }
            
            // Load text elements
            if (data.textElements) {
                data.textElements.forEach(t => {
                    const textEl = document.createElement('div');
                    textEl.className = 'text-input';
                    textEl.style.position = 'absolute';
                    textEl.style.left = t.x + 'px';
                    textEl.style.top = t.y + 'px';
                    textEl.style.fontSize = t.fontSize + 'px';
                    textEl.style.color = t.color;
                    textEl.style.padding = '5px';
                    textEl.style.cursor = 'move';
                    textEl.style.zIndex = '1001';
                    textEl.style.whiteSpace = 'pre-wrap';
                    textEl.textContent = t.text;
                    
                    if (t.width) textEl.style.width = t.width + 'px';
                    if (t.height) textEl.style.height = t.height + 'px';
                    
                    if (textFrameEnabled) {
                        textEl.style.border = '1px solid #ccc';
                        textEl.style.background = 'white';
                        textEl.setAttribute('contenteditable', 'true');
                        textEl.style.minWidth = '100px';
                        textEl.style.minHeight = '30px';
                    } else {
                        textEl.style.border = 'none';
                        textEl.style.background = 'transparent';
                        textEl.setAttribute('contenteditable', 'false');
                    }
                    
                    // Add resize handles
                    const handles = document.createElement('div');
                    handles.className = 'resize-handles';
                    handles.style.display = textFrameEnabled ? 'block' : 'none';
                    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = 'resize-handle ' + pos;
                        handles.appendChild(handle);
                    });
                    textEl.appendChild(handles);
                    
                    document.body.appendChild(textEl);
                    
                    const textData = {
                        element: textEl,
                        name: t.name || null,
                        text: t.text,
                        x: t.x,
                        y: t.y,
                        fontSize: t.fontSize,
                        color: t.color,
                        width: t.width || 100,
                        height: t.height || 30,
                        resizeEnabled: t.resizeEnabled !== false,
                        locked: t.locked || false
                    };
                    
                    if (textData.locked) {
                        textEl.classList.add('locked');
                        textEl.setAttribute('contenteditable', 'false');
                    }
                    
                    textElements.push(textData);
                    
                    makeTextDraggable(textEl, textData);
                    makeTextResizable(textEl, textData);
                    makeTextEditable(textEl, textData);
                    
                    // Update text content on input
                    textEl.addEventListener('input', () => {
                        textData.text = textEl.textContent;
                    });
                });
            }
            
            // Load icon library
            if (data.iconLibrary) {
                iconLibrary = data.iconLibrary;
                renderIconLibrary();
            }
            
            // Load map icons
            if (data.mapIcons) {
                data.mapIcons.forEach(iconData => {
                    const icon = iconLibrary[iconData.iconIndex];
                    if (!icon) return;
                    
                    const iconEl = document.createElement('div');
                    iconEl.className = 'map-icon';
                    if (iconData.locked) iconEl.classList.add('locked');
                    iconEl.style.left = iconData.x + 'px';
                    iconEl.style.top = iconData.y + 'px';
                    iconEl.style.width = iconData.width + 'px';
                    iconEl.style.height = iconData.height + 'px';
                    
                    const img = document.createElement('img');
                    img.src = icon.data;
                    // Apply rotation if saved
                    if (iconData.rotation) {
                        img.style.transform = `rotate(${iconData.rotation}deg)`;
                    }
                    iconEl.appendChild(img);
                    
                    const handles = document.createElement('div');
                    handles.className = 'resize-handles';
                    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = 'resize-handle ' + pos;
                        handles.appendChild(handle);
                    });
                    iconEl.appendChild(handles);
                    
                    document.body.appendChild(iconEl);
                    
                    const mapIcon = {
                        element: iconEl,
                        iconIndex: iconData.iconIndex,
                        x: iconData.x,
                        y: iconData.y,
                        width: iconData.width,
                        height: iconData.height,
                        rotation: iconData.rotation || 0,
                        locked: iconData.locked || false
                    };
                    
                    mapIcons.push(mapIcon);
                    
                    makeIconDraggable(iconEl, mapIcon);
                    makeIconResizable(iconEl, mapIcon);
                    
                    iconEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        showIconContextMenu(e, mapIcon);
                    });
                    
                    iconEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setActiveMapIcon(mapIcon);
                    });
                });
            }
            
            // Load RNG data
            if (data.rngList) {
                rngList = data.rngList.map(rng => ({
                    id: rng.id,
                    name: rng.name,
                    min: rng.min,
                    max: rng.max,
                    result: rng.result,
                    linkedRngs: rng.linkedRngs || []
                }));
                nextRngId = Math.max(...rngList.map(r => r.id), 0) + 1;
            }
            
            renderRNG();
            
            // Load frame elements
            if (data.frameElements) {
                data.frameElements.forEach(f => {
                    const frameEl = document.createElement('div');
                    frameEl.className = 'sheet-frame';
                    if (f.locked) frameEl.classList.add('locked');
                    frameEl.style.left = f.x + 'px';
                    frameEl.style.top = f.y + 'px';
                    frameEl.style.width = f.width + 'px';
                    frameEl.style.height = f.height + 'px';
                    frameEl.style.border = `${f.borderThickness}px solid ${f.borderColor}`;
                    
                    const r = parseInt(f.bgColor.slice(1, 3), 16);
                    const g = parseInt(f.bgColor.slice(3, 5), 16);
                    const b = parseInt(f.bgColor.slice(5, 7), 16);
                    frameEl.style.background = `rgba(${r}, ${g}, ${b}, ${f.bgOpacity / 100})`;
                    
                    const titleEl = document.createElement('div');
                    titleEl.className = 'frame-title ' + f.titlePlacement;
                    titleEl.textContent = f.title;
                    titleEl.style.fontSize = f.titleSize + 'px';
                    titleEl.style.color = f.titleColor || f.borderColor;
                    frameEl.appendChild(titleEl);
                    
                    const handles = document.createElement('div');
                    handles.className = 'resize-handles';
                    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = 'resize-handle ' + pos;
                        handles.appendChild(handle);
                    });
                    frameEl.appendChild(handles);
                    
                    document.body.appendChild(frameEl);
                    
                    const frameData = {
                        element: frameEl,
                        title: f.title,
                        titleSize: f.titleSize,
                        titlePlacement: f.titlePlacement,
                        titleColor: f.titleColor || f.borderColor,
                        borderThickness: f.borderThickness,
                        borderColor: f.borderColor,
                        bgColor: f.bgColor,
                        bgOpacity: f.bgOpacity,
                        x: f.x,
                        y: f.y,
                        width: f.width,
                        height: f.height,
                        locked: f.locked
                    };
                    
                    frameElements.push(frameData);
                    
                    makeFrameDraggable(frameEl, frameData);
                    makeFrameResizable(frameEl, frameData);
                    
                    frameEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showFrameContextMenu(e, frameData);
                    });
                    
                    frameEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setActiveFrame(frameData);
                    });
                });
            }
            
            // Load number entries
            if (data.numberEntries) {
                data.numberEntries.forEach(n => {
                    const entryEl = document.createElement('div');
                    entryEl.className = 'number-entry';
                    entryEl.style.left = n.x + 'px';
                    entryEl.style.top = n.y + 'px';
                    entryEl.style.width = n.width + 'px';
                    entryEl.style.height = n.height + 'px';
                    if (n.bgColor) entryEl.style.backgroundColor = n.bgColor;
                    
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.value = n.value;
                    input.style.fontSize = n.fontSize + 'px';
                    if (n.textColor) input.style.color = n.textColor;
                    input.style.backgroundColor = 'transparent';
                    if (n.bold) input.style.fontWeight = 'bold';
                    if (n.italic) input.style.fontStyle = 'italic';
                    if (n.min !== null) input.min = n.min;
                    if (n.max !== null) input.max = n.max;
                    entryEl.appendChild(input);
                    
                    const handles = document.createElement('div');
                    handles.className = 'resize-handles';
                    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = 'resize-handle ' + pos;
                        handles.appendChild(handle);
                    });
                    entryEl.appendChild(handles);
                    
                    document.body.appendChild(entryEl);
                    
                    if (n.locked) entryEl.classList.add('locked');
                    
                    const entryData = {
                        element: entryEl,
                        input: input,
                        name: n.name || null,
                        value: n.value,
                        min: n.min,
                        max: n.max,
                        fontSize: n.fontSize,
                        textColor: n.textColor || '#000000',
                        bgColor: n.bgColor || '#ffffff',
                        bold: n.bold || false,
                        italic: n.italic || false,
                        x: n.x,
                        y: n.y,
                        width: n.width,
                        height: n.height,
                        locked: n.locked || false
                    };
                    
                    numberEntries.push(entryData);
                    
                    input.addEventListener('change', () => {
                        entryData.value = parseFloat(input.value) || 0;
                    });
                    
                    input.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                    });
                    
                    makeNumberEntryDraggable(entryEl, entryData);
                    makeNumberEntryResizable(entryEl, entryData);
                    
                    entryEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showNumberEntryContextMenu(e, entryData);
                    });
                    
                    entryEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setActiveNumberEntry(entryData);
                    });
                });
            }
            
            // Load label elements
            if (data.labelElements) {
                data.labelElements.forEach(l => {
                    const labelEl = document.createElement('div');
                    labelEl.className = 'sheet-label';
                    labelEl.style.left = l.x + 'px';
                    labelEl.style.top = l.y + 'px';
                    labelEl.style.fontSize = l.fontSize + 'px';
                    labelEl.style.color = l.color;
                    labelEl.style.letterSpacing = l.letterSpacing + 'px';
                    if (l.bold) labelEl.style.fontWeight = 'bold';
                    if (l.italic) labelEl.style.fontStyle = 'italic';
                    if (l.underline) labelEl.style.textDecoration = 'underline';
                    labelEl.textContent = l.text;
                    
                    const handles = document.createElement('div');
                    handles.className = 'resize-handles';
                    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = 'resize-handle ' + pos;
                        handles.appendChild(handle);
                    });
                    labelEl.appendChild(handles);
                    
                    document.body.appendChild(labelEl);
                    
                    if (l.locked) labelEl.classList.add('locked');
                    
                    const labelData = {
                        element: labelEl,
                        name: l.name || null,
                        text: l.text,
                        fontSize: l.fontSize,
                        color: l.color,
                        letterSpacing: l.letterSpacing,
                        bold: l.bold,
                        italic: l.italic,
                        underline: l.underline,
                        x: l.x,
                        y: l.y,
                        locked: l.locked || false
                    };
                    
                    labelElements.push(labelData);
                    
                    makeLabelDraggable(labelEl, labelData);
                    
                    labelEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showLabelContextMenu(e, labelData);
                    });
                    
                    labelEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setActiveLabel(labelData);
                    });
                });
            }
            
            // Load button elements
            if (data.buttonElements) {
                data.buttonElements.forEach(b => {
                    const buttonData = {
                        id: b.id,
                        text: b.text,
                        fontSize: b.fontSize,
                        textColor: b.textColor,
                        bgColor: b.bgColor,
                        bold: b.bold,
                        italic: b.italic,
                        x: b.x,
                        y: b.y,
                        width: b.width,
                        height: b.height,
                        locked: b.locked || false,
                        tasks: b.tasks || []
                    };
                    
                    createButtonElement(buttonData);
                    buttonElements.push(buttonData);
                });
            }
            
            // Load list box elements
            if (data.listBoxElements) {
                data.listBoxElements.forEach(lb => {
                    const listBoxData = {
                        id: lb.id,
                        title: lb.title,
                        titleSize: lb.titleSize,
                        titleColor: lb.titleColor,
                        fontSize: lb.fontSize,
                        textColor: lb.textColor,
                        bgColor: lb.bgColor,
                        buttonColor: lb.buttonColor,
                        borderSize: lb.borderSize,
                        borderColor: lb.borderColor,
                        bold: lb.bold,
                        italic: lb.italic,
                        x: lb.x,
                        y: lb.y,
                        width: lb.width,
                        height: lb.height,
                        locked: lb.locked || false,
                        items: lb.items || []
                    };
                    
                    createListBoxElement(listBoxData);
                    listBoxElements.push(listBoxData);
                    if (listBoxData.id >= nextListBoxId) {
                        nextListBoxId = listBoxData.id + 1;
                    }
                });
            }
            
            // Load event variables
            if (data.eventVariables) {
                eventVariables = data.eventVariables.map(v => ({
                    id: v.id,
                    name: v.name,
                    varType: v.varType || 'integer',
                    value: v.value
                }));
                nextVariableId = Math.max(...eventVariables.map(v => v.id), 0) + 1;
            }
            
            // Load checkbox elements
            if (data.checkboxElements) {
                data.checkboxElements.forEach(cb => {
                    placeCheckbox(cb.x, cb.y, {
                        name: cb.name,
                        label: cb.label,
                        checked: cb.checked,
                        fontSize: cb.fontSize,
                        textColor: cb.textColor,
                        boxSize: cb.boxSize,
                        checkColor: cb.checkColor,
                        locked: cb.locked
                    });
                });
            }
            
            // Check if any elements exceed the current viewport and enable scrollbars if needed
            applyCanvasSize();
            adjustOverflowForImport();
            
            alert('Dashboard loaded successfully!');
            clearUnsaved();
        } catch (err) {
            alert('Error loading dashboard: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// Check if imported content exceeds the current viewport and enable scrollbars
function adjustOverflowForImport() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let maxRight = canvasWidth;
    let maxBottom = canvasHeight;
    
    // Collect max extents from all positioned element arrays
    const allElements = [
        ...textElements,
        ...mapIcons,
        ...frameElements,
        ...numberEntries,
        ...labelElements,
        ...buttonElements,
        ...listBoxElements
    ];
    
    allElements.forEach(el => {
        const right = (el.x || 0) + (el.width || 120);
        const bottom = (el.y || 0) + (el.height || 40);
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    
    // If any content extends beyond the viewport, enable scrolling
    if (maxRight > vw || maxBottom > vh) {
        document.body.style.overflow = 'auto';
        let spacer = document.getElementById('import-spacer');
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.id = 'import-spacer';
            spacer.style.position = 'absolute';
            spacer.style.pointerEvents = 'none';
            spacer.style.zIndex = '-1';
            document.body.appendChild(spacer);
        }
        spacer.style.left = '0px';
        spacer.style.top = '0px';
        spacer.style.width = Math.max(maxRight + 40, vw) + 'px';
        spacer.style.height = Math.max(maxBottom + 40, vh) + 'px';
        
        // Resize the drawing and grid canvases to cover the full scrollable area
        const fullW = Math.max(maxRight + 40, vw);
        const fullH = Math.max(maxBottom + 40, vh);
        if (drawingCanvas) {
            drawingCanvas.width = fullW;
            drawingCanvas.height = fullH;
            drawingCanvas.style.width = fullW + 'px';
            drawingCanvas.style.height = fullH + 'px';
        }
        if (gridCanvas) {
            gridCanvas.width = fullW;
            gridCanvas.height = fullH;
            gridCanvas.style.width = fullW + 'px';
            gridCanvas.style.height = fullH + 'px';
        }
    } else {
        // Content fits ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keep overflow hidden
        document.body.style.overflow = 'hidden';
        const spacer = document.getElementById('import-spacer');
        if (spacer) spacer.remove();
    }
}

// Re-check overflow on window resize (user might resize to accommodate)
window.addEventListener('resize', () => {
    adjustOverflowForImport();
});

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();
