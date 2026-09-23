/* 渲染验证：截图落地页与工具页，并检查控制台报错与关键元素 */
const puppeteer = require('puppeteer');
const path = require('path');

const DIR = 'D:/workbuddy文件/2026-09-22-19-47-50/xiaoyoujihua-web';
const OUT = 'D:/workbuddy文件/2026-09-22-19-47-50/.workbuddy/_verify';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: 'D:/workbuddy文件/2026-09-22-19-47-50/.workbuddy/_verify/profile',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

  // ---------- 落地页 ----------
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(DIR, 'index.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const landing = await page.evaluate(() => {
    const q = s => !!document.querySelector(s);
    const reveals = document.querySelectorAll('.reveal');
    const visible = document.querySelectorAll('.reveal.is-visible');
    return {
      title: document.title,
      sections: Array.from(document.querySelectorAll('section')).map(s => s.className.split(' ')[0]),
      faqCount: document.querySelectorAll('.faq-item').length,
      sceneCount: document.querySelectorAll('.scene-card').length,
      stepCount: document.querySelectorAll('.step-item').length,
      quoteMiniCount: document.querySelectorAll('.quote-mini').length,
      revealTotal: reveals.length,
      revealVisible: visible.length,
      hasBlob: q('.blob'), hasPhone: q('.phone'), hasWebcard: q('.webcard'),
      bodyHeight: document.body.scrollHeight
    };
  });

  await page.screenshot({ path: path.join(OUT, 'landing-full.png'), fullPage: true });
  await page.screenshot({ path: path.join(OUT, 'landing-hero.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await page.evaluate(() => window.scrollTo(0, 1900));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, 'landing-scenes.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1000));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, 'landing-footer.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // ---------- 工具页 ----------
  await page.setViewport({ width: 1100, height: 1000, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(DIR, 'app.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  // 清空并注入测试数据
  await page.evaluate(() => {
    localStorage.removeItem('xyjh_tasks');
    localStorage.setItem('xyjh_tasks', JSON.stringify([
      { id: 1, title: '给品牌方案写大纲', done: false, star: true, priority: 'high', tags: ['工作'], dueLabel: '9月24日 15:00', dueTs: Date.now(), createdAt: Date.now(), timeLabel: '9/23 10:30' },
      { id: 2, title: '晨间冥想 15 分钟', done: true, star: false, priority: 'low', tags: ['健康'], dueLabel: '', dueTs: null, createdAt: Date.now(), timeLabel: '9/23 07:30' },
      { id: 3, title: '晚上 7 点 · 瑜伽课', done: false, star: false, priority: 'mid', tags: ['生活', '健康'], dueLabel: '9月23日 19:00', dueTs: Date.now(), createdAt: Date.now(), timeLabel: '9/23 09:12' },
      { id: 4, title: '读《拖延心理学》20 页', done: false, star: false, priority: '', tags: [], dueLabel: '', dueTs: null, createdAt: Date.now(), timeLabel: '9/23 08:00' }
    ]));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 模拟输入自然语言，检查实时预览
  await page.type('#taskInput', '明天下午三点 和牙医预约 #健康 !高');
  await new Promise(r => setTimeout(r, 350));
  const preview = await page.evaluate(() => {
    const el = document.getElementById('parsePreview');
    return { hidden: el.hidden, text: el.textContent.replace(/\s+/g, ' ').trim() };
  });
  await page.screenshot({ path: path.join(OUT, 'app-typed.png'), clip: { x: 0, y: 0, width: 1100, height: 1000 } });

  // 提交并检查结果
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 400));
  const afterAdd = await page.evaluate(() => {
    const first = document.querySelector('.task-item');
    return {
      count: document.querySelectorAll('.task-item').length,
      firstTitle: first ? first.querySelector('.task-body b').textContent : '',
      firstMeta: first ? (first.querySelector('.task-meta') || {}).textContent || '' : '',
      firstSmall: first ? first.querySelector('.task-body small').textContent : '',
      progress: document.getElementById('progressText').textContent,
      pct: document.getElementById('progressPct').textContent,
      tagChips: Array.from(document.querySelectorAll('.tag-chip')).map(c => c.textContent),
      legend: document.getElementById('progressLegend').textContent.replace(/\s+/g, ' ').trim()
    };
  });

  // 标签筛选
  await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll('.tag-chip')).find(c => c.textContent === '健康');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 300));
  const filtered = await page.evaluate(() => ({
    count: document.querySelectorAll('.task-item').length,
    listCount: document.getElementById('listCount').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'app-filtered.png'), clip: { x: 0, y: 0, width: 1100, height: 1000 } });

  // 切回全部 + 星标筛选
  await page.evaluate(() => {
    const all = document.querySelector('.tag-chip[data-tag=""]');
    if (all) all.click();
    const star = document.querySelector('.tab[data-tab="star"]');
    if (star) star.click();
  });
  await new Promise(r => setTimeout(r, 300));
  const starred = await page.evaluate(() => document.querySelectorAll('.task-item').length);

  await browser.close();

  console.log('=== 落地页 ===');
  console.log(JSON.stringify(landing, null, 2));
  console.log('\n=== 工具页：输入预览 ===');
  console.log(JSON.stringify(preview, null, 2));
  console.log('\n=== 工具页：添加后 ===');
  console.log(JSON.stringify(afterAdd, null, 2));
  console.log('\n=== 工具页：按「健康」筛选 ===');
  console.log(JSON.stringify(filtered, null, 2));
  console.log('\n=== 工具页：星标筛选条数 ===', starred);
  console.log('\n=== 页面报错 ===');
  console.log(errors.length ? errors.join('\n') : '无');
})();
