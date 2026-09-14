// store-worker.js — 存销生成/清理 worker 线程（重活移出主进程，避免窗口消息卡顿）
// lib.js 内部自动 require('iconv-lite')（同目录 node_modules）；结果经 postMessage 结构化克隆返回
const { parentPort, workerData } = require('worker_threads');

(async () => {
  try {
    const lib = require('./lib.js');
    // 显式加载 iconv：lib 内部 require('iconv-lite') 在 worker 解析失败时 iconv 为 null，会静默以 UTF-8 写 GBK 脚本（破坏服务端）
    let iconv = null;
    try { iconv = require('iconv-lite'); } catch (e) { iconv = null; }
    if (!iconv) { parentPort.postMessage({ ok: false, msg: 'worker 缺少 iconv-lite（无法以 GBK 写脚本），请检查 GUI 资源目录' }); return; }
    lib.setIconv(iconv);
    const { action, root, o } = workerData || {};
    if (!root) { parentPort.postMessage({ ok: false, msg: '未选择引擎根目录' }); return; }
    const r = action === 'clean'
      ? await lib.storeCleanScripts(root, o || {})
      : await lib.genStoreScript(root, o || {});
    parentPort.postMessage(r || { ok: false, msg: '无返回结果' });
  } catch (e) {
    parentPort.postMessage({ ok: false, msg: 'worker 执行出错: ' + (e && e.stack || e) });
  }
})();
