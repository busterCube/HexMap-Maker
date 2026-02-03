import * as THREE from './lib/three.module.js';

// Initialize Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff);

// Dark mode state
let isDarkMode = false;

// Background state
let bgColor = '#ffffff';
let bgImageData = null; // Base64 image data

// Camera panning state
let cameraOffsetX = 0;
let cameraOffsetY = 0;
let gridBounds = { minX: -10, maxX: 10, minY: -10, maxY: 10 };
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
    if (scrollbarH) updateScrollbars();
}

// Scrollbar elements (declared early so updateCamera can reference them)
const scrollbarH = document.getElementById('scrollbar-h');
const scrollbarV = document.getElementById('scrollbar-v');
const thumbH = document.getElementById('scrollbar-h-thumb');
const thumbV = document.getElementById('scrollbar-v-thumb');

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

// Icons state
let iconLibrary = []; // Array of {data: base64, name: string}
let mapIcons = []; // Icons placed on the map
let selectedIconIndex = -1; // Currently selected icon from library
let activeMapIcon = null; // Currently active (selected) map icon
const MAX_ICONS = 40;

menuToggle.addEventListener('click', () => {
    menu.classList.toggle('open');
});

systemToggle.addEventListener('click', () => {
    systemMenu.classList.toggle('open');
});

// Navigation buttons
document.getElementById('nav-hexmap').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('nav-dungeon').addEventListener('click', () => {
    window.location.href = 'dungeon-maker.html';
});

// Dark mode toggle
document.getElementById('toggle-dark-mode').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    updateDarkMode();
});

function updateDarkMode() {
    if (isDarkMode) {
        // Dark mode colors
        renderer.setClearColor(0x2b2b2b);
        bgColor = '#2b2b2b';
        document.getElementById('toggle-dark-mode').textContent = 'Enable Light Mode';
    } else {
        // Light mode colors
        renderer.setClearColor(0xffffff);
        bgColor = '#ffffff';
        document.getElementById('toggle-dark-mode').textContent = 'Enable Dark Mode';
    }
    
    // Update background color element if it exists
    const bgColorInput = document.getElementById('bg-color');
    if (bgColorInput) {
        bgColorInput.value = bgColor;
        document.getElementById('bg-color-text').value = bgColor;
    }
    
    // Regenerate grid with new line colors
    generateGrid();
}

// Collapsible tool sections
document.querySelectorAll('.tool-section h3').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    });
});

// Background controls
document.getElementById('bg-color').addEventListener('input', (e) => {
    document.getElementById('bg-color-text').value = e.target.value;
});

document.getElementById('bg-color-text').addEventListener('input', (e) => {
    document.getElementById('bg-color').value = e.target.value;
});

document.getElementById('apply-bg-color').addEventListener('click', () => {
    bgColor = document.getElementById('bg-color').value;
    bgImageData = null;
    document.getElementById('bg-image').style.display = 'none';
    renderer.setClearColor(bgColor);
});

document.getElementById('import-bg-image').addEventListener('click', () => {
    document.getElementById('bg-image-file').click();
});

document.getElementById('bg-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        bgImageData = event.target.result;
        const bgImage = document.getElementById('bg-image');
        bgImage.src = bgImageData;
        bgImage.style.display = 'block';
        renderer.setClearColor(0x000000, 0); // Make canvas transparent to show image
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset so same file can be selected again
});

document.getElementById('clear-bg-image').addEventListener('click', () => {
    bgImageData = null;
    document.getElementById('bg-image').style.display = 'none';
    renderer.setClearColor(bgColor);
});

document.getElementById('square-color').addEventListener('input', (e) => {
    document.getElementById('square-color-text').value = e.target.value;
});

document.getElementById('square-color-text').addEventListener('input', (e) => {
    document.getElementById('square-color').value = e.target.value;
});

// Palette functionality
const paletteContainer = document.getElementById('palette-container');
const paletteAddBtn = document.getElementById('palette-add');
let palette = []; // Array of {color: string, name: string}
const MAX_PALETTE_SIZE = 30;

function renderPalette() {
    paletteContainer.innerHTML = '';
    palette.forEach((item, index) => {
        const paletteItem = document.createElement('div');
        paletteItem.className = 'palette-item';
        
        const colorDiv = document.createElement('div');
        colorDiv.className = 'palette-color';
        colorDiv.style.backgroundColor = item.color;
        colorDiv.title = item.name + ' (' + item.color + ')';
        colorDiv.addEventListener('click', () => {
            // Set the square fill color to this palette color
            document.getElementById('square-color').value = item.color;
            document.getElementById('square-color-text').value = item.color;
            // Update selection visual
            document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
            colorDiv.classList.add('selected');
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from palette';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            palette.splice(index, 1);
            renderPalette();
        });
        colorDiv.appendChild(deleteBtn);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'palette-name';
        nameSpan.textContent = item.name;
        nameSpan.title = 'Click to rename';
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new name for this color:', item.name);
            if (newName !== null && newName.trim() !== '') {
                palette[index].name = newName.trim();
                renderPalette();
            }
        });
        
        paletteItem.appendChild(colorDiv);
        paletteItem.appendChild(nameSpan);
        paletteContainer.appendChild(paletteItem);
    });
}

paletteAddBtn.addEventListener('click', () => {
    if (palette.length >= MAX_PALETTE_SIZE) {
        alert('Palette is full! Maximum ' + MAX_PALETTE_SIZE + ' colors allowed.');
        return;
    }
    const currentColor = document.getElementById('square-color').value;
    const name = prompt('Enter a name for this color:', 'Color ' + (palette.length + 1));
    if (name !== null) {
        palette.push({ color: currentColor, name: name.trim() || 'Color ' + (palette.length + 1) });
        renderPalette();
    }
});

