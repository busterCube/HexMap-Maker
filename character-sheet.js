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
let textFrameEnabled = false;
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

// Clipboard for copy/paste
let clipboard = null; // {type: 'frame'|'text'|'numberEntry'|'label', data: {...}}

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
    canvasWidth = parseInt(document.getElementById('canvas-width').value);
    canvasHeight = parseInt(document.getElementById('canvas-height').value);
});

document.getElementById('reset-view').addEventListener('click', () => {
    cameraOffsetX = 0;
    cameraOffsetY = 0;
    updateCamera();
});

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

document.getElementById('text-frame-enabled').addEventListener('change', (e) => {
    textFrameEnabled = e.target.checked;
    // Update all existing text elements
    textElements.forEach(textEl => {
        if (textFrameEnabled) {
            const alpha = textFrameOpacity / 100;
            textEl.element.style.border = '1px solid #ccc';
            textEl.element.style.background = `rgba(255, 255, 255, ${alpha})`;
            textEl.element.setAttribute('contenteditable', 'true');
            textEl.element.style.minWidth = '100px';
            textEl.element.style.minHeight = '30px';
            // Show resize handles if enabled for this text box
            const handles = textEl.element.querySelector('.resize-handles');
            if (handles && textEl.resizeEnabled !== false) handles.style.display = 'block';
        } else {
            textEl.element.style.border = 'none';
            textEl.element.style.background = 'transparent';
            textEl.element.setAttribute('contenteditable', 'false');
            // Hide resize handles
            const handles = textEl.element.querySelector('.resize-handles');
            if (handles) handles.style.display = 'none';
        }
    });
});

