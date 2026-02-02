import * as THREE from './lib/three.module.js';

// Initialize Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff);

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

document.getElementById('hex-color').addEventListener('input', (e) => {
    document.getElementById('hex-color-text').value = e.target.value;
});

document.getElementById('hex-color-text').addEventListener('input', (e) => {
    document.getElementById('hex-color').value = e.target.value;
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
            // Set the hex fill color to this palette color
            document.getElementById('hex-color').value = item.color;
            document.getElementById('hex-color-text').value = item.color;
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
    const currentColor = document.getElementById('hex-color').value;
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
    a.download = 'hexmap_palette_' + new Date().toISOString().slice(0, 10) + '.json';
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

// Create hex grid - configurable orientation
let hexOrientation = 'flat'; // 'pointy' or 'flat'
let hexSizePx = 50; // hex size in pixels (10-100)
let hexRadius = 0.5; // distance from center to vertex (will be recalculated based on hexSizePx)
let hexWidth = hexRadius * Math.sqrt(3); // flat-to-flat width
let hexHeight = hexRadius * 2; // point-to-point height
let horizSpacing = hexWidth; // horizontal spacing between hex centers
let vertSpacing = hexRadius * 1.5; // vertical spacing (3/4 of height)

function updateHexMetrics() {
    // Convert pixel size to world units (50px = 0.5 radius as default)
    hexRadius = hexSizePx / 100;
    
    if (hexOrientation === 'pointy') {
        // Pointy-top: width is flat-to-flat, height is point-to-point
        hexWidth = hexRadius * Math.sqrt(3);
        hexHeight = hexRadius * 2;
        horizSpacing = hexWidth;
        vertSpacing = hexRadius * 1.5;
    } else {
        // Flat-top: width is point-to-point, height is flat-to-flat
        hexWidth = hexRadius * 2;
        hexHeight = hexRadius * Math.sqrt(3);
        horizSpacing = hexRadius * 1.5;
        vertSpacing = hexHeight;
    }
}

function createHex(x, y, z, color = 0xffffff) {
    const shape = new THREE.Shape();
    // Starting angle: 90° for pointy-top, 0° for flat-top
    const startAngle = hexOrientation === 'pointy' ? Math.PI / 2 : 0;
    for (let i = 0; i < 6; i++) {
        const angle = startAngle + (i * Math.PI / 3); // increment by 60°
        const px = hexRadius * Math.cos(angle);
        const py = hexRadius * Math.sin(angle);
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
    }
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 });
    const hex = new THREE.Mesh(geometry, material);
    hex.position.set(x, y, z);
    hex.userData.originalColor = color;

    return hex;
}

let gridWidth = 20;
let gridHeight = 20;
let hexes = [];
let hexCenters = [];
let gridLines = null;

