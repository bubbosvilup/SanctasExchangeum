// ===============================
// CONFIGURAZIONE
// ===============================

const participants = [
  "Niccol\u00f2 B",
  "Niccol\u00f2 A",
  "Paolo C",
  "Valerio C",
  "Lorenzo C",
  "Alberto B",
];

// Derangement semplice: ogni nome regala al successivo
const assignments = {
  "Niccol\u00f2 B": "Lorenzo C",
  "Niccol\u00f2 A": "Valerio C",
  "Paolo C": "Niccol\u00f2 A",
  "Valerio C": "Niccol\u00f2 B",
  "Lorenzo C": "Alberto B",
  "Alberto B": "Paolo C",
};

// Chiavi salvataggio locale
const STORAGE_NAME = "ss2025_name";
const STORAGE_RECEIVER = "ss2025_receiver";

// Codice segreto admin
const ADMIN_KEY = "Emperor!";
const QUOTES_ENDPOINT = "assets/quotes.json";
const QUOTES_ROTATION_MS = 6500;
const PHOTO_BASE_PATH = "assets/portraits/";
const PHOTO_EXTENSIONS = ["webp", "jpg.webp", "jpg", "jpeg", "png"];
const participantPhotoSlug = {
  "Niccol\u00f2 B": "niccoloB",
  "Niccol\u00f2 A": "niccoloA",
  "Paolo C": "paoloC",
  "Valerio C": "valerioC",
  "Lorenzo C": "lorenzoC",
  "Alberto B": "albertoB",
};

// ===============================
// ELEMENTI DOM
// ===============================

const selectEl = document.getElementById("participant-select");
const revealBtn = document.getElementById("reveal-btn");
const errorEl = document.getElementById("error");
const resultCard = document.getElementById("result-card");
const yourNameEl = document.getElementById("your-name");
const receiverNameEl = document.getElementById("receiver-name");
const selectionArea = document.getElementById("selection-area");
const confirmEl = document.getElementById("confirm-message");
const receiverPhotoWrapper = document.getElementById("receiver-photo-wrapper");
const receiverPhotoEl = document.getElementById("receiver-photo");
const receiverPhotoPlaceholder = document.getElementById(
  "receiver-photo-placeholder"
);
const mainStackEl = document.querySelector(".main-stack");

// Admin elements
const adminPanel = document.getElementById("admin-panel");
const adminTable = document.getElementById("admin-table");
const closeAdmin = document.getElementById("close-admin");
const adminClearBtn = document.getElementById("admin-clear");
const adminTriggerBtn = document.getElementById("admin-trigger");
const bgHumEl = document.getElementById("bg-hum");
const clickOneEl = document.getElementById("click-one");
const clickTwoEl = document.getElementById("click-two");
const litanyTextEl = document.getElementById("litany-text");

let pendingConfirmation = false;
let pendingName = null;
let storageOperational = true;
let humStarted = false;
let litanyQuotes = [];
let litanyTimer = null;
let currentQuoteIndex = 0;

// ===============================
// FUNZIONI BASE
// ===============================

function handleStorageError(err) {
  if (!storageOperational) return;
  storageOperational = false;
  errorEl.textContent =
    "\u26a0\uFE0F Il Cogitatore non pu\u00f2 accedere alla memoria locale. Disattiva la navigazione privata o abilita l'archiviazione per ricevere la missione.";
  console.error("localStorage non disponibile:", err);
}

function storageGet(key) {
  if (!storageOperational) return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    handleStorageError(err);
    return null;
  }
}

function storageSet(key, value) {
  if (!storageOperational) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    handleStorageError(err);
    return false;
  }
}

function storageRemove(key, force = false) {
  if (!storageOperational && !force) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    handleStorageError(err);
  }
}

