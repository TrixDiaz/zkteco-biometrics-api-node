const express = require("express");
const ZKLib = require("zklib-js");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());

// 🔧 FIXED: Proper constructor usage
const zk = new ZKLib("192.168.13.201", 4370, 5000, 0);

app.get("/users", async (req, res) => {
  try {
    console.log("🔌 Connecting to device...");
    await zk.createSocket();

    console.log("📥 Fetching users...");
    const users = await zk.getUsers();

    console.log("✅ Disconnecting...");
    await zk.disconnect();

    res.json({success: true, users});
  } catch (err) {
    console.error("❌ Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: err.message || "Unknown error",
        error: err,
      });
  }
});

app.get('/logs', async (req, res) => {
  const { from, to, userId } = req.query;

  try {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if ((from && isNaN(fromDate)) || (to && isNaN(toDate))) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use MM/DD/YYYY' });
    }

    await zk.createSocket();
    const { data: logs } = await zk.getAttendances(); // ✅ FIXED
    await zk.disconnect();

    const filteredLogs = logs.filter(log => {
      const logDate = new Date(log.recordTime);

      const isWithinDateRange =
        (!fromDate || logDate >= fromDate) &&
        (!toDate || logDate <= toDate);

      const isMatchingUser =
        !userId || log.deviceUserId === userId;

      return isWithinDateRange && isMatchingUser;
    });

    res.json({ success: true, logs: filteredLogs });
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Unknown error', error: err });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
});
