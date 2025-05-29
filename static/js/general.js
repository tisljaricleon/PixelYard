let loadingIntervalId = null;
let toolButtons = null;
let selectedColor = null;
window.activeTool = null;
window.iroColorPicker = null;
window.iroAlphaPicker = null;

document.addEventListener("DOMContentLoaded", function () {
  loadingScreenConnect();

  const toolContainer = document.querySelector(".tools-vertical");
  toolButtons = toolContainer.querySelectorAll("button");

  const swatches = document.querySelectorAll(".swatch");
  swatches.forEach((swatch) => {
    swatch.addEventListener("click", function () {
      swatches.forEach((s) => s.classList.remove("selected"));
      this.classList.add("selected");
      if (iroColorPicker) {
        iroColorPicker.color.hexString = this.dataset.color;
      }
      window.selectedColor = this.dataset.color;
    });
  });

  if (swatches.length > 0) {
    swatches[0].classList.add("selected");
    window.selectedColor = swatches[0].dataset.color;
    if (iroColorPicker) {
      iroColorPicker.color.hexString = swatches[0].dataset.color;
    }
  }

  initToolListeners();
  initColorPicker();
  initAlphaPanel();
});

document.addEventListener("resize", () => {
  if (activeTool !== "hand" && activeTool !== "pencil")
    showPanel(`${activeTool}-panel`, activeTool);
});

/* Hide panels on outside click */
document.addEventListener("click", (event) => {
  const panelsToCheck = ["color-picker-panel", "alpha-picker-panel"];
  panelsToCheck.forEach((panelId) => {
    const panel = document.getElementById(panelId);
    const buttonId = panelId.replace("-panel", "");
    const button = document.getElementById(buttonId);

    if (
      panel &&
      panel.style.display !== "none" &&
      !panel.contains(event.target) &&
      !(button && button.contains(event.target))
    ) {
      panel.style.display = "none";
    }
  });
});

/* Shortcut listers */
document.addEventListener("keydown", function (e) {
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
    return;

  if (e.key === "d" || e.key === "D") {
    selectTool(e, "color-picker");
  } else if (e.key === "a" || e.key === "A") {
    selectTool(e, "alpha-picker");
  }

  if (e.key >= "1" && e.key <= "7") {
    const index = parseInt(e.key, 10) - 1;
    const swatches = document.querySelectorAll(".swatch");
    if (swatches[index]) {
      swatches.forEach((s) => s.classList.remove("selected"));
      swatches[index].classList.add("selected");
      const color = swatches[index].dataset.color;
      window.selectedColor = color;
      if (iroColorPicker) {
        iroColorPicker.color.hexString = color;
      }
    }
  }
});

/* Loading screen */
function loadingScreenConnect() {
  const text = document.querySelector("#loading-screen p");
  if (text) {
    let dots = 0;
    loadingIntervalId = setInterval(() => {
      dots = (dots + 1) % 4;
      text.textContent = "Connecting" + ".".repeat(dots);
    }, 1000);
  }
}

/* Selected tool */
function initToolListeners() {
  document.querySelector(".tools-vertical #color-picker").addEventListener("click", (e) => {
    selectTool(e, "color-picker");
  });

  document.querySelector(".tools-vertical #alpha-picker").addEventListener("click", (e) => {
    selectTool(e, "alpha-picker");
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    document.querySelector(".tools-vertical #alpha-picker").addEventListener("click", (e) => {
      selectTool(e, "alpha-picker");
    });
    document.querySelector(".tools-vertical #alpha-picker").addEventListener("click", (e) => {
      selectTool(e, "alpha-picker");
    });
  }

  selectTool(null, "pencil");
}

function selectTool(e, tool) {
  if (e) e.stopPropagation();

  activeTool = tool;
  toolButtons.forEach((button) => {
    if (button.id === tool) {
      button.classList.add("selected-tool");
      button.focus();
    } else {
      button.classList.remove("selected-tool");
      button.blur();
    }
    button.classList.remove("panel-open");
  });

  hidePanels();

  if (tool === "color-picker") {
    showPanel("color-picker-panel", "color-picker");
  } else if (tool === "alpha-picker") {
    showPanel("alpha-picker-panel", "alpha-picker");
  }
}

/* Show/hide panel(s) */
function showPanel(panelId, buttonId) {
  document.querySelectorAll(".tool-panel").forEach((p) => (p.style.display = "none"));

  const button = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);

  if (button && panel) {
    const rectangle = button.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.display = "flex";
    panel.style.top = `${rectangle.top}px`;
    panel.style.left = `${rectangle.right + 16}px`;
    button.classList.add("panel-open");
  }
}

