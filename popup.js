const urlsTextarea = document.getElementById("urls");
const intervalInput = document.getElementById("interval");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");

// Load saved settings and current status when popup opens
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      "urls",
      "interval",
      "isRunning",
    ]);
    urlsTextarea.value = data.urls ? data.urls.join("\n") : "";
    intervalInput.value = data.interval || 60; // Default to 60 seconds

    updateStatus(data.isRunning || false);
  } catch (error) {
    console.error("Error loading settings:", error);
    updateStatus(false); // Assume stopped if error
  }
}

// Update UI based on running state
function updateStatus(isRunning) {
  if (isRunning) {
    statusDiv.textContent = "Status: Running";
    statusDiv.style.color = "green";
    startButton.disabled = true;
    stopButton.disabled = false;
    urlsTextarea.disabled = true;
    intervalInput.disabled = true;
  } else {
    statusDiv.textContent = "Status: Stopped";
    statusDiv.style.color = "red";
    startButton.disabled = false;
    stopButton.disabled = true;
    urlsTextarea.disabled = false;
    intervalInput.disabled = false;
  }
}

// --- Event Listeners ---

startButton.addEventListener("click", async () => {
  const urls = urlsTextarea.value
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => url);
  const interval = parseInt(intervalInput.value, 10);

  if (!urls.length) {
    alert("Please enter at least one URL.");
    return;
  }

  if (isNaN(interval) || interval < 1) {
    alert("Please enter a valid interval (minimum 1 second).");
    return;
  }

  try {
    // Save settings
    await chrome.storage.local.set({ urls, interval });

    // Send message to background script to start
    await chrome.runtime.sendMessage({
      action: "start",
      urls: urls,
      interval: interval,
    });
    console.log("Start message sent to background.");
    updateStatus(true); // Update UI immediately
  } catch (error) {
    console.error("Error starting:", error);
    alert(`Error starting: ${error.message}`);
    updateStatus(false);
  }
});

stopButton.addEventListener("click", async () => {
  try {
    // Send message to background script to stop
    await chrome.runtime.sendMessage({ action: "stop" });
    console.log("Stop message sent to background.");
    updateStatus(false); // Update UI immediately
  } catch (error) {
    console.error("Error stopping:", error);
    alert(`Error stopping: ${error.message}`);
    // Optional: try to fetch status again if stopping failed UI side
  }
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", loadSettings);

// Listen for status updates from the background (e.g., if stopped unexpectedly)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateStatus") {
    console.log("Popup received status update:", message.isRunning);
    updateStatus(message.isRunning);
  }
  // Keep the message channel open for asynchronous response if needed
  // return true;
});
