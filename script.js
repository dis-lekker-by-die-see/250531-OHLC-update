const apiUrl = "https://lightchart.bitflyer.com/api/ohlc";
let existingData = null;
let updatedJson = null;

function log(message) {
  const output = document.getElementById("output");
  output.textContent += message + "\n";
}

function getMostRecent9amJst() {
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = (utcMinutes + jstOffset) % (24 * 60);
  const jstHour = Math.floor(jstMinutes / 60);
  //log(`Math.floor(jstMinutes / 60): ${Math.floor(jstMinutes / 60)}`);
  let recent9am = new Date(now);
  recent9am.setUTCHours(0, 0, 0, 0); // Midnight UTC
  // if (jstHour < 9) {
  //   recent9am.setUTCDate(recent9am.getUTCDate() - 1); // Previous day
  //   log(`1 Most Recent 09:00: ${recent9am.getTime()}`);
  // }
  // recent9am.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 09:00 JST
  // log(`2 Most Recent 09:00: ${recent9am.getTime()}`);

  recent9am.setUTCDate(recent9am.getUTCDate() - 1); // Previous day
  log(`Most Recently Completed 1 Day: ${recent9am.getTime()}`);
  return recent9am.getTime();
}

function getTimestampedFilename() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // JST is UTC+9 in milliseconds
  const jstTime = new Date(
    now.getTime() + jstOffset + now.getTimezoneOffset() * 60 * 1000
  );
  const year = jstTime.getFullYear().toString().slice(-2); // YY
  const month = (jstTime.getMonth() + 1).toString().padStart(2, "0"); // MM
  const day = jstTime.getDate().toString().padStart(2, "0"); // DD
  const hours = jstTime.getHours().toString().padStart(2, "0"); // HH (24-hour)
  const minutes = jstTime.getMinutes().toString().padStart(2, "0"); // MM
  const seconds = jstTime.getSeconds().toString().padStart(2, "0"); // SS
  //return `FX_BTC_JPY-OHLC-d-all_${year}${month}${day}-${hours}${minutes}${seconds}`;
  return `BTC_JPY-OHLC-d-all_${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function formatJstDate(timestampMs) {
  const date = new Date(timestampMs);
  const jstOffset = 9 * 60 * 60 * 1000; // JST is UTC+9
  const jstTime = new Date(
    date.getTime() + jstOffset + date.getTimezoneOffset() * 60 * 1000
  );
  const year = jstTime.getFullYear();
  const month = (jstTime.getMonth() + 1).toString().padStart(2, "0");
  const day = jstTime.getDate().toString().padStart(2, "0");
  const hours = jstTime.getHours().toString().padStart(2, "0");
  const minutes = jstTime.getMinutes().toString().padStart(2, "0");
  const seconds = jstTime.getSeconds().toString().padStart(2, "0");
  const milliseconds = jstTime.getMilliseconds().toString().padStart(3, "0");
  //return `${year}-${month}-${day}_${hours}:${minutes} (${seconds}.${milliseconds})`;
  return `${year}-${month}-${day}_${hours}:${minutes}`;
}

function formatPrice(value) {
  if (value == null) return "null";
  return Math.round(value).toLocaleString("en-US", { useGrouping: true });
}

function calculateSMA1(data, periods1) {
  if (!data || data.length === 0) return [];
  const sma1 = new Array(data.length).fill(null);
  if (data.length > 0) {
    for (let i = data.length - 1; i >= 0; i--) {
      let sum = 0;
      let count = 0;
      // Average from current row to 'periods' newer rows
      for (
        let j = i;
        j < Math.min(data.length, i + Math.floor(periods1));
        j++
      ) {
        const close = data[j][4];
        if (close !== null) {
          sum += close;
          count++;
        }
      }
      // Calculate SMA if enough non-null values
      if (count > 0) {
        sma1[i] = Math.round(sum / count);
      } else if (i < data.length - 1) {
        sma1[i] = sma1[i + 1]; // Use previous SMA if no valid closes
      }
    }
  }
  return sma1;
}

function calculateSMA2(data, periods2) {
  if (!data || data.length === 0) return [];
  const sma2 = new Array(data.length).fill(null);
  if (data.length > 0) {
    for (let i = data.length - 1; i >= 0; i--) {
      let sum = 0;
      let count = 0;
      // Average from current row to 'periods' newer rows
      for (
        let j = i;
        j < Math.min(data.length, i + Math.floor(periods2));
        j++
      ) {
        const close = data[j][4];
        if (close !== null) {
          sum += close;
          count++;
        }
      }
      // Calculate SMA if enough non-null values
      if (count > 0) {
        sma2[i] = Math.round(sum / count);
      } else if (i < data.length - 1) {
        sma2[i] = sma2[i + 1]; // Use previous SMA if no valid closes
      }
    }
  }
  return sma2;
}

function updateTable(data) {
  if (!data) return;
  const tbody = document.querySelector("#jsonTable tbody");
  tbody.innerHTML = "";
  const periods1 =
    parseFloat(document.getElementById("sma1Periods").value) || 1;
  const periods2 =
    parseFloat(document.getElementById("sma2Periods").value) || 1;
  const sma1Values = calculateSMA1(data, periods1);
  const sma2Values = calculateSMA2(data, periods2);
  const positions = new Array(data.length).fill(null);
  const plValues = new Array(data.length).fill(null);
  const totalValues = new Array(data.length).fill(null);
  let lastPosition = null;
  let runningTotal = 0;

  // Calculate positions, P/L, and total from oldest to newest
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    let prevSma1Color =
      i < data.length - 1
        ? //? sma1Values[i + 1] > (i + 2 < data.length ? sma1Values[i + 2] : null)
          sma1Values[i + 1] > (i + 2 < data.length ? sma2Values[i + 1] : null)
          ? "#90EE90" // green
          : //: sma1Values[i + 1] < (i + 2 < data.length ? sma1Values[i + 2] : null)
          sma1Values[i + 1] < (i + 2 < data.length ? sma2Values[i + 1] : null)
          ? "#FFB6C1" // red
          : ""
        : "";
    let currentSma1Color =
      i < data.length - 1
        ? //? sma1Values[i] > sma1Values[i + 1]
          sma1Values[i] > sma2Values[i]
          ? "#90EE90"
          : //: sma1Values[i] < sma1Values[i + 1]
          sma1Values[i] < sma2Values[i]
          ? "#FFB6C1"
          : ""
        : "";

    // Calculate Position
    if (
      i === data.length - 1 ||
      (currentSma1Color !== prevSma1Color && currentSma1Color !== "")
    ) {
      positions[i] = row[4] !== null ? row[4] : lastPosition;
    } else {
      positions[i] = lastPosition;
    }
    if (positions[i] !== null) lastPosition = positions[i];

    // Calculate P/L and Total
    if (i < data.length - 1 && row[4] !== null && positions[i + 1] !== null) {
      if (prevSma1Color === "#90EE90") {
        // Previous was long
        plValues[i] = row[4] - positions[i + 1]; // Long: current CLOSE - previous Position
      } else if (prevSma1Color === "#FFB6C1") {
        // Previous was short
        plValues[i] = positions[i + 1] - row[4]; // Short: previous Position - current CLOSE
      }
      // Add P/L to running total on position change
      if (
        i < data.length - 1 &&
        currentSma1Color !== prevSma1Color &&
        currentSma1Color !== ""
      ) {
        runningTotal += plValues[i] || 0;
      }
    }
    totalValues[i] = runningTotal;
  }

  // Render table rows
  data.forEach((row, index) => {
    const tr = document.createElement("tr");
    let closeBgColor = "";
    let sma1BgColor = "";
    if (index < data.length - 1) {
      const nextClose = data[index + 1][4];
      const currentClose = row[4];
      const nextSMA1 = sma1Values[index + 1];
      const currentSMA1 = sma1Values[index];
      const nextSMA2 = sma2Values[index + 1];
      const currentSMA2 = sma2Values[index];
      if (currentClose !== null && nextClose !== null) {
        closeBgColor =
          currentClose > nextClose
            ? "background-color: #90EE90;"
            : currentClose < nextClose
            ? "background-color: #FFB6C1;"
            : "";
      }
      // if (currentSMA1 !== null && nextSMA1 !== null) {
      //   sma1BgColor =
      //     currentSMA1 > nextSMA1
      //       ? "background-color: #90EE90;"
      //       : currentSMA1 < nextSMA1
      //       ? "background-color: #FFB6C1;"
      //       : "";
      // }
      if (currentSMA2 !== null && nextSMA2 !== null) {
        sma1BgColor =
          currentSMA1 > currentSMA2
            ? "background-color: #90EE90;"
            : currentSMA1 < currentSMA2
            ? "background-color: #FFB6C1;"
            : "";
      }
    }
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatJstDate(row[0])}</td>
      <td style="${closeBgColor}">${formatPrice(row[4])}</td>
      <td style="${sma1BgColor}">${formatPrice(sma1Values[index])}</td>
      <td>${formatPrice(sma2Values[index])}</td>
      <td>${formatPrice(positions[index])}</td>
      <td>${formatPrice(plValues[index])}</td>
      <td>${formatPrice(totalValues[index])}</td>
      <td class="extra">${row[0]}</td>
      <td class="extra">${formatPrice(row[1])}</td>
      <td class="extra">${formatPrice(row[2])}</td>
      <td class="extra">${formatPrice(row[3])}</td>
      <td class="extra">${formatPrice(row[4])}</td>
      <td class="extra">${row[5] ?? "null"}</td>
      <td class="extra">${row[6] ?? "null"}</td>
      <td class="extra">${row[7] ?? "null"}</td>
      <td class="extra">${row[8] ?? "null"}</td>
      <td class="extra">${row[9] ?? "null"}</td>
    `;
    tbody.appendChild(tr);
  });
  toggleColumns();
}