function hidePanels() {
  document.querySelectorAll(".tool-panel").forEach((id) => {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = "none";
  });
}

/* Init color picker */
function initColorPicker() {
  if (iroColorPicker) return;

  iroColorPicker = new iro.ColorPicker("#iro-color-picker", {
    width: 160,
    color: selectedColor || "#65bc47",
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, options: { sliderType: "value" } },
    ],
  });

  function updateColorText() {
    const color = iroColorPicker.color;
    const hex = color.hexString;
    const rgba = color.rgba;
    document.querySelector("#color-picker-panel .text-value").innerHTML = `
  <div class="tool-panel-row">
    <span class="tool-panel-label">HEX:</span>
    <span class="tool-panel-value">${hex}</span>
  </div>
  <div class="tool-panel-row">
    <span class="tool-panel-label">RGB:</span>
    <span class="tool-panel-value">${rgba.r}, ${rgba.g}, ${rgba.b}</span>
  </div>
`;
  }

  iroColorPicker.on("color:change", function (color) {
    window.selectedColor = color.hexString;
    updateColorText();

    /* Handle color picker swatch color set */
    const selectedSwatch = document.querySelector(".swatch.selected");
    if (selectedSwatch) {
      selectedSwatch.dataset.color = color.hexString;
      selectedSwatch.style.background = color.hexString;
    }
  });

  updateColorText();

  const colorInput = document.querySelector("#color-picker-panel input");
  if (colorInput) {
    function handleColorInputChange() {
      let value = colorInput.value.trim();

      if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
        if (value[0] !== "#") value = "#" + value;
        iroColorPicker.color.hexString = value;
        colorInput.style.borderColor = "#65bc47";
      } else if (
        /^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(value) ||
        /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(value)
      ) {
        let nums = value.match(/\d+/g).map(Number);
        if (nums.length === 3) {
          iroColorPicker.color.rgb = { r: nums[0], g: nums[1], b: nums[2] };
          colorInput.style.borderColor = "#65bc47";
        } else {
          colorInput.style.borderColor = "#e74c3c";
          setTimeout(() => (colorInput.style.borderColor = "#000"), 1000);
          return;
        }
      } else {
        colorInput.style.borderColor = "#e74c3c";
        setTimeout(() => (colorInput.style.borderColor = "#000"), 1000);
        return;
      }

      setTimeout(() => (colorInput.style.borderColor = "#000"), 1000);
      colorInput.value = "";
      updateColorText();
    }

    if (colorInput) {
      colorInput.addEventListener("change", handleColorInputChange);
      colorInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleColorInputChange();
          colorInput.blur();
        }
      });
    }
  }
}

/* Init alpha picker */
function initAlphaPanel() {
  if (iroAlphaPicker) return;

  iroAlphaPicker = new iro.ColorPicker("#iro-alpha-picker", {
    width: 160,
    color: { r: 0, g: 0, b: 0, a: 1 },
    layout: [
      {
        component: iro.ui.Slider,
        options: {
          sliderType: "alpha",
          sliderSize: 32,
        },
      },
    ],
  });

  const alphaValue = document.querySelector("#alpha-picker-panel .text-value");
  const alphaInput = document.querySelector("#alpha-picker-panel input");

  function updateAlphaText() {
    const alphaPercent = Math.round(iroAlphaPicker.color.alpha * 100);
    alphaValue.innerHTML = `
    <div class="tool-panel-row">
      <span class="tool-panel-label">ALPHA:</span>
      <span class="tool-panel-value">${alphaPercent}%</span>
    </div>
  `;
    if (alphaInput) alphaInput.value = alphaPercent;
  }

  iroAlphaPicker.on("color:change", function (color) {
    window.selectedAlpha = Math.round(color.alpha * 100);
    updateAlphaText();
  });

  if (alphaInput) {
    function handleAlphaInput() {
      let val = parseInt(alphaInput.value, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        alphaInput.style.borderColor = "#e74c3c";
        setTimeout(() => (alphaInput.style.borderColor = "#000"), 1000);
        return;
      }
      iroAlphaPicker.color.alpha = val / 100;
      window.selectedAlpha = val;
      alphaInput.style.borderColor = "#65bc47";
      setTimeout(() => (alphaInput.style.borderColor = "#000"), 1000);
      updateAlphaText();
    }

    alphaInput.addEventListener("change", handleAlphaInput);
    alphaInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        handleAlphaInput();
        alphaInput.blur();
      }
    });
  }

  updateAlphaText();
}
