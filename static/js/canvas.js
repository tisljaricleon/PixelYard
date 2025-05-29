class GridCanvas {
  constructor(canvas, gridArray) {
    this.TILE_COUNT_X = 1000;
    this.TILE_COUNT_Y = 1000;
    this.TILE_SIZE = 10;
    this.ZOOM_FACTOR = 0.5;
    this.MIN_ZOOM = 0.1;
    this.MAX_ZOOM = 20;

    this.grid = canvas;
    this.ctx = canvas.getContext("2d");
    this.gridArray = gridArray;

    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.panning = false;
    this.startPanRelX = 0;
    this.startPanRelY = 0;
    this.lastTouchX = null;
    this.lastTouchY = null;
    this.lastDist = null;

    this.PAN_MARGIN = 300;

    this.bgImage = new Image();
    this.bgImage.src = "/static/assets/images/grass_pattern.jpg";
    this.bgPattern = null;

    this.bgImage.onload = () => {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.bgPattern = ctx.createPattern(this.bgImage, "repeat");
      ctx.restore();
      this.drawGrid();
    };

    window.addEventListener("resize", () => this.resizeToFullscreen());
    this.resizeToFullscreen();

    // Zooming //
    this.grid.addEventListener("wheel", (e) => this.onWheel(e));
    // Panning //
    this.grid.addEventListener("mousedown", (e) => this.onMouseDownPan(e));
    this.grid.addEventListener("mousemove", (e) => this.onMouseMovePan(e));
    this.grid.addEventListener("mouseup", () => this.onMouseUpAndLeavePan());
    this.grid.addEventListener("mouseleave", () => this.onMouseUpAndLeavePan());

    this.grid.addEventListener("mouseleave", () => this.onMouseLeave());
    this.grid.addEventListener("mouseenter", () => this.onMouseEnter());

    this.grid.addEventListener("mousemove", (e) => this.onMouseMove(e));

    this.grid.addEventListener("click", (e) => this.onClick(e));
    this.grid.addEventListener("mousedown", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      this.onMouseDownEyedropper(e);
    });

    this.grid.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
    this.grid.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
    this.grid.addEventListener("touchend", (e) => this.onTouchEnd(e), { passive: false });

    let lastRightClickTime = 0;
    this.grid.addEventListener("contextmenu", (e) => {
      const now = Date.now();
      if (now - lastRightClickTime < 400) {
        this.onTileContextMenu(e);
        lastRightClickTime = 0;
      } else {
        lastRightClickTime = now;
      }
      e.preventDefault();
    });
  }

  resizeToFullscreen() {
    const dpr = window.devicePixelRatio || 1;
    this.grid.style.position = "fixed";
    this.grid.style.left = "0";
    this.grid.style.top = "0";
    this.grid.width = window.innerWidth * dpr;
    this.grid.height = window.innerHeight * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.clampOffsets();
    this.drawGrid();
  }

  clampOffsets() {
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = this.grid.width / dpr;
    const canvasHeight = this.grid.height / dpr;
    const gridPixelWidth = this.TILE_COUNT_X * this.TILE_SIZE * this.zoom;
    const gridPixelHeight = this.TILE_COUNT_Y * this.TILE_SIZE * this.zoom;

    if (gridPixelWidth + 2 * this.PAN_MARGIN <= canvasWidth) {
      this.offsetX = (canvasWidth - gridPixelWidth) / 2;
    } else {
      const minOffsetX = canvasWidth - gridPixelWidth - this.PAN_MARGIN;
      const maxOffsetX = this.PAN_MARGIN;
      this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    }

    if (gridPixelHeight + 2 * this.PAN_MARGIN <= canvasHeight) {
      this.offsetY = (canvasHeight - gridPixelHeight) / 2;
    } else {
      const minOffsetY = canvasHeight - gridPixelHeight - this.PAN_MARGIN;
      const maxOffsetY = this.PAN_MARGIN;
      this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
    }
  }

  drawGrid() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.grid.width, this.grid.height);

    if (this.bgPattern) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = this.bgPattern;
      this.ctx.fillRect(0, 0, this.grid.width, this.grid.height);
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.translate(this.offsetX * dpr, this.offsetY * dpr);
    this.ctx.scale(this.zoom * dpr, this.zoom * dpr);

    const canvasWidth = this.grid.width / dpr / this.zoom;
    const canvasHeight = this.grid.height / dpr / this.zoom;

    let startCol = Math.floor(-this.offsetX / (this.TILE_SIZE * this.zoom));
    let startRow = Math.floor(-this.offsetY / (this.TILE_SIZE * this.zoom));
    let endCol = Math.ceil((canvasWidth - this.offsetX / this.zoom) / this.TILE_SIZE);
    let endRow = Math.ceil((canvasHeight - this.offsetY / this.zoom) / this.TILE_SIZE);

    startCol = Math.max(0, Math.min(this.TILE_COUNT_X, startCol));
    startRow = Math.max(0, Math.min(this.TILE_COUNT_Y, startRow));
    endCol = Math.max(0, Math.min(this.TILE_COUNT_X, endCol));
    endRow = Math.max(0, Math.min(this.TILE_COUNT_Y, endRow));

    const viewW = endCol - startCol;
    const viewH = endRow - startRow;

    if (viewW > 0 && viewH > 0) {
      const viewportArray = new Uint8ClampedArray(viewW * viewH * 4);
      for (let y = 0; y < viewH; y++) {
        const srcStart = ((startRow + y) * this.TILE_COUNT_X + startCol) * 4;
        const srcEnd = srcStart + viewW * 4;
        const destStart = y * viewW * 4;
        viewportArray.set(this.gridArray.subarray(srcStart, srcEnd), destStart);
      }

      const imageData = new ImageData(viewportArray, viewW, viewH);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = viewW;
      tempCanvas.height = viewH;
      tempCanvas.getContext("2d").putImageData(imageData, 0, 0);

      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(
        tempCanvas,
        0,
        0,
        viewW,
        viewH,
        startCol * this.TILE_SIZE,
        startRow * this.TILE_SIZE,
        viewW * this.TILE_SIZE,
        viewH * this.TILE_SIZE
      );
    }

    if (
      this.hoveredTileX !== null &&
      this.hoveredTileY !== null &&
      this.hoveredTileX >= 0 &&
      this.hoveredTileX < this.TILE_COUNT_X &&
      this.hoveredTileY >= 0 &&
      this.hoveredTileY < this.TILE_COUNT_Y
    ) {
      this.ctx.save();
      this.ctx.lineWidth = 2 / this.zoom;
      this.ctx.strokeStyle = "#000000";
      this.ctx.strokeRect(
        this.hoveredTileX * this.TILE_SIZE,
        this.hoveredTileY * this.TILE_SIZE,
        this.TILE_SIZE,
        this.TILE_SIZE
      );
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  /* Zooming logic - done */
  onWheel(e) {
    e.preventDefault();
    const mouse = {
      x: e.clientX,
      y: e.clientY,
    };

    const rect = this.grid.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const mouseX = (mouse.x - rect.left) / dpr;
    const mouseY = (mouse.y - rect.top) / dpr;

    const worldX = (mouseX - this.offsetX) / this.zoom;
    const worldY = (mouseY - this.offsetY) / this.zoom;

    this.zoom = e.deltaY < 0 ? this.zoom / this.ZOOM_FACTOR : this.zoom * this.ZOOM_FACTOR;
    this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom));

    this.offsetX = mouseX - worldX * this.zoom;
    this.offsetY = mouseY - worldY * this.zoom;

    this.clampOffsets();
    this.drawGrid();

    if (this.panning) {
      this.startPanRelX = e.clientX - this.offsetX;
      this.startPanRelY = e.clientY - this.offsetY;
    }
  }

  /* Panning - done */
  onMouseDownPan(e) {
    if (e.button !== 2) return;
    e.preventDefault();
    const popup = document.getElementById("tile-info-popup");
    if (popup) popup.style.display = "none";

    selectTool(e, "hand");

    this.panning = true;
    this.startPanRelX = e.clientX - this.offsetX;
    this.startPanRelY = e.clientY - this.offsetY;
  }

  onMouseMovePan(e) {
    if (!this.panning || window.activeTool !== "hand") return;
    this.offsetX = e.clientX - this.startPanRelX;
    this.offsetY = e.clientY - this.startPanRelY;

    this.clampOffsets();
    this.drawGrid();
  }

  onMouseUpAndLeavePan() {
    this.panning = false;
  }

  onMouseLeave() {
    this.hoveredTileX = null;
    this.hoveredTileY = null;
    document.querySelector(".current-data").style.display = "none";
  }

  onMouseEnter() {
    document.querySelector(".current-data").style.display = "grid";
  }

  /* Current data updater */
  onMouseMove(e) {
    const rect = this.grid.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - this.offsetX) / this.zoom;
    const worldY = (e.clientY - rect.top - this.offsetY) / this.zoom;
    const tileX = Math.floor(worldX / this.TILE_SIZE);
    const tileY = Math.floor(worldY / this.TILE_SIZE);

    if (tileX >= 0 && tileX < this.TILE_COUNT_X && tileY >= 0 && tileY < this.TILE_COUNT_Y) {
      const index = (tileY * this.TILE_COUNT_X + tileX) * 4;
      const r = this.gridArray[index];
      const g = this.gridArray[index + 1];
      const b = this.gridArray[index + 2];
      const a = this.gridArray[index + 3];

      document.querySelector(".current-data").style.display = "grid";
      document.querySelector(
        ".current-data .current-coordinates"
      ).textContent = `(${tileX}, ${tileY})`;
      const hex =
        "#" +
        [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("") +
        a.toString(16).padStart(2, "0");
      document.querySelector(
        ".current-data .current-color-swatch"
      ).style.background = `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
      document.querySelector(".current-data .current-color-value").textContent = hex;

      this.hoveredTileX = tileX;
      this.hoveredTileY = tileY;
    } else {
      document.querySelector(".current-data").style.display = "none";
      this.hoveredTileX = null;
      this.hoveredTileY = null;
    }
    this.drawGrid();
  }

  /* Pencil */
  onClick(e) {
    if (typeof e.button !== "undefined" && e.button !== 0) return;
    e.preventDefault();

    const rect = this.grid.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - this.offsetX) / this.zoom;
    const worldY = (e.clientY - rect.top - this.offsetY) / this.zoom;
    const tileX = Math.floor(worldX / this.TILE_SIZE);
    const tileY = Math.floor(worldY / this.TILE_SIZE);

    if (tileX >= 0 && tileX < this.TILE_COUNT_X && tileY >= 0 && tileY < this.TILE_COUNT_Y) {
      let rgb = window.selectedColor || "#ffffff";
      let alpha = typeof window.selectedAlpha === "number" ? window.selectedAlpha : 100;
      let alpha255 = Math.round((alpha / 100) * 255);
      let alphaHex = alpha255.toString(16).padStart(2, "0");
      let color = rgb + alphaHex;

      this.updatePixel(tileX, tileY, color);
      this.drawGrid();

      if (window.wsManager) {
        window.wsManager.queuePixelUpdate(tileX, tileY, color);
      }
    }
  }

  updatePixel(x, y, color) {
    let r = 0,
      g = 0,
      b = 0,
      a = 255;

    if (typeof color === "string" && color[0] === "#" && color.length === 9) {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
      a = parseInt(color.slice(7, 9), 16);
    }
    const idx = (y * this.TILE_COUNT_X + x) * 4;
    this.gridArray[idx] = r;
    this.gridArray[idx + 1] = g;
    this.gridArray[idx + 2] = b;
    this.gridArray[idx + 3] = a;
  }

  onMouseDownEyedropper(e) {
    if (e.touches) return;
    if (typeof e.button !== "undefined" && e.button !== 1) return;
    e.preventDefault();

    const rect = this.grid.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - this.offsetX) / this.zoom;
    const worldY = (e.clientY - rect.top - this.offsetY) / this.zoom;
    const tileX = Math.floor(worldX / this.TILE_SIZE);
    const tileY = Math.floor(worldY / this.TILE_SIZE);

    if (tileX >= 0 && tileX < this.TILE_COUNT_X && tileY >= 0 && tileY < this.TILE_COUNT_Y) {
      const idx = (tileY * this.TILE_COUNT_X + tileX) * 4;
      const r = this.gridArray[idx];
      const g = this.gridArray[idx + 1];
      const b = this.gridArray[idx + 2];
      const a = this.gridArray[idx + 3];

      const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
      const alphaPercent = Math.round((a / 255) * 100);

      window.selectedColor = hex;
      window.selectedAlpha = alphaPercent;

      if (window.iroColorPicker) window.iroColorPicker.color.hexString = hex;
      if (window.iroAlphaPicker) window.iroAlphaPicker.value = alphaPercent;
    }
  }

  onTileContextMenu(e) {
    e.preventDefault();
    const rect = this.grid.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - this.offsetX) / this.zoom;
    const worldY = (mouseY - this.offsetY) / this.zoom;
    const tileX = Math.floor(worldX / this.TILE_SIZE);
    const tileY = Math.floor(worldY / this.TILE_SIZE);

    const tileCanvasX =
      this.offsetX + tileX * this.TILE_SIZE * this.zoom + (this.TILE_SIZE * this.zoom) / 2;
    const tileCanvasY = this.offsetY + tileY * this.TILE_SIZE * this.zoom;
    const popupScreenX = rect.left + tileCanvasX;
    const popupScreenY = rect.top + tileCanvasY;

    fetch(`/api/tileInfo?x=${tileX}&y=${tileY}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return;
        this.showTileInfoPopup(popupScreenX, popupScreenY, data);
      });
  }

  showTileInfoPopup(screenX, screenY, data) {
    let popup = document.getElementById("tile-info-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "tile-info-popup";
      popup.style.position = "fixed";
      popup.style.zIndex = 1000;
      popup.style.pointerEvents = "auto";
      popup.style.minWidth = "200px";
      document.body.appendChild(popup);
    }
    popup.innerHTML = `
    <div class="arrow-up"></div>
    <b>Placed by:</b> ${data.username}<br>
    <b>Time:</b> ${this.formatTime(data.seconds_ago)}<br>
    <b>Color:</b> <span class="info-data" style="background:#${data.color};"></span> #${
      data.color
    }<br>
    <b>Coords:</b> (${data.x}, ${data.y})
  `;
    popup.style.display = "block";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popup.style.left = `${screenX - popup.offsetWidth / 2}px`;
        popup.style.top = `${screenY - popup.offsetHeight - 12}px`;
      });
    });

    document.addEventListener("mousedown", function hidePopup(ev) {
      if (!popup.contains(ev.target)) {
        popup.style.display = "none";
        document.removeEventListener("mousedown", hidePopup);
      }
    });
  }

  formatTime(seconds) {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  }
}
