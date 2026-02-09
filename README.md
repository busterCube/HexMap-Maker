# Hex Map Maker

A WebGL application for creating and editing hexagonal maps using Three.js. Perfect for tabletop RPG maps, strategy game boards, and world-building projects.

## Features

### Grid & Display
- **Customizable Grid Size** - Create grids from 1x1 up to 300x300 hexes
- **Hex Orientation** - Choose between pointy-top or flat-top hexagons
- **Adjustable Hex Size** - Scale hexes from 10px to 200px
- **Background Options** - Set a solid background color or import a background image
- **Scrolling & Navigation** - Scroll large maps using mouse wheel, shift+wheel for horizontal, or drag scrollbars

### Hex Editing
- **Color Fill** - Click any hex to fill it with the selected color
- **Color Picker** - Use the color picker or enter hex codes directly
- **Hex Tags** - Right-click a hex to add a text tag (displayed on the hex)
- **Clear Hex** - Right-click to reset a hex to default or clear its tag

### Color Palette
- **Save Colors** - Add frequently used colors to your palette (up to 30 colors)
- **Named Colors** - Give each palette color a custom name
- **Quick Select** - Click any palette color to use it for filling
- **Palette Management** - Remove colors or rename them as needed

### Drawing Tools
- **Freehand Drawing** - Draw lines and shapes directly on the map
- **Customizable Lines** - Adjust line color and thickness (1-20px)
- **Eraser Tool** - Erase parts of your drawings
- **Clear All Drawings** - Remove all freehand drawings at once

### Text Tool
- **Add Text Labels** - Click anywhere to add text to your map
- **Customizable Text** - Adjust font size (8-72px) and color
- **Draggable Labels** - Move text labels by dragging them
- **Edit/Delete** - Right-click labels to edit or remove them

### Border Tool
- **Individual Borders** — Click on square edges to add borders
- **Customizable Borders** — Choose border color and thickness (1–10px)
- **Remove Borders** — Toggle removal mode to click and remove individual borders
- **Clear All Borders** — Remove every border at once
- **Border Palette** — Maintain a separate palette for border colors with save/import

### Icon System
- **Icon Library** - Import up to 40 custom icons (PNG, JPG, GIF, SVG)
- **Place Icons** - Select an icon and click on the map to place it
- **Resize Icons** - Drag corner/edge handles to resize placed icons
- **Move Icons** - Drag icons to reposition them
- **Delete Icons** - Right-click an icon to remove it

### Save & Export
- **Save Map** - Export your entire map as a JSON file
- **Load Map** - Import previously saved maps
- **Save Palette** - Export just your color palette
- **Load Palette** - Import a saved palette into any map

---

## Saving System

### Save Map (Full Project Save)
Saves **everything** about your map project to a JSON file:

| Data | Description |
|------|-------------|
| Grid Settings | Width, height, hex size, orientation |
| Background | Background color and/or background image |
| Hex Data | Color and opacity of every hex |
| Hex Tags | All text tags attached to hexes |
| Drawings | All freehand drawings (as image data) |
| Text Labels | All text labels with position, size, and color |
| Map Icons | All placed icons with position and size |
| Icon Library | Your imported icon images |
| Color Palette | All saved palette colors with names |

**File format:** `hexmap_YYYY-MM-DD.json`

### Save Palette (Colors Only)
Saves **only your color palette** for reuse across different maps:

| Data | Description |
|------|-------------|
| Colors | All palette color hex codes |
| Names | Custom names for each color |

**File format:** `hexmap_palette_YYYY-MM-DD.json`

This is useful when you want to maintain consistent colors across multiple map projects (e.g., a "forest" palette or "desert" palette).

---

## Getting Started

### Run Via Webpage

1. Open Webpage: https://bustercube.github.io/HexMap-Maker/

---

## Walkthrough: Creating Your First Hex Map

### Step 1: Set Up Your Grid
1. Open the **Tools Menu** (☰ button, top-left)
2. Under **Grid Settings**, set your desired width and height (e.g., 20x15)
3. Choose hex orientation: **Pointy Top** or **Flat Top**
4. Adjust **Hex Size** if needed (default 50px works well)
5. Click **Apply Grid Size**

### Step 2: Set Up Your Background
1. Under **Background**, choose a background color using the color picker
2. Click **Apply Background Color**
3. Alternatively, click **Import Background Image** to use an image

### Step 3: Create Your Color Palette
1. Under **Hex Fill Color**, select a color you'll use frequently (e.g., green for forests)
2. Click **Add to Palette**
3. Click the color name below it to rename it (e.g., "Forest")
4. Repeat for other terrain types: blue for water, tan for desert, gray for mountains, etc.

### Step 4: Paint Your Terrain
1. Select a color from your palette or the color picker
2. **Left-click** on hexes to fill them with that color
3. Work through your map, filling in terrain regions

### Step 5: Add Tags to Important Hexes
1. **Right-click** on a hex you want to label
2. Select **Add Tag**
3. Enter a short name (e.g., "Town", "River", "Castle")
4. The tag appears on the hex

