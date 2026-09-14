// 更新 GUI index.html：三个 panel 的范围加"按地图"选项
const fs = require('fs');
const h0 = fs.readFileSync('index.html', 'utf8');

let h = h0;

// ① 爆率调整：范围 seg 加按地图
h = h.replace(
  '<button data-scope="all" class="active">全服（所有怪物）</button>\n          <button data-scope="mon">指定怪物</button>',
  '<button data-scope="all" class="active">全服</button>\n          <button data-scope="mon">指定怪物</button>\n          <button data-scope="map">按地图</button>'
);
// ① 怪物行后加地图行
h = h.replace(
  '      <div class="row" id="row-mon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="mon" placeholder="例如 白野猪 / 祖玛教主">\n      </div>',
  '      <div class="row" id="row-mon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="mon" placeholder="例如 白野猪 / 祖玛教主">\n      </div>\n      <div class="row" id="row-map" style="display:none;">\n        <label>地图代码</label>\n        <input type="text" id="map" placeholder="MonGen.txt 地图代码，如 shuai209 / Q004">\n        <span class="hint">从 MonGen.txt 查该地图刷的怪</span>\n      </div>'
);

// ② 批量调整：范围 seg 加按地图
h = h.replace(
  '<button data-bs="all" class="active">全服调整</button>\n          <button data-bs="mon">按怪物名称</button>',
  '<button data-bs="all" class="active">全服调整</button>\n          <button data-bs="mon">按怪物名称</button>\n          <button data-bs="map">按地图</button>'
);
h = h.replace(
  '      <div class="row" id="row-bmon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="bmon" placeholder="例如 白野猪">\n      </div>',
  '      <div class="row" id="row-bmon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="bmon" placeholder="例如 白野猪">\n      </div>\n      <div class="row" id="row-bmap" style="display:none;">\n        <label>地图代码</label>\n        <input type="text" id="bmap" placeholder="MonGen.txt 地图代码">\n      </div>'
);

// ③ 随机转换：范围 seg 加按地图
h = h.replace(
  '<button data-rs="all" class="active">全服转换</button>\n          <button data-rs="mon">按怪物名称</button>',
  '<button data-rs="all" class="active">全服转换</button>\n          <button data-rs="mon">按怪物名称</button>\n          <button data-rs="map">按地图</button>'
);
h = h.replace(
  '      <div class="row" id="row-rmon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="rmon" placeholder="例如 白野猪">\n      </div>',
  '      <div class="row" id="row-rmon" style="display:none;">\n        <label>怪物名</label>\n        <input type="text" id="rmon" placeholder="例如 白野猪">\n      </div>\n      <div class="row" id="row-rmap" style="display:none;">\n        <label>地图代码</label>\n        <input type="text" id="rmap" placeholder="MonGen.txt 地图代码">\n      </div>'
);

fs.writeFileSync('index.html', h);
const diff = h !== h0;
console.log('index.html 更新完成, 有变化:', diff);
if (!diff) console.log('警告: 替换未生效，检查模板字符串');