function generateGrid() {
    // Remove existing hexes
    hexes.forEach(hex => scene.remove(hex));
    hexes = [];
    hexCenters = [];
    
    // Remove existing grid lines
    if (gridLines) {
        scene.remove(gridLines);
        gridLines = null;
    }
    
    // Create hexes
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            let x, y;
            if (hexOrientation === 'pointy') {
                // Pointy-top: offset odd rows
                x = (col - gridWidth / 2 + 0.5) * horizSpacing + (row % 2) * (horizSpacing / 2);
                y = (row - gridHeight / 2 + 0.5) * vertSpacing;
            } else {
                // Flat-top: offset odd columns
                x = (col - gridWidth / 2 + 0.5) * horizSpacing;
                y = (row - gridHeight / 2 + 0.5) * vertSpacing + (col % 2) * (vertSpacing / 2);
            }
            const hex = createHex(x, y, 0);
            scene.add(hex);
            hexes.push(hex);
            hexCenters.push({ row, col, x, y });
        }
    }
    
    // Draw grid lines once (no duplicates)
    const linePoints = [];
    const startAngle = hexOrientation === 'pointy' ? Math.PI / 2 : 0;
    
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            let cx, cy;
            if (hexOrientation === 'pointy') {
                cx = (col - gridWidth / 2 + 0.5) * horizSpacing + (row % 2) * (horizSpacing / 2);
                cy = (row - gridHeight / 2 + 0.5) * vertSpacing;
            } else {
                cx = (col - gridWidth / 2 + 0.5) * horizSpacing;
                cy = (row - gridHeight / 2 + 0.5) * vertSpacing + (col % 2) * (vertSpacing / 2);
            }
            
            // Get all 6 vertices of this hex
            const vertices = [];
            for (let i = 0; i < 6; i++) {
                const angle = startAngle + (i * Math.PI / 3);
                vertices.push({
                    x: cx + hexRadius * Math.cos(angle),
                    y: cy + hexRadius * Math.sin(angle)
                });
            }
            
            if (hexOrientation === 'pointy') {
                // Pointy-top: Draw top edge (vertex 5 to vertex 0)
                linePoints.push(new THREE.Vector3(vertices[5].x, vertices[5].y, 0));
                linePoints.push(new THREE.Vector3(vertices[0].x, vertices[0].y, 0));
                
                // Draw top-right edge (vertex 0 to vertex 1)
                linePoints.push(new THREE.Vector3(vertices[0].x, vertices[0].y, 0));
                linePoints.push(new THREE.Vector3(vertices[1].x, vertices[1].y, 0));
                
                // Draw right edge (vertex 1 to vertex 2)
                linePoints.push(new THREE.Vector3(vertices[1].x, vertices[1].y, 0));
                linePoints.push(new THREE.Vector3(vertices[2].x, vertices[2].y, 0));
                
                // Only draw bottom edges for bottom row
                if (row === 0) {
                    linePoints.push(new THREE.Vector3(vertices[2].x, vertices[2].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[3].x, vertices[3].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[3].x, vertices[3].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[4].x, vertices[4].y, 0));
                }
                
                // Only draw left edge for first column
                if (col === 0) {
                    linePoints.push(new THREE.Vector3(vertices[4].x, vertices[4].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[5].x, vertices[5].y, 0));
                }
            } else {
                // Flat-top: Draw top-right edge (vertex 0 to vertex 1)
                linePoints.push(new THREE.Vector3(vertices[0].x, vertices[0].y, 0));
                linePoints.push(new THREE.Vector3(vertices[1].x, vertices[1].y, 0));
                
                // Draw right edge (vertex 1 to vertex 2)
                linePoints.push(new THREE.Vector3(vertices[1].x, vertices[1].y, 0));
                linePoints.push(new THREE.Vector3(vertices[2].x, vertices[2].y, 0));
                
                // Draw bottom-right edge (vertex 2 to vertex 3)
                linePoints.push(new THREE.Vector3(vertices[2].x, vertices[2].y, 0));
                linePoints.push(new THREE.Vector3(vertices[3].x, vertices[3].y, 0));
                
                // Only draw left edges for first column
                if (col === 0) {
                    linePoints.push(new THREE.Vector3(vertices[3].x, vertices[3].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[4].x, vertices[4].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[4].x, vertices[4].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[5].x, vertices[5].y, 0));
                }
                
                // Only draw top-left edge for top row or even columns at top
                if (row === gridHeight - 1 || (col % 2 === 1 && row === gridHeight - 1)) {
                    linePoints.push(new THREE.Vector3(vertices[5].x, vertices[5].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[0].x, vertices[0].y, 0));
                }
                // Handle top edge for odd columns
                if (col % 2 === 0 && row === gridHeight - 1) {
                    linePoints.push(new THREE.Vector3(vertices[5].x, vertices[5].y, 0));
                    linePoints.push(new THREE.Vector3(vertices[0].x, vertices[0].y, 0));
                }
            }
        }
    }
    
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(gridLines);
    
    // Calculate grid bounds for scrolling
    calculateGridBounds();
    updateScrollbars();
}

// Calculate the bounds of the grid
function calculateGridBounds() {
    const totalWidth = gridWidth * horizSpacing;
    const totalHeight = gridHeight * vertSpacing;
    const padding = hexRadius * 2; // Add some padding
    
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
    e.preventDefault();
}, { passive: false });

// Initial grid generation
updateHexMetrics(); // Initialize metrics for default orientation
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

document.getElementById('apply-hex-size').addEventListener('click', () => {
    const newSize = Math.min(100, Math.max(10, parseInt(document.getElementById('hex-size').value) || 50));
    document.getElementById('hex-size').value = newSize;
    hexSizePx = newSize;
    updateHexMetrics();
    
    // Reset camera position when hex size changes
    cameraOffsetX = 0;
    cameraOffsetY = 0;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    
    generateGrid();
});

// Hex orientation controls
document.querySelectorAll('input[name="hex-orientation"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        hexOrientation = e.target.value;
        updateHexMetrics();
        
        // Reset camera position when orientation changes
        cameraOffsetX = 0;
        cameraOffsetY = 0;
        camera.position.set(0, 0, 10);
        camera.lookAt(0, 0, 0);
        
        generateGrid();
    });
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
        drawingCanvas.width = window.innerWidth;
        drawingCanvas.height = window.innerHeight;
    }
    // Update tag positions
    updateTagPositions();
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
    const intersects = raycaster.intersectObjects(hexes);
    if (intersects.length > 0) {
        const hex = intersects[0].object;
        const color = document.getElementById('hex-color').value;
        hex.material.color.setStyle(color);
        hex.material.opacity = 0.8; // slightly transparent so grid lines show through
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
    const intersects = raycaster.intersectObjects(hexes);
    
    if (intersects.length > 0) {
        const hex = intersects[0].object;
        selectedHex = hex;
        
        // Update Add Tag / Clear Tag option
        const addTagItem = document.getElementById('ctx-add-tag');
        if (hex.userData.tag) {
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

let selectedHex = null;

function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu.classList.contains('visible')) {
        contextMenu.classList.remove('visible');
        contextMenuOpen = true; // Flag to prevent hex fill on next click
    }
}

// Hide context menu when clicking elsewhere
window.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
        hideContextMenu();
    }
});