function playMedia(audioEl) {
  if (!audioEl) return;
  try {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch (err) {
    console.warn("Audio playback blocked:", err);
  }
}

function playClickSound(isSecond) {
  const primary = isSecond ? clickTwoEl : clickOneEl;
  const secondary = isSecond ? clickOneEl : clickTwoEl;
  if (secondary) {
    secondary.pause();
    secondary.currentTime = 0;
  }
  if (primary) {
    primary.currentTime = 0;
    playMedia(primary);
  }
}

function startBackgroundHum() {
  if (!bgHumEl || humStarted) return;
  bgHumEl.loop = true;
  playMedia(bgHumEl);
  humStarted = !bgHumEl.paused;
}

function initAudioFX() {
  if (!bgHumEl) return;
  bgHumEl.volume = 0.35;
  startBackgroundHum();
  const resumeHum = () => {
    startBackgroundHum();
  };
  document.addEventListener("click", resumeHum, { once: true });
  document.addEventListener("touchstart", resumeHum, {
    once: true,
    passive: true,
  });
}

function showResult(name, receiver) {
  yourNameEl.textContent = "Fratello di Battaglia: " + name;
  receiverNameEl.textContent = receiver;
  resultCard.style.display = "block";
  setReceiverPhoto(receiver);
  if (mainStackEl) {
    mainStackEl.classList.add("main-stack--result-only");
  }
}

function clearResult() {
  yourNameEl.textContent = "";
  receiverNameEl.textContent = "";
  resultCard.style.display = "none";
  clearReceiverPhoto();
  if (mainStackEl) {
    mainStackEl.classList.remove("main-stack--result-only");
  }
}

function lockUI() {
  selectionArea.style.opacity = "0.4";
  selectionArea.style.pointerEvents = "none";
}

function unlockUI() {
  selectionArea.style.opacity = "1";
  selectionArea.style.pointerEvents = "auto";
}

function hideConfirmation() {
  confirmEl.style.display = "none";
  confirmEl.innerHTML = "";
}

function setConfirmation(html) {
  confirmEl.style.display = "block";
  confirmEl.innerHTML = html;
}

function resetPendingState() {
  pendingConfirmation = false;
  pendingName = null;
}

function initFromStorage() {
  const storedName = storageGet(STORAGE_NAME);
  const storedReceiver = storageGet(STORAGE_RECEIVER);

  if (storedName && storedReceiver) {
    showResult(storedName, storedReceiver);
    lockUI();
  } else {
    clearResult();
    unlockUI();
  }

  hideConfirmation();
  resetPendingState();
}

function setLitanyText(text) {
  if (!litanyTextEl) return;
  litanyTextEl.classList.remove("litany-text--reveal");
  // trigger reflow for animation reset
  void litanyTextEl.offsetWidth;
  litanyTextEl.textContent = text;
  litanyTextEl.classList.add("litany-text--reveal");
}

function loadLitanyQuotes() {
  if (!litanyTextEl) return;
  fetch(QUOTES_ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Unable to fetch quotes");
      }
      return response.json();
    })
    .then((data) => {
      litanyQuotes = Array.isArray(data.quotes)
        ? data.quotes.filter(
            (quote) => typeof quote === "string" && quote.trim().length > 0
          )
        : [];
      if (!litanyQuotes.length) {
        throw new Error("No quotes present");
      }
      currentQuoteIndex = 0;
      setLitanyText(litanyQuotes[currentQuoteIndex]);
      if (litanyTimer) {
        clearInterval(litanyTimer);
      }
      litanyTimer = setInterval(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % litanyQuotes.length;
        setLitanyText(litanyQuotes[currentQuoteIndex]);
      }, QUOTES_ROTATION_MS);
    })
    .catch(() => {
      setLitanyText(
        "Persevera nella fede. L'Imperatore veglia anche senza Vox-Litanie."
      );
    });
}

