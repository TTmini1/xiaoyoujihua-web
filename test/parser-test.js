/* 解析器单测：隔离运行 parseInput，验证自然语言识别结果 */
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
vm.createContext(ctx);
vm.runInContext(code, ctx);

const cases = [
  '明天下午三点 和牙医预约',
  '明天下午3点 和牙医预约 #健康 !高',
  '周五上午10点 项目周会 #工作',
  '今晚8点 和朋友吃饭 #生活',
  '10月1日 国庆出行准备 !中',
  '买牛奶',
  '后天 交房租 #账单 !高',
  '下周三 客户回访 #客户 !高',
  '3点半 开会',
  '下午 整理房间',
  '周日 陪家人吃饭 #家庭'
];

let pass = 0;
cases.forEach(function (c) {
  const r = ctx.parseInput(c);
  console.log('输入: ' + c);
  console.log('  标题="' + r.title + '"  截止=' + (r.dueLabel || '无') +
    '  优先级=' + (r.priority || '无') + '  标签=[' + r.tags.join(',') + ']');
  if (r.title) pass++;
});
console.log('\n全部 ' + cases.length + ' 条用例完成，标题均成功提取: ' + pass + '/' + cases.length);