// Context menu actions
document.getElementById('ctx-clear-hex').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedHex) {
        // Clear fill
        selectedHex.material.opacity = 0;
        // Clear tag
        if (selectedHex.userData.tagElement) {
            selectedHex.userData.tagElement.remove();
            selectedHex.userData.tagElement = null;
            selectedHex.userData.tag = null;
        }
    }
    hideContextMenu();
});

document.getElementById('ctx-clear-fill').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedHex) {
        selectedHex.material.opacity = 0;
    }
    hideContextMenu();
});

document.getElementById('ctx-add-tag').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedHex) {
        if (selectedHex.userData.tag) {
            // Clear tag
            if (selectedHex.userData.tagElement) {
                selectedHex.userData.tagElement.remove();
                selectedHex.userData.tagElement = null;
                selectedHex.userData.tag = null;
            }
        } else {
            // Add tag - prompt for text
            const tagText = prompt('Enter tag text:');
            if (tagText && tagText.trim()) {
                addTagToHex(selectedHex, tagText.trim());
            }
        }
    }
    hideContextMenu();
});

function addTagToHex(hex, text) {
    // Remove existing tag if any
    if (hex.userData.tagElement) {
        hex.userData.tagElement.remove();
    }
    
    // Get hex screen position
    const hexPos = new THREE.Vector3(hex.position.x, hex.position.y, hex.position.z);
    hexPos.project(camera);
    const screenX = (hexPos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-hexPos.y * 0.5 + 0.5) * window.innerHeight;
    
    // Calculate hex size on screen
    const hexEdgePos = new THREE.Vector3(hex.position.x + hexRadius * 0.8, hex.position.y, hex.position.z);
    hexEdgePos.project(camera);
    const edgeScreenX = (hexEdgePos.x * 0.5 + 0.5) * window.innerWidth;
    const hexScreenRadius = Math.abs(edgeScreenX - screenX);
    
    // Create tag element
    const tagElement = document.createElement('div');
    tagElement.className = 'hex-tag';
    tagElement.textContent = text;
    tagElement.style.left = screenX + 'px';
    tagElement.style.top = screenY + 'px';
    tagElement.style.transform = 'translate(-50%, -50%)';
    
    // Size font to fit inside hex
    const maxWidth = hexScreenRadius * 1.6;
    tagElement.style.maxWidth = maxWidth + 'px';
    tagElement.style.fontSize = Math.max(8, Math.min(16, hexScreenRadius * 0.6)) + 'px';
    tagElement.style.overflow = 'hidden';
    tagElement.style.textOverflow = 'ellipsis';
    tagElement.style.whiteSpace = 'nowrap';
    
    document.body.appendChild(tagElement);
    
    // Store reference
    hex.userData.tag = text;
    hex.userData.tagElement = tagElement;
}

// Update tag positions on camera change
function updateTagPositions() {
    hexes.forEach(hex => {
        if (hex.userData.tagElement) {
            const hexPos = new THREE.Vector3(hex.position.x, hex.position.y, hex.position.z);
            hexPos.project(camera);
            const screenX = (hexPos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-hexPos.y * 0.5 + 0.5) * window.innerHeight;
            hex.userData.tagElement.style.left = screenX + 'px';
            hex.userData.tagElement.style.top = screenY + 'px';
            
            // Update font size based on hex size
            const hexEdgePos = new THREE.Vector3(hex.position.x + hexRadius * 0.8, hex.position.y, hex.position.z);
            hexEdgePos.project(camera);
            const edgeScreenX = (hexEdgePos.x * 0.5 + 0.5) * window.innerWidth;
            const hexScreenRadius = Math.abs(edgeScreenX - screenX);
            const maxWidth = hexScreenRadius * 1.6;
            hex.userData.tagElement.style.maxWidth = maxWidth + 'px';
            hex.userData.tagElement.style.fontSize = Math.max(8, Math.min(16, hexScreenRadius * 0.6)) + 'px';
        }
    });
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
        drawingCanvas.width = window.innerWidth;
        drawingCanvas.height = window.innerHeight;
        document.body.appendChild(drawingCanvas);
        drawingCtx = drawingCanvas.getContext('2d');
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
    drawingCtx.moveTo(event.clientX, event.clientY);
}