function toggleColumns() {
  const isChecked = document.getElementById("toggleColumns").checked;
  const extraColumns = document.querySelectorAll(".extra");
  extraColumns.forEach((col) => {
    col.style.display = isChecked ? "" : "none";
  });
}

async function loadSavedData() {
  //log("Load Saved Data: Loading FX_BTC_JPY-OHLC-d-all.json");
  log("Load Saved Data: Loading BTC_JPY-OHLC-d-all.json");
  existingData = null; // Clear existing data before fetch
  try {
    //const response = await fetch("FX_BTC_JPY-OHLC-d-all.json");
    const cacheBuster = `?_=${new Date().getTime()}`; // Prevent caching and reusing old json data
    const response = await fetch(`BTC_JPY-OHLC-d-all.json${cacheBuster}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    existingData = data;
    log(`Load Saved Data: Loaded ${existingData.length} entries`);
    updateTable(existingData);
    document.getElementById("jsonFileInput").disabled = true;
    document.getElementById("getDataBtn").disabled = false;
  } catch (error) {
    log(`Error: ${error.message}`);
  }
}

async function uploadJson() {
  log("Upload JSON: Selecting file");
  try {
    const fileInput = document.getElementById("jsonFileInput");
    if (!fileInput.files.length) {
      throw new Error("No file selected");
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        existingData = JSON.parse(event.target.result);
        log(`Upload JSON: Loaded ${existingData.length} entries`);
        updateTable(existingData);
        document.getElementById("getDataBtn").disabled = false;
      } catch (error) {
        log(`Error: Invalid JSON format - ${error.message}`);
      }
    };
    reader.readAsText(file);
  } catch (error) {
    log(`Error: ${error.message}`);
  }
}

async function getNewData() {
  log("Get New Data: Starting process");
  try {
    if (!existingData) {
      throw new Error("No JSON file uploaded");
    }

    let latestTimestamp = null;
    if (existingData.length > 0) {
      latestTimestamp = Math.max(...existingData.map((entry) => entry[0]));
      log(
        `Latest Timestamp Found: ${latestTimestamp} (${new Date(
          latestTimestamp
        ).toISOString()})`
      );
    } else {
      log("No Existing Data: Using most recent 9:00 AM JST");
    }

    const recent9amMs = getMostRecent9amJst(); // - 86400000; // "- 86400000" sets the most recent timestamp to yesterday's 09:00
    const beforeMs =
      latestTimestamp && latestTimestamp > recent9amMs
        ? latestTimestamp
        : recent9amMs;
    log(`API Query Before: ${beforeMs} (${new Date(beforeMs).toISOString()})`);

    const params = new URLSearchParams({
      //symbol: "FX_BTC_JPY",
      symbol: "BTC_JPY",
      period: "d",
      before: beforeMs.toString(),
    });
    log(`GET    ${apiUrl}?${params.toString()}`);

    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://lightchart.bitflyer.com/",
        Origin: "https://lightchart.bitflyer.com",
      },
    });
    log(
      `HTTP ${response.status} ${
        response.ok ? "OK" : "Error"
      }: Response received`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      log("Invalid API Response: Not a list");
      return;
    }

    if (data.length === 0) {
      log("No New Data Available: API returned empty list");
      updatedJson = existingData;
    } else {
      const formattedData = data
        .filter((entry) => entry.length >= 10)
        .map((entry) => entry.slice(0, 10));
      log(`Data Retrieved: ${formattedData.length} entries formatted`);

      const existingTimestamps = new Set(existingData.map((entry) => entry[0]));
      const newData = formattedData.filter(
        (entry) => !existingTimestamps.has(entry[0])
      );
      log(`New Data Filtered: ${newData.length} unique entries to prepend`);

      if (newData.length === 0) {
        log("No New Data: No entries to prepend");
        updatedJson = existingData;
      } else {
        updatedJson = newData.concat(existingData);
        log(`Data Prepended: ${newData.length} entries added`);
      }
    }

    updateTable(updatedJson);
    document.getElementById("saveJsonBtn").disabled = false;
  } catch (error) {
    log(`Error: ${error.message}`);
  }
}

function saveNewJson() {
  if (!updatedJson) {
    log("Error: No updated JSON to save");
    return;
  }
  const blob = new Blob([JSON.stringify(updatedJson, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getTimestampedFilename() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log(`Save New JSON: Prompted to save ${a.download}`);
}

function downloadCsv() {
  const table = document.getElementById("jsonTable");
  let csv = [];
  const rows = table.querySelectorAll("tr");

  rows.forEach((row, rowIndex) => {
    const cols = row.querySelectorAll("th, td");
    const rowData = [];
    cols.forEach((col, colIndex) => {
      // Skip extra columns if hidden
      if (col.classList.contains("extra") && col.style.display) {
        return;
      }
      let cellText = col.textContent.trim();
      // Escape quotes and wrap in quotes if contains commas or quotes
      if (cellText.includes(",") || cellText.includes('"')) {
        cellText = `"${cellText.replace(/"/g, '""')}"`;
      }
      rowData.push(cellText);
    });
    if (rowData.length > 0) {
      csv.push(rowData.join(","));
    }
  });

  const csvContent = csv.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getTimestampedFilename() + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log(`Download CSV: Prompted to save ${a.download}`);
}
