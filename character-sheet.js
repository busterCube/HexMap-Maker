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
const MAX_ICONS = 40;

// RNG state
let rngList = []; // Array of {name, min, max, result, linkedRngs: [id1, id2, ...]}
let nextRngId = 1;

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
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
    }
    document.getElementById('toggle-drawing').textContent = isDrawing ? 'Disable Drawing' : 'Enable Drawing';
});

document.getElementById('toggle-eraser').addEventListener('click', () => {
    isErasing = !isErasing;
    if (isErasing) {
        isDrawing = false;
        isTextMode = false;
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-text').textContent = 'Enable Text Tool';
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
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
    }
    document.getElementById('toggle-text').textContent = isTextMode ? 'Disable Text Tool' : 'Enable Text Tool';
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

window.addEventListener('resize', () => {
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;
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
            
            const textEl = document.createElement('div');
            textEl.className = 'text-input';
            textEl.style.position = 'absolute';
            textEl.style.left = e.clientX + 'px';
            textEl.style.top = e.clientY + 'px';
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
                x: e.clientX,
                y: e.clientY,
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
    
    if (selectedIconIndex !== -1 && iconLibrary[selectedIconIndex]) {
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
});

function placeIcon(x, y) {
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
        height: 64
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
    mapIcon.element.classList.add('active');
}

function makeIconDraggable(element, mapIcon) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button !== 0) return;
        
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
        
        mapIcon.x = startLeft + dx;
        mapIcon.y = startTop + dy;
        
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

function makeTextDraggable(element, textData) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', (e) => {
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
        
        textData.x = startLeft + dx;
        textData.y = startTop + dy;
        
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

let currentTextData = null;
let currentIconData = null;

function showTextContextMenu(e, textData) {
    currentTextData = textData;
    textContextMenu.style.left = e.clientX + 'px';
    textContextMenu.style.top = e.clientY + 'px';
    textContextMenu.classList.add('visible');
}

function showIconContextMenu(e, mapIcon) {
    currentIconData = mapIcon;
    iconContextMenu.style.left = e.clientX + 'px';
    iconContextMenu.style.top = e.clientY + 'px';
    iconContextMenu.classList.add('visible');
}

document.addEventListener('click', () => {
    textContextMenu.classList.remove('visible');
    iconContextMenu.classList.remove('visible');
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

document.getElementById('toggle-resize').addEventListener('click', () => {
    if (currentTextData) {
        const handles = currentTextData.element.querySelector('.resize-handles');
        if (handles) {
            currentTextData.resizeEnabled = !currentTextData.resizeEnabled;
            if (textFrameEnabled && currentTextData.resizeEnabled) {
                handles.style.display = 'block';
            } else {
                handles.style.display = 'none';
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

// Save/Load functionality
document.getElementById('save-map').addEventListener('click', () => {
    const drawingData = drawingCanvas.toDataURL();
    
    const data = {
        version: 1,
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
            resizeEnabled: t.resizeEnabled !== false
        })),
        iconLibrary: iconLibrary,
        mapIcons: mapIcons.map(icon => ({
            iconIndex: icon.iconIndex,
            x: icon.x,
            y: icon.y,
            width: icon.width,
            height: icon.height
        })),
        rngList: rngList.map(rng => ({
            id: rng.id,
            name: rng.name,
            min: rng.min,
            max: rng.max,
            result: rng.result,
            linkedRngs: rng.linkedRngs
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
                        resizeEnabled: t.resizeEnabled !== false
                    };
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
                    iconEl.style.left = iconData.x + 'px';
                    iconEl.style.top = iconData.y + 'px';
                    iconEl.style.width = iconData.width + 'px';
                    iconEl.style.height = iconData.height + 'px';
                    
                    const img = document.createElement('img');
                    img.src = icon.data;
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
                        height: iconData.height
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
