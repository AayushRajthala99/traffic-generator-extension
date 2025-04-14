const OFFSCREEN_DOCUMENT_PATH = "/offscreen.html";
let requestTimeoutId = null; // To hold the ID of the scheduled timeout

// --- Offscreen Document Management (Keep as before) ---
async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });
  return contexts.length > 0;
}

async function setupOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    console.log("Background: Creating offscreen document.");
    await chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["DOM_PARSER", "BLOBS"], // Adjust if other reasons needed
        justification: "Required for background fetch requests",
      })
      .catch((error) => {
        console.error("Background: Error creating offscreen document:", error);
      });
    console.log(
      "Background: Offscreen document creation initiated or already exists."
    );
  }
}

async function closeOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    console.log("Background: Offscreen document does not exist, cannot close.");
    return;
  }
  console.log("Background: Closing offscreen document.");
  await chrome.offscreen.closeDocument().catch((error) => {
    console.error("Background: Error closing offscreen document:", error);
  });
  console.log("Background: Offscreen document closed.");
}

// --- Request Logic (Using setTimeout Chain) ---

async function startRequests(urls, interval) {
  console.log(`Background: Starting requests. Interval: ${interval} seconds.`);
  // Clear any existing timeout before starting anew
  if (requestTimeoutId) {
    clearTimeout(requestTimeoutId);
    requestTimeoutId = null;
    console.log("Background: Cleared existing timeout.");
  }

  // Initialize state in storage
  await chrome.storage.local.set({
    isRunning: true,
    urls: urls,
    interval: interval, // Store interval in seconds
    nextUrlIndex: 0, // Start from the first URL
  });
  console.log("Background: State saved (isRunning=true, index=0).");

  // Ensure offscreen document is ready before the first request
  await setupOffscreenDocument();

  // Trigger the first request immediately (no initial delay)
  await triggerNextRequest();

  // Send status update to popup if open
  chrome.runtime
    .sendMessage({ action: "updateStatus", isRunning: true })
    .catch((e) =>
      console.log("Background: Popup not open or error sending status:", e)
    );
}

async function stopRequests() {
  console.log("Background: Stopping requests.");
  // Clear pending timeout
  if (requestTimeoutId) {
    clearTimeout(requestTimeoutId);
    requestTimeoutId = null;
    console.log("Background: Cleared scheduled timeout.");
  }
  // Update state
  await chrome.storage.local.set({ isRunning: false });
  console.log("Background: State saved (isRunning=false).");
  // Close the offscreen document
  await closeOffscreenDocument();
  console.log("Background: Request process stopped.");

  // Send status update to popup if open
  chrome.runtime
    .sendMessage({ action: "updateStatus", isRunning: false })
    .catch((e) =>
      console.log("Background: Popup not open or error sending status:", e)
    );
}

// Function to trigger the request for the *next* URL in sequence
async function triggerNextRequest() {
  // Read the current state
  const data = await chrome.storage.local.get([
    "isRunning",
    "urls",
    "nextUrlIndex",
    "interval",
  ]);

  if (!data.isRunning || !data.urls || data.urls.length === 0) {
    console.log("Background: Stopping condition met (not running or no URLs).");
    await stopRequests(); // Ensure clean stop
    return;
  }

  const currentIndex = data.nextUrlIndex;
  const currentUrl = data.urls[currentIndex];

  // Calculate and store the index for the *next* iteration (looping)
  const nextIndex = (currentIndex + 1) % data.urls.length;
  await chrome.storage.local.set({ nextUrlIndex: nextIndex });
  console.log(
    `Background: Processing URL index ${currentIndex}: ${currentUrl}. Next index will be ${nextIndex}.`
  );

  // Ensure offscreen is ready before sending message
  await setupOffscreenDocument();

  // Send the single URL to the offscreen document for fetching
  console.log(`Background: Sending URL to offscreen: ${currentUrl}`);
  chrome.runtime
    .sendMessage({
      target: "offscreen",
      action: "sendSingleRequest",
      url: currentUrl,
    })
    .catch((error) => {
      console.error(
        "Background: Error sending message to offscreen document:",
        error
      );
      // If sending fails, we should probably still schedule the next one to avoid stopping the chain
      scheduleNextRequestAfterDelay(data.interval);
    });

  // IMPORTANT: Do NOT schedule the next request here. Wait for the 'requestComplete' message.
}