// Save Palette functionality
document.getElementById('save-palette').addEventListener('click', () => {
    if (palette.length === 0) {
        alert('Palette is empty. Add some colors first.');
        return;
    }
    
    const paletteData = {
        version: 1,
        type: 'palette',
        colors: palette
    };
    
    const blob = new Blob([JSON.stringify(paletteData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeon_palette_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Import Palette functionality
document.getElementById('import-palette').addEventListener('click', () => {
    document.getElementById('import-palette-file').click();
});

document.getElementById('import-palette-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const paletteData = JSON.parse(event.target.result);
            
            if (!paletteData.type || paletteData.type !== 'palette' || !paletteData.colors) {
                alert('Invalid palette file format.');
                return;
            }
            
            // Ask user if they want to replace or merge
            const action = palette.length > 0 
                ? confirm('Do you want to replace the current palette? Click OK to replace, Cancel to merge.')
                : true;
            
            if (action) {
                // Replace palette
                palette = paletteData.colors.slice(0, MAX_PALETTE_SIZE);
            } else {
                // Merge palettes
                const remaining = MAX_PALETTE_SIZE - palette.length;
                const toAdd = paletteData.colors.slice(0, remaining);
                palette = palette.concat(toAdd);
            }
            
            renderPalette();
            alert('Palette imported successfully! (' + palette.length + ' colors)');
        } catch (err) {
            alert('Error importing palette: ' + err.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
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

document.getElementById('toggle-drawing').addEventListener('click', () => {
    isDrawing = !isDrawing;
    if (isDrawing) {
        isErasing = false;
        document.getElementById('toggle-eraser').textContent = 'Enable Eraser';
    }
    document.getElementById('toggle-drawing').textContent = isDrawing ? 'Disable Drawing' : 'Enable Drawing';
});

document.getElementById('toggle-eraser').addEventListener('click', () => {
    isErasing = !isErasing;
    if (isErasing) {
        isDrawing = false;
        document.getElementById('toggle-drawing').textContent = 'Enable Drawing';
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
    document.getElementById('toggle-text').textContent = isTextMode ? 'Disable Text Tool' : 'Enable Text Tool';
});

// Border Tool
let isBorderMode = false;
let isRemovingBorder = false;
let customBorders = []; // Array of {row, col, edge, color, thickness}
let borderLines = null;

document.getElementById('border-color').addEventListener('input', (e) => {
    document.getElementById('border-color-text').value = e.target.value;
});

document.getElementById('border-color-text').addEventListener('input', (e) => {
    document.getElementById('border-color').value = e.target.value;
});

document.getElementById('border-thickness').addEventListener('input', (e) => {
    document.getElementById('border-thickness-value').textContent = e.target.value;
});

document.getElementById('toggle-border').addEventListener('click', () => {
    isBorderMode = !isBorderMode;
    if (isBorderMode && isRemovingBorder) {
        isRemovingBorder = false;
        document.getElementById('toggle-remove-border').textContent = 'Enable Remove Border';
    }
    document.getElementById('toggle-border').textContent = isBorderMode ? 'Disable Border Tool' : 'Enable Border Tool';
});

document.getElementById('toggle-remove-border').addEventListener('click', () => {
    isRemovingBorder = !isRemovingBorder;
    if (isRemovingBorder && isBorderMode) {
        isBorderMode = false;
        document.getElementById('toggle-border').textContent = 'Enable Border Tool';
    }
    document.getElementById('toggle-remove-border').textContent = isRemovingBorder ? 'Disable Remove Border' : 'Enable Remove Border';
});

document.getElementById('clear-all-borders').addEventListener('click', () => {
    customBorders = [];
    renderCustomBorders();
});

function renderCustomBorders() {
    // Remove existing custom border lines
    if (borderLines) {
        scene.remove(borderLines);
        borderLines = null;
    }
    
    if (customBorders.length === 0) return;
    
    const linePoints = [];
    const colors = [];
    
    customBorders.forEach(border => {
        const index = border.row * gridWidth + border.col;
        if (index >= squareCenters.length) return;
        
        const center = squareCenters[index];
        const cx = center.x;
        const cy = center.y;
        const halfSize = squareSize / 2;
        
        // Define square edges: 0=top, 1=right, 2=bottom, 3=left
        const edges = [
            [{x: cx - halfSize, y: cy + halfSize}, {x: cx + halfSize, y: cy + halfSize}], // top
            [{x: cx + halfSize, y: cy + halfSize}, {x: cx + halfSize, y: cy - halfSize}], // right
            [{x: cx + halfSize, y: cy - halfSize}, {x: cx - halfSize, y: cy - halfSize}], // bottom
            [{x: cx - halfSize, y: cy - halfSize}, {x: cx - halfSize, y: cy + halfSize}]  // left
        ];
        
        const edge = edges[border.edge];
        if (!edge) return;
        
        const v1 = edge[0];
        const v2 = edge[1];
        
        // Calculate perpendicular offset direction for thickness
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / len; // perpendicular vector
        const perpY = dx / len;
        
        // Add multiple line segments offset perpendicular to the line for thickness effect
        const thickness = border.thickness;
        const offsetStep = 0.015; // spacing between parallel lines
        for (let t = 0; t < thickness; t++) {
            const offset = (t - thickness / 2) * offsetStep;
            const ox = perpX * offset;
            const oy = perpY * offset;
            linePoints.push(new THREE.Vector3(v1.x + ox, v1.y + oy, 0.01));
            linePoints.push(new THREE.Vector3(v2.x + ox, v2.y + oy, 0.01));
        }
        
        const color = new THREE.Color(border.color);
        for (let t = 0; t < thickness; t++) {
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }
    });
    
    if (linePoints.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
        borderLines = new THREE.LineSegments(geometry, material);
        scene.add(borderLines);
    }
}


// Create square grid
let squareSizePx = 50; // square size in pixels (10-100)
let squareSize = 0.5; // size in world units (will be recalculated based on squareSizePx)

function updateSquareMetrics() {
    // Convert pixel size to world units (50px = 0.5 as default)
    squareSize = squareSizePx / 100;
}

function createSquare(x, y, z, color = 0xffffff) {
    const shape = new THREE.Shape();
    const halfSize = squareSize / 2;
    
    // Create square shape
    shape.moveTo(-halfSize, -halfSize);
    shape.lineTo(halfSize, -halfSize);
    shape.lineTo(halfSize, halfSize);
    shape.lineTo(-halfSize, halfSize);
    shape.closePath();
    
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 });
    const square = new THREE.Mesh(geometry, material);
    square.position.set(x, y, z);
    square.userData.originalColor = color;

    return square;
}

let gridWidth = 20;
let gridHeight = 20;
let squares = [];
let squareCenters = [];
let gridLines = null;

function generateGrid() {
    // Remove existing squares
    squares.forEach(square => scene.remove(square));
    squares = [];
    squareCenters = [];
    
    // Remove existing grid lines and border lines
    if (gridLines) {
        // Remove border lines if they exist
        if (gridLines.userData.borderLines) {
            scene.remove(gridLines.userData.borderLines);
        }
        scene.remove(gridLines);
        gridLines = null;
    }
    
    // Create squares
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const x = (col - gridWidth / 2 + 0.5) * squareSize;
            const y = (row - gridHeight / 2 + 0.5) * squareSize;
            const square = createSquare(x, y, 0);
            scene.add(square);
            squares.push(square);
            squareCenters.push({ row, col, x, y });
        }
    }
    
    // Draw grid lines with darker, thicker borders
    const linePoints = [];
    const borderLinePoints = []; // Separate array for outer borders
    const halfSize = squareSize / 2;
    
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const cx = (col - gridWidth / 2 + 0.5) * squareSize;
            const cy = (row - gridHeight / 2 + 0.5) * squareSize;
            
            // Define the four corners of the square
            const topLeft = { x: cx - halfSize, y: cy + halfSize };
            const topRight = { x: cx + halfSize, y: cy + halfSize };
            const bottomLeft = { x: cx - halfSize, y: cy - halfSize };
            const bottomRight = { x: cx + halfSize, y: cy - halfSize };
            
            // Check if this square is on the border
            const isTopEdge = row === gridHeight - 1;
            const isBottomEdge = row === 0;
            const isLeftEdge = col === 0;
            const isRightEdge = col === gridWidth - 1;
            
            // Top edge
            if (isTopEdge) {
                borderLinePoints.push(new THREE.Vector3(topLeft.x, topLeft.y, 0));
                borderLinePoints.push(new THREE.Vector3(topRight.x, topRight.y, 0));
            } else {
                linePoints.push(new THREE.Vector3(topLeft.x, topLeft.y, 0));
                linePoints.push(new THREE.Vector3(topRight.x, topRight.y, 0));
            }
            
            // Right edge
            if (isRightEdge) {
                borderLinePoints.push(new THREE.Vector3(topRight.x, topRight.y, 0));
                borderLinePoints.push(new THREE.Vector3(bottomRight.x, bottomRight.y, 0));
            } else {
                linePoints.push(new THREE.Vector3(topRight.x, topRight.y, 0));
                linePoints.push(new THREE.Vector3(bottomRight.x, bottomRight.y, 0));
            }
            
            // Bottom edge
            if (isBottomEdge) {
                borderLinePoints.push(new THREE.Vector3(bottomLeft.x, bottomLeft.y, 0));
                borderLinePoints.push(new THREE.Vector3(bottomRight.x, bottomRight.y, 0));
            } else {
                linePoints.push(new THREE.Vector3(bottomLeft.x, bottomLeft.y, 0));
                linePoints.push(new THREE.Vector3(bottomRight.x, bottomRight.y, 0));
            }
            
            // Left edge
            if (isLeftEdge) {
                borderLinePoints.push(new THREE.Vector3(topLeft.x, topLeft.y, 0));
                borderLinePoints.push(new THREE.Vector3(bottomLeft.x, bottomLeft.y, 0));
            } else {
                linePoints.push(new THREE.Vector3(topLeft.x, topLeft.y, 0));
                linePoints.push(new THREE.Vector3(bottomLeft.x, bottomLeft.y, 0));
            }
        }
    }
    
    // Create regular grid lines (thinner, lighter)
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineColor = isDarkMode ? 0xffffff : 0x000000;
    const gridMaterial = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 1 });
    gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(gridLines);
    
    // Create border lines (thicker, darker)
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderLinePoints);
    const borderMaterial = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 3 });
    const borderLines = new THREE.LineSegments(borderGeometry, borderMaterial);
    scene.add(borderLines);
    
    // Store reference to border lines for later removal
    gridLines.userData.borderLines = borderLines;
    
    // Calculate grid bounds for scrolling
    calculateGridBounds();
    updateScrollbars();
}

