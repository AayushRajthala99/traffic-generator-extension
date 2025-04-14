# Traffic Generator Extension

A simple Chromium-based browser extension that generates background traffic by periodically sending requests to a list of specified URLs.

## Features

- Send background HTTP requests to multiple URLs
- Customizable request intervals
- Runs in the background without interrupting browsing
- Lightweight and easy to use

## Installation

1. Download or clone this repository:

   ```bash
   git clone https://github.com/AayushRajthala99/traffic-generator-extension.git
   ```


2. Open Google Chrome and navigate to `chrome://extensions/`.

3. Enable **Developer mode** by toggling the switch in the top right corner.

4. Click on **Load unpacked** and select the folder where you cloned or downloaded the repository.

## Usage

1. Click on the extension icon in the Chrome toolbar to open the popup interface.

2. Enter the list of URLs you want to send requests to.

3. Set the desired interval (in seconds) between each request.

4. Click the **Start** button to begin sending background traffic.

5. To stop the traffic, click the **Stop** button.

## Files Overview

- `manifest.json` – Extension configuration and permissions
- `background.js` – Manages background tasks and intervals
- `popup.html` & `popup.js` – User interface for input and controls
- `offscreen.html` & `offscreen.js` – Handles background fetch requests
- `icons/` – Extension icons
