// 重写 gen-bundle.js：reqCode 用 JSON.stringify 安全转义
const fs = require('fs');
const path = require('path');

function walkJs(d) {
  let r = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) r = r.concat(walkJs(p));
    else if (f.endsWith('.js') || f.endsWith('.json')) r.push(p);
  }
  return r;
}

const mods = {};
for (const [pkg, base] of [
  ['iconv-lite', path.join(__dirname, '..', 'rate-gui', '元歌工具箱', 'resources', 'app', 'node_modules', 'iconv-lite')],
  ['safer-buffer', path.join(__dirname, '..', 'rate-gui', '元歌工具箱', 'resources', 'app', 'node_modules', 'safer-buffer')],
  ['basic-ftp', path.join(__dirname, 'node_modules', 'basic-ftp')],
]) {
  for (const f of walkJs(base)) {
    const rel = pkg + '/' + f.replace(/\\/g, '/').split(pkg + '/')[1];
    mods[rel] = fs.readFileSync(f, 'utf8');
  }
}

let memCode = 'const __path = require("path");\n';
memCode += 'global.__M2RELOAD_PS1 = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'm2-reload.ps1'), 'utf8')) + ';\n';
memCode += 'global.__SITE_TPL = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'site-template', 'droprate.html'), 'utf8')) + ';\n';
memCode += 'global.__STORE_TEMPLATE = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'store-template.txt'), 'utf8')) + ';\n';
memCode += 'const __memMods = new Map();\n';
for (const [name, code] of Object.entries(mods)) {
  memCode += '__memMods.set(' + JSON.stringify(name) + ', ' + JSON.stringify(code) + ');\n';
}

// 自实现加载器（SEA 兼容；require 回调闭包绑定父模块路径，支持延迟 require）
const reqSrc = `
global.__iconvLite = (() => {
  const __cache = {};
  function __load(abs, rawId) {
    if (__cache[abs]) return __cache[abs].exports;
    if (!__memMods.has(abs)) {
      try { return require(rawId); } catch (e2) { throw new Error('模块未注册: ' + abs); }
    }
    const code = __memMods.get(abs);
    const m = { exports: {} };
    __cache[abs] = m;
    if (abs.endsWith('.json')) {
      m.exports = JSON.parse(code);
    } else {
      const wrapped = '(function(require,module,exports,__dirname,__filename){' + code + '\\n})';
      const fn = eval(wrapped);
      const parentAbs = abs;
      fn((r) => {
        let rabs = r;
        if (r === 'iconv-lite') rabs = 'iconv-lite/lib/index.js';
        else if (r === 'safer-buffer') rabs = 'safer-buffer/safer.js';
        else if (r === 'basic-ftp') rabs = 'basic-ftp/dist/index.js';
        if (r.startsWith('.')) {
          const base = __path.posix.dirname(parentAbs);
          rabs = __path.posix.normalize(__path.posix.join(base, r));
          if (!__memMods.has(rabs)) {
            if (__memMods.has(rabs + '.js')) rabs = rabs + '.js';
            else if (__memMods.has(rabs + '/index.js')) rabs = rabs + '/index.js';
          }
        }
        return __load(rabs, r);
      }, m, m.exports, __path.posix.dirname(abs), abs);
    }
    return m.exports;
  }
  return __load('iconv-lite/lib/index.js', 'iconv-lite/lib/index.js');
})();


global.__basicFtp = (() => {
  const __c2 = {};
  function __l2(abs, rawId) {
    if (__c2[abs]) return __c2[abs].exports;
    if (!__memMods.has(abs)) { try { return require(rawId); } catch (e2) { throw new Error('模块未注册: ' + abs); } }
    const code = __memMods.get(abs);
    const m = { exports: {} };
    __c2[abs] = m;
    if (abs.endsWith('.json')) { m.exports = JSON.parse(code); }
    else {
      const wrapped = '(function(require,module,exports,__dirname,__filename){' + code + '\\n})';
      const fn = eval(wrapped);
      const parentAbs = abs;
      fn((r) => {
        let rabs = r;
        if (r === 'basic-ftp') rabs = 'basic-ftp/dist/index.js';
        if (r.startsWith('.')) {
          const base = __path.posix.dirname(parentAbs);
          rabs = __path.posix.normalize(__path.posix.join(base, r));
          if (!__memMods.has(rabs)) {
            if (__memMods.has(rabs + '.js')) rabs = rabs + '.js';
            else if (__memMods.has(rabs + '/index.js')) rabs = rabs + '/index.js';
          }
        }
        return __l2(rabs, r);
      }, m, m.exports, __path.posix.dirname(abs), abs);
    }
    return m.exports;
  }
  return __l2('basic-ftp/dist/index.js', 'basic-ftp/dist/index.js');
})();

`;
const reqCode = 'eval(' + JSON.stringify(reqSrc) + ');';

const lib = fs.readFileSync('lib.js', 'utf8');
const main = fs.readFileSync('main.js', 'utf8').replace(/^#!.*\r?\n/, '');
const bundled = '// 单文件版（SEA 打包用，内联 iconv-lite）\n' +
  memCode + '\n' + reqCode + '\n' +
  lib.replace('module.exports = {', 'global.__lib = {') +
  '\n' +
  main
    .replace("const lib = require('./lib.js');", 'const lib = global.__lib;')
    .replace("const fs = require('fs');\n", '')
    .replace("const path = require('path');\n", '');
fs.writeFileSync('bundle.js', bundled);
console.log('bundle.js 生成:', bundled.length, '字节');