// Calculate the bounds of the grid
function calculateGridBounds() {
    const totalWidth = gridWidth * squareSize;
    const totalHeight = gridHeight * squareSize;
    const padding = squareSize * 2; // Add some padding
    
    gridBounds.minX = -totalWidth / 2 - padding;
    gridBounds.maxX = totalWidth / 2 + padding;
    gridBounds.minY = -totalHeight / 2 - padding;
    gridBounds.maxY = totalHeight / 2 + padding;
}

function updateScrollbars() {
    // Guard: don't run if elements aren't ready yet
    if (!scrollbarH || !scrollbarV) return;
    
    const gridWidthTotal = gridBounds.maxX - gridBounds.minX;
    const gridHeightTotal = gridBounds.maxY - gridBounds.minY;
    
    // Check if horizontal scroll is needed
    if (gridWidthTotal > viewBounds.width) {
        scrollbarH.classList.add('visible');
        const trackWidth = scrollbarH.offsetWidth;
        const thumbWidth = Math.max(30, (viewBounds.width / gridWidthTotal) * trackWidth);
        thumbH.style.width = thumbWidth + 'px';
        
        // Calculate thumb position
        const scrollRange = gridWidthTotal - viewBounds.width;
        const minOffset = gridBounds.minX + viewBounds.width / 2;
        const maxOffset = gridBounds.maxX - viewBounds.width / 2;
        const normalizedPos = (cameraOffsetX - minOffset) / (maxOffset - minOffset);
        const maxThumbLeft = trackWidth - thumbWidth;
        thumbH.style.left = Math.max(0, Math.min(maxThumbLeft, normalizedPos * maxThumbLeft)) + 'px';
    } else {
        scrollbarH.classList.remove('visible');
        cameraOffsetX = 0; // Reset when not needed
    }
    
    // Check if vertical scroll is needed
    if (gridHeightTotal > viewBounds.height) {
        scrollbarV.classList.add('visible');
        const trackHeight = scrollbarV.offsetHeight;
        const thumbHeight = Math.max(30, (viewBounds.height / gridHeightTotal) * trackHeight);
        thumbV.style.height = thumbHeight + 'px';
        
        // Calculate thumb position (inverted because Y goes up in Three.js but down in screen)
        const scrollRange = gridHeightTotal - viewBounds.height;
        const minOffset = gridBounds.minY + viewBounds.height / 2;
        const maxOffset = gridBounds.maxY - viewBounds.height / 2;
        const normalizedPos = (maxOffset - cameraOffsetY) / (maxOffset - minOffset);
        const maxThumbTop = trackHeight - thumbHeight;
        thumbV.style.top = Math.max(0, Math.min(maxThumbTop, normalizedPos * maxThumbTop)) + 'px';
    } else {
        scrollbarV.classList.remove('visible');
        cameraOffsetY = 0; // Reset when not needed
    }
}

// Scrollbar dragging
let isDraggingScrollbarH = false;
let isDraggingScrollbarV = false;
let scrollStartX = 0;
let scrollStartY = 0;
let scrollStartOffsetX = 0;
let scrollStartOffsetY = 0;

thumbH.addEventListener('mousedown', (e) => {
    isDraggingScrollbarH = true;
    scrollStartX = e.clientX;
    scrollStartOffsetX = cameraOffsetX;
    e.preventDefault();
    e.stopPropagation();
});

thumbV.addEventListener('mousedown', (e) => {
    isDraggingScrollbarV = true;
    scrollStartY = e.clientY;
    scrollStartOffsetY = cameraOffsetY;
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingScrollbarH) {
        const trackWidth = scrollbarH.offsetWidth;
        const thumbWidth = thumbH.offsetWidth;
        const maxThumbLeft = trackWidth - thumbWidth;
        
        const deltaX = e.clientX - scrollStartX;
        const gridWidthTotal = gridBounds.maxX - gridBounds.minX;
        const scrollRange = gridWidthTotal - viewBounds.width;
        const deltaOffset = (deltaX / maxThumbLeft) * scrollRange;
        
        const minOffset = gridBounds.minX + viewBounds.width / 2;
        const maxOffset = gridBounds.maxX - viewBounds.width / 2;
        cameraOffsetX = Math.max(minOffset, Math.min(maxOffset, scrollStartOffsetX + deltaOffset));
        
        camera.position.x = cameraOffsetX;
        camera.lookAt(cameraOffsetX, cameraOffsetY, 0);
        updateScrollbars();
        updateTagPositions();
        updateIconPositions();
        updateTextPositions();
        updateDrawingCanvasPosition();
    }
    
    if (isDraggingScrollbarV) {
        const trackHeight = scrollbarV.offsetHeight;
        const thumbHeight = thumbV.offsetHeight;
        const maxThumbTop = trackHeight - thumbHeight;
        
        const deltaY = e.clientY - scrollStartY;
        const gridHeightTotal = gridBounds.maxY - gridBounds.minY;
        const scrollRange = gridHeightTotal - viewBounds.height;
        const deltaOffset = -(deltaY / maxThumbTop) * scrollRange; // Inverted
        
        const minOffset = gridBounds.minY + viewBounds.height / 2;
        const maxOffset = gridBounds.maxY - viewBounds.height / 2;
        cameraOffsetY = Math.max(minOffset, Math.min(maxOffset, scrollStartOffsetY + deltaOffset));
        
        camera.position.y = cameraOffsetY;
        camera.lookAt(cameraOffsetX, cameraOffsetY, 0);
        updateScrollbars();
        updateTagPositions();
        updateIconPositions();
        updateTextPositions();
        updateDrawingCanvasPosition();
    }
});

document.addEventListener('mouseup', () => {
    isDraggingScrollbarH = false;
    isDraggingScrollbarV = false;
});

// Mouse wheel scrolling
document.getElementById('canvas').addEventListener('wheel', (e) => {
    const gridWidthTotal = gridBounds.maxX - gridBounds.minX;
    const gridHeightTotal = gridBounds.maxY - gridBounds.minY;
    
    // Determine scroll direction and amount
    const scrollAmount = 2; // Units to scroll per wheel tick
    
    if (e.shiftKey && gridWidthTotal > viewBounds.width) {
        // Horizontal scroll with shift+wheel
        const minOffset = gridBounds.minX + viewBounds.width / 2;
        const maxOffset = gridBounds.maxX - viewBounds.width / 2;
        cameraOffsetX = Math.max(minOffset, Math.min(maxOffset, cameraOffsetX + Math.sign(e.deltaY) * scrollAmount));
    } else if (gridHeightTotal > viewBounds.height) {
        // Vertical scroll
        const minOffset = gridBounds.minY + viewBounds.height / 2;
        const maxOffset = gridBounds.maxY - viewBounds.height / 2;
        cameraOffsetY = Math.max(minOffset, Math.min(maxOffset, cameraOffsetY - Math.sign(e.deltaY) * scrollAmount));
    }
    
    camera.position.set(cameraOffsetX, cameraOffsetY, 10);
    camera.lookAt(cameraOffsetX, cameraOffsetY, 0);
    updateScrollbars();
    updateTagPositions();
    updateIconPositions();
    updateTextPositions();
    updateDrawingCanvasPosition();
    e.preventDefault();
}, { passive: false });