function clearReceiverPhoto() {
  if (!receiverPhotoWrapper || !receiverPhotoEl) return;
  receiverPhotoWrapper.classList.remove("photo-loaded");
  receiverPhotoWrapper.classList.add("photo-missing");
  receiverPhotoEl.classList.remove("receiver-photo-img--visible");
  receiverPhotoEl.removeAttribute("src");
  if (receiverPhotoPlaceholder) {
    receiverPhotoPlaceholder.style.display = "block";
    receiverPhotoPlaceholder.textContent =
      "Il ritratto cogitato apparir\u00e0 qui (480\u00d7640px, formato .webp/.jpg).";
  }
}

function setReceiverPhoto(targetName) {
  if (!receiverPhotoWrapper || !receiverPhotoEl) return;
  const slug = participantPhotoSlug[targetName];
  if (!slug) {
    clearReceiverPhoto();
    return;
  }

  const attempts = PHOTO_EXTENSIONS.map(
    (ext) => `${PHOTO_BASE_PATH}${slug}.${ext}`
  );
  let currentIndex = 0;

  const tryLoad = () => {
    if (currentIndex >= attempts.length) {
      receiverPhotoWrapper.classList.add("photo-missing");
      receiverPhotoWrapper.classList.remove("photo-loaded");
      receiverPhotoEl.classList.remove("receiver-photo-img--visible");
      receiverPhotoEl.removeAttribute("src");
      if (receiverPhotoPlaceholder) {
        receiverPhotoPlaceholder.style.display = "block";
        receiverPhotoPlaceholder.textContent =
          "Ritratto non trovato. Assicurati che il file esista e sia 480\u00d7640px (.webp/.jpg).";
      }
      return;
    }

    const photoPath = attempts[currentIndex];
    receiverPhotoEl.onload = () => {
      receiverPhotoWrapper.classList.remove("photo-missing");
      receiverPhotoWrapper.classList.add("photo-loaded");
      receiverPhotoEl.classList.add("receiver-photo-img--visible");
      if (receiverPhotoPlaceholder) {
        receiverPhotoPlaceholder.style.display = "none";
      }
    };
    receiverPhotoEl.onerror = () => {
      currentIndex += 1;
      tryLoad();
    };
    receiverPhotoEl.alt = `Ritratto di ${targetName}`;
    receiverPhotoEl.src = photoPath;
  };

  receiverPhotoWrapper.classList.add("photo-missing");
  if (receiverPhotoPlaceholder) {
    receiverPhotoPlaceholder.style.display = "block";
    receiverPhotoPlaceholder.textContent =
      "Recupero in corso del ritratto cogitato...";
  }
  receiverPhotoEl.classList.remove("receiver-photo-img--visible");
  receiverPhotoEl.removeAttribute("src");
  tryLoad();
}

// ===============================
// LOGICA UTENTE NORMALE
// ===============================

