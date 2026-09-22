/* 小有计划 - 网页版逻辑
   数据保存在浏览器 localStorage（key: xyjh_tasks）。
   接入后端后，只需替换 loadTasks / saveTasks 即可实现与手机端同步。 */
(function () {
  'use strict';

  var STORAGE_KEY = 'xyjh_tasks';

  var state = {
    tasks: [],
    tab: 'all'
  };

  // ---------- DOM ----------
  var $input = document.getElementById('taskInput');
  var $addBtn = document.getElementById('addBtn');
  var $list = document.getElementById('taskList');
  var $empty = document.getElementById('empty');
  var $tabs = document.getElementById('tabs');
  var $progressText = document.getElementById('progressText');
  var $progressFill = document.getElementById('progressFill');

  // ---------- 数据层（可替换为接口同步） ----------
  function loadTasks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (e) { /* 存储不可用时静默降级 */ }
  }

  // ---------- 工具 ----------
  function formatDate(d) {
    var week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + week[d.getDay()];
  }
  function formatTime(ts) {
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- 渲染 ----------
  function render() {
    var tasks = state.tasks;
    var doneCount = tasks.filter(function (t) { return t.done; }).length;
    var filtered = tasks;
    if (state.tab === 'todo') filtered = tasks.filter(function (t) { return !t.done; });
    if (state.tab === 'done') filtered = tasks.filter(function (t) { return t.done; });

    $progressText.textContent = formatDate(new Date()) + ' · 已完成 ' + doneCount + ' / ' + tasks.length;
    $progressFill.style.width = (tasks.length ? Math.round(doneCount / tasks.length * 100) : 0) + '%';

    $list.innerHTML = filtered.map(function (t) {
      return '<li class="task-item' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
        '<span class="pcheck">' + (t.done ? '✓' : '') + '</span>' +
        '<div class="task-body"><b>' + escapeHtml(t.title) + '</b>' +
        '<small>' + (t.done ? '已完成' : '待完成') + ' · ' + t.timeLabel + '</small></div>' +
        '<button class="del-btn" data-del="' + t.id + '" title="删除">×</button>' +
        '</li>';
    }).join('');

    $empty.hidden = filtered.length !== 0;
    saveTasks();
  }

  // ---------- 交互 ----------
  function addTask() {
    var title = ($input.value || '').trim();
    if (!title) {
      $input.focus();
      return;
    }
    var now = Date.now();
    state.tasks.unshift({ id: now, title: title, done: false, createdAt: now, timeLabel: formatTime(now) });
    $input.value = '';
    render();
    $input.focus();
  }

  function toggleTask(id) {
    state.tasks = state.tasks.map(function (t) {
      if (t.id === id) {
        return Object.assign({}, t, { done: !t.done, timeLabel: t.done ? t.timeLabel : formatTime(Date.now()) });
      }
      return t;
    });
    render();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    render();
  }

  $addBtn.addEventListener('click', addTask);
  $input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addTask();
  });

  $list.addEventListener('click', function (e) {
    var delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.stopPropagation();
      deleteTask(Number(delBtn.getAttribute('data-del')));
      return;
    }
    var item = e.target.closest('.task-item');
    if (item) toggleTask(Number(item.getAttribute('data-id')));
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

  // ---------- 启动 ----------
  state.tasks = loadTasks();
  render();
})();
