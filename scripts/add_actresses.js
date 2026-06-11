const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_JS = path.join(ROOT, 'src', 'data.js');

const text = fs.readFileSync(DATA_JS, 'utf8');
const m = text.match(/export const CELEBRITIES\s*=\s*(\[[\s\S]*\])/);
const data = JSON.parse(m[1]);
const existing = new Set(data.map(c => c.name + '|' + c.group));

const toAdd = [
  // ── 배우 (여) ──
  {name:'하지원', emoji:'🎬', group:'배우', mbti:'ENFJ', gender:'여', height:165, weight:50, age:48, nationality:'한국'},
  {name:'손예진', emoji:'🎬', group:'배우', mbti:'ISFP', gender:'여', height:163, weight:46, age:44, nationality:'한국'},
  {name:'김혜수', emoji:'🎬', group:'배우', mbti:'ENTJ', gender:'여', height:168, weight:50, age:56, nationality:'한국'},
  {name:'한지민', emoji:'🎬', group:'배우', mbti:'ISFJ', gender:'여', height:162, weight:45, age:44, nationality:'한국'},
  {name:'한가인', emoji:'🎬', group:'배우', mbti:'INFP', gender:'여', height:168, weight:47, age:44, nationality:'한국'},
  {name:'박소담', emoji:'🎬', group:'배우', mbti:'INFJ', gender:'여', height:162, weight:47, age:35, nationality:'한국'},
  {name:'심은경', emoji:'🎬', group:'배우', mbti:'ENFP', gender:'여', height:164, weight:48, age:32, nationality:'한국'},
  {name:'한효주', emoji:'🎬', group:'배우', mbti:'ISFJ', gender:'여', height:169, weight:50, age:39, nationality:'한국'},
  {name:'박신혜', emoji:'🎬', group:'배우', mbti:'ENFJ', gender:'여', height:167, weight:47, age:36, nationality:'한국'},
  {name:'김소은', emoji:'🎬', group:'배우', mbti:'ISFP', gender:'여', height:166, weight:47, age:37, nationality:'한국'},
  {name:'박민영', emoji:'🎬', group:'배우', mbti:'ENFP', gender:'여', height:165, weight:47, age:40, nationality:'한국'},
  {name:'윤은혜', emoji:'🎬', group:'배우', mbti:'ESFP', gender:'여', height:163, weight:46, age:42, nationality:'한국'},
  {name:'이민정', emoji:'🎬', group:'배우', mbti:'ISFJ', gender:'여', height:164, weight:46, age:43, nationality:'한국'},
  {name:'유인나', emoji:'🎬', group:'배우', mbti:'ESFP', gender:'여', height:167, weight:47, age:44, nationality:'한국'},
  {name:'전도연', emoji:'🎬', group:'배우', mbti:'INTJ', gender:'여', height:165, weight:48, age:53, nationality:'한국'},
  {name:'장나라', emoji:'🎬', group:'배우', mbti:'ENFP', gender:'여', height:165, weight:46, age:45, nationality:'한국'},
  {name:'배두나', emoji:'🎬', group:'배우', mbti:'INFP', gender:'여', height:173, weight:51, age:47, nationality:'한국'},
  {name:'윤여정', emoji:'🎬', group:'배우', mbti:'ENTJ', gender:'여', height:163, weight:48, age:79, nationality:'한국'},
  {name:'조여정', emoji:'🎬', group:'배우', mbti:'ISFP', gender:'여', height:165, weight:48, age:45, nationality:'한국'},
  {name:'조유리', emoji:'🎬', group:'배우', mbti:'ISFJ', gender:'여', height:162, weight:46, age:25, nationality:'한국'},
  {name:'한소희', emoji:'🎬', group:'배우', mbti:'INFP', gender:'여', height:168, weight:49, age:32, nationality:'한국'},
  {name:'서현진', emoji:'🎬', group:'배우', mbti:'ENFP', gender:'여', height:167, weight:49, age:41, nationality:'한국'},
  {name:'신예은', emoji:'🎬', group:'배우', mbti:'INFJ', gender:'여', height:163, weight:45, age:30, nationality:'한국'},
  {name:'오하영', emoji:'🎬', group:'배우', mbti:'ENFP', gender:'여', height:167, weight:48, age:35, nationality:'한국'},
  {name:'이세영', emoji:'🎬', group:'배우', mbti:'ISFP', gender:'여', height:166, weight:47, age:36, nationality:'한국'},
  {name:'전여빈', emoji:'🎬', group:'배우', mbti:'INFP', gender:'여', height:167, weight:48, age:34, nationality:'한국'},
  {name:'표예진', emoji:'🎬', group:'배우', mbti:'ENFJ', gender:'여', height:166, weight:47, age:32, nationality:'한국'},
  {name:'하연수', emoji:'🎬', group:'배우', mbti:'INFP', gender:'여', height:166, weight:49, age:37, nationality:'한국'},
  // ── 솔로 가수 ──
  {name:'엄정화', emoji:'🎵', group:'솔로', mbti:'ESFP', gender:'여', height:165, weight:50, age:57, nationality:'한국'},
  {name:'성유리', emoji:'🎵', group:'솔로', mbti:'ISFP', gender:'여', height:168, weight:48, age:45, nationality:'한국'},
  {name:'손담비', emoji:'🎵', group:'솔로', mbti:'ESFP', gender:'여', height:167, weight:48, age:43, nationality:'한국'},
  // ── Girl's Day 나머지 멤버 ──
  {name:'혜리',  emoji:'🌼', group:"Girl's Day", mbti:'ESFP', gender:'여', height:166, weight:47, age:32, nationality:'한국'},
  {name:'소진',  emoji:'🌼', group:"Girl's Day", mbti:'ENFJ', gender:'여', height:162, weight:45, age:40, nationality:'한국'},
  {name:'민아',  emoji:'🌼', group:"Girl's Day", mbti:'INFP', gender:'여', height:160, weight:44, age:34, nationality:'한국'},
  // ── 기타 그룹 ──
  {name:'유진',  emoji:'🎵', group:'S.E.S.',  mbti:'ESFP', gender:'여', height:161, weight:45, age:47, nationality:'한국'},
  {name:'한승연',emoji:'🎵', group:'KARA',    mbti:'ENFP', gender:'여', height:163, weight:46, age:40, nationality:'한국'},
];

let maxId = Math.max(...data.map(c => c.id));
let added = 0;
const byGroup = {};

for (const member of toAdd) {
  const key = member.name + '|' + member.group;
  if (existing.has(key)) {
    console.log('⏭ 이미 존재:', member.name, '(' + member.group + ')');
    continue;
  }
  maxId++;
  const score = Math.floor(7000 + Math.random() * 2500);
  data.push({ id: maxId, score, image: null, ...member });
  existing.add(key);
  if (!byGroup[member.group]) byGroup[member.group] = [];
  byGroup[member.group].push(member.name);
  added++;
}

console.log('\n── 그룹별 추가 결과 ──');
const groups = Object.keys(byGroup);
for (let i = 0; i < groups.length; i++) {
  const g = groups[i];
  const ns = byGroup[g];
  console.log('  ' + g + ' (' + ns.length + '명): ' + ns.join(', '));
}
console.log('\n✅ 총 ' + added + '명 추가 → 전체 ' + data.length + '명');

const out = 'export const CELEBRITIES = ' + JSON.stringify(data, null, 2) + '\n';
fs.writeFileSync(DATA_JS, out);
fs.writeFileSync(path.join(__dirname, 'celebs.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(ROOT, 'public', 'celebs-data.json'), JSON.stringify(data, null, 2));
console.log('💾 저장 완료');
