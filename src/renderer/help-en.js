// Rehberin (F1) İngilizce metni. Anahtarlar index.html'deki data-help-section adlarıdır;
// Türkçe bölüm değişince buradaki karşılığını da güncelle. "keys" bölümündeki id'ler app.js'te kullanılır.

export const HELP_EN = {
  start: `
    <h3>What is Whiteboard?</h3>
    <p>An infinitely large canvas. You can write and draw with a pen and put shapes, text, sticky notes, images, PDF pages and Obsidian notes on the same board. The board is saved automatically after every change; the label at the top left says <b>Saved</b> or <b>Saving…</b>.</p>

    <h3>Your first drawing</h3>
    <ol>
      <li>Pick the pen from the toolbar at the top (or press <kbd>2</kbd>) and draw on the board.</li>
      <li>Made a mistake? Undo with <kbd>Ctrl+Z</kbd>, redo with <kbd>Ctrl+Y</kbd>.</li>
      <li>To move something you drew, switch to the Select tool with <kbd>1</kbd>, click it and drag.</li>
      <li>Change color and thickness in the <b>properties panel</b> below the toolbar (see below).</li>
    </ol>

    <h3>Screen layout</h3>
    <ul>
      <li><b>Top center – toolbar:</b> pens, eraser, ruler, shapes, text/note, insert tools, undo / redo.</li>
      <li><b>Top left:</b> the menu button (☰), the <b>My boards</b> gallery and the save status.</li>
      <li><b>Below the toolbar – properties panel:</b> changes with the selected tool or objects; color, thickness, fill, font size, brush type and similar settings live here. The arrow on its bottom edge hides it.</li>
      <li><b>Bottom right:</b> zoom out / in, click the percentage to return to 100%, and the "fit all" button.</li>
    </ul>

    <h3>Tool groups</h3>
    <p>Similar tools (pens, shapes, text/note, insert) are grouped into one button. The button shows <b>the tool you used last</b>. To reach the other tools in the group:</p>
    <ul>
      <li><b>click the active button again</b>, or</li>
      <li><b>right-click</b> the button, or</li>
      <li><b>press and hold</b> the button for half a second (right-clicking is hard with a pen).</li>
    </ul>
    <p class="tip">The small letter/number badges on the tools are their shortcut keys. Hover over a tool to see its description.</p>

    <h3>Moving around the board</h3>
    <ul>
      <li><b>Scrolling:</b> mouse wheel (<kbd>Shift</kbd> + wheel for horizontal), two fingers on a touchpad.</li>
      <li><b>Grab and drag:</b> hold <kbd>Space</kbd> and drag, or drag with the <b>middle mouse button</b>. The "Pan" (hand) tool in the toolbar does the same.</li>
      <li><b>Zoom:</b> <kbd>Ctrl</kbd> + wheel (zooms toward the cursor), <kbd>Ctrl +</kbd> / <kbd>Ctrl -</kbd>, or pinch with two fingers on a touch screen.</li>
      <li><b>Back to 100%:</b> <kbd>Ctrl+0</kbd>. <b>Fit the whole drawing on screen:</b> <kbd>Ctrl+1</kbd>.</li>
    </ul>
    <p class="tip">The board's last view (position and zoom) is stored with the file, so you continue where you left off when you open it.</p>
  `,

  draw: `
    <h3>Pen <kbd>2</kbd> / <kbd>P</kbd></h3>
    <p>The freehand drawing tool. With a pressure-sensitive stylus the line gets thicker as you press harder. The back end of the stylus (eraser end), if it has one, always erases.</p>
    <h4>Brush types</h4>
    <p>Chosen from the top row of the properties panel while the pen is selected. They can also be applied to selected lines:</p>
    <ul>
      <li><kbd>Alt+1</kbd> <b>Pen</b> – plain, standard line.</li>
      <li><kbd>Alt+2</kbd> <b>Calligraphy</b> – slanted sharp nib; the line thins and thickens with direction.</li>
      <li><kbd>Alt+3</kbd> <b>Brush pen</b> – thick when drawn slowly, thin when fast; pointed ends.</li>
      <li><kbd>Alt+4</kbd> <b>Fountain pen</b> – ink with slightly varying thickness.</li>
      <li><kbd>Alt+5</kbd> <b>Dashed</b> – a dashed line.</li>
      <li><kbd>Alt+6</kbd> <b>Arrow</b> – adds an arrowhead to the end of the line.</li>
      <li><kbd>Alt+7</kbd> <b>Dashed arrow</b> – draws a dashed line with an arrowhead at the end.</li>
      <li><kbd>Alt+8</kbd> <b>Rainbow</b> – has its own colors; the color choice does not apply.</li>
      <li><kbd>Alt+9</kbd> <b>Galaxy</b> – starry space ink; pick the classic space colors or another tone (including a custom color) from the color row. The color of selected galaxy lines can be changed later too.</li>
      <li><kbd>Alt+0</kbd> <b>Tape</b> – patterned sticky tape (washi).</li>
      <li><b>Hatched</b> – fills the area enclosed by your path with thin slanted lines (like showing the filled part in a physics diagram). Trace around the inside of the shape; the area closes when you lift the pen. Pick the hatch direction in the panel: slanted, reverse slanted or crosshatch. The width sets how dense the hatching is. A hatched area is never converted to a shape and the eraser removes it as a whole. It has no shortcut.</li>
    </ul>
    <p class="tip">The brush shortcuts (<kbd>Alt+1</kbd> … <kbd>Alt+0</kbd>) switch to the Pen and pick that brush from any tool. If pen lines are selected, the brush is applied to them.</p>
    <h4>Drawing straight lines</h4>
    <p>Hold <kbd>Shift</kbd> or <kbd>Ctrl</kbd> while drawing: from the point where you pressed the key, a perfectly straight line comes out. The line snaps to horizontal, vertical and 45° angles.</p>
    <h4>Convert to shape</h4>
    <p>While the <b>Convert to shape</b> button in the properties panel is on, hand-drawn lines, triangles, quadrilaterals, pentagons and circles are turned into clean shapes. This works with all pen brush types except <b>Arrow</b> and <b>Dashed arrow</b> (no conversion with the highlighter). Special brushes keep their look; only their outline becomes a clean shape. The conversion is a separate undo step: <kbd>Ctrl+Z</kbd> brings back the hand drawing. It is not applied if you used a straight line (Shift/Ctrl) or the ruler. Turn the button off if you don't want it.</p>

    <h3>Highlighter <kbd>3</kbd> / <kbd>H</kbd></h3>
    <p>A thick, semi-transparent marker for highlighting text or drawings without covering them.</p>

    <h3>Temporary highlighter <kbd>4</kbd> / <kbd>G</kbd></h3>
    <p>Use it like a pointer when presenting or explaining. What you draw <b>stays while you hold it</b> and slowly fades when you let go. It is not saved to the board and does not enter the undo history.</p>

    <h3>Laser pointer <kbd>W</kbd></h3>
    <p>For pointing while explaining or screen sharing. The cursor becomes a glowing dot; press and drag to leave a trail that is visible briefly and then fades. Pick its color in the properties panel (red by default). Nothing is added to the board. It is in the pens group.</p>

    <h3>Eraser <kbd>5</kbd> / <kbd>E</kbd></h3>
    <ul>
      <li><b>Whole line:</b> erases the entire line you touch.</li>
      <li><b>Partial:</b> erases only where the eraser passes; the line is split in two.</li>
      <li><b>Also erase notes and images:</b> when off, the eraser only touches lines and shapes; when on, it also erases notes, text and images. Off by default so you don't erase an image by accident.</li>
    </ul>

    <h3>Ruler <kbd>6</kbd> / <kbd>R</kbd></h3>
    <p>Places a semi-transparent ruler on the screen; press again to remove it. The ruler is not saved to the board; it is only a drawing aid.</p>
    <ul>
      <li><b>Move:</b> grab the body of the ruler and drag. Pressing on the ruler moves it whatever tool is selected.</li>
      <li><b>Rotate:</b> grab the blue button and turn, or turn the <b>mouse wheel</b> while the cursor is over the ruler (1° steps, 15° with <kbd>Shift</kbd>). When rotating with the button it snaps to horizontal, vertical and 45°; with <kbd>Shift</kbd> it turns in 15° steps.</li>
      <li><b>Straight line:</b> start the pen (or highlighter) right next to the ruler's edge; the line follows that edge perfectly straight.</li>
    </ul>

    <h3>Shapes</h3>
    <p><b>Rectangle</b> <kbd>7</kbd>/<kbd>D</kbd>, <b>Ellipse</b> <kbd>8</kbd>/<kbd>O</kbd>, <b>Line</b> <kbd>9</kbd>/<kbd>L</kbd>, <b>Arrow</b> <kbd>0</kbd>/<kbd>A</kbd>. Press and drag on the board to draw.</p>
    <ul>
      <li>With <kbd>Shift</kbd>: the rectangle becomes a square, the ellipse a circle; lines and arrows snap to 15° angles.</li>
      <li><b>Fill:</b> for rectangles and ellipses choose <i>None</i>, <i>Light</i> (semi-transparent) or <i>Solid</i> in the panel.</li>
      <li>Color and thickness are set in the panel; they also apply to selected shapes.</li>
    </ul>
  `,

  edit: `
    <h3>Select <kbd>1</kbd> / <kbd>V</kbd></h3>
    <ul>
      <li><b>One object:</b> click it. A frame and corner handles appear around it.</li>
      <li><b>Several objects:</b> starting from an empty spot, draw around the objects (<b>lasso</b>); or hold <kbd>Shift</kbd> and click to add / remove them one by one. <kbd>Ctrl+A</kbd> selects everything.</li>
      <li><b>Clear the selection:</b> click an empty spot or press <kbd>Esc</kbd>.</li>
    </ul>

    <h3>Moving, resizing and rotating</h3>
    <ul>
      <li><b>Move:</b> drag the selected object or press the arrow keys (1 pixel; 10 pixels with <kbd>Shift</kbd>).</li>
      <li><b>Resize:</b> drag a corner handle. Rectangles, ellipses, polygons and notes resize freely; other objects keep their proportions.</li>
      <li><b>Rotate:</b> drag the round handle above the selection; the object turns 360° around its own center and the angle is shown next to it. It snaps near 0°, 90°, 180° and 270°; with <kbd>Shift</kbd> held it turns in 15° steps. <b>↺ 90°</b> / <b>↻ 90°</b> in the panel turn a quarter turn. With several objects selected they all rotate together. Rotated objects keep their proportions when resized; a rotated image cannot be cropped. The coordinate system cannot be rotated.</li>
      <li><b>Line and arrow ends:</b> with a single line or arrow selected, move each end separately using the handles at its two ends.</li>
    </ul>

    <h3>Copying and duplicating</h3>
    <ul>
      <li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+X</kbd> / <kbd>Ctrl+V</kbd>: copy, cut, paste. Pasted objects appear where the cursor is.</li>
      <li><kbd>Ctrl+D</kbd> or <b>Duplicate</b> in the panel: copies the selection right next to it.</li>
      <li>You can also copy and paste into another board.</li>
      <li><b>Scissors</b> (<kbd>S</kbd>): to take only part of a drawing, drag a rectangle around that part. Lines crossing the rectangle are cut at its border and the pieces inside are selected; then cut with <kbd>Ctrl+X</kbd>, copy with <kbd>Ctrl+C</kbd>, drag them apart or delete with <kbd>Delete</kbd>. <kbd>Ctrl+Z</kbd> rejoins the cut lines. Images, text, notes and filled shapes are not cut; if inside the rectangle they are selected whole.</li>
    </ul>

    <h3>Ordering and deleting</h3>
    <ul>
      <li><kbd>]</kbd> brings to front, <kbd>[</kbd> sends to back (<b>Front</b> / <b>Back</b> in the panel). Decides which of overlapping objects stays on top.</li>
      <li><kbd>Delete</kbd> or <kbd>Backspace</kbd> deletes the selection (<b>Delete</b> in the panel).</li>
    </ul>

    <h3>Properties panel</h3>
    <p>The panel below the toolbar changes with what you are doing: brush, color and thickness with the pen; fill with a shape; font size with text; note color with a note; eraser settings with the eraser. If an object is selected, your change applies to <b>that object</b>; otherwise it applies to <b>your next drawings</b>.</p>
    <ul>
      <li>The <b>arrow</b> on the panel's bottom edge hides the panel. While hidden, the arrow stays right below the toolbar (the dot next to it shows the selected color); click it to bring the panel back.</li>
      <li>While the <b>pin</b> next to the arrow is on (the default), the panel opens and closes only with the arrow, and if you leave it hidden it stays hidden when you switch tools. With the pin off, the panel hides itself when you start drawing and reappears when you change tools or select an object.</li>
    </ul>

    <h3>Comments <kbd>Ctrl+Shift+M</kbd></h3>
    <ul>
      <li>Like in Notion, you can comment on any object: select a single object and press <b>Comment</b> in the panel or <kbd>Ctrl+Shift+M</kbd>. Type in the popup; <kbd>Enter</kbd> sends (<kbd>Shift+Enter</kbd> for a new line).</li>
      <li>An object with comments shows a yellow <b>badge</b> with the comment count at its top-right corner; click it to open the comments. Hover a comment to <b>edit</b> or <b>delete</b> it.</li>
      <li><b>✓</b> marks the comments as <b>resolved</b> and hides the badge. Select the object and open <b>Comments</b> from the panel to reopen them, or write a new comment (a new comment reopens the thread).</li>
      <li>Comments are saved with the board, can be undone with <kbd>Ctrl+Z</kbd> and are found by <kbd>Ctrl+F</kbd>. They don't appear in exported images and PDFs. Duplicated or copied objects don't take the comments along; cut and paste moves them.</li>
      <li>Turning off <b>Show comments</b> in the menu (☰) hides the badges (handy when presenting).</li>
    </ul>

    <h3>Searching the board <kbd>Ctrl+F</kbd></h3>
    <ul>
      <li>A search box opens at the top right. It searches text, sticky notes, the titles of Obsidian sections and the functions in coordinate systems.</li>
      <li>Matches are marked with a yellow frame, and the current one is centered on screen. <kbd>Enter</kbd> next, <kbd>Shift+Enter</kbd> previous; <kbd>Esc</kbd> closes.</li>
      <li>Handwritten (pen-drawn) writing cannot be searched.</li>
    </ul>

    <h3>Cropping images</h3>
    <ul>
      <li>With an image (PDF page, screenshot) selected, press <b>Crop</b> in the panel or <b>double-click</b> the image.</li>
      <li>Drag the edges and corners of the white frame, or grab inside it to move it. The part outside is dimmed.</li>
      <li><kbd>Enter</kbd> or <b>Apply</b> crops, <b>Reset</b> returns the frame to the whole image, <kbd>Esc</kbd> or <b>Cancel</b> cancels. The cropped part is removed from the file (the board gets smaller); <kbd>Ctrl+Z</kbd> restores the image.</li>
    </ul>

    <h3>Undo / redo</h3>
    <p><kbd>Ctrl+Z</kbd> and <kbd>Ctrl+Y</kbd> (or <kbd>Ctrl+Shift+Z</kbd>). Every drawing, move, deletion and setting change is a separate step. The arrows at the right of the toolbar do the same.</p>
  `,

  text: `
    <h3>Text <kbd>T</kbd></h3>
    <ul>
      <li>Click an empty spot on the board and start typing. Clicking existing text edits it.</li>
      <li>To finish, press <kbd>Esc</kbd> or <kbd>Ctrl+Enter</kbd>, or click somewhere else. Empty text is removed automatically.</li>
      <li>With the Select tool, <b>double-click</b> text to edit it later.</li>
      <li>Color and font size are chosen in the panel; they also apply to selected text.</li>
    </ul>

    <h3>Sticky note <kbd>N</kbd></h3>
    <ul>
      <li>A colored note paper opens where you click and you can type right away. The note grows taller as you type.</li>
      <li>Change the note color and font size in the panel.</li>
      <li>Resize it with the handles and move it by dragging.</li>
    </ul>

    <h3>Pasting from the clipboard</h3>
    <p>If you paste <b>plain text</b> copied from elsewhere with <kbd>Ctrl+V</kbd>, it becomes a text object where the cursor is. A copied <b>image</b> (e.g. a screenshot) is inserted as an image.</p>
  `,

  insert: `
    <h3>Inserting images <kbd>I</kbd></h3>
    <p>There are three ways:</p>
    <ul>
      <li>Click the image button in the <b>Insert</b> group of the toolbar (or press <kbd>I</kbd>) and choose the file. You can choose several files.</li>
      <li><b>Drag and drop</b> the file from Explorer onto the board. It is inserted where you drop it.</li>
      <li>Paste an image from the clipboard with <kbd>Ctrl+V</kbd> (e.g. a screenshot taken with <kbd>Win+Shift+S</kbd>).</li>
    </ul>
    <p>The inserted image is embedded in the board file; it stays on the board even if you delete the original. Very large images make the board file large too.</p>

    <h3>Inserting PDFs</h3>
    <p>Choose the PDF with the image button or drag it onto the window. <b>Each page is inserted as a separate image</b>, one below the other; you can take notes on them with the pen.</p>
    <p>For multi-page PDFs you are asked which pages to insert: <b>All pages</b>, a list like <code>1-5, 8, 11-13</code> in the <b>Pages</b> box (<code>11-</code> means from page 11 to the end), or <b>a number of pages starting from a page</b> (e.g. starting at page 12, 4 pages → 12-15). Inserting many pages can take a while.</p>

    <h3>Insert from Obsidian <kbd>B</kbd></h3>
    <p>Puts a note (or part of a note) from your Obsidian vault onto the board as an image that <b>looks close to how it appears in Obsidian</b>. Formulas (KaTeX), callouts, [[links]], images, highlights and task lists are supported.</p>
    <ol>
      <li>Press <kbd>B</kbd> or click the Obsidian button in the Insert group of the toolbar.</li>
      <li>Choose the vault in the window that opens (if it isn't found, point to it with "Choose vault folder…").</li>
      <li>Type the note's name in the search box at the top; move with <kbd>↑</kbd> <kbd>↓</kbd>, choose the note with <kbd>Enter</kbd>.</li>
      <li>Choose the <b>whole</b> note, a <b>heading</b> (with its subheadings) or a <b>block</b>. A preview appears on the right.</li>
      <li>Set the width with <i>Narrow / Medium / Wide</i>.</li>
      <li>Press <b>Insert into board</b> (or <kbd>Ctrl+Enter</kbd>).</li>
    </ol>
    <h4>After inserting</h4>
    <ul>
      <li><b>Double-click</b> the inserted section to open the note in Obsidian at that section (<b>Open in Obsidian</b> in the panel).</li>
      <li>If you changed the note in Obsidian, select the section and press <b>Refresh from source</b> in the panel. To update all Obsidian sections on the board at once, use <b>Refresh Obsidian sections</b> in the menu.</li>
      <li>The section is moved, resized, copied and deleted like an ordinary image.</li>
    </ul>
    <p class="tip">Obsidian must be installed on your computer and the vault must have been opened in Obsidian before.</p>
  `,

  boards: `
    <h3>What is a board and where is it stored?</h3>
    <p>Each board is a single <b>.tahta</b> file. The folder the boards live in is called a <b>vault</b>. The default vault is the <i>Documents\\Beyaz Tahta</i> folder. Opening a folder as a vault does not move the files in it.</p>

    <h3>My boards gallery <kbd>Ctrl+G</kbd></h3>
    <p>Shows all boards in the vault with thumbnails.</p>
    <ul>
      <li>Click a card or press <kbd>Enter</kbd>: open the board.</li>
      <li>The search box at the top: search the boards; <kbd>Enter</kbd> opens the first result.</li>
      <li><b>New board</b> (<kbd>Ctrl+N</kbd>): starts an empty board.</li>
      <li>The pencil icon on a card or <kbd>F2</kbd>: <b>rename</b>. The trash icon: <b>delete</b> (asks for confirmation).</li>
      <li><b>Show in Explorer</b>: opens the vault folder in Explorer.</li>
    </ul>

    <h3>Vaults</h3>
    <ul>
      <li><b>New vault…</b>: creates a new, empty folder at the location you choose.</li>
      <li><b>Open vault…</b>: adds an existing folder (e.g. a folder in Google Drive) as a vault.</li>
      <li>Vaults are listed at the top of the gallery; click one to switch to it. Each vault remembers its last open board.</li>
      <li>Removing a vault from the list does not delete the vault or its files; it only removes it from the list.</li>
    </ul>

    <h3>File operations</h3>
    <ul>
      <li><b>Open…</b> (<kbd>Ctrl+O</kbd>): opens a .tahta file outside the vault; the vault does not change.</li>
      <li><b>Save</b> (<kbd>Ctrl+S</kbd>): saves the board right away.</li>
      <li><b>Autosave</b> (the checkbox in the menu): when on, every change is saved automatically. When off, the board is saved only with <kbd>Ctrl+S</kbd>; the top left shows "Not saved", and you are asked whether to save when switching boards or closing the window.</li>
      <li><b>Save as…</b> (<kbd>Ctrl+Shift+S</kbd>): writes a copy of the board wherever you want.</li>
      <li><b>Show file location</b>: shows the open board's file in Explorer.</li>
      <li>Double-clicking a .tahta file in Explorer also opens it in Whiteboard.</li>
    </ul>

    <h3>Using several devices</h3>
    <p>If you keep the vault in a synced folder such as Google Drive or OneDrive, you can reach the same boards from another computer.</p>
    <ul>
      <li>When you return to the window, if the board changed on another device and you have no unsaved changes, <b>the latest version is loaded automatically</b>.</li>
      <li>If the same board was changed differently on two devices, the other device's work is <b>not overwritten</b>: yours is saved next to it as a separate copy named <b>"(conflict …)"</b>. You can compare and merge the two by hand.</li>
      <li>Try not to keep the same board open on two devices at once.</li>
    </ul>

    <h3>Clearing the board</h3>
    <p><b>Clear board</b> in the menu deletes everything (asks for confirmation first). If you did it by accident, undo with <kbd>Ctrl+Z</kbd>.</p>
  `,

  view: `
    <h3>Background</h3>
    <p>From the menu (☰), <b>Background pattern</b>: None, Grid, Dots, Lines. <b>Background color</b>: preset colors or a custom color picker. The choice is stored with the board; each board can have its own background.</p>

    <h3>Theme and language</h3>
    <p>Choose <b>Light</b>, <b>Dark</b> or <b>System</b> (follows the Windows setting) in the menu. The theme is specific to this computer and independent of the board's background. The interface language (<b>Türkçe</b> / <b>English</b>) is chosen in the same menu or under <b>View → Dil / Language</b>.</p>

    <h3>Exporting as PNG <kbd>Ctrl+E</kbd></h3>
    <ul>
      <li>If nothing is selected, <b>everything on the board</b> is exported; if objects are selected, <b>only those</b>.</li>
      <li>The image is cropped with a small margin around the objects and saved with the board's background.</li>
      <li>On very large boards the resolution is reduced automatically.</li>
    </ul>

    <h3>Zoom buttons</h3>
    <p>The bar at the bottom right: <b>−</b> zooms out, <b>+</b> zooms in, clicking the percentage returns to 100%, and the corner-arrows icon fits the whole drawing on screen.</p>

    <h3>Full screen and more</h3>
    <p>The menu bar at the top is normally hidden; press <kbd>Alt</kbd> to show it. Go full screen with <b>View → Full screen</b>.</p>
  `,

  student: `
    <h3>Student mode</h3>
    <p>Checking <b>Student mode</b> in the menu (☰) turns on study tools: protractor, compass, cover tape, coordinate system, locking, formulas, PDF export and printing. Turning it off hides these tools; objects such as tapes and graphs you already added stay on the board. The setting is specific to this computer.</p>

    <h3>Locking <kbd>Ctrl+L</kbd></h3>
    <ul>
      <li>Select an object and press <b>Lock</b> in the panel. A locked object cannot be moved, resized or erased, and is not selected by clicking or <kbd>Ctrl+A</kbd>. You can easily lasso the drawings on top of it.</li>
      <li>To select a locked object, <b>double-click</b> it with the Select tool; an orange dashed frame appears. Then <b>Unlock</b> in the panel or <kbd>Ctrl+L</kbd>.</li>
      <li>If <b>Lock pages</b> is checked when inserting a PDF, the pages come in locked; you can write on them right away.</li>
      <li><b>Unlock everything</b> in the menu removes all locks on the board.</li>
    </ul>

    <h3>Cover tape <kbd>K</kbd></h3>
    <p>Drag a patterned tape over an answer or formula; it covers what is underneath completely. To test yourself:</p>
    <ul>
      <li><b>Tap the tape with the pen</b> (or click with the tape tool, double-click with the Select tool): the tape is revealed and a dashed frame stays in its place.</li>
      <li>To hide it again, click with the tape tool or double-click with the Select tool. The panel has <b>Hide all</b> / <b>Reveal all</b>, and the menu has <b>Hide all tapes</b>.</li>
      <li>Every time the board is opened, all tapes start hidden.</li>
    </ul>

    <h3>Protractor <kbd>Q</kbd></h3>
    <ul>
      <li>Like the ruler, it stays on screen and is not saved to the board. Drag its body to move it; rotate it with the rotate button or the mouse wheel while over it.</li>
      <li>Drag the blue and red handles to measure the angle between the two arms (5° steps with <kbd>Shift</kbd>). The angle is shown in the middle.</li>
      <li>If you start the pen just outside the arc, the line follows the arc as part of a circle.</li>
    </ul>

    <h3>Compass <kbd>C</kbd></h3>
    <ol>
      <li>Drag outward from the center to set the radius. The radius is shown in squares (one square of the grid background).</li>
      <li>Then drag anywhere: the pencil end turns around the center and draws an arc. A full turn or a single tap leaves a clean circle.</li>
      <li>Drag the center handle to move the compass, the end handle to change the radius. <kbd>Shift</kbd>: the center snaps to grid corners, the radius to half squares.</li>
      <li><kbd>Esc</kbd> or <b>New center</b> in the panel: resets the compass.</li>
    </ol>

    <h3>Coordinate system <kbd>X</kbd></h3>
    <ul>
      <li>Insert it from the Insert group; the axes align with the grid background (1 unit = 1 square).</li>
      <li>Type a function in the panel's box and press <kbd>Enter</kbd>: <code>x^2 - 2x - 3</code>, <code>2sin x</code>, <code>1/x</code>, <code>√(x+1)</code>, <code>ln x</code>, <code>e^x</code>, <code>abs(x)</code> for absolute value. Implicit multiplication (<code>2x</code>, <code>3(x-1)</code>), <code>π</code> and the decimal comma are supported; angles are in radians.</li>
      <li>Each graph is drawn in its own color and listed at the top left; click its name in the panel to edit the equation in place, <kbd>Enter</kbd> (or leaving the box) updates the graph, <kbd>Esc</kbd> cancels; the <b>×</b> next to it removes the graph. <b>Grid</b> shows unit squares.</li>
    </ul>

    <h3>Formulas</h3>
    <p>With the Text tool, write a formula between dollar signs: <code>Area $\\pi r^2$</code> inline, <code>$$\\frac{1}{2}$$</code> as a large formula. When you finish typing, the formula is rendered properly (KaTeX). While editing, the source text is shown. Prices like <code>$5 and $10</code> are not treated as formulas.</p>

    <h3>Export as PDF <kbd>Ctrl+Shift+E</kbd> and printing <kbd>Ctrl+P</kbd></h3>
    <ul>
      <li>Puts the whole board or the selected objects on A4 (portrait or landscape) pages.</li>
      <li><b>Fit to width</b>: a long board is split into pages; page breaks are placed in a gap that doesn't cut objects (e.g. between PDF pages) when possible. <b>Fit on one page</b>: everything is shrunk onto one page.</li>
      <li>To save ink, turn off <b>Also print the background color and pattern</b>.</li>
      <li>Cover tapes are printed as they currently are (revealed / hidden); with hidden tapes you can print an exam sheet.</li>
    </ul>
  `,

  keys: `
    <p class="muted">This list is generated from the tool definitions, so it is always up to date. To change a tool shortcut, click the key, then press the new key (<kbd>Esc</kbd> cancels).</p>
    <p><button id="helpResetKeys" class="keyreset">Reset to defaults</button></p>
    <h3>Tools</h3>
    <table id="helpToolKeys"></table>
    <h3>General</h3>
    <table id="helpGeneralKeys"></table>
  `,

  faq: `
    <h3>My lines turn into shapes on their own</h3>
    <p>Turn off the <b>Convert to shape</b> button in the properties panel while drawing with the pen (any brush type except Arrow and Dashed arrow). After a conversion, <kbd>Ctrl+Z</kbd> brings back the hand drawing.</p>

    <h3>The eraser doesn't erase my images and notes</h3>
    <p><b>Also erase notes and images</b> must be on in the eraser panel. It is off on purpose.</p>

    <h3>I can't select anything / dragging draws instead</h3>
    <p>Make sure you are on the Select tool (<kbd>1</kbd> or <kbd>V</kbd>). Dragging with the pen selected draws.</p>

    <h3>I feel lost on the board</h3>
    <p>Fit the whole drawing on screen with <kbd>Ctrl+1</kbd>. <kbd>Ctrl+0</kbd> returns to 100%.</p>

    <h3>The "board changed on another device" message</h3>
    <p>This is normal if the vault is in a synced folder. Your version was saved as a separate file named "(conflict …)"; nothing was lost. You can open both from My boards.</p>

    <h3>My board doesn't show up in My boards</h3>
    <p>Make sure you are in the right vault (the vault list at the top of the gallery). A file is listed only if it has the <b>.tahta</b> extension and is inside the selected folder. Check the folder with <b>Show in Explorer</b>.</p>

    <h3>A PDF or image was not inserted</h3>
    <p>For corrupted or unsupported files a warning appears at the bottom of the screen. Supported image formats are the common ones such as PNG, JPG, GIF and WebP.</p>

    <h3>Insert from Obsidian doesn't work</h3>
    <ul>
      <li>Obsidian must be installed on your computer and the vault must have been opened in Obsidian at least once.</li>
      <li>If the vault isn't listed, point to its folder with <b>Choose vault folder…</b> in the picker window.</li>
      <li>A "Note not found" warning means the note was moved or deleted.</li>
    </ul>

    <h3>Pen pressure doesn't work</h3>
    <p>Pressure works only with a stylus (or a pressure-sensitive tablet); a mouse and fingers draw at a fixed thickness. Make sure the pen driver is installed in Windows.</p>

    <h3>I deleted something by accident</h3>
    <p><kbd>Ctrl+Z</kbd>. Everything can be undone, including clearing the board. The undo history is reset after closing and reopening the board.</p>
  `,
};
