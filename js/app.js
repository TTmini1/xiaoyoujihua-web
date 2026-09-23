/* ============================================================
   小有计划 - 网页版逻辑
   ------------------------------------------------------------
   数据层被抽象为 store 接口（load / save / remove / clear），
   当前实现为 localStorage。要做多端同步，只需替换 store 的
   实现（见文件底部的 RemoteStore / createStore 注释），
   页面逻辑无需改动。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     一、数据层：存储适配器（可替换）
     --------------------------------------------------------- */
  var STORAGE_KEY = 'xyjh_tasks';
  var API_BASE = '';           // 例：'https://api.example.com'，留空则走本地存储
  var TOKEN_KEY = 'xyjh_token'; // 登录态令牌（预留）

  var LocalStore = {
    name: 'local',
    load: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch (e) {
        return [];
      }
    },
    save: function (tasks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    },
    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      return Promise.resolve(true);
    }
  };

  /* 远端存储（预留）：接口约定
     GET    {API_BASE}/tasks        -> [{id,title,done,...}]
     PUT    {API_BASE}/tasks        -> 整体覆盖（body: {tasks:[...]}）
     接入时把 createStore 的返回值换成 RemoteStore 即可。 */
  var RemoteStore = {
    name: 'remote',
    headers: function () {
      var t = '';
      try { t = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
      return { 'Content-Type': 'application/json', 'Authorization': t ? 'Bearer ' + t : '' };
    },
    load: function () {
      return fetch(API_BASE + '/tasks', { headers: this.headers() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return LocalStore.load(); });
    },
    save: function (tasks) {
      return fetch(API_BASE + '/tasks', {
        method: 'PUT', headers: this.headers(), body: JSON.stringify({ tasks: tasks })
      }).then(function (r) { return r.ok; }).catch(function () {
        return LocalStore.save(tasks); // 断网降级到本地，恢复后由上层补同步
      });
    },
    clear: function () {
      return fetch(API_BASE + '/tasks', { method: 'DELETE', headers: this.headers() })
        .catch(function () { return LocalStore.clear(); });
    }
  };

  // 有配置 API_BASE 时走远端，否则走本地
  var store = API_BASE ? RemoteStore : LocalStore;

  /* ---------------------------------------------------------
     二、状态
     --------------------------------------------------------- */
  var state = {
    tasks: [],
    tab: 'all',
    tag: '',
    editingId: null,
    dragId: null,
    syncing: false
  };

  /* ---------------------------------------------------------
     三、DOM
     --------------------------------------------------------- */
  var $input = document.getElementById('taskInput');
  var $addBtn = document.getElementById('addBtn');
  var $list = document.getElementById('taskList');
  var $empty = document.getElementById('empty');
  var $tabs = document.getElementById('tabs');
  var $tagFilter = document.getElementById('tagFilter');
  var $progressText = document.getElementById('progressText');
  var $progressPct = document.getElementById('progressPct');
  var $progressFill = document.getElementById('progressFill');
  var $progressLegend = document.getElementById('progressLegend');
  var $preview = document.getElementById('parsePreview');
  var $previewText = document.getElementById('parsePreviewText');
  var $listCount = document.getElementById('listCount');
  var $exportBtn = document.getElementById('exportBtn');
  var $importBtn = document.getElementById('importBtn');
  var $importFile = document.getElementById('importFile');

  /* ---------------------------------------------------------
     四、工具函数
     --------------------------------------------------------- */
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var PRIORITY = { high: { label: '高', order: 0 }, mid: { label: '中', order: 1 }, low: { label: '低', order: 2 } };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDate(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
  }
  function formatTime(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- 自然语言解析：识别日期、时间、标签、优先级 ----
     支持：今天/明天/后天/今晚、周X/下周X、X月X日、
           上午/中午/下午/晚上、X点/X点半/X点X分、X:XX、
           中文数字（三点/十点半）
     标记：#标签名   !高 / !中 / !低                                */
  var CN_NUM = { '零': 0, '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

  // 把「三」「十」「十一」「二十」等中文数字转成阿拉伯数字
  function cnToNum(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s === '十') return 10;
    if (/^十[一二三四五六七八九]$/.test(s)) return 10 + CN_NUM[s[1]];
    if (/^[一二两三四五六七八九]十$/.test(s)) return CN_NUM[s[0]] * 10;
    if (/^[一二两三四五六七八九]十[一二三四五六七八九]$/.test(s)) return CN_NUM[s[0]] * 10 + CN_NUM[s[2]];
    if (s.length === 1 && CN_NUM[s] !== undefined) return CN_NUM[s];
    return null;
  }

  function parseInput(raw) {
    var text = String(raw || '').trim();
    var result = { title: '', dueLabel: '', dueTs: null, tags: [], priority: '' };

    // 标签：#健康
    text = text.replace(/#([^\s#!]+)/g, function (_, t) {
      if (result.tags.indexOf(t) === -1) result.tags.push(t);
      return ' ';
    });

    // 优先级：!高 / !中 / !低 / !high（中文无需 \b 词边界）
    text = text.replace(/!\s*(高|中|低|high|mid|low)/gi, function (_, p) {
      var k = p.toLowerCase();
      result.priority = (k === '高' || k === 'high') ? 'high' : ((k === '低' || k === 'low') ? 'low' : 'mid');
      return ' ';
    });
    // 兜底：单独的感叹号开头也当高优先级
    text = text.replace(/!+(?=\s|$)/g, ' ');

    // 解析日期
    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var found = false;
    var m;

    if ((m = text.match(/(今天|今晚|今早|明天|明晚|后天|大后天)/))) {
      var offMap = { '今天': 0, '今晚': 0, '今早': 0, '明天': 1, '明晚': 1, '后天': 2, '大后天': 3 };
      base.setDate(base.getDate() + offMap[m[1]]);
      // 「今晚/明晚」同时提供时段信息，转成时段词保留给时间规则使用
      var hint = /今晚/.test(m[1]) ? '晚上' : (/明晚/.test(m[1]) ? '晚上' : (/今早/.test(m[1]) ? '早上' : ''));
      found = true;
      text = text.replace(m[0], hint ? ' ' + hint + ' ' : ' ');
    } else if ((m = text.match(/(下下?周|下下?星期)([一二三四五六日天])/))) {
      var weekMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
      var target = weekMap[m[2]];
      var cur = base.getDay();
      var diff = (target - cur + 7) % 7;
      if (diff === 0) diff = 7;
      base.setDate(base.getDate() + diff + (m[1].indexOf('下下') === 0 ? 7 : 0));
      found = true;
      text = text.replace(m[0], ' ');
    } else if ((m = text.match(/(周|星期)([一二三四五六日天])/))) {
      var weekMap2 = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
      var t2 = weekMap2[m[2]];
      var diff2 = (t2 - base.getDay() + 7) % 7;
      if (diff2 === 0) diff2 = 7;
      base.setDate(base.getDate() + diff2);
      found = true;
      text = text.replace(m[0], ' ');
    } else if ((m = text.match(/(\d{1,2})月(\d{1,2})[日号]/))) {
      base.setMonth(parseInt(m[1], 10) - 1);
      base.setDate(parseInt(m[2], 10));
      found = true;
      text = text.replace(m[0], ' ');
    }

    // 解析时间（阿拉伯数字与中文数字都支持）
    var hour = null, minute = 0;
    var periodWord = '(上午|早上|早晨|中午|下午|傍晚|晚上|今晚|明晚|夜里)';
    var numWord = '(\\d{1,2}|[一二两三四五六七八九十]{1,3})';
    var tm;

    if ((tm = text.match(new RegExp(periodWord + '?\\s*' + numWord + '\\s*[:：点时]\\s*(\\d{1,2}|[一二两三四五六七八九十]{1,3})?\\s*(半|分)?')))) {
      hour = cnToNum(tm[2]);
      var mm = tm[3] ? cnToNum(tm[3]) : null;
      if (mm !== null && mm !== undefined) minute = mm;
      else if (tm[4] === '半') minute = 30;
      var period = tm[1] || '';
      if (period && /下午|傍晚|晚上|今晚|明晚|夜里|中午/.test(period) && hour < 12) hour += 12;
      else if (!period && hour <= 7) hour += 12; // 「3点」口语多指下午
      if (hour > 23) hour -= 12;
      if (hour !== null) { found = true; text = text.replace(tm[0], ' '); }
    } else if ((tm = text.match(new RegExp(periodWord + '\\s*' + numWord)))) {
      hour = cnToNum(tm[2]);
      var p2 = tm[1];
      if (/下午|傍晚|晚上|今晚|明晚|夜里|中午/.test(p2) && hour < 12) hour += 12;
      if (hour !== null) { found = true; text = text.replace(tm[0], ' '); }
    }

    // 单独的日期前缀「今晚/明晚」若未被时间规则消费，也要清掉
    if (!found) {
      var lone = text.match(/(今晚|明晚|今早)/);
      if (lone) { found = true; text = text.replace(lone[0], ' '); }
    }

    if (found) {
      if (hour !== null) {
        base.setHours(hour, minute, 0, 0);
        result.dueLabel = (base.getMonth() + 1) + '月' + base.getDate() + '日 ' + pad(hour) + ':' + pad(minute);
      } else {
        base.setHours(9, 0, 0, 0);
        result.dueLabel = (base.getMonth() + 1) + '月' + base.getDate() + '日 ' + WEEK[base.getDay()];
      }
      result.dueTs = base.getTime();
    }

    result.title = text.replace(/\s+/g, ' ').trim();
    return result;
  }

  /* ---------------------------------------------------------
     五、渲染
     --------------------------------------------------------- */
  function filtered() {
    var tasks = state.tasks.slice();
    if (state.tab === 'todo') tasks = tasks.filter(function (t) { return !t.done; });
    if (state.tab === 'done') tasks = tasks.filter(function (t) { return t.done; });
    if (state.tab === 'star') tasks = tasks.filter(function (t) { return t.star; });
    if (state.tag) tasks = tasks.filter(function (t) { return (t.tags || []).indexOf(state.tag) !== -1; });
    return tasks;
  }

  function renderProgress() {
    var tasks = state.tasks;
    var done = tasks.filter(function (t) { return t.done; }).length;
    var pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    $progressText.textContent = formatDate(new Date()) + ' · 已完成 ' + done + ' / ' + tasks.length;
    $progressPct.textContent = pct + '%';
    $progressFill.style.width = pct + '%';

    // 按标签统计
    var byTag = {};
    tasks.forEach(function (t) {
      (t.tags || []).forEach(function (g) {
        byTag[g] = byTag[g] || { total: 0, done: 0 };
        byTag[g].total++;
        if (t.done) byTag[g].done++;
      });
    });
    var keys = Object.keys(byTag);
    $progressLegend.innerHTML = keys.length
      ? keys.map(function (k) {
          return '<span class="legend-item">' + escapeHtml(k) + ' ' + byTag[k].done + '/' + byTag[k].total + '</span>';
        }).join('')
      : '<span class="legend-item legend-empty">还没有标签，写「#工作」试试</span>';
  }

  function renderTagFilter() {
    var set = {};
    state.tasks.forEach(function (t) {
      (t.tags || []).forEach(function (g) { set[g] = true; });
    });
    var keys = Object.keys(set);
    if (!keys.length) { $tagFilter.innerHTML = ''; return; }
    var html = '<button class="tag-chip' + (state.tag ? '' : ' active') + '" data-tag="">全部标签</button>';
    html += keys.map(function (k) {
      return '<button class="tag-chip' + (state.tag === k ? ' active' : '') + '" data-tag="' + escapeHtml(k) + '">' + escapeHtml(k) + '</button>';
    }).join('');
    $tagFilter.innerHTML = html;
  }

  function taskHtml(t) {
    var editing = state.editingId === t.id;
    var chips = (t.tags || []).map(function (g) {
      return '<em class="chip chip-tag">' + escapeHtml(g) + '</em>';
    }).join('');
    var pri = t.priority ? '<em class="chip chip-pri-' + t.priority + '">' + PRIORITY[t.priority].label + '</em>' : '';

    return '<li class="task-item' + (t.done ? ' done' : '') + '" data-id="' + t.id + '" draggable="false">' +
      '<span class="drag-dot" data-drag="' + t.id + '" title="拖拽排序">⠿</span>' +
      '<span class="pcheck">' + (t.done ? '✓' : '') + '</span>' +
      '<div class="task-body">' +
        (editing
          ? '<input class="edit-input" data-edit="' + t.id + '" value="' + escapeHtml(t.title) + '" maxlength="80" />'
          : '<b data-title="' + t.id + '">' + escapeHtml(t.title) + '</b>') +
        '<small>' +
          (t.done ? '已完成' : '待完成') +
          (t.dueLabel ? ' · 截止 ' + escapeHtml(t.dueLabel) : '') +
          ' · ' + t.timeLabel +
          (t.synced ? ' · 已同步' : '') +
        '</small>' +
        (chips || pri ? '<div class="task-meta">' + pri + chips + '</div>' : '') +
      '</div>' +
      '<button class="star-btn' + (t.star ? ' on' : '') + '" data-star="' + t.id + '" title="重点关注">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (t.star ? 'currentColor' : 'none') + '"><path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<button class="del-btn" data-del="' + t.id + '" title="删除">×</button>' +
      '</li>';
  }

  function render() {
    var list = filtered();
    $list.innerHTML = list.map(taskHtml).join('');
    $empty.hidden = list.length !== 0;
    $listCount.textContent = list.length ? '共 ' + list.length + ' 条' : '';
    renderProgress();
    renderTagFilter();
    persist();
  }

  /* ---------------------------------------------------------
     六、持久化（异步，失败静默降级）
     --------------------------------------------------------- */
  var syncTimer = null;
  function persist() {
    if (state.syncing) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      state.syncing = true;
      Promise.resolve(store.save(state.tasks)).then(function () {
        state.syncing = false;
      }, function () { state.syncing = false; });
    }, 120);
  }

  /* ---------------------------------------------------------
     七、操作
     --------------------------------------------------------- */
  function addTask() {
    var raw = ($input.value || '').trim();
    if (!raw) { $input.focus(); return; }
    var parsed = parseInput(raw);
    if (!parsed.title) parsed.title = raw;

    state.tasks.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: parsed.title,
      done: false,
      star: false,
      priority: parsed.priority,
      tags: parsed.tags,
      dueLabel: parsed.dueLabel,
      dueTs: parsed.dueTs,
      createdAt: Date.now(),
      timeLabel: formatTime(Date.now())
    });
    $input.value = '';
    hidePreview();
    render();
    $input.focus();
  }

  function toggleTask(id) {
    state.tasks = state.tasks.map(function (t) {
      if (t.id !== id) return t;
      var done = !t.done;
      return Object.assign({}, t, { done: done, timeLabel: done ? formatTime(Date.now()) : t.timeLabel });
    });
    render();
  }

  function toggleStar(id) {
    state.tasks = state.tasks.map(function (t) {
      return t.id === id ? Object.assign({}, t, { star: !t.star }) : t;
    });
    render();
  }

  function deleteTask(id) {
    var item = $list.querySelector('.task-item[data-id="' + id + '"]');
    if (item) item.classList.add('removing');
    setTimeout(function () {
      state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
      render();
    }, item ? 180 : 0);
  }

  function saveEdit(id, value) {
    var v = String(value || '').trim();
    state.editingId = null;
    if (!v) { render(); return; }
    state.tasks = state.tasks.map(function (t) {
      return t.id === id ? Object.assign({}, t, { title: v }) : t;
    });
    render();
  }

  /* ---------------------------------------------------------
     八、事件绑定
     --------------------------------------------------------- */
  $addBtn.addEventListener('click', addTask);
  $input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addTask();
    if (e.key === 'Escape') { $input.value = ''; hidePreview(); }
  });

  // 输入时实时预览识别结果
  $input.addEventListener('input', function () {
    var raw = $input.value.trim();
    if (!raw) { hidePreview(); return; }
    var p = parseInput(raw);
    var bits = [];
    if (p.dueLabel) bits.push('截止 ' + p.dueLabel);
    if (p.priority) bits.push('优先级 ' + PRIORITY[p.priority].label);
    (p.tags || []).forEach(function (t) { bits.push('#' + t); });
    if (!bits.length) { hidePreview(); return; }
    $previewText.innerHTML = '已识别：<b>' + escapeHtml(p.title || raw) + '</b>' + bits.map(function (b) {
      return '<span class="parse-chip">' + escapeHtml(b) + '</span>';
    }).join('');
    $preview.hidden = false;
  });

  function hidePreview() { $preview.hidden = true; }

  $list.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-del]'))) {
      e.stopPropagation(); deleteTask(Number(el.getAttribute('data-del'))); return;
    }
    if ((el = e.target.closest('[data-star]'))) {
      e.stopPropagation(); toggleStar(Number(el.getAttribute('data-star'))); return;
    }
    if ((el = e.target.closest('[data-title]'))) {
      e.stopPropagation();
      state.editingId = Number(el.getAttribute('data-title'));
      render();
      var inp = $list.querySelector('.edit-input');
      if (inp) { inp.focus(); inp.select(); }
      return;
    }
    var item = e.target.closest('.task-item');
    if (item && !e.target.closest('.edit-input')) toggleTask(Number(item.getAttribute('data-id')));
  });

  $list.addEventListener('keydown', function (e) {
    var inp = e.target.closest('.edit-input');
    if (!inp) return;
    if (e.key === 'Enter') saveEdit(Number(inp.getAttribute('data-edit')), inp.value);
    if (e.key === 'Escape') { state.editingId = null; render(); }
  });

  $list.addEventListener('focusout', function (e) {
    var inp = e.target.closest('.edit-input');
    if (inp) saveEdit(Number(inp.getAttribute('data-edit')), inp.value);
  });

  $tabs.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    state.tab = tab.getAttribute('data-tab');
    Array.prototype.forEach.call($tabs.children, function (el) {
      el.classList.toggle('active', el === tab);
    });
    render();
  });

  $tagFilter.addEventListener('click', function (e) {
    var chip = e.target.closest('.tag-chip');
    if (!chip) return;
    state.tag = chip.getAttribute('data-tag');
    render();
  });

  /* ---- 拖拽排序 ---- */
  $list.addEventListener('dragstart', function (e) {
    var dot = e.target.closest('[data-drag]');
    if (dot) {
      state.dragId = Number(dot.getAttribute('data-drag'));
      var item = dot.closest('.task-item');
      if (item) item.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }
  });
  $list.addEventListener('dragover', function (e) {
    if (state.dragId === null) return;
    e.preventDefault();
    var over = e.target.closest('.task-item');
    $list.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); });
    if (over && Number(over.getAttribute('data-id')) !== state.dragId) over.classList.add('drag-over');
  });
  $list.addEventListener('drop', function (e) {
    if (state.dragId === null) return;
    e.preventDefault();
    var over = e.target.closest('.task-item');
    if (over) {
      var targetId = Number(over.getAttribute('data-id'));
      var from = state.tasks.findIndex(function (t) { return t.id === state.dragId; });
      var to = state.tasks.findIndex(function (t) { return t.id === targetId; });
      if (from > -1 && to > -1 && from !== to) {
        var moved = state.tasks.splice(from, 1)[0];
        state.tasks.splice(to, 0, moved);
      }
    }
    state.dragId = null;
    render();
  });
  $list.addEventListener('dragend', function () {
    state.dragId = null;
    $list.querySelectorAll('.dragging, .drag-over').forEach(function (n) {
      n.classList.remove('dragging'); n.classList.remove('drag-over');
    });
  });

  // 让拖拽点可拖（draggable 挂在 li 上，由圆点触发）
  $list.addEventListener('mousedown', function (e) {
    var dot = e.target.closest('[data-drag]');
    $list.querySelectorAll('.task-item').forEach(function (li) {
      li.setAttribute('draggable', dot ? 'true' : 'false');
    });
  });

  /* ---- 导出 / 导入 ---- */
  $exportBtn.addEventListener('click', function () {
    var data = JSON.stringify({ app: '小有计划', version: 1, exportedAt: Date.now(), tasks: state.tasks }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '小有计划-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $importBtn.addEventListener('click', function () { $importFile.click(); });
  $importFile.addEventListener('change', function () {
    var f = $importFile.files && $importFile.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var json = JSON.parse(reader.result);
        var arr = Array.isArray(json) ? json : (json.tasks || []);
        if (!Array.isArray(arr)) throw new Error('格式不正确');
        arr.forEach(function (t, i) {
          if (!t || !t.title) return;
          state.tasks.push({
            id: Date.now() + i + Math.floor(Math.random() * 1000),
            title: String(t.title),
            done: !!t.done,
            star: !!t.star,
            priority: t.priority || '',
            tags: Array.isArray(t.tags) ? t.tags : [],
            dueLabel: t.dueLabel || '',
            dueTs: t.dueTs || null,
            createdAt: t.createdAt || Date.now(),
            timeLabel: t.timeLabel || formatTime(Date.now())
          });
        });
        render();
      } catch (err) {
        alert('导入失败：文件格式不正确');
      }
      $importFile.value = '';
    };
    reader.readAsText(f);
  });

  /* ---------------------------------------------------------
     九、启动
     --------------------------------------------------------- */
  Promise.resolve(store.load()).then(function (tasks) {
    state.tasks = Array.isArray(tasks) ? tasks : [];
    // 兼容旧数据：补齐缺失字段
    state.tasks = state.tasks.map(function (t) {
      return Object.assign({ star: false, priority: '', tags: [], dueLabel: '', dueTs: null }, t, {
        tags: Array.isArray(t.tags) ? t.tags : []
      });
    });
    render();
    $input.focus();
  });
})();
