/* 解析器单测：隔离运行 parseInput，验证自然语言识别结果。
   日期固定为 2026-09-23（周三），周X 类用例可做精确断言。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function grab(re) {
  const m = src.match(re);
  return m ? m[0] : '';
}

const prelude = [
  "var WEEK = ['周日','周一','周二','周三','周四','周五','周六'];",
  "var PRIORITY = { high: { label: '高' }, mid: { label: '中' }, low: { label: '低' } };",
  "function pad(n) { return n < 10 ? '0' + n : '' + n; }"
].join('\n');

// 连同中文数字工具一起提取
const cnNumConst = grab(/var CN_NUM = \{[\s\S]*?\};/);
const cnToNumFn = grab(/function cnToNum\(s\) \{[\s\S]*?\n  \}/);

const code = prelude + '\n' + cnNumConst + '\n' + cnToNumFn + '\n' +
  grab(/function parseInput[\s\S]*?\n  \}/) +
  '\nthis.parseInput = parseInput;';

const ctx = {};
// 固定当前时间：2026-09-23 12:00（周三）
const RealDate = Date;
ctx.Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(2026, 8, 23, 12, 0, 0);
    else super(...args);
  }
  static now() { return new RealDate(2026, 8, 23, 12, 0, 0).getTime(); }
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

/* 用例：[输入, 校验函数, 描述] */
const cases = [
  ['明天下午三点 和牙医预约', r => r.dueLabel === '9月24日 15:00', '中文数字+相对日'],
  ['明天下午3点 和牙医预约 #健康 !高', r => r.dueLabel === '9月24日 15:00' && r.tags[0] === '健康' && r.priority === 'high', '标签+优先级'],
  ['周五上午10点 项目周会 #工作', r => r.dueLabel === '9月25日 周五' === false && r.dueLabel.indexOf('9月25日') !== -1 && r.dueLabel.indexOf('10:00') !== -1, '周五→9月25日'],
  ['今晚8点 和朋友吃饭 #生活', r => r.dueLabel === '9月23日 20:00', '今晚→20点'],
  ['10月1日 国庆出行准备 !中', r => r.dueLabel.indexOf('10月1日') !== -1 && r.priority === 'mid', '绝对日期'],
  ['买牛奶', r => r.title === '买牛奶' && !r.dueLabel, '纯文本'],
  ['后天 交房租 #账单 !高', r => r.dueLabel.indexOf('9月25日') !== -1 && r.priority === 'high', '后天'],
  ['下周三 客户回访 #客户 !高', r => r.dueLabel.indexOf('9月30日') !== -1, '下周三→9月30日'],
  ['3点半 开会', r => r.dueLabel === '9月23日 15:30', '下午默认+半'],
  ['下午 整理房间', r => !r.dueLabel && r.title.indexOf('整理房间') !== -1, '孤立时段不误判日期'],
  ['周日 陪家人吃饭 #家庭', r => r.dueLabel.indexOf('9月27日') !== -1 && r.dueLabel.indexOf('周日') !== -1, '周日→9月27日'],
  ['周一 晨会', r => r.dueLabel.indexOf('9月28日') !== -1, '周一→下周一'],
  ['下周二 复诊', r => r.dueLabel.indexOf('9月29日') !== -1, '下周二→9月29日']
];

let pass = 0;
cases.forEach(function ([c, check, desc]) {
  const r = ctx.parseInput(c);
  const ok = check(r);
  console.log((ok ? '✅' : '❌') + ' ' + desc + '  「' + c + '」');
  if (!ok) {
    console.log('   实际: 标题="' + r.title + '" 截止=' + (r.dueLabel || '无') +
      ' 优先级=' + (r.priority || '无') + ' 标签=[' + r.tags.join(',') + ']');
  } else {
    pass++;
  }
});
console.log('\n' + pass + '/' + cases.length + ' 条用例通过');
process.exit(pass === cases.length ? 0 : 1);
