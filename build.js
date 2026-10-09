/**
 * OfferGo 模块化编译器与热重载脚本 (Zero-Dependency Builder)
 * 作用：将 src/ 目录中拆分细化的小模块秒级编译装配为 Chrome 扩展可直接加载的标准单入口文件。
 * 用法：
 *   node build.js           # 单次编译全量产物 (耗时约 10~20ms)
 *   node build.js --watch   # 监听 src/ 文件夹改动，保存后即刻自动编译
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

function verifySyntax(code, filename) {
  try {
    new vm.Script(code, { filename });
  } catch (err) {
    console.error(`❌ [BUILD SYNTAX ERROR] ${filename}:`, err.message);
    throw err;
  }
}

// 1. 构建 content.js
function buildContent() {
  const dir = path.join(SRC_DIR, 'content');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  
  const chunks = [
    '// ==========================================================================',
    '//  OfferGo - Content Script (Auto-generated from src/content/*.js)',
    '//  请编辑 src/content/ 下对应的小模块文件，然后运行 npm run build (或 node build.js)',
    '// ==========================================================================\n'
  ];

  for (const f of files) {
    const code = readFile(path.join(dir, f));
    chunks.push(`// --- [src/content/${f}] ---`);
    chunks.push(code);
    chunks.push('\n');
  }

  const output = chunks.join('\n');
  verifySyntax(output, 'content.js');
  writeFile(path.join(ROOT_DIR, 'content.js'), output);
  console.log(`✓ Built content.js (${output.split('\n').length} lines, from ${files.length} modules)`);
}

// 2. 构建 floating_card.js
function buildCard() {
  const dir = path.join(SRC_DIR, 'card');
  const p1_init = readFile(path.join(dir, '01_init.js'));
  const stylesCss = readFile(path.join(dir, 'styles.css'));
  const templateHtml = readFile(path.join(dir, 'template.html'));
  const p2_dom_refs = readFile(path.join(dir, '02_dom_refs.js'));
  const p3_storage = readFile(path.join(dir, '03_storage.js'));
  const p4_views = readFile(path.join(dir, '04_views.js'));
  const p5_pill = readFile(path.join(dir, '05_pill.js'));
  const p6_ai_config = readFile(path.join(dir, '06_ai_config.js'));
  const p7_interactions = readFile(path.join(dir, '07_interactions.js'));
  const p8_password = readFile(path.join(dir, '08_password_card.js'));
  const p9_lifecycle = readFile(path.join(dir, '09_lifecycle.js'));
  const p10_navigation = readFile(path.join(dir, '10_section_navigation.js'));
  const chunks = [
    p1_init,
    '  // --- [src/card/styles.css] ---',
    '  styleEl.textContent = `',
    stylesCss,
    '  `;',
    '  shadow.appendChild(styleEl);',
    '',
    '  // --- [src/card/template.html] ---',
    '  const container = document.createElement("div");',
    '  container.innerHTML = `',
    templateHtml,
    '  `;',
    '  shadow.appendChild(container);',
    '',
    '  // --- [src/card/02_dom_refs.js] ---',
    p2_dom_refs,
    '',
    '  // --- [src/card/03_storage.js] ---',
    p3_storage,
    '',
    '  // --- [src/card/04_views.js] ---',
    p4_views,
    '',
    '  // --- [src/card/05_pill.js] ---',
    p5_pill,
    '',
    '  // --- [src/card/06_ai_config.js] ---',
    p6_ai_config,
    '',
    '  // --- [src/card/07_interactions.js] ---',
    p7_interactions,
    '',
    '  // --- [src/card/08_password_card.js] ---',
    p8_password,
    '',
    '  // --- [src/card/10_section_navigation.js] ---',
    p10_navigation,
    '',
    '  // --- [src/card/09_lifecycle.js] ---',
    p9_lifecycle
  ];

  const output = chunks.join('\n');
  verifySyntax(output, 'floating_card.js');
  writeFile(path.join(ROOT_DIR, 'floating_card.js'), output);
  console.log(`✓ Built floating_card.js (${output.split('\n').length} lines, template & styles modularized)`);
}

// 3. 构建 background.js
function buildBackground() {
  const dir = path.join(SRC_DIR, 'background');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();

  const chunks = [
    '// ==========================================================================',
    '//  OfferGo - Background Service Worker (Auto-generated from src/background/*.js)',
    '//  请编辑 src/background/ 下对应的小模块文件，然后运行 npm run build',
    '// ==========================================================================\n'
  ];

  for (const f of files) {
    const code = readFile(path.join(dir, f));
    chunks.push(`// --- [src/background/${f}] ---`);
    chunks.push(code);
    chunks.push('\n');
  }

  const output = chunks.join('\n');
  verifySyntax(output, 'background.js');
  writeFile(path.join(ROOT_DIR, 'background.js'), output);
  console.log(`✓ Built background.js (${output.split('\n').length} lines, from ${files.length} modules)`);
}

// 4. 构建 sidepanel.js
function buildSidepanel() {
  const dir = path.join(SRC_DIR, 'sidepanel');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();

  const chunks = [
    '// ==========================================================================',
    '//  OfferGo - Sidepanel Logic (Auto-generated from src/sidepanel/*.js)',
    '//  请编辑 src/sidepanel/ 下对应的小模块文件，然后运行 npm run build',
    '// ==========================================================================\n'
  ];

  for (const f of files) {
    const code = readFile(path.join(dir, f));
    chunks.push(`// --- [src/sidepanel/${f}] ---`);
    chunks.push(code);
    chunks.push('\n');
  }

  const output = chunks.join('\n');
  verifySyntax(output, 'sidepanel.js');
  writeFile(path.join(ROOT_DIR, 'sidepanel.js'), output);
  console.log(`✓ Built sidepanel.js (${output.split('\n').length} lines, from ${files.length} modules)`);
}

function buildAll() {
  const start = Date.now();
  console.log('📦 Starting OfferGo modular build...');
  buildContent();
  buildCard();
  buildBackground();
  buildSidepanel();
  console.log(`✨ All modules built successfully in ${Date.now() - start}ms!`);
}

function watchMode() {
  buildAll();
  console.log('\n👀 Watching src/ for changes... Press Ctrl+C to stop.');
  let timeout = null;
  fs.watch(SRC_DIR, { recursive: true }, (event, filename) => {
    if (!filename) return;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log(`\n🔄 Detected change in ${filename}, rebuilding...`);
      try {
        buildAll();
      } catch (e) {
        // syntax errors logged in verifySyntax
      }
    }, 80);
  });
}

if (process.argv.includes('--watch')) {
  watchMode();
} else {
  buildAll();
}
