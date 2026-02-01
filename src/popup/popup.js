// ADHD Reader - Popup Script
// Handles settings UI and communication with background

document.addEventListener('DOMContentLoaded', async () => {
  // Get current settings
  let settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  // Element references
  const elements = {
    // Main toggle
    enabled: document.getElementById('enabled'),

    // Eye tracking
    eyeTracking: document.getElementById('eyeTracking'),
    calibrateBtn: document.getElementById('calibrateBtn'),

    // Typography
    bionicReading: document.getElementById('bionicReading'),
    fontFamily: document.getElementById('fontFamily'),
    fontSize: document.getElementById('fontSize'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    lineHeight: document.getElementById('lineHeight'),
    lineHeightValue: document.getElementById('lineHeightValue'),
    letterSpacing: document.getElementById('letterSpacing'),
    letterSpacingValue: document.getElementById('letterSpacingValue'),
    wordSpacing: document.getElementById('wordSpacing'),
    wordSpacingValue: document.getElementById('wordSpacingValue'),

    // Focus
    blurAmount: document.getElementById('blurAmount'),
    blurAmountValue: document.getElementById('blurAmountValue'),
    lineGuide: document.getElementById('lineGuide'),
    spotlightMode: document.getElementById('spotlightMode'),

    // Tools
    openPdfReaderBtn: document.getElementById('openPdfReaderBtn'),

    // Overlay
    overlayEnabled: document.getElementById('overlayEnabled'),
    colorButtons: document.querySelectorAll('.color-btn'),

    // Accessibility
    reduceMotion: document.getElementById('reduceMotion'),
    highContrast: document.getElementById('highContrast')
  };

  // Populate UI with current settings
  function populateUI() {
    elements.enabled.checked = settings.enabled;
    elements.eyeTracking.checked = settings.eyeTracking?.enabled || false;

    // Typography
    elements.bionicReading.checked = settings.typography?.bionicReading || false;
    elements.fontFamily.value = settings.typography?.fontFamily || 'default';
    elements.fontSize.value = settings.typography?.fontSize || 100;
    elements.fontSizeValue.textContent = `${settings.typography?.fontSize || 100}%`;
    elements.lineHeight.value = settings.typography?.lineHeight || 1.6;
    elements.lineHeightValue.textContent = settings.typography?.lineHeight || 1.6;
    elements.letterSpacing.value = settings.typography?.letterSpacing || 0;
    elements.letterSpacingValue.textContent = `${settings.typography?.letterSpacing || 0}px`;
    elements.wordSpacing.value = settings.typography?.wordSpacing || 0;
    elements.wordSpacingValue.textContent = `${settings.typography?.wordSpacing || 0}px`;

    // Focus
    elements.blurAmount.value = settings.focus?.blurAmount || 3;
    elements.blurAmountValue.textContent = `${settings.focus?.blurAmount || 3}px`;
    elements.lineGuide.checked = settings.focus?.lineGuide ?? true;
    elements.spotlightMode.checked = settings.focus?.spotlightMode || false;

    // Overlay
    elements.overlayEnabled.checked = settings.overlay?.enabled || false;
    updateColorButtons(settings.overlay?.color || 'cream');

    // Accessibility
    elements.reduceMotion.checked = settings.accessibility?.reduceMotion || false;
    elements.highContrast.checked = settings.accessibility?.highContrast || false;
  }

  // Update color button active state
  function updateColorButtons(activeColor) {
    elements.colorButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === activeColor);
    });
  }

  // Save settings
  async function saveSettings() {
    await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  }

  // Initialize UI
  populateUI();

  // Event listeners

  // Main toggle
  elements.enabled.addEventListener('change', async () => {
    settings.enabled = elements.enabled.checked;
    await saveSettings();
  });

  // Eye tracking
  elements.eyeTracking.addEventListener('change', async () => {
    settings.eyeTracking.enabled = elements.eyeTracking.checked;
    await saveSettings();
  });

  elements.calibrateBtn.addEventListener('click', async () => {
    // Send message to content script to start calibration
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'START_CALIBRATION' });
    window.close();
  });

  // Typography
  elements.bionicReading.addEventListener('change', async () => {
    settings.typography.bionicReading = elements.bionicReading.checked;
    await saveSettings();
  });

  elements.fontFamily.addEventListener('change', async () => {
    settings.typography.fontFamily = elements.fontFamily.value;
    await saveSettings();
  });

  elements.fontSize.addEventListener('input', () => {
    const value = elements.fontSize.value;
    elements.fontSizeValue.textContent = `${value}%`;
  });

  elements.fontSize.addEventListener('change', async () => {
    settings.typography.fontSize = parseInt(elements.fontSize.value);
    await saveSettings();
  });

  elements.lineHeight.addEventListener('input', () => {
    elements.lineHeightValue.textContent = elements.lineHeight.value;
  });

  elements.lineHeight.addEventListener('change', async () => {
    settings.typography.lineHeight = parseFloat(elements.lineHeight.value);
    await saveSettings();
  });

  elements.letterSpacing.addEventListener('input', () => {
    elements.letterSpacingValue.textContent = `${elements.letterSpacing.value}px`;
  });

  elements.letterSpacing.addEventListener('change', async () => {
    settings.typography.letterSpacing = parseFloat(elements.letterSpacing.value);
    await saveSettings();
  });

  elements.wordSpacing.addEventListener('input', () => {
    elements.wordSpacingValue.textContent = `${elements.wordSpacing.value}px`;
  });

  elements.wordSpacing.addEventListener('change', async () => {
    settings.typography.wordSpacing = parseInt(elements.wordSpacing.value);
    await saveSettings();
  });

  // Focus
  elements.blurAmount.addEventListener('input', () => {
    elements.blurAmountValue.textContent = `${elements.blurAmount.value}px`;
  });

  elements.blurAmount.addEventListener('change', async () => {
    settings.focus.blurAmount = parseFloat(elements.blurAmount.value);
    await saveSettings();
  });

  elements.lineGuide.addEventListener('change', async () => {
    settings.focus.lineGuide = elements.lineGuide.checked;
    await saveSettings();
  });

  elements.spotlightMode.addEventListener('change', async () => {
    settings.focus.spotlightMode = elements.spotlightMode.checked;
    await saveSettings();
  });

  elements.openPdfReaderBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pdf-reader/index.html') });
  });

  // Overlay
  elements.overlayEnabled.addEventListener('change', async () => {
    settings.overlay.enabled = elements.overlayEnabled.checked;
    await saveSettings();
  });

  elements.colorButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      settings.overlay.color = btn.dataset.color;
      updateColorButtons(btn.dataset.color);
      await saveSettings();
    });
  });

  // Accessibility
  elements.reduceMotion.addEventListener('change', async () => {
    settings.accessibility.reduceMotion = elements.reduceMotion.checked;
    await saveSettings();
  });

  elements.highContrast.addEventListener('change', async () => {
    settings.accessibility.highContrast = elements.highContrast.checked;
    await saveSettings();
  });
});