### Step 6: Add Text Labels
1. Under **Text Tool**, click **Enable Text Tool**
2. Adjust font size and color as needed
3. Click anywhere on the map to place text
4. Type your label and press **Enter** or click away
5. Drag labels to reposition them
6. Click **Disable Text Tool** when done

### Step 7: Draw Roads, Rivers, or Borders
1. Under **Drawing Tools**, click **Enable Drawing**
2. Set your line color and thickness
3. Draw freehand on the map (hold mouse button and drag)
4. Use **Enable Eraser** to fix mistakes
5. Click **Disable Drawing** when done

### Step 8: Add Icons
1. Under **Icons**, click **Import Icon** to add icon images
2. Click an icon in your library to select it (highlighted in blue)
3. Click on the map to place the icon
4. Drag corners/edges to resize, drag center to move
5. Right-click an icon to delete it
6. Click the selected icon again to deselect it

### Step 9: Save Your Work
1. Open the **System Menu** (⚙ button, top-right)
2. Click **Save Map** to download your complete map
3. Optionally, click **Save Palette** to save just your colors for other projects

### Step 10: Continue Later
1. Open the **System Menu**
2. Click **Import Map** and select your saved JSON file
3. Your entire map is restored exactly as you left it!

---

## Tips & Tricks

- **Large Maps**: For maps larger than your screen, use mouse wheel to scroll vertically, or hold Shift + wheel to scroll horizontally
- **Consistent Colors**: Create and save a palette early, then load it into new maps for consistent terrain colors
- **Icons**: Prepare your icons as transparent PNGs for best results
- **Backup**: Save your map frequently, especially before major changes
- **Background Images**: Use a background image as a reference, then trace over it with hex colors

---

## Technologies

- Three.js for WebGL rendering
- Vanilla JavaScript (no frameworks)
- HTML5 Canvas for drawing tools
- HTTP Server for local development

---

# Dungeon Maker

A square-grid map editor for creating dungeon layouts, battle maps, and interior spaces. Accessible from the Hex Map Maker's System menu or directly via `dungeon-maker.html`.

## Features

### Grid & Display
- **Customizable Grid Size** — Create grids from 1×1 up to 300×300 squares
- **Adjustable Square Size** — Scale squares from 10px to 100px
- **Background Options** — Set a solid background color or import a background image
- **Dark Mode** — Toggle between light and dark appearance

### Square Editing
- **Color Fill** — Click any square to fill it with the selected color
- **Color Picker** — Use the color picker or enter hex codes directly
- **Clear Square** — Right-click a square to reset it

### Color Palette
- **Save Colors** — Add frequently used colors to your palette
- **Named Colors** — Give each palette color a custom name
- **Quick Select** — Click any palette color to use it for filling
- **Save / Import Palette** — Export or import palettes for reuse across projects

### Border Tool
- **Individual Borders** — Click on square edges to add borders
- **Customizable Borders** — Choose border color and thickness (1–10px)
- **Remove Borders** — Toggle removal mode to click and remove individual borders
- **Clear All Borders** — Remove every border at once
- **Border Palette** — Maintain a separate palette for border colors with save/import

### Drawing Tools
- **Freehand Drawing** — Draw lines and shapes directly on the map
- **Customizable Lines** — Adjust line color and thickness (1–10px)
- **Eraser Tool** — Erase parts of your drawings
- **Clear All Drawings** — Remove all freehand drawings at once

### Text Tool
- **Add Text Labels** — Click anywhere to add text to your map
- **Customizable Text** — Adjust font size (10–50px) and color
- **Text Box Frame** — Optionally show a frame around text
- **Draggable Labels** — Move text labels by dragging them
- **Edit/Delete** — Right-click labels to edit or remove them

### Icon System
- **Icon Library** — Import up to 40 custom icons
- **Place Icons** — Select an icon and click on the map to place it
- **Resize & Move** — Drag handles to resize, drag center to move
- **Delete Icons** — Right-click an icon to remove it

### RNG (Random Number Generators)
- **Add RNGs** — Create random number generators with custom min/max ranges
- **Roll** — Generate random results on demand
- **Save / Import RNGs** — Export and import RNG configurations

### Save & Export
- **Save Dungeon** — Export the entire dungeon as a JSON file
- **Import Dungeon** — Load a previously saved dungeon

## Dungeon Saving System

| Data | Description |
|------|-------------|
| Grid Settings | Width, height, square size |
| Background | Background color and/or background image |
| Square Data | Color of every filled square |
| Borders | All individual border customizations (color, thickness, position) |
| Drawings | All freehand drawings (as image data) |
| Text Labels | All text labels with position, size, and color |
| Icons | All placed icons with position and size |
| Icon Library | Imported icon images |
| Color Palette | Saved fill palette colors with names |
| Border Palette | Saved border palette colors with names |
| RNG List | All random number generator configurations |

