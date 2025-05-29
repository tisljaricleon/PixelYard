class WebSocketManager {
  constructor(url) {
    this.socket = io(url, {
      transports: ["websocket"],
    });

    this.username = null;
    this.pixelBatch = [];
    this.batchTimeout = null;

    this.socket.on("connect", () => this.connect());
    this.socket.on("full_canvas_result", (data) => this.fullCanvasResult(data));
    this.socket.on("authenticate_result", (data) => this.authenticateResult(data));
    this.socket.on("batch_pixel_error", (data) => this.batchPixelUpdate(data));
    this.socket.on("batch_pixel_update", (data) => this.batchPixelUpdate(data));

    this.socket.on("tile_info", (data) => this.showTileInfo(data));
    this.socket.on("chat_message", (data) => {
      if (window.appendChatMessage) window.appendChatMessage(data);
    });
    this.socket.on("recent_messages", (messages) => {
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) chatMessages.innerHTML = "";
      if (window.appendChatMessage) {
        messages.forEach((msg) => window.appendChatMessage(msg));
      }
    });
  }

  connect() {
    console.log("[WS] Connected, SID:", this.socket.id);
    this.ssid = this.socket.id;
    this.socket.emit("get_full_canvas");
  }

  fullCanvasResult(array) {
    if (array) {
      const grid = document.getElementById("grid");
      const gridArray = new Uint8ClampedArray(array);
      window.gridCanvas = new GridCanvas(grid, gridArray);
      window.gridCanvas.drawGrid();
      document.getElementById("loading-screen").classList.add("u-dis-none");
      document.querySelector(".content-wrapper").classList.remove("u-dis-none");
    } else {
      console.log("[WS] Failed to fetch full canvas");
    }
  }

  authenticate(username) {
    this.ssid = this.socket.id;
    this.socket.emit("authenticate", { username });
  }

  authenticateResult(data) {
    document.querySelector(".menu-wrapper").classList.add("u-dis-none");
    document.querySelector(".blur-background").classList.add("u-dis-none");
    document.querySelector(".tools-vertical").classList.remove("u-dis-none");
    document.querySelector(".swatches-menu").classList.remove("u-dis-none");
    document.querySelector(".current-data").classList.remove("u-dis-none");
    this.username = data.username;
  }

  queuePixelUpdate(x, y, color) {
    if (color.startsWith("#")) color = color.slice(1);
    let username = this.username;
    let timestamp = new Date().toISOString();
    this.pixelBatch.push({ x, y, color, username, timestamp });

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        const deduped = {};
        for (const pixel of this.pixelBatch) {
          const key = `${pixel.x},${pixel.y}`;
          deduped[key] = pixel;
        }
        const batchToSend = Object.values(deduped);

        this.socket.emit("batch_pixel_queue", batchToSend);
        this.pixelBatch = [];
        this.batchTimeout = null;
      }, 250);
    }
  }

  batchPixelUpdate(data) {
    if (!window.gridCanvas || !data || !Array.isArray(data.batch)) return;
    for (const pixel of data.batch) {
      window.gridCanvas.updatePixel(pixel.x, pixel.y, "#" + pixel.color);
    }
    window.gridCanvas.drawGrid();
  }

  batchPixelOk() {}

  requestTileInfo(x, y) {
    this.socket.emit("request_tile_info", { x, y });
  }

  showTileInfo(data) {
    window.gridCanvas.showTileInfoPopup(data);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = location.host;
  const wsUrl = `${wsProtocol}//${wsHost}`;

  window.wsManager = new WebSocketManager(wsUrl);

  document.getElementById("join-button").addEventListener("click", function () {
    let username = document.getElementById("join-username").value.trim();
    window.wsManager.authenticate(username);
  });
});
document.getElementById("join-username").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    let username = document.getElementById("join-username").value.trim();
    window.wsManager.authenticate(username);
  }
});
