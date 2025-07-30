const express = require("express");
const ZKLib = require("zklib-js");
const cors = require("cors");

const app = express();

// Parse command line arguments
const args = process.argv.slice(2);
let PORT = 3000;
let HOST = "0.0.0.0"; // Default to all interfaces

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    PORT = parseInt(args[i + 1]);
  } else if (args[i] === "--host" && args[i + 1]) {
    HOST = args[i + 1];
  } else if (args[i].startsWith("--port=")) {
    PORT = parseInt(args[i].split("=")[1]);
  } else if (args[i].startsWith("--host=")) {
    HOST = args[i].split("=")[1];
  }
}

// Device IP and port
const DEVICE_IP = "192.168.13.201";
const DEVICE_PORT = 4370;

app.use(cors());

// Initialize device connection object
const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 0);

// Helper function to connect with retry
async function connectToDevice() {
  try {
    console.log(`🔌 Connecting to ZKTeco at ${DEVICE_IP}:${DEVICE_PORT}...`);
    await zk.createSocket();
    console.log("✅ Connected to device.");
  } catch (err) {
    console.warn("⚠️ First connection attempt failed:", err.message);
    console.log("🔁 Retrying in 1 second...");
    await new Promise((res) => setTimeout(res, 1000));

    try {
      await zk.createSocket();
      console.log("✅ Connected on second attempt.");
    } catch (retryErr) {
      throw new Error(
        `Failed to connect to device after retry: ${retryErr.message}`
      );
    }
  }
}

// ✅ GET /users
app.get("/users", async (req, res) => {
  try {
    await connectToDevice();

    console.log("📥 Fetching users...");
    const users = await zk.getUsers();

    await zk.disconnect();
    console.log("🔌 Disconnected from device.");

    res.json({success: true, users});
  } catch (err) {
    console.error("❌ Error in /users:", err.message);
    try {
      await zk.disconnect(); // Ensure socket is closed on error
    } catch {}
    res.status(500).json({
      success: false,
      message: err.message || "Unknown error",
      error: err,
    });
  }
});

// ✅ GET /logs
app.get("/logs", async (req, res) => {
  const {from, to, userId} = req.query;

  try {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if ((from && isNaN(fromDate)) || (to && isNaN(toDate))) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use MM/DD/YYYY",
      });
    }

    await connectToDevice();

    console.log("📥 Fetching attendance logs...");
    const rawLogs = await zk.getAttendances();
    await zk.disconnect();

    if (!rawLogs || !Array.isArray(rawLogs.data)) {
      throw new Error("Device returned invalid or no log data.");
    }

    const logs = rawLogs.data;

    // Filter logs
    const filteredLogs = logs.filter((log) => {
      const logDate = new Date(log.recordTime);

      const isWithinDateRange =
        (!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate);

      const isMatchingUser =
        !userId || String(log.deviceUserId) === String(userId);

      return isWithinDateRange && isMatchingUser;
    });

    res.json({success: true, logs: filteredLogs});
  } catch (err) {
    console.error("❌ Error in /logs:", err.message);
    try {
      await zk.disconnect();
    } catch {}
    res.status(500).json({
      success: false,
      message: err.message || "Unknown error",
      error: err,
    });
  }
});

// 🟢 Start the server
app.listen(PORT, HOST, () => {
  console.log(`🚀 API Server running at http://${HOST}:${PORT}`);
  console.log(`🌐 Server accessible on all network interfaces`);
});