// Initial grid generation
updateSquareMetrics(); // Initialize metrics
generateGrid();

// Grid size controls
document.getElementById('apply-grid-size').addEventListener('click', () => {
    const newWidth = Math.min(300, Math.max(1, parseInt(document.getElementById('grid-width').value) || 20));
    const newHeight = Math.min(300, Math.max(1, parseInt(document.getElementById('grid-height').value) || 20));
    document.getElementById('grid-width').value = newWidth;
    document.getElementById('grid-height').value = newHeight;
    gridWidth = newWidth;
    gridHeight = newHeight;
    
    // Reset camera position when grid changes
    cameraOffsetX = 0;
    cameraOffsetY = 0;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    
    generateGrid();
});

document.getElementById('apply-square-size').addEventListener('click', () => {
    const newSize = Math.min(100, Math.max(10, parseInt(document.getElementById('square-size').value) || 50));
    document.getElementById('square-size').value = newSize;
    squareSizePx = newSize;
    updateSquareMetrics();
    
    // Reset camera position when square size changes
    cameraOffsetX = 0;
    cameraOffsetY = 0;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    
    generateGrid();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    updateCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Resize drawing canvas if it exists
    if (drawingCanvas) {
        // Save current drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawingCanvas.width;
        tempCanvas.height = drawingCanvas.height;
        tempCanvas.getContext('2d').drawImage(drawingCanvas, 0, 0);
        
        // Resize canvas
        drawingCanvas.width = window.innerWidth * 3;
        drawingCanvas.height = window.innerHeight * 3;
        
        // Restore drawing
        drawingCtx.drawImage(tempCanvas, 0, 0);
    }
    // Update tag positions
    updateTagPositions();
    // Update icon positions
    updateIconPositions();
    // Update text positions
    updateTextPositions();
    // Update drawing canvas position
    updateDrawingCanvasPosition();
});

// Add interactivity
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let contextMenuOpen = false;

function onMouseClick(event) {
    // Don't fill if context menu was just closed
    if (contextMenuOpen) {
        contextMenuOpen = false;
        return;
    }
    if (isDrawing || isErasing || isTextMode) return; // don't fill when drawing, erasing, or adding text
    if (selectedIconIndex >= 0) return; // don't fill when placing icons
    if (event.button !== 0) return; // only left click
    if (event.target.closest('#context-menu') || event.target.closest('#menu') || event.target.closest('#system-menu') || event.target.closest('.scrollbar') || event.target.closest('.map-icon')) return; // ignore menu, scrollbar, and map icon clicks
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // Handle border mode
    if (isBorderMode || isRemovingBorder) {
        const intersects = raycaster.intersectObjects(squares);
        if (intersects.length > 0) {
            const square = intersects[0].object;
            const squareIndex = squares.indexOf(square);
            if (squareIndex === -1) return;
            
            const center = squareCenters[squareIndex];
            const cx = center.x;
            const cy = center.y;
            const halfSize = squareSize / 2;
            
            // Get click position in world coordinates
            const worldPos = screenToWorld(event.clientX, event.clientY);
            const clickX = worldPos.x;
            const clickY = worldPos.y;
            
            // Define square edges: 0=top, 1=right, 2=bottom, 3=left
            const edges = [
                [{x: cx - halfSize, y: cy + halfSize}, {x: cx + halfSize, y: cy + halfSize}], // top
                [{x: cx + halfSize, y: cy + halfSize}, {x: cx + halfSize, y: cy - halfSize}], // right
                [{x: cx + halfSize, y: cy - halfSize}, {x: cx - halfSize, y: cy - halfSize}], // bottom
                [{x: cx - halfSize, y: cy - halfSize}, {x: cx - halfSize, y: cy + halfSize}]  // left
            ];
            
            // Find closest edge
            let closestEdge = 0;
            let minDist = Infinity;
            
            for (let i = 0; i < 4; i++) {
                const v1 = edges[i][0];
                const v2 = edges[i][1];
                
                // Distance from point to line segment
                const dx = v2.x - v1.x;
                const dy = v2.y - v1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const t = Math.max(0, Math.min(1, ((clickX - v1.x) * dx + (clickY - v1.y) * dy) / (len * len)));
                const projX = v1.x + t * dx;
                const projY = v1.y + t * dy;
                const dist = Math.sqrt((clickX - projX) * (clickX - projX) + (clickY - projY) * (clickY - projY));
                
                if (dist < minDist) {
                    minDist = dist;
                    closestEdge = i;
                }
            }
            
            // Only add/remove border if click was close to an edge
            if (minDist < squareSize * 0.25) {
                const borderColor = document.getElementById('border-color').value;
                const borderThickness = parseInt(document.getElementById('border-thickness').value);
                
                // Check if this border already exists
                const existingIndex = customBorders.findIndex(b => 
                    b.row === center.row && b.col === center.col && b.edge === closestEdge
                );
                
                if (existingIndex >= 0) {
                    // Border exists - remove it
                    customBorders.splice(existingIndex, 1);
                } else if (!isRemovingBorder) {
                    // No border exists and not in remove mode - add new border
                    customBorders.push({
                        row: center.row,
                        col: center.col,
                        edge: closestEdge,
                        color: borderColor,
                        thickness: borderThickness
                    });
                }
                
                renderCustomBorders();
            }
        }
        return;
    }
    
    const intersects = raycaster.intersectObjects(squares);
    if (intersects.length > 0) {
        const square = intersects[0].object;
        const color = document.getElementById('square-color').value;
        square.material.color.setStyle(color);
        square.material.opacity = 0.8; // slightly transparent so grid lines show through
    }
}

function onContextMenu(event) {
    event.preventDefault();
    if (isDrawing || isErasing || isTextMode) return;
    
    // Hide any existing context menu
    hideContextMenu();
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(squares);
    
    if (intersects.length > 0) {
        const square = intersects[0].object;
        selectedSquare = square;
        
        // Update Add Tag / Clear Tag option
        const addTagItem = document.getElementById('ctx-add-tag');
        if (square.userData.tag) {
            addTagItem.textContent = 'Clear Tag';
        } else {
            addTagItem.textContent = 'Add Tag';
        }
        
        // Show context menu at mouse position
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';
        contextMenu.classList.add('visible');
    }
}

let selectedSquare = null;

function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu.classList.contains('visible')) {
        contextMenu.classList.remove('visible');
        contextMenuOpen = true; // Flag to prevent square fill on next click
    }
}

// Hide context menu when clicking elsewhere
window.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
        hideContextMenu();
    }
});

// Context menu actions
document.getElementById('ctx-clear-square').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSquare) {
        // Clear fill
        selectedSquare.material.opacity = 0;
        // Clear tag
        if (selectedSquare.userData.tagElement) {
            selectedSquare.userData.tagElement.remove();
            selectedSquare.userData.tagElement = null;
            selectedSquare.userData.tag = null;
        }
    }
    hideContextMenu();
});

document.getElementById('ctx-clear-fill').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSquare) {
        selectedSquare.material.opacity = 0;
    }
    hideContextMenu();
});

document.getElementById('ctx-add-tag').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSquare) {
        if (selectedSquare.userData.tag) {
            // Clear tag
            if (selectedSquare.userData.tagElement) {
                selectedSquare.userData.tagElement.remove();
                selectedSquare.userData.tagElement = null;
                selectedSquare.userData.tag = null;
            }
        } else {
            // Add tag - prompt for text
            const tagText = prompt('Enter tag text:');
            if (tagText && tagText.trim()) {
                addTagToSquare(selectedSquare, tagText.trim());
            }
        }
    }
    hideContextMenu();
});

