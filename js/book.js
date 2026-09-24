/* ============================================================
   翻书模式（Book Mode）
   —— 把落地页的各个 section 分配进「书页」，在桌面端呈现逐页翻阅效果。
   —— 手机端 / 减少动效 / 无 JS 时，自动保持原有纵向滚动，功能完全不受影响。
   分组方案（共 6 页）：
     0  封面        导语
     1  手机同步    多端同步（深色区）
     2  使用场景    功能亮点 + 使用场景
     3  三步上手    怎么运作
     4  用户心声    用户心声 + 常见问题
     5  开始使用    结尾行动号召 + 页脚
   ============================================================ */
(function () {
  'use strict';

  var DESKTOP_MIN = 1025;          // 与 CSS 的 1080 断点配合：小于此宽度走滚动模式
  var shell = document.querySelector('.book-shell');

  /* ---- 未注入书壳（旧版本 HTML）时直接退出，不影响原页面 ---- */
  if (!shell) return;

  var pages = Array.prototype.slice.call(shell.querySelectorAll('.book-page'));
  if (pages.length < 2) return;

  var current = 0;
  var locked = false;              // 动画期间加锁，避免快速连点错乱
  var hint = document.querySelector('.book-hint');

  /* ------------------------------------------------------------
     1. 判定是否启用翻书
     ---- 条件：桌面宽度 + 支持 3D 变换 + 用户未关闭动效 + 无 hash 深链接
     ------------------------------------------------------------ */
  function supportsBook() {
    if (window.innerWidth < DESKTOP_MIN) return false;
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return false;
    return true;
  }

  function isBookOn() {
    return document.body.classList.contains('book-mode');
  }

  /* ------------------------------------------------------------
     2. 切换模式
     ------------------------------------------------------------ */
  function enableBook(keepIndex) {
    if (isBookOn()) return;
    document.body.classList.add('book-mode');
    shell.classList.remove('book-off');
    current = typeof keepIndex === 'number' ? keepIndex : 0;
    render(current, null);
    if (hint) {
      hint.classList.remove('is-hidden');
      setTimeout(function () { hint.classList.add('is-hidden'); }, 4200);
    }
  }

  function disableBook() {
    if (!isBookOn()) return;
    document.body.classList.remove('book-mode');
    pages.forEach(function (p) {
      p.classList.remove('is-current', 'is-flipped', 'from-next', 'from-prev');
      p.removeAttribute('style');
    });
    // 滚动模式：把所有 reveal 内容立即显示，避免 IntersectionObserver 漏触发导致空白
    revealAll();
  }

  /* ------------------------------------------------------------
     3. 渲染指定页
     ------------------------------------------------------------ */
  function render(idx, dir) {
    idx = Math.max(0, Math.min(pages.length - 1, idx));
    pages.forEach(function (p, i) {
      p.classList.remove('from-next', 'from-prev');
      if (i === idx) {
        p.classList.add('is-current');
        p.classList.remove('is-flipped');
        if (dir === 'next') p.classList.add('from-next');
        else if (dir === 'prev') p.classList.add('from-prev');
      } else if (i < idx) {
        p.classList.remove('is-current');
        p.classList.add('is-flipped');
      } else {
        p.classList.remove('is-current', 'is-flipped');
      }
    });

    // 当前页回到顶部 + 触发该页内的入场动画
    var page = pages[idx];
    if (page) {
      page.scrollTop = 0;
      revealIn(page);
    }

    syncControls(idx);
    current = idx;
  }

  /* 翻书模式里 IntersectionObserver 不会因滚动触发，
     这里在页面切换时主动给当前页的 .reveal 元素加上 is-visible */
  function revealIn(page) {
    var items = page.querySelectorAll('.reveal');
    Array.prototype.forEach.call(items, function (el, i) {
      el.classList.remove('is-visible');
      setTimeout(function () { el.classList.add('is-visible'); }, 60 + i * 70);
    });
    animateStats(page);
  }

  function revealAll() {
    var items = document.querySelectorAll('.reveal');
    Array.prototype.forEach.call(items, function (el) { el.classList.add('is-visible'); });
    var nums = document.querySelectorAll('.stat b');
    Array.prototype.forEach.call(nums, function (el) { el.textContent = el.getAttribute('data-raw') || el.textContent; });
  }

  /* 数字滚动：翻到含数据的那一页时逐条递增 */
  function animateStats(page) {
    var nums = page.querySelectorAll('.stat b');
    if (!nums.length) return;
    Array.prototype.forEach.call(nums, function (el) {
      var raw = el.getAttribute('data-raw') || el.textContent.trim();
      el.setAttribute('data-raw', raw);
      var target = parseFloat(raw.replace(/[^\d.]/g, ''));
      if (isNaN(target)) return;
      var suffix = raw.replace(/[\d.,]/g, '');
      var decimals = (raw.match(/\.(\d+)/) || [, ''])[1].length;
      var start = performance.now(), dur = 1000;
      (function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      })(start);
    });
  }

  /* ------------------------------------------------------------
     4. 控件状态与页点
     ------------------------------------------------------------ */
  var prevBtn = document.querySelector('.book-prev');
  var nextBtn = document.querySelector('.book-next');
  var dots = Array.prototype.slice.call(document.querySelectorAll('.book-dot'));
  var count = document.querySelector('.book-count');

  function syncControls(idx) {
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) {
      var last = pages.length - 1;
      nextBtn.disabled = idx === last;
      nextBtn.textContent = idx === last ? '已是末页' : '下一页 →';
      nextBtn.classList.toggle('is-primary', idx < last);
    }
    dots.forEach(function (d, i) { d.classList.toggle('is-current', i === idx); });
    if (count) count.textContent = (idx + 1) + ' / ' + pages.length;
  }

  /* ------------------------------------------------------------
     5. 翻页动作
     ------------------------------------------------------------ */
  function goto(idx, dir) {
    idx = Math.max(0, Math.min(pages.length - 1, idx));
    if (idx === current || locked) return;
    locked = true;
    var d = dir || (idx > current ? 'next' : 'prev');
    render(idx, d);
    setTimeout(function () { locked = false; }, 380);
  }
  function next() { goto(current + 1, 'next'); }
  function prev() { goto(current - 1, 'prev'); }

  /* ------------------------------------------------------------
     6. 事件绑定：按钮 / 键盘 / 滚轮 / 触摸
     ------------------------------------------------------------ */
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () { goto(i); });
  });

  document.addEventListener('keydown', function (e) {
    if (!isBookOn()) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault(); next();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault(); prev();
    } else if (e.key === 'Home') { e.preventDefault(); goto(0, 'prev'); }
    else if (e.key === 'End') { e.preventDefault(); goto(pages.length - 1, 'next'); }
  });

  // 滚轮翻页：页内可滚动时优先页内滚动，到底/到顶才翻页
  var wheelLock = false;
  window.addEventListener('wheel', function (e) {
    if (!isBookOn()) return;
    var page = pages[current];
    if (!page) return;
    var atTop = page.scrollTop <= 1;
    var atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 1;
    var goingDown = e.deltaY > 0;
    if (!(goingDown && atBottom) && !(!goingDown && atTop)) return;  // 页内还能滚，交给浏览器
    if (wheelLock) return;
    wheelLock = true;
    setTimeout(function () { wheelLock = false; }, 700);
    if (goingDown) next(); else prev();
  }, { passive: true });

  // 触摸横滑（触屏笔记本 / 平板横屏）
  var touchX = null, touchY = null;
  window.addEventListener('touchstart', function (e) {
    if (!isBookOn() || e.touches.length !== 1) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!isBookOn() || touchX === null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchX;
    var dy = t.clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      // 翻书页内通常是横向留白区，可直接翻页
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });

  /* ------------------------------------------------------------
     7. 锚点链接：翻书模式下转为"跳到对应页"
     ------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    if (!isBookOn()) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    var page = target.closest('.book-page');
    if (!page) return;
    e.preventDefault();
    var idx = pages.indexOf(page);
    if (idx >= 0) goto(idx);
  }, true);

  /* ------------------------------------------------------------
     8. 模式切换：响应窗口尺寸变化
     ------------------------------------------------------------ */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (supportsBook()) {
        if (!isBookOn()) enableBook();
      } else if (isBookOn()) {
        disableBook();
      }
    }, 180);
  });

  /* ------------------------------------------------------------
     9. 初始化
     ---- 首屏带 hash 深链接时，先按滚动模式定位，避免"跳错页"
     ------------------------------------------------------------ */
  var hash = location.hash ? location.hash.slice(1) : '';
  if (hash) {
    var ht = document.getElementById(hash);
    if (ht) {
      var hp = ht.closest('.book-page');
      var hi = hp ? pages.indexOf(hp) : -1;
      // 直接把书打开到对应页，比先滚再跳更自然
      if (hi >= 0 && supportsBook()) enableBook(hi);
      return;
    }
    return;                        // 有 hash 但找不到目标：保持滚动模式
  }

  if (supportsBook()) enableBook(0);
})();