document.getElementById('toggle-drawing').addEventListener('click', () => {
    isDrawing = !isDrawing;
    if (isDrawing) {
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-drawing').textContent = isDrawing ? 'Disable Drawing' : 'Enable Drawing';
});

document.getElementById('toggle-eraser').addEventListener('click', () => {
    isErasing = !isErasing;
    if (isErasing) {
        isDrawing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-eraser').textContent = isErasing ? 'Disable Eraser' : 'Enable Eraser';
});

document.getElementById('clear-all-drawing').addEventListener('click', () => {
    if (drawingCanvas && drawingCtx) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
});

document.getElementById('toggle-text').addEventListener('click', () => {
    isTextMode = !isTextMode;
    if (isTextMode) {
        isDrawing = false;
        isErasing = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-text').textContent = isTextMode ? 'Disable Text Tool' : 'Enable Text Tool';
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
    isFrameMode = !isFrameMode;
    if (isFrameMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-frame-tool').textContent = isFrameMode ? 'Disable Frame Tool' : 'Enable Frame Tool';
});

// Number Entry Tool controls
document.getElementById('toggle-number-entry-tool').addEventListener('click', () => {
    isNumberEntryMode = !isNumberEntryMode;
    if (isNumberEntryMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-number-entry-tool').textContent = isNumberEntryMode ? 'Disable Number Entry Tool' : 'Enable Number Entry Tool';
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
    isLabelMode = !isLabelMode;
    if (isLabelMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isIconMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-label-tool').textContent = isLabelMode ? 'Disable Label Tool' : 'Enable Label Tool';
});

// Icon tool toggle
document.getElementById('toggle-icon-tool').addEventListener('click', () => {
    isIconMode = !isIconMode;
    if (isIconMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isButtonMode = false;
        isListBoxMode = false;
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    } else {
        selectedIconIndex = -1;
        renderIconLibrary();
    }
    document.getElementById('toggle-icon-tool').textContent = isIconMode ? 'Disable Image Placement' : 'Enable Image Placement';
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
    isButtonMode = !isButtonMode;
    if (isButtonMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isListBoxMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-listbox-tool').textContent = 'Enable List Box Tool';
    }
    document.getElementById('toggle-button-tool').textContent = isButtonMode ? 'Disable Button Tool' : 'Enable Button Tool';
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
    isListBoxMode = !isListBoxMode;
    if (isListBoxMode) {
        isDrawing = false;
        isErasing = false;
        isTextMode = false;
        isFrameMode = false;
        isNumberEntryMode = false;
        isLabelMode = false;
        isIconMode = false;
        isButtonMode = false;
        selectedIconIndex = -1;
        renderIconLibrary();
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
        document.getElementById('toggle-frame-tool').textContent = 'Enable Frame Tool';
        document.getElementById('toggle-number-entry-tool').textContent = 'Enable Number Entry Tool';
        document.getElementById('toggle-label-tool').textContent = 'Enable Label Tool';
        document.getElementById('toggle-icon-tool').textContent = 'Enable Image Placement';
        document.getElementById('toggle-button-tool').textContent = 'Enable Button Tool';
    }
    document.getElementById('toggle-listbox-tool').textContent = isListBoxMode ? 'Disable List Box Tool' : 'Enable List Box Tool';
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
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;
    gridCanvas.width = window.innerWidth;
    gridCanvas.height = window.innerHeight;
    drawGrid();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCamera();
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
        deleteBtn.textContent = '×';
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
        deleteBtn.textContent = '×';
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
            
            drawingCtx.strokeStyle = isErasing ? bgColor : color;
            drawingCtx.lineWidth = isErasing ? thickness * 2 : thickness;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            
            const p1 = drawingPoints[drawingPoints.length - 2];
            const p2 = drawingPoints[drawingPoints.length - 1];
            
            drawingCtx.beginPath();
            drawingCtx.moveTo(p1[0], p1[1]);
            drawingCtx.lineTo(p2[0], p2[1]);
            drawingCtx.stroke();
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
    isPanning = false;
    
    if (isDrawing || isErasing) {
        drawingPoints = [];
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Zoom not implemented for character sheet
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (clipboard) {
        lastContextMenuPosition = { x: e.clientX, y: e.clientY };
        canvasContextMenu.style.left = e.clientX + 'px';
        canvasContextMenu.style.top = e.clientY + 'px';
        canvasContextMenu.classList.add('visible');
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeIconResizable(element, mapIcon) {
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
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
    const color = document.getElementById('text-color').value;
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeFrameResizable(element, frameData) {
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    });
}

function showFrameContextMenu(e, frameData) {
    currentFrameData = frameData;
    frameContextMenu.style.left = e.clientX + 'px';
    frameContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-frame-lock').textContent = frameData.locked ? 'Unlock Frame' : 'Lock Frame';
    
    frameContextMenu.classList.add('visible');
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeNumberEntryResizable(element, entryData) {
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    });
}

function showNumberEntryContextMenu(e, entryData) {
    currentNumberEntryData = entryData;
    numberEntryContextMenu.style.left = e.clientX + 'px';
    numberEntryContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-number-entry-lock').textContent = entryData.locked ? 'Unlock' : 'Lock';
    
    numberEntryContextMenu.classList.add('visible');
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function showLabelContextMenu(e, labelData) {
    currentLabelData = labelData;
    labelContextMenu.style.left = e.clientX + 'px';
    labelContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-label-lock').textContent = labelData.locked ? 'Unlock' : 'Lock';
    
    labelContextMenu.classList.add('visible');
}

function makeTextDraggable(element, textData) {
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeTextResizable(element, textData) {
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    });
}

function makeTextEditable(element, textData) {
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showTextContextMenu(e, textData);
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
    textContextMenu.style.left = e.clientX + 'px';
    textContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-text-lock').textContent = textData.locked ? 'Unlock' : 'Lock';
    
    textContextMenu.classList.add('visible');
}

function showIconContextMenu(e, mapIcon) {
    currentIconData = mapIcon;
    iconContextMenu.style.left = e.clientX + 'px';
    iconContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-icon-lock').textContent = mapIcon.locked ? 'Unlock Image' : 'Lock Image';
    
    iconContextMenu.classList.add('visible');
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
});

document.getElementById('edit-text').addEventListener('click', () => {
    if (currentTextData) {
        const newText = prompt('Edit text:', currentTextData.text);
        if (newText !== null) {
            currentTextData.text = newText;
            currentTextData.element.textContent = newText;
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('toggle-text-lock').addEventListener('click', () => {
    if (currentTextData) {
        currentTextData.locked = !currentTextData.locked;
        if (currentTextData.locked) {
            currentTextData.element.classList.add('locked');
            currentTextData.element.setAttribute('contenteditable', 'false');
        } else {
            currentTextData.element.classList.remove('locked');
            if (textFrameEnabled) {
                currentTextData.element.setAttribute('contenteditable', 'true');
            }
        }
    }
    textContextMenu.classList.remove('visible');
});

document.getElementById('delete-text').addEventListener('click', () => {
    if (currentTextData) {
        const index = textElements.indexOf(currentTextData);
        if (index !== -1) {
            textElements.splice(index, 1);
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
        }
    }
    numberEntryContextMenu.classList.remove('visible');
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
    
    // Click to execute tasks (only when not in edit mode)
    buttonEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isButtonMode) {
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
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        if (buttonData.locked) return;
        if (!isButtonMode) return; // Only drag in button edit mode
        
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeButtonResizable(element, buttonData) {
    const handles = element.querySelector('.resize-handles');
    if (!handles) return;
    
    Array.from(handles.children).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (buttonData.locked) return;
            if (!isButtonMode) return;
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    });
}

function showButtonContextMenu(e, buttonData) {
    currentButtonData = buttonData;
    buttonContextMenu.style.left = e.clientX + 'px';
    buttonContextMenu.style.top = e.clientY + 'px';
    
    // Update lock menu item text
    document.getElementById('toggle-button-lock').textContent = buttonData.locked ? 'Unlock' : 'Lock';
    
    buttonContextMenu.classList.add('visible');
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
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        if (e.target.classList.contains('list-box-item') || e.target.closest('.list-box-item')) return;
        if (e.button !== 0) return;
        if (listBoxData.locked) return;
        if (!isListBoxMode) return;
        
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function makeListBoxResizable(element, listBoxData) {
    const handles = element.querySelector('.resize-handles');
    if (!handles) return;
    
    Array.from(handles.children).forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        const direction = handle.className.split(' ')[1];
        
        handle.addEventListener('mousedown', (e) => {
            if (listBoxData.locked) return;
            if (!isListBoxMode) return;
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
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    });
}

function showListBoxContextMenu(e, listBoxData) {
    currentListBoxData = listBoxData;
    listboxContextMenu.style.left = e.clientX + 'px';
    listboxContextMenu.style.top = e.clientY + 'px';
    
    document.getElementById('toggle-listbox-lock').textContent = listBoxData.locked ? 'Unlock' : 'Lock';
    
    listboxContextMenu.classList.add('visible');
}

function showListBoxItemContextMenu(e) {
    listboxItemContextMenu.style.left = e.clientX + 'px';
    listboxItemContextMenu.style.top = e.clientY + 'px';
    listboxItemContextMenu.classList.add('visible');
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
        <div class="task-block-template" data-type="run-rng" draggable="true">
            <span class="task-icon">🎲</span> Run RNG
        </div>
        <div class="task-block-template" data-type="add" draggable="true">
            <span class="task-icon">➕</span> Add to Number
        </div>
        <div class="task-block-template" data-type="subtract" draggable="true">
            <span class="task-icon">➖</span> Subtract from Number
        </div>
        <div class="task-block-template" data-type="set" draggable="true">
            <span class="task-icon">✏️</span> Set Number
        </div>
    `;
    content.appendChild(palette);
    
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
}

function createTaskBlock(task, index) {
    const block = document.createElement('div');
    block.className = 'task-block ' + task.type;
    block.dataset.index = index;
    block.draggable = true;
    
    let blockContent = '';
    
    switch (task.type) {
        case 'run-rng':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">🎲</span> Run RNG
                    <button class="task-delete" data-index="${index}">×</button>
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
                    <span class="task-icon">➕</span> Add to Number
                    <button class="task-delete" data-index="${index}">×</button>
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
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'subtract':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">➖</span> Subtract from Number
                    <button class="task-delete" data-index="${index}">×</button>
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
                    </select>
                    ${getSourceInput(task, index)}
                </div>
            `;
            break;
        case 'set':
            blockContent = `
                <div class="task-block-header">
                    <span class="task-icon">✏️</span> Set Number
                    <button class="task-delete" data-index="${index}">×</button>
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
                    </select>
                    ${getSourceInput(task, index)}
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
        default:
            return `<input type="number" class="task-static-value" data-index="${index}" value="${task.staticValue || 0}">`;
    }
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
                const newTask = {
                    type: type,
                    rngIndex: null,
                    storeResult: true,
                    targetIndex: null,
                    sourceType: 'static',
                    staticValue: 0,
                    sourceIndex: null
                };
                tempTasks.push(newTask);
                renderTaskSequence();
            }
        });
    }
}

// ============== TASK EXECUTION ==============
let lastRngResult = 0;
let eventRngResults = []; // Collect all RNG results during an event

function executeButtonTasks(buttonData) {
    if (!buttonData.tasks || buttonData.tasks.length === 0) {
        return;
    }
    
    lastRngResult = 0;
    eventRngResults = []; // Reset results collection
    
    for (const task of buttonData.tasks) {
        executeTask(task);
    }
    
    // Show all RNG results at the end
    if (eventRngResults.length > 0) {
        showAllRngResults(eventRngResults);
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

function showAllRngResults(results) {
    const notification = document.createElement('div');
    notification.className = 'rng-result-notification';
    
    // Build content showing all RNG results
    let content = results.map(r => `${r.name}: ${r.result}`).join('<br>');
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
        type: 'character-sheet',
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        bgColor: bgColor,
        bgImageData: bgImageData,
        drawing: drawingData,
        textElements: textElements.map(t => ({
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
        }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'character_sheet_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('import-map').addEventListener('click', () => {
    document.getElementById('import-map-file').click();
});

document.getElementById('import-map-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (!data.type || data.type !== 'character-sheet') {
                alert('Invalid character sheet file format.');
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
            
            alert('Character sheet loaded successfully!');
        } catch (err) {
            alert('Error loading character sheet: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();