function addTagToSquare(square, text) {
    // Remove existing tag if any
    if (square.userData.tagElement) {
        square.userData.tagElement.remove();
    }
    
    // Get square screen position
    const squarePos = new THREE.Vector3(square.position.x, square.position.y, square.position.z);
    squarePos.project(camera);
    const screenX = (squarePos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-squarePos.y * 0.5 + 0.5) * window.innerHeight;
    
    // Calculate square size on screen
    const squareEdgePos = new THREE.Vector3(square.position.x + squareSize * 0.4, square.position.y, square.position.z);
    squareEdgePos.project(camera);
    const edgeScreenX = (squareEdgePos.x * 0.5 + 0.5) * window.innerWidth;
    const squareScreenHalfSize = Math.abs(edgeScreenX - screenX);
    
    // Create tag element
    const tagElement = document.createElement('div');
    tagElement.className = 'square-tag';
    tagElement.textContent = text;
    tagElement.style.left = screenX + 'px';
    tagElement.style.top = screenY + 'px';
    tagElement.style.transform = 'translate(-50%, -50%)';
    
    // Size font to fit inside square
    const maxWidth = squareScreenHalfSize * 1.8;
    tagElement.style.maxWidth = maxWidth + 'px';
    tagElement.style.fontSize = Math.max(8, Math.min(16, squareScreenHalfSize * 0.6)) + 'px';
    tagElement.style.overflow = 'hidden';
    tagElement.style.textOverflow = 'ellipsis';
    tagElement.style.whiteSpace = 'nowrap';
    
    document.body.appendChild(tagElement);
    
    // Store reference
    square.userData.tag = text;
    square.userData.tagElement = tagElement;
}

// Convert screen coordinates to world coordinates
function screenToWorld(screenX, screenY) {
    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;
    
    const worldX = cameraOffsetX + ndcX * (camera.right - camera.left) / 2;
    const worldY = cameraOffsetY + ndcY * (camera.top - camera.bottom) / 2;
    
    return { x: worldX, y: worldY };
}

// Convert world coordinates to screen coordinates
function worldToScreen(worldX, worldY) {
    const pos = new THREE.Vector3(worldX, worldY, 0);
    pos.project(camera);
    const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    return { x: screenX, y: screenY };
}

// Update tag positions on camera change
function updateTagPositions() {
    squares.forEach(square => {
        if (square.userData.tagElement) {
            const squarePos = new THREE.Vector3(square.position.x, square.position.y, square.position.z);
            squarePos.project(camera);
            const screenX = (squarePos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-squarePos.y * 0.5 + 0.5) * window.innerHeight;
            square.userData.tagElement.style.left = screenX + 'px';
            square.userData.tagElement.style.top = screenY + 'px';
            
            // Update font size based on square size
            const squareEdgePos = new THREE.Vector3(square.position.x + squareSize * 0.4, square.position.y, square.position.z);
            squareEdgePos.project(camera);
            const edgeScreenX = (squareEdgePos.x * 0.5 + 0.5) * window.innerWidth;
            const squareScreenHalfSize = Math.abs(edgeScreenX - screenX);
            const maxWidth = squareScreenHalfSize * 1.8;
            square.userData.tagElement.style.maxWidth = maxWidth + 'px';
            square.userData.tagElement.style.fontSize = Math.max(8, Math.min(16, squareScreenHalfSize * 0.6)) + 'px';
        }
    });
}

// Update icon positions on camera change
function updateIconPositions() {
    mapIcons.forEach(icon => {
        if (icon.dataset.worldX !== undefined && icon.dataset.worldY !== undefined) {
            const worldX = parseFloat(icon.dataset.worldX);
            const worldY = parseFloat(icon.dataset.worldY);
            const screenPos = worldToScreen(worldX, worldY);
            const width = icon.offsetWidth;
            const height = icon.offsetHeight;
            icon.style.left = (screenPos.x - width / 2) + 'px';
            icon.style.top = (screenPos.y - height / 2) + 'px';
        }
    });
}

// Update text label positions on camera change
function updateTextPositions() {
    textElements.forEach(label => {
        if (label.dataset.worldX !== undefined && label.dataset.worldY !== undefined) {
            const worldX = parseFloat(label.dataset.worldX);
            const worldY = parseFloat(label.dataset.worldY);
            const screenPos = worldToScreen(worldX, worldY);
            label.style.left = screenPos.x + 'px';
            label.style.top = screenPos.y + 'px';
        }
    });
}

// Update drawing canvas position on camera change
function updateDrawingCanvasPosition() {
    if (drawingCanvas && drawingCanvas.dataset.worldX !== undefined) {
        const worldX = parseFloat(drawingCanvas.dataset.worldX);
        const worldY = parseFloat(drawingCanvas.dataset.worldY);
        const screenPos = worldToScreen(worldX, worldY);
        drawingCanvas.style.left = screenPos.x + 'px';
        drawingCanvas.style.top = screenPos.y + 'px';
    }
}

window.addEventListener('click', onMouseClick);
window.addEventListener('contextmenu', onContextMenu);

let isMouseDown = false;
let drawingCanvas = null;
let drawingCtx = null;

function initDrawingCanvas() {
    if (!drawingCanvas) {
        drawingCanvas = document.createElement('canvas');
        drawingCanvas.id = 'drawing-canvas';
        drawingCanvas.style.position = 'absolute';
        drawingCanvas.style.top = '0';
        drawingCanvas.style.left = '0';
        drawingCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.zIndex = '100';
        // Make canvas larger to accommodate scrolling
        drawingCanvas.width = window.innerWidth * 3;
        drawingCanvas.height = window.innerHeight * 3;
        document.body.appendChild(drawingCanvas);
        drawingCtx = drawingCanvas.getContext('2d');
        
        // Store the world coordinates of the canvas origin (top-left corner at current camera position)
        const topLeftWorld = screenToWorld(-window.innerWidth, -window.innerHeight);
        drawingCanvas.dataset.worldX = topLeftWorld.x;
        drawingCanvas.dataset.worldY = topLeftWorld.y;
        updateDrawingCanvasPosition();
    }
}

function onMouseDown(event) {
    if (!isDrawing && !isErasing) return;
    isMouseDown = true;
    initDrawingCanvas();
    
    if (isErasing) {
        drawingCtx.globalCompositeOperation = 'destination-out';
        drawingCtx.strokeStyle = 'rgba(0,0,0,1)';
        drawingCtx.lineWidth = parseInt(document.getElementById('line-thickness').value) * 3; // Larger eraser
    } else {
        drawingCtx.globalCompositeOperation = 'source-over';
        const color = document.getElementById('line-color').value;
        const thickness = parseInt(document.getElementById('line-thickness').value);
        drawingCtx.strokeStyle = color;
        drawingCtx.lineWidth = thickness;
    }
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.beginPath();
    // Convert to canvas-local coordinates
    const canvasX = event.clientX - drawingCanvas.offsetLeft;
    const canvasY = event.clientY - drawingCanvas.offsetTop;
    drawingCtx.moveTo(canvasX, canvasY);
}

function onMouseMove(event) {
    if (!isMouseDown || (!isDrawing && !isErasing)) return;
    // Convert to canvas-local coordinates
    const canvasX = event.clientX - drawingCanvas.offsetLeft;
    const canvasY = event.clientY - drawingCanvas.offsetTop;
    drawingCtx.lineTo(canvasX, canvasY);
    drawingCtx.stroke();
    drawingCtx.beginPath();
    drawingCtx.moveTo(canvasX, canvasY);
}