// Function to schedule the next call to triggerNextRequest after a delay
function scheduleNextRequestAfterDelay(intervalSeconds) {
  // Clear any potentially redundant timeout first
  if (requestTimeoutId) {
    clearTimeout(requestTimeoutId);
  }
  const delayMilliseconds = Math.max(100, intervalSeconds * 1000); // Ensure minimum delay if interval is 0 or negative, e.g. 100ms
  console.log(
    `Background: Scheduling next request trigger in ${delayMilliseconds} ms.`
  );
  requestTimeoutId = setTimeout(triggerNextRequest, delayMilliseconds);
}

// --- Event Listeners ---

// Listen for messages from popup or offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "start" && message.urls && message.interval) {
    startRequests(message.urls, message.interval).catch(console.error);
    return false; // Indicate synchronous handling
  } else if (message.action === "stop") {
    stopRequests().catch(console.error);
    return false; // Indicate synchronous handling
  } else if (message.action === "requestComplete") {
    // Received confirmation from offscreen that a request finished (success or fail)
    console.log("Background: Received requestComplete from offscreen.");
    // Schedule the *next* request after the user-defined interval
    chrome.storage.local
      .get(["interval", "isRunning"])
      .then((data) => {
        if (data.isRunning) {
          // Only schedule if still supposed to be running
          scheduleNextRequestAfterDelay(data.interval || 60); // Use stored interval, default 60 if missing
        } else {
          console.log(
            "Background: Not scheduling next request as isRunning is false."
          );
        }
      })
      .catch(console.error);
    return false; // Indicate synchronous handling
  } else if (message.target === "offscreen") {
    // Forward message specifically targeted to offscreen, if not handled above
    console.log(
      "Background: Forwarding message to potential offscreen listeners:",
      message
    );
    // This path might not be needed if offscreen only listens for sendSingleRequest
  }

  // Optional: return true if you need to send an asynchronous response later
  // return true;
});

// Check state on browser startup/extension install
chrome.runtime.onStartup.addListener(async () => {
  console.log("Background: Browser startup detected.");
  const data = await chrome.storage.local.get(["isRunning"]);
  if (data.isRunning) {
    console.log(
      "Background: Was running before browser close. Restarting request sequence."
    );
    // If it was running, restart the sequence. It will pick up from the stored index.
    await setupOffscreenDocument(); // Ensure offscreen is ready
    await triggerNextRequest();
  } else {
    console.log("Background: Was not running before browser close.");
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`Background: Extension event - ${details.reason}`);
  if (details.reason === "install") {
    // Set default state on first install
    await chrome.storage.local.set({
      isRunning: false,
      urls: [],
      interval: 60,
      nextUrlIndex: 0,
    });
    console.log("Background: Initialized storage on install.");
  } else if (details.reason === "update") {
    // Optional: Handle updates, maybe ensure state is consistent
    const data = await chrome.storage.local.get(["isRunning"]);
    if (data.isRunning) {
      console.log(
        "Background: Extension updated while running. Attempting to restart sequence."
      );
      await setupOffscreenDocument();
      await triggerNextRequest(); // Try to resume
    }
  }
  // Ensure state consistency on install/update
  const checkData = await chrome.storage.local.get(["isRunning"]);
  if (checkData.isRunning === undefined) {
    await chrome.storage.local.set({ isRunning: false });
  }
});

console.log("Background service worker started or restarted.");
