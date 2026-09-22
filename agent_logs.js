/**
 * Agent 专用诊断日志查询与监听工具 (Agent-Friendly Diagnostic Tool)
 * 供 AI Agent / 自动化脚本在后台快速提取、审查大模型推断日志与表单匹配决策。
 *
 * 使用方法:
 *   node agent_logs.js           # 打印当前最近 10 条日志
 *   node agent_logs.js --json    # 输出纯 JSON，方便 Agent 代码直接结构化分析
 *   node agent_logs.js --listen  # 启动本地日志接收器 (端口 28888)，自动将浏览器扩展中的实时 AI 诊断落盘到 agent_debug.log
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const logFilePath = path.join(__dirname, "agent_debug.log");

function readLocalLogs() {
  if (!fs.existsSync(logFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(logFilePath, "utf8");
    const lines = raw.split("\n").filter(l => l.trim().length > 0);
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { raw: line };
      }
    });
  } catch (err) {
    console.error("读取日志文件失败:", err.message);
    return [];
  }
}

function startLogServer() {
  const PORT = 28888;
  const server = http.createServer((req, res) => {
    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/log") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const entry = JSON.parse(body);
          // 追加到本地文件
          fs.appendFileSync(logFilePath, JSON.stringify(entry) + "\n", "utf8");
          console.log(`[AGENT LOG RECEIVED] ${entry.time} | 状态: ${entry.status} | 耗时: ${entry.durationMs}ms`);
          if (entry.elementMeta) {
            console.log(`  - 输入框标签: "${(entry.elementMeta.clues || [])[0] || ''}" | placeholder: "${entry.elementMeta.placeholder || ''}"`);
          }
          if (entry.rawOutput) {
            console.log(`  - 大模型推断: ${entry.rawOutput}`);
          }
          if (entry.error) {
            console.log(`  - 错误详情: ${entry.error}`);
          }
          console.log("--------------------------------------------------");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch(e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[ResumeFiller Agent Log Server] 正在监听 http://127.0.0.1:${PORT}/log`);
    console.log(`日志将实时追加到: ${logFilePath}`);
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--listen")) {
    startLogServer();
    return;
  }

  const isJson = args.includes("--json");
  const isAll = args.includes("--all");
  const logs = readLocalLogs();

  if (logs.length === 0) {
    if (isJson) {
      console.log("[]");
    } else {
      console.log("=== [ResumeFiller Agent Logs] ===");
      console.log("暂无已记录的诊断日志。");
      console.log("提示：可使用 `node agent_logs.js --listen` 启动后台实时日志落盘服务。");
    }
    return;
  }

  const outputLogs = isAll ? logs : logs.slice(-10);

  if (isJson) {
    console.log(JSON.stringify(outputLogs, null, 2));
    return;
  }

  console.log(`=== [ResumeFiller Agent Logs] (显示最近 ${outputLogs.length} 条) ===\n`);
  outputLogs.forEach((item, idx) => {
    console.log(`[#${idx + 1}] 时间: ${item.time || "未知"} | 状态: ${item.status || "未知"} | 耗时: ${item.durationMs || 0}ms`);
    console.log(`  - 页面URL: ${item.url || "未知"}`);
    if (item.elementMeta) {
      console.log(`  - 输入控件特征:`);
      console.log(`      * 直接标签: "${(item.elementMeta.clues || [])[0] || ''}"`);
      console.log(`      * 占位提示: "${item.elementMeta.placeholder || ''}"`);
      console.log(`      * 控件名称: "${item.elementMeta.name || item.elementMeta.tag || ''}"`);
      console.log(`      * 面包屑路径: "${item.elementMeta.breadcrumb || ''}"`);
      console.log(`      * 提取线索: [${(item.elementMeta.clues || []).join(", ")}]`);
    }
    if (item.rawOutput) {
      console.log(`  - 大模型原始推断: ${item.rawOutput}`);
    }
    if (item.error) {
      console.log(`  - 错误详情: ${item.error}`);
    }
    console.log("--------------------------------------------------");
  });
}

main();