function onMouseUp(event) {
    if (!isDrawing && !isErasing) return;
    isMouseDown = false;
    // Reset composite operation
    if (drawingCtx) {
        drawingCtx.globalCompositeOperation = 'source-over';
    }
}

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// Text tool
function onCanvasClick(event) {
    if (!isTextMode || event.target !== document.getElementById('canvas')) return;
    const textSize = parseInt(document.getElementById('text-size').value) || 20;
    const textColor = document.getElementById('text-color').value;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.style.left = event.clientX + 'px';
    input.style.top = event.clientY + 'px';
    input.style.fontSize = textSize + 'px';
    input.style.color = textColor;
    input.style.background = 'transparent';
    input.style.border = '1px dashed #999';
    input.placeholder = 'Enter text';
    document.body.appendChild(input);
    input.focus();

    function convertToLabel() {
        const text = input.value.trim();
        if (text) {
            const label = document.createElement('div');
            label.className = 'text-label';
            label.textContent = text;
            label.style.position = 'absolute';
            label.style.left = input.style.left;
            label.style.top = input.style.top;
            label.style.fontSize = textSize + 'px';
            label.style.color = textColor;
            label.style.cursor = 'move';
            label.style.userSelect = 'none';
            label.style.zIndex = '1001';
            
            // Store world coordinates
            const worldPos = screenToWorld(parseFloat(input.style.left), parseFloat(input.style.top));
            label.dataset.worldX = worldPos.x;
            label.dataset.worldY = worldPos.y;
            
            document.body.appendChild(label);
            textElements.push(label);
            
            // Make label draggable
            let isDragging = false;
            let offsetX, offsetY;
            
            label.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click only
                    isDragging = true;
                    offsetX = e.clientX - label.offsetLeft;
                    offsetY = e.clientY - label.offsetTop;
                    e.stopPropagation();
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    label.style.left = (e.clientX - offsetX) + 'px';
                    label.style.top = (e.clientY - offsetY) + 'px';
                    // Update world coordinates
                    const worldPos = screenToWorld(e.clientX - offsetX, e.clientY - offsetY);
                    label.dataset.worldX = worldPos.x;
                    label.dataset.worldY = worldPos.y;
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            // Right-click context menu for text
            label.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showTextContextMenu(e.clientX, e.clientY, label);
            });
        }
        input.remove();
    }

    input.addEventListener('blur', convertToLabel);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            convertToLabel();
        }
    });
}

document.getElementById('canvas').addEventListener('click', onCanvasClick);

// Text context menu functionality
const textContextMenu = document.getElementById('text-context-menu');
let selectedTextLabel = null;

function showTextContextMenu(x, y, label) {
    selectedTextLabel = label;
    textContextMenu.style.left = x + 'px';
    textContextMenu.style.top = y + 'px';
    textContextMenu.classList.add('visible');
}

function hideTextContextMenu() {
    textContextMenu.classList.remove('visible');
    selectedTextLabel = null;
}

// Hide text context menu on click elsewhere
document.addEventListener('click', (e) => {
    if (!textContextMenu.contains(e.target)) {
        hideTextContextMenu();
    }
});

// Edit text
document.getElementById('ctx-edit-text').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedTextLabel) {
        const currentText = selectedTextLabel.textContent;
        const newText = prompt('Edit text:', currentText);
        if (newText !== null && newText.trim() !== '') {
            selectedTextLabel.textContent = newText.trim();
        }
    }
    hideTextContextMenu();
});

// Change size
document.getElementById('ctx-change-size').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedTextLabel) {
        const currentSize = parseInt(selectedTextLabel.style.fontSize) || 20;
        const newSize = prompt('Enter new font size (10-100):', currentSize);
        if (newSize !== null) {
            const size = Math.min(100, Math.max(10, parseInt(newSize) || currentSize));
            selectedTextLabel.style.fontSize = size + 'px';
        }
    }
    hideTextContextMenu();
});

// Delete text
document.getElementById('ctx-delete-text').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedTextLabel) {
        const index = textElements.indexOf(selectedTextLabel);
        if (index > -1) {
            textElements.splice(index, 1);
        }
        selectedTextLabel.remove();
    }
    hideTextContextMenu();
});

// ===== ICONS FUNCTIONALITY =====

const iconContainer = document.getElementById('icon-container');
const iconAddBtn = document.getElementById('icon-add');
const iconFileInput = document.getElementById('icon-file');
const iconContextMenu = document.getElementById('icon-context-menu');

function renderIconLibrary() {
    iconContainer.innerHTML = '';
    iconLibrary.forEach((item, index) => {
        const iconItem = document.createElement('div');
        iconItem.className = 'icon-item';
        
        const iconPreview = document.createElement('div');
        iconPreview.className = 'icon-preview';
        if (index === selectedIconIndex) {
            iconPreview.classList.add('selected');
        }
        iconPreview.title = item.name;
        
        const img = document.createElement('img');
        img.src = item.data;
        iconPreview.appendChild(img);
        
        iconPreview.addEventListener('click', () => {
            // Toggle selection - click again to deselect
            if (selectedIconIndex === index) {
                selectedIconIndex = -1;
                iconPreview.classList.remove('selected');
            } else {
                selectedIconIndex = index;
                document.querySelectorAll('.icon-preview').forEach(el => el.classList.remove('selected'));
                iconPreview.classList.add('selected');
            }
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove from library';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            iconLibrary.splice(index, 1);
            if (selectedIconIndex === index) {
                selectedIconIndex = -1;
            } else if (selectedIconIndex > index) {
                selectedIconIndex--;
            }
            renderIconLibrary();
        });
        iconPreview.appendChild(deleteBtn);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'icon-name';
        nameSpan.textContent = item.name;
        nameSpan.title = 'Click to rename';
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new name for this icon:', item.name);
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

iconAddBtn.addEventListener('click', () => {
    if (iconLibrary.length >= MAX_ICONS) {
        alert('Icon library is full! Maximum ' + MAX_ICONS + ' icons allowed.');
        return;
    }
    iconFileInput.click();
});

iconFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const name = prompt('Enter a name for this icon:', file.name.replace(/\.[^.]+$/, ''));
        if (name !== null) {
            iconLibrary.push({
                data: event.target.result,
                name: name.trim() || 'Icon ' + (iconLibrary.length + 1)
            });
            renderIconLibrary();
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

// Place icon on canvas when clicking with an icon selected
document.getElementById('canvas').addEventListener('click', (e) => {
    if (selectedIconIndex >= 0 && !isTextMode && !isDrawing && !isErasing) {
        const icon = iconLibrary[selectedIconIndex];
        placeIconOnMap(icon.data, e.clientX, e.clientY);
    }
});

function placeIconOnMap(imageData, x, y, width = 80, height = 80, worldX = null, worldY = null) {
    const mapIcon = document.createElement('div');
    mapIcon.className = 'map-icon';
    mapIcon.style.left = (x - width / 2) + 'px';
    mapIcon.style.top = (y - height / 2) + 'px';
    mapIcon.style.width = width + 'px';
    mapIcon.style.height = height + 'px';
    
    // Store world coordinates (convert from screen if not provided)
    if (worldX !== null && worldY !== null) {
        mapIcon.dataset.worldX = worldX;
        mapIcon.dataset.worldY = worldY;
    } else {
        const worldPos = screenToWorld(x, y);
        mapIcon.dataset.worldX = worldPos.x;
        mapIcon.dataset.worldY = worldPos.y;
    }
    
    const img = document.createElement('img');
    img.src = imageData;
    img.draggable = false;
    mapIcon.appendChild(img);
    
    // Add resize handles
    const handlesContainer = document.createElement('div');
    handlesContainer.className = 'resize-handles';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handle.dataset.position = pos;
        handlesContainer.appendChild(handle);
    });
    mapIcon.appendChild(handlesContainer);
    
    document.body.appendChild(mapIcon);
    mapIcons.push(mapIcon);
    
    // Store image data for saving
    mapIcon.dataset.imageData = imageData;
    
    // Make active
    setActiveMapIcon(mapIcon);
    
    // Dragging logic
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    
    mapIcon.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.button === 0) {
            isDragging = true;
            dragOffsetX = e.clientX - mapIcon.offsetLeft;
            dragOffsetY = e.clientY - mapIcon.offsetTop;
            setActiveMapIcon(mapIcon);
            e.stopPropagation();
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            mapIcon.style.left = (e.clientX - dragOffsetX) + 'px';
            mapIcon.style.top = (e.clientY - dragOffsetY) + 'px';
            // Update world coordinates after dragging
            const centerX = e.clientX - dragOffsetX + mapIcon.offsetWidth / 2;
            const centerY = e.clientY - dragOffsetY + mapIcon.offsetHeight / 2;
            const worldPos = screenToWorld(centerX, centerY);
            mapIcon.dataset.worldX = worldPos.x;
            mapIcon.dataset.worldY = worldPos.y;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Resize logic
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    handlesContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
            resizeHandle = e.target.dataset.position;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = mapIcon.offsetWidth;
            startHeight = mapIcon.offsetHeight;
            startLeft = mapIcon.offsetLeft;
            startTop = mapIcon.offsetTop;
            e.stopPropagation();
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        if (resizeHandle.includes('e')) {
            newWidth = Math.max(20, startWidth + dx);
        }
        if (resizeHandle.includes('w')) {
            newWidth = Math.max(20, startWidth - dx);
            newLeft = startLeft + (startWidth - newWidth);
        }
        if (resizeHandle.includes('s')) {
            newHeight = Math.max(20, startHeight + dy);
        }
        if (resizeHandle.includes('n')) {
            newHeight = Math.max(20, startHeight - dy);
            newTop = startTop + (startHeight - newHeight);
        }
        
        mapIcon.style.width = newWidth + 'px';
        mapIcon.style.height = newHeight + 'px';
        mapIcon.style.left = newLeft + 'px';
        mapIcon.style.top = newTop + 'px';
        
        // Update world coordinates after resize (center may have moved)
        const centerX = newLeft + newWidth / 2;
        const centerY = newTop + newHeight / 2;
        const worldPos = screenToWorld(centerX, centerY);
        mapIcon.dataset.worldX = worldPos.x;
        mapIcon.dataset.worldY = worldPos.y;
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
        resizeHandle = null;
    });
    
    // Right-click context menu
    mapIcon.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showIconContextMenu(e.clientX, e.clientY, mapIcon);
    });
    
    return mapIcon;
}

