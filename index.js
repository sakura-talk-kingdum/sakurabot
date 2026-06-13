import dotenv from "dotenv";
import https from "https";
import "./web.js";

dotenv.config();

setInterval(() => {
  const req = https.get("https://bot.sakurahp.f5.si/", res => {
    res.resume(); // データ捨てる（重要）
  });

  req.on("error", err => {
    console.error("[KeepAlive Error]", err.message);
  });

  req.setTimeout(5000, () => {
    req.destroy();
    console.error("[KeepAlive Timeout]");
  });
}, 120_000);