**File format:** `dungeon_YYYY-MM-DD.json`

### Navigation
The System menu includes navigation buttons to switch between the Hex Map Maker, Dungeon Maker, and Character Sheet.

---

# Character Sheet Maker

A freeform canvas editor for building interactive character sheets, inventory trackers, and custom game forms. Accessible from the System menu navigation or directly via `character-sheet.html`.

## Features

### Canvas & Layout
- **Adjustable Canvas Size** — Set width and height from 500px to 10,000px to create sheets larger than the viewport
- **Scrollable Workspace** — Automatically enables scrollbars when content exceeds the viewport
- **Grid Overlay** — Toggle a pixel grid with adjustable size (5–100px)
- **Snap to Grid** — Snap placed elements to the grid for precise alignment
- **Background Options** — Set a solid background color or upload a background image

### Drawing Tool
- **Freehand Drawing** — Draw directly on the canvas
- **Customizable Lines** — Adjust line color and thickness (1–10px)
- **Eraser Tool** — Erase parts of your drawings
- **Clear All Drawings** — Remove all freehand drawings at once

### Text Tool
- **Add Text Labels** — Click anywhere to place editable text
- **Customizable Text** — Adjust font size (10–100px) and color
- **Text Box Frame** — Optionally show a frame around text with adjustable opacity
- **Draggable & Resizable** — Move and resize text boxes
- **Lockable** — Lock text in place to prevent accidental moves
- **Copy & Paste** — Right-click to copy, right-click canvas to paste

### Frame Tool
- **Titled Frames** — Place bordered frames with customizable titles
- **Title Options** — Set title text, font size, placement (left/center/right), and color
- **Border Customization** — Adjust border color and thickness (1–20px)
- **Background** — Set frame background color and opacity
- **Lockable** — Lock frames to prevent accidental moves
- **Copy & Paste** — Duplicate frames via right-click

### Number Entry Tool
- **Numeric Inputs** — Place number input boxes on the sheet
- **Range Limits** — Set optional min and max values
- **Customizable Appearance** — Adjust font size, text color, background color, bold, and italic
- **Lockable** — Lock entries to prevent accidental moves
- **Copy & Paste** — Duplicate number entries via right-click

### Label Tool
- **Heading Labels** — Place styled text labels for section headers
- **Customizable Appearance** — Adjust font size (10–100px), color, letter spacing, bold, italic, and underline
- **Lockable** — Lock labels in place
- **Copy & Paste** — Duplicate labels via right-click

### Button Tool
- **Interactive Buttons** — Place clickable buttons on the sheet
- **Customizable Appearance** — Set button text, font size, text color, button color, bold, and italic
- **Programmable Actions** — Right-click to edit button actions via an event/task system
- **Lockable** — Lock buttons in place
- **Copy & Paste** — Duplicate buttons via right-click

### List Box Tool
- **Item Lists** — Place list boxes for inventory, equipment, or any collection
- **Titled Lists** — Set a title with customizable font size and color
- **Item Management** — Type items to add; right-click items to adjust count, set amount, or delete
- **Customizable Appearance** — Adjust text size, text color, background color, button color, border size, and border color
- **Lockable** — Lock list boxes in place
- **Copy & Paste** — Duplicate list boxes via right-click

### Image Tool
- **Image Library** — Import up to 40 custom images (PNG, JPG, GIF, SVG)
- **Place Images** — Enable placement mode, select an image, then click the canvas
- **Resize & Move** — Drag handles to resize, drag center to reposition
- **Rotate** — Right-click to rotate 90°
- **Layer Order** — Bring to front or send to back
- **Lockable** — Lock images in place

### RNG (Random Number Generators)
- **Add RNGs** — Create random number generators with custom min/max ranges
- **Linked RNGs** — Link multiple RNGs to roll them together
- **Roll Results** — Results display on-screen with animated notifications

### Event System (Button Actions)
Buttons can be programmed with a visual task editor to create interactive character sheets:
- **RNG Roll** — Roll a specific RNG and optionally display the result
- **Set Number Entry** — Update a number entry to a fixed or calculated value
- **Print** — Display a labeled value on screen
- **And More** - Find many more features in the Even System to customize your sheet!

## Character Sheet Saving System

| Data | Description |
|------|-------------|
| Canvas Settings | Canvas width and height |
| Background | Background color and/or background image |
| Drawings | All freehand drawings (as image data) |
| Text Elements | All text labels with position, size, color, lock state |
| Frames | All frames with title, border, background, and lock state |
| Number Entries | All number inputs with value, range, styling, and lock state |
| Labels | All labels with text, styling, and lock state |
| Buttons | All buttons with text, styling, actions, and lock state |
| List Boxes | All list boxes with items, counts, styling, and lock state |
| Icons / Images | All placed images with position, size, rotation, and lock state |
| Icon Library | Imported image files |
| RNG List | All random number generator configurations and links |
| Event Variables | Variables used by the button event system |

**File format:** `character_sheet_YYYY-MM-DD.json`

---