function setActiveMapIcon(icon) {
    // Deselect all
    document.querySelectorAll('.map-icon').forEach(el => el.classList.remove('active'));
    activeMapIcon = icon;
    if (icon) {
        icon.classList.add('active');
    }
}

// Click elsewhere to deselect map icon
document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-icon') && !e.target.closest('#icon-context-menu')) {
        setActiveMapIcon(null);
    }
});

// Icon context menu
let contextMapIcon = null;

function showIconContextMenu(x, y, icon) {
    contextMapIcon = icon;
    iconContextMenu.style.left = x + 'px';
    iconContextMenu.style.top = y + 'px';
    iconContextMenu.classList.add('visible');
}

function hideIconContextMenu() {
    iconContextMenu.classList.remove('visible');
    contextMapIcon = null;
}

document.addEventListener('click', (e) => {
    if (!iconContextMenu.contains(e.target)) {
        hideIconContextMenu();
    }
});

document.getElementById('ctx-remove-icon').addEventListener('click', (e) => {
    e.stopPropagation();
    if (contextMapIcon) {
        const index = mapIcons.indexOf(contextMapIcon);
        if (index > -1) {
            mapIcons.splice(index, 1);
        }
        contextMapIcon.remove();
        if (activeMapIcon === contextMapIcon) {
            activeMapIcon = null;
        }
    }
    hideIconContextMenu();
});

// ===== RNG (Random Number Generator) FUNCTIONALITY =====

const rngContainer = document.getElementById('rng-container');
const rngAddBtn = document.getElementById('rng-add');
let rngList = []; // Array of {name: string, min: number, max: number}
const MAX_RNG_COUNT = 20;

function renderRNGList() {
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
        nameSpan.title = 'Click to rename';
        nameSpan.addEventListener('click', () => {
            const newName = prompt('Enter new name for this RNG:', rng.name);
            if (newName !== null && newName.trim() !== '') {
                rngList[index].name = newName.trim();
                renderRNGList();
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rng-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete RNG';
        deleteBtn.addEventListener('click', () => {
            rngList.splice(index, 1);
            renderRNGList();
        });
        
        header.appendChild(nameSpan);
        header.appendChild(deleteBtn);
        
        // Input row for min/max
        const inputsDiv = document.createElement('div');
        inputsDiv.className = 'rng-inputs';
        
        const minLabel = document.createElement('label');
        minLabel.textContent = 'Min:';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.value = rng.min;
        minInput.addEventListener('change', () => {
            rngList[index].min = parseInt(minInput.value) || 0;
        });
        
        const maxLabel = document.createElement('label');
        maxLabel.textContent = 'Max:';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.value = rng.max;
        maxInput.addEventListener('change', () => {
            rngList[index].max = parseInt(maxInput.value) || 100;
        });
        
        inputsDiv.appendChild(minLabel);
        inputsDiv.appendChild(minInput);
        inputsDiv.appendChild(maxLabel);
        inputsDiv.appendChild(maxInput);
        
        // Result row with display and button
        const resultDiv = document.createElement('div');
        resultDiv.className = 'rng-result-row';
        
        const resultDisplay = document.createElement('div');
        resultDisplay.className = 'rng-result';
        resultDisplay.textContent = '-';
        
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
            
            // Add animation effect
            resultDisplay.style.backgroundColor = '#e0e0e0';
            resultDisplay.style.color = '#999';
            resultDisplay.textContent = '...';
            generateBtn.disabled = true;
            
            setTimeout(() => {
                const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
                resultDisplay.textContent = randomNum;
                resultDisplay.style.backgroundColor = 'white';
                resultDisplay.style.color = '#333';
                generateBtn.disabled = false;
            }, 1000);
        });
        
        resultDiv.appendChild(resultDisplay);
        resultDiv.appendChild(generateBtn);
        
        // Assemble the item
        rngItem.appendChild(header);
        rngItem.appendChild(inputsDiv);
        rngItem.appendChild(resultDiv);
        rngContainer.appendChild(rngItem);
    });
}

rngAddBtn.addEventListener('click', () => {
    if (rngList.length >= MAX_RNG_COUNT) {
        alert('RNG list is full! Maximum ' + MAX_RNG_COUNT + ' RNGs allowed.');
        return;
    }
    
    const name = prompt('Enter a name for this RNG:', 'RNG ' + (rngList.length + 1));
    if (name !== null) {
        rngList.push({
            name: name.trim() || 'RNG ' + (rngList.length + 1),
            min: 1,
            max: 100
        });
        renderRNGList();
    }
});

