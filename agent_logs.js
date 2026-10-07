/**
 * Agent 专用诊断日志、填充率审计与执行轨迹工具 (Agent-Friendly Telemetry & Audit Tool)
 * 供 AI Agent / 自动化评估脚本在后台快速提取、审查整页表单填充率、漏填项原因与 Agent 动作轨迹。
 *
 * 使用方法:
 *   node agent_logs.js                  # 打印最近 10 条诊断与填充率审计日志
 *   node agent_logs.js --report         # 仅打印最近的整页填充率审计与 Agent 会话报告
 *   node agent_logs.js --json           # 输出纯 JSON，方便其他 Agent 脚本直接结构化解析
 *   node agent_logs.js --listen         # 启动本地日志接收器 (端口 28888)，实时落盘浏览器扩展发出的填充率与 Agent 轨迹到 agent_debug.log
 *   node agent_logs.js --session <ID>   # 仅查看指定 Agent 会话（含轮次和单步结果）
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
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    return lines.map((line) => {
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

function formatAuditReportConsole(item) {
  const audit = item.coverageAudit || (item.metrics ? item : null);
  if (!audit || !audit.metrics) return;

  const m = audit.metrics;
  console.log(`  📊 [表单填充率审计报告] 系统: ${audit.system || "未知"} | 触发源: ${audit.triggerSource || item.action}`);
  console.log(`     * 总体填充率: ${m.fillRatePercent}% (已填 ${m.filledFieldsCount} / 总计 ${m.totalFieldsCount} 项, 未填 ${m.emptyFieldsCount} 项)`);
  console.log(`     * 必填填充率: ${m.requiredFillRatePercent}% (已填 ${m.requiredFilledCount} / 必填 ${m.requiredTotalCount} 项)`);

  if (audit.sectionSummary && Object.keys(audit.sectionSummary).length > 0) {
    const secParts = Object.entries(audit.sectionSummary).map(
      ([sec, st]) => `${sec}: ${st.filled}/${st.total}(${st.rate})`
    );
    console.log(`     * 板块覆盖率: ${secParts.join(" | ")}`);
  }

  if (Array.isArray(audit.unfilledFields) && audit.unfilledFields.length > 0) {
    console.log(`     * 未填字段诊断清单 (前 ${Math.min(10, audit.unfilledFields.length)} 项):`);
    audit.unfilledFields.slice(0, 10).forEach((u, i) => {
      console.log(
        `       ${i + 1}. [${u.section}] "${u.label}" (type=${u.type}${u.isRequired ? ", 必填*" : ""}${u.name ? `, name=${u.name}` : ""})`
      );
    });
  }

  if (Array.isArray(audit.validationErrors) && audit.validationErrors.length > 0) {
    console.log(`     * 页面红字报错 (${audit.validationErrors.length} 项):`);
    audit.validationErrors.forEach((err, i) => {
      console.log(`       ! [${err.fieldName}]: ${err.errorMessage}`);
    });
  }

  if (item.sessionSummary && Array.isArray(item.sessionSummary.executionTrace)) {
    const s = item.sessionSummary;
    const duration = Number.isFinite(item.durationMs) ? ` | 耗时 ${(item.durationMs / 1000).toFixed(1)}s` : "";
    const verified = s.verifiedStepsCount !== undefined ? `，验证通过 ${s.verifiedStepsCount}` : "";
    const skipped = s.skippedStepsCount ? `，跳过 ${s.skippedStepsCount}` : "";
    console.log(`  🤖 [Agent 会话 ${item.sessionId || "legacy"}] 终止原因: ${item.terminationReason || "未知"}${duration}`);
    console.log(`     * 共 ${s.roundsExecuted} 轮 | 总步数: ${s.totalStepsExecuted} (成功 ${s.successfulStepsCount}${verified}${skipped}，失败 ${s.failedStepsCount})`);
    if (s.actionSummary) console.log(`     * 动作分布: ${Object.entries(s.actionSummary).map(([action, count]) => `${action}=${count}`).join(" | ")}`);
    s.executionTrace.forEach((step) => {
      const elapsed = Number.isFinite(step.durationMs) ? ` ${step.durationMs}ms` : "";
      const outcome = step.success ? (step.verified ? "✓成功且验证" : "✓成功") : (step.skipped ? "↷跳过" : "❌失败");
      console.log(`       Step #${step.stepIndex} [第${step.round || "?"}轮]: ${step.action} -> target=${step.fieldId || ""} slot=${step.slot || ""} | ${outcome}${elapsed} ${step.reason ? `(${step.reason})` : ""}${step.error ? ` [${step.error}]` : ""}`);
    });
  }
}

function startLogServer() {
  const PORT = 28888;
  const server = http.createServer((req, res) => {
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
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const entry = JSON.parse(body);
          fs.appendFileSync(logFilePath, JSON.stringify(entry) + "\n", "utf8");
          console.log(`\n[AGENT LOG RECEIVED] ${entry.time} | 类型: ${entry.action || "diagnostic"}`);
          console.log(`  - 页面URL: ${entry.url || "未知"}`);

          if (entry.action === "page_fill_rate_audit" || entry.action === "agent_session_report") {
            formatAuditReportConsole(entry);
          } else if (entry.action === "agent_session_event") {
            console.log(`  - 会话: ${entry.sessionId || "未知"} | 事件: ${entry.event || "未知"} | 已耗时: ${entry.elapsedMs ?? "?"}ms`);
            if (entry.round !== undefined) console.log(`  - 轮次: ${entry.round}`);
            if (entry.step) console.log(`  - 步骤: ${entry.step.action} -> ${entry.step.slot || entry.step.target || ""}`);
            if (entry.result) console.log(`  - 结果: ${entry.result.success ? "成功" : (entry.result.skipped ? "跳过" : "失败")}${entry.result.error ? ` [${entry.result.error}]` : ""}`);
          } else {
            if (entry.elementMeta) {
              console.log(`  - 输入框标签: "${(entry.elementMeta.clues || [])[0] || ""}" | placeholder: "${entry.elementMeta.placeholder || ""}"`);
            }
            if (entry.rawOutput) {
              console.log(`  - 大模型推断: ${entry.rawOutput}`);
            }
            if (entry.error) {
              console.log(`  - 错误详情: ${entry.error}`);
            }
          }
          console.log("--------------------------------------------------");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
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
    console.log(`日志与填充率审计报告将实时追加到: ${logFilePath}`);
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
  const isReportOnly = args.includes("--report");
  const sessionArgIndex = args.indexOf("--session");
  const requestedSessionId = sessionArgIndex >= 0 ? args[sessionArgIndex + 1] : "";
  let logs = readLocalLogs();

  if (isReportOnly) {
    logs = logs.filter((l) => l.action === "page_fill_rate_audit" || l.action === "agent_session_report");
  }
  if (requestedSessionId) {
    logs = logs.filter((l) => l.sessionId === requestedSessionId);
  }

  if (logs.length === 0) {
    if (isJson) {
      console.log("[]");
    } else {
      console.log("=== [ResumeFiller Agent Telemetry & Audit Logs] ===");
      console.log("暂无本地落盘的诊断日志。");
      console.log("提示 1：运行 `node agent_logs.js --listen` 可实时接收并落盘网页填充率与 Agent 轨迹；");
      console.log("提示 2：也可直接在插件侧边栏【接口与优化】底部点击【导出 Agent 诊断审计日志】下载 JSON。");
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
    console.log(`[#${idx + 1}] 时间: ${item.time || "未知"} | 动作类型: ${item.action || "callLLM"}`);
    console.log(`  - 页面URL: ${item.url || "未知"}`);

    if (item.action === "page_fill_rate_audit" || item.action === "agent_session_report") {
      formatAuditReportConsole(item);
    } else {
      if (item.elementMeta) {
        console.log(`  - 输入控件特征: 标签="${(item.elementMeta.clues || [])[0] || ""}" | placeholder="${item.elementMeta.placeholder || ""}"`);
      }
      if (item.rawOutput) {
        console.log(`  - 大模型原始推断: ${item.rawOutput}`);
      }
      if (item.error) {
        console.log(`  - 错误详情: ${item.error}`);
      }
    }
    console.log("--------------------------------------------------");
  });
}

main();