function onMouseMove(event) {
    if (!isMouseDown || (!isDrawing && !isErasing)) return;
    drawingCtx.lineTo(event.clientX, event.clientY);
    drawingCtx.stroke();
    drawingCtx.beginPath();
    drawingCtx.moveTo(event.clientX, event.clientY);
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

function placeIconOnMap(imageData, x, y, width = 80, height = 80) {
    const mapIcon = document.createElement('div');
    mapIcon.className = 'map-icon';
    mapIcon.style.left = (x - width / 2) + 'px';
    mapIcon.style.top = (y - height / 2) + 'px';
    mapIcon.style.width = width + 'px';
    mapIcon.style.height = height + 'px';
    
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

// Save Map functionality
document.getElementById('save-map').addEventListener('click', () => {
    // Collect all hex data
    const hexData = hexes.map((hex, index) => {
        const center = hexCenters[index];
        return {
            row: center.row,
            col: center.col,
            color: '#' + hex.material.color.getHexString(),
            opacity: hex.material.opacity,
            tag: hex.userData.tag || null
        };
    });
    
    // Get drawing canvas data
    let drawingData = null;
    if (drawingCanvas) {
        drawingData = drawingCanvas.toDataURL('image/png');
    }
    
    // Collect text labels
    const textLabels = [];
    document.querySelectorAll('.text-label').forEach(label => {
        textLabels.push({
            text: label.textContent,
            left: label.style.left,
            top: label.style.top,
            fontSize: label.style.fontSize,
            color: label.style.color
        });
    });
    
    // Collect map icons
    const mapIconsData = [];
    mapIcons.forEach(icon => {
        mapIconsData.push({
            imageData: icon.dataset.imageData,
            left: icon.style.left,
            top: icon.style.top,
            width: icon.style.width,
            height: icon.style.height
        });
    });
    
    // Build save object
    const saveData = {
        version: 1,
        gridWidth: gridWidth,
        gridHeight: gridHeight,
        hexSizePx: hexSizePx,
        hexOrientation: hexOrientation,
        bgColor: bgColor,
        bgImageData: bgImageData,
        hexes: hexData,
        drawingData: drawingData,
        textLabels: textLabels,
        mapIcons: mapIconsData,
        iconLibrary: iconLibrary,
        palette: palette
    };
    
    // Create and download JSON file
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hexmap_' + new Date().toISOString().slice(0, 10) + '.json';
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
            
            // Validate version
            if (!saveData.version) {
                alert('Invalid map file format.');
                return;
            }
            
            // Restore settings
            gridWidth = saveData.gridWidth || 20;
            gridHeight = saveData.gridHeight || 20;
            hexSizePx = saveData.hexSizePx || 50;
            hexOrientation = saveData.hexOrientation || 'flat';
            
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
            document.getElementById('hex-size').value = hexSizePx;
            document.getElementById('hex-pointy').checked = hexOrientation === 'pointy';
            document.getElementById('hex-flat').checked = hexOrientation === 'flat';
            
            // Update metrics and regenerate grid
            updateHexMetrics();
            
            // Reset camera
            cameraOffsetX = 0;
            cameraOffsetY = 0;
            camera.position.set(0, 0, 10);
            camera.lookAt(0, 0, 0);
            
            generateGrid();
            
            // Restore hex colors and tags
            if (saveData.hexes) {
                saveData.hexes.forEach(hexData => {
                    const index = hexData.row * gridWidth + hexData.col;
                    if (index < hexes.length) {
                        const hex = hexes[index];
                        hex.material.color.setStyle(hexData.color);
                        hex.material.opacity = hexData.opacity;
                        if (hexData.tag) {
                            addTagToHex(hex, hexData.tag);
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
                    label.style.left = labelData.left;
                    label.style.top = labelData.top;
                    label.style.fontSize = labelData.fontSize;
                    label.style.color = labelData.color;
                    label.style.cursor = 'move';
                    label.style.userSelect = 'none';
                    label.style.zIndex = '1001';
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
                    const icon = placeIconOnMap(
                        iconData.imageData, 
                        parseInt(iconData.left) + parseInt(iconData.width) / 2,
                        parseInt(iconData.top) + parseInt(iconData.height) / 2,
                        parseInt(iconData.width),
                        parseInt(iconData.height)
                    );
                });
                setActiveMapIcon(null); // Deselect all after restore
            }
            
            alert('Map imported successfully!');
        } catch (err) {
            alert('Error importing map: ' + err.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input so same file can be imported again
    e.target.value = '';
});