// Save RNG functionality
document.getElementById('save-rng').addEventListener('click', () => {
    if (rngList.length === 0) {
        alert('RNG list is empty. Add some RNGs first.');
        return;
    }
    
    const rngData = {
        version: 1,
        type: 'rng',
        rngs: rngList
    };
    
    const blob = new Blob([JSON.stringify(rngData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rng_list_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Import RNG functionality
document.getElementById('import-rng').addEventListener('click', () => {
    document.getElementById('import-rng-file').click();
});

document.getElementById('import-rng-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const rngData = JSON.parse(event.target.result);
            
            if (!rngData.type || rngData.type !== 'rng' || !rngData.rngs) {
                alert('Invalid RNG file format.');
                return;
            }
            
            // Ask user if they want to replace or merge
            const action = rngList.length > 0 
                ? confirm('Do you want to replace the current RNG list? Click OK to replace, Cancel to merge.')
                : true;
            
            if (action) {
                // Replace RNG list
                rngList = rngData.rngs.slice(0, MAX_RNG_COUNT);
            } else {
                // Merge RNG lists
                const remaining = MAX_RNG_COUNT - rngList.length;
                const toAdd = rngData.rngs.slice(0, remaining);
                rngList = rngList.concat(toAdd);
            }
            
            renderRNGList();
            alert('RNG list imported successfully! (' + rngList.length + ' RNGs)');
        } catch (err) {
            alert('Error importing RNG list: ' + err.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
});

// Save Map functionality
document.getElementById('save-map').addEventListener('click', () => {
    // Collect all square data
    const squareData = squares.map((square, index) => {
        const center = squareCenters[index];
        return {
            row: center.row,
            col: center.col,
            color: '#' + square.material.color.getHexString(),
            opacity: square.material.opacity,
            tag: square.userData.tag || null
        };
    });
    
    // Get drawing canvas data
    let drawingData = null;
    if (drawingCanvas) {
        drawingData = drawingCanvas.toDataURL('image/png');
    }
    
    // Collect text labels (save world coordinates)
    const textLabels = [];
    document.querySelectorAll('.text-label').forEach(label => {
        textLabels.push({
            text: label.textContent,
            worldX: parseFloat(label.dataset.worldX),
            worldY: parseFloat(label.dataset.worldY),
            fontSize: label.style.fontSize,
            color: label.style.color
        });
    });
    
    // Collect map icons (save world coordinates for position-independent storage)
    const mapIconsData = [];
    mapIcons.forEach(icon => {
        mapIconsData.push({
            imageData: icon.dataset.imageData,
            worldX: parseFloat(icon.dataset.worldX),
            worldY: parseFloat(icon.dataset.worldY),
            width: icon.style.width,
            height: icon.style.height
        });
    });
    
    // Build save object
    const saveData = {
        version: 1,
        type: 'dungeon',
        gridWidth: gridWidth,
        gridHeight: gridHeight,
        squareSizePx: squareSizePx,
        bgColor: bgColor,
        bgImageData: bgImageData,
        squares: squareData,
        drawingData: drawingData,
        textLabels: textLabels,
        mapIcons: mapIconsData,
        iconLibrary: iconLibrary,
        palette: palette,
        customBorders: customBorders
    };
    
    // Create and download JSON file
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeon_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Import Map functionality
document.getElementById('import-map').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const saveData = JSON.parse(event.target.result);
            
            // Validate version and type
            if (!saveData.version || saveData.type !== 'dungeon') {
                alert('Invalid dungeon file format.');
                return;
            }
            
            // Restore settings
            gridWidth = saveData.gridWidth || 20;
            gridHeight = saveData.gridHeight || 20;
            squareSizePx = saveData.squareSizePx || 50;
            
            // Restore background
            bgColor = saveData.bgColor || '#ffffff';
            bgImageData = saveData.bgImageData || null;
            document.getElementById('bg-color').value = bgColor;
            document.getElementById('bg-color-text').value = bgColor;
            
            if (bgImageData) {
                const bgImage = document.getElementById('bg-image');
                bgImage.src = bgImageData;
                bgImage.style.display = 'block';
                renderer.setClearColor(0x000000, 0);
            } else {
                document.getElementById('bg-image').style.display = 'none';
                renderer.setClearColor(bgColor);
            }
            
            // Update UI
            document.getElementById('grid-width').value = gridWidth;
            document.getElementById('grid-height').value = gridHeight;
            document.getElementById('square-size').value = squareSizePx;
            
            // Update metrics and regenerate grid
            updateSquareMetrics();
            
            // Reset camera
            cameraOffsetX = 0;
            cameraOffsetY = 0;
            camera.position.set(0, 0, 10);
            camera.lookAt(0, 0, 0);
            
            generateGrid();
            
            // Restore square colors and tags
            if (saveData.squares) {
                saveData.squares.forEach(squareData => {
                    const index = squareData.row * gridWidth + squareData.col;
                    if (index < squares.length) {
                        const square = squares[index];
                        square.material.color.setStyle(squareData.color);
                        square.material.opacity = squareData.opacity;
                        if (squareData.tag) {
                            addTagToSquare(square, squareData.tag);
                        }
                    }
                });
            }
            
            // Restore drawing
            if (saveData.drawingData) {
                initDrawingCanvas();
                const img = new Image();
                img.onload = () => {
                    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                    drawingCtx.drawImage(img, 0, 0);
                };
                img.src = saveData.drawingData;
            } else if (drawingCanvas) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            }
            
            // Restore text labels
            document.querySelectorAll('.text-label').forEach(el => el.remove());
            textElements.length = 0; // Clear the array
            if (saveData.textLabels) {
                saveData.textLabels.forEach(labelData => {
                    const label = document.createElement('div');
                    label.className = 'text-label';
                    label.textContent = labelData.text;
                    label.style.position = 'absolute';
                    label.style.fontSize = labelData.fontSize;
                    label.style.color = labelData.color;
                    label.style.cursor = 'move';
                    label.style.userSelect = 'none';
                    label.style.zIndex = '1001';
                    
                    label.dataset.worldX = labelData.worldX;
                    label.dataset.worldY = labelData.worldY;
                    const screenPos = worldToScreen(labelData.worldX, labelData.worldY);
                    label.style.left = screenPos.x + 'px';
                    label.style.top = screenPos.y + 'px';
                    
                    document.body.appendChild(label);
                    textElements.push(label);
                    
                    // Make draggable
                    let isDragging = false;
                    let offsetX, offsetY;
                    label.addEventListener('mousedown', (e) => {
                        if (e.button === 0) {
                            isDragging = true;
                            offsetX = e.clientX - label.offsetLeft;
                            offsetY = e.clientY - label.offsetTop;
                            e.stopPropagation();
                        }
                    });
                    document.addEventListener('mousemove', (e) => {
                        if (isDragging) {
                            label.style.left = (e.clientX - offsetX) + 'px';
                            label.style.top = (e.clientY - offsetY) + 'px';
                            const worldPos = screenToWorld(e.clientX - offsetX, e.clientY - offsetY);
                            label.dataset.worldX = worldPos.x;
                            label.dataset.worldY = worldPos.y;
                        }
                    });
                    document.addEventListener('mouseup', () => {
                        isDragging = false;
                    });
                    
                    label.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showTextContextMenu(e.clientX, e.clientY, label);
                    });
                });
            }
            
            // Restore palette
            if (saveData.palette) {
                palette = saveData.palette;
                renderPalette();
            }
            
            // Restore icon library
            if (saveData.iconLibrary) {
                iconLibrary = saveData.iconLibrary;
                selectedIconIndex = -1;
                renderIconLibrary();
            }
            
            // Restore map icons
            mapIcons.forEach(icon => icon.remove());
            mapIcons.length = 0;
            if (saveData.mapIcons) {
                saveData.mapIcons.forEach(iconData => {
                    const screenPos = worldToScreen(iconData.worldX, iconData.worldY);
                    const icon = placeIconOnMap(
                        iconData.imageData, 
                        screenPos.x,
                        screenPos.y,
                        parseInt(iconData.width),
                        parseInt(iconData.height),
                        iconData.worldX,
                        iconData.worldY
                    );
                });
                setActiveMapIcon(null); // Deselect all after restore
            }
            
            // Restore custom borders
            if (saveData.customBorders) {
                customBorders = saveData.customBorders;
                renderCustomBorders();
            }
            
            alert('Dungeon imported successfully!');
        } catch (err) {
            alert('Error importing dungeon: ' + err.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input so same file can be imported again
    e.target.value = '';
});