revealBtn.addEventListener("click", () => {
  errorEl.textContent = "";
  const selectedName = selectEl.value;

  if (!selectedName) {
    hideConfirmation();
    resetPendingState();
    errorEl.textContent = "\u26a0\uFE0F ERRORE. Seleziona il tuo Genoma.";
    return;
  }

  const existingName = storageGet(STORAGE_NAME);
  const existingReceiver = storageGet(STORAGE_RECEIVER);

  // Questo browser ha gi\u00e0 un destino sigillato
  if (existingName && existingReceiver) {
    hideConfirmation();
    resetPendingState();
    showResult(existingName, existingReceiver);
    lockUI();
    return;
  }

  // Primo click o cambio di nome \u2192 mostra messaggio di conferma
  if (!pendingConfirmation || pendingName !== selectedName) {
    pendingConfirmation = true;
    pendingName = selectedName;

    playClickSound(false);
    setConfirmation(`
      <div class="confirm-header">
        <span class="confirm-icon">\u2737</span>
        <span class="confirm-title">Conferma identit\u00e0 genetica</span>
        <span class="confirm-icon">\u2737</span>
      </div>
      <p class="confirm-body">
        Genoma dichiarato:
        <span class="confirm-name">"${selectedName}"</span>.<br />
      </p>
      <p class="confirm-footer">
        Assicurati di aver selezionato <span class="confirm-name">il tuo nome</span>, se \u00e8 corretto, premi di nuovo
        <span class="confirm-strong">"Ricevi la Missione"</span>
        per scolpire il giuramento nei Sacri Archivi.
      </p>
    `);

    return; // primo click: solo conferma visiva
  }

  // Secondo click con lo stesso nome \u2192 sigilla nei Sacri Archivi
  const receiver = assignments[selectedName];

  if (!receiver) {
    hideConfirmation();
    resetPendingState();
    errorEl.textContent =
      "\u26a0\uFE0F Errore critico negli archivi dell'Inquisizione.";
    return;
  }

  playClickSound(true);
  if (!storageOperational) {
    hideConfirmation();
    resetPendingState();
    errorEl.textContent =
      "\u26a0\uFE0F Il Cogitatore non pu\u00f2 sigillare la missione su questo dispositivo. Abilita la memoria locale e riprova.";
    return;
  }

  const sealed =
    storageSet(STORAGE_NAME, selectedName) &&
    storageSet(STORAGE_RECEIVER, receiver);

  if (!sealed) {
    storageRemove(STORAGE_NAME, true);
    storageRemove(STORAGE_RECEIVER, true);
    hideConfirmation();
    resetPendingState();
    errorEl.textContent =
      "\u26a0\uFE0F Il Cogitatore non riesce a salvare la missione. Libera spazio o consenti i dati locali e riprova.";
    return;
  }

  resetPendingState();

  setConfirmation(`
    <div class="confirm-header">
      <span class="confirm-icon">\u2736</span>
      <span class="confirm-title">Giuramento registrato</span>
    </div>
    <p class="confirm-body">
      Il Cogitatore ha sigillato il tuo destino natalizio.
      Questo terminale servir\u00e0 da ora in avanti il Genoma
      <span class="confirm-name">"${selectedName}"</span>.
    </p>
  `);

  lockUI();
  showResult(selectedName, receiver);
});

// ===============================
// PANNELLO ADMIN SEGRETO
// ===============================

// Apertura tramite pulsante dedicato
if (adminTriggerBtn) {
  adminTriggerBtn.addEventListener("click", promptAdminAccess);
}

function promptAdminAccess() {
  const pass = prompt("Inserisci il Codice dell'Inquisitore Nicco:");
  if (pass === ADMIN_KEY) {
    openAdminPanel();
  } else if (pass !== null) {
    alert("⚠️ Accesso Negato. Invio report all'Admin in corso...");
  }
}

function openAdminPanel() {
  adminPanel.style.display = "block";

  // Popola tabella completa
  let html = "<tr><td><b>Donatore</b></td><td><b>Ricevitore</b></td></tr>";
  participants.forEach((p) => {
    html += `<tr><td>${p}</td><td>${assignments[p]}</td></tr>`;
  });
  adminTable.innerHTML = html;
}

closeAdmin.addEventListener("click", () => {
  adminPanel.style.display = "none";
});

adminClearBtn.addEventListener("click", () => {
  const conferma = confirm(
    "\u26a0\uFE0F ATTENZIONE \u26a0\uFE0F\n\nVuoi veramente PURIFICARE questo Terminale Sacro?\n\nIl Cogitatore dimenticher\u00e0 il suo Ordine Imperiale.\n\nProcedere con la Purificazione?"
  );

  if (!conferma) return;

  storageRemove(STORAGE_NAME, true);
  storageRemove(STORAGE_RECEIVER, true);
  initFromStorage();

  alert(
    "\u2736 Terminale Purificato con Successo.\n\nIl Machine Spirit \u00e8 pronto per un nuovo servizio all'Imperatore."
  );
  selectEl.value = "";
  errorEl.textContent = "";
});

// ===============================
// INIT
// ===============================

function bootstrap() {
  initFromStorage();
  initAudioFX();
  loadLitanyQuotes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
