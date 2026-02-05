/**
 * 最終版
 * - クイズは外部 JSON (quiz.json) から読み込み
 * - Day1/Day2 の画面
 * - Day1 は情報が複数。未解除はクイズ正解で閲覧可能
 * - 一度解除した情報は次回クイズ無し
 * - 間違いは最大3回、毎回クイズ内容は変わる（同一アイテム内で再出題しない）
 * - 3回不正解になったら「永久ロック」して以後は見られない
 */

const STORE_KEY = "quizUnlockDemo:v2";

const DATA = {
  day1: [
    { id: "d1-a", title: "1日目：お昼ごはん", desc: "正解すると“情報A”が表示されます。", body: "<p><b>情報A</b>：お昼ごはんはイタリアンです。<br>la bottega yossci<a href="https://tabelog.com/aichi/A2305/A230503/23093152/?msockid=3bce2742de58646f00ce3215df7a6529" target="_blank" rel="noopener noreferrer">お店のページ</a></p>" },
    { id: "d1-b", title: "1日目：情報B", desc: "正解すると“情報B”が表示されます。", body: "<p><b>情報B</b>：複数項目を持たせることも可能です。</p><ul><li>項目1</li><li>項目2</li></ul>" },
    { id: "d1-c", title: "1日目：情報C", desc: "正解すると“情報C”が表示されます。", body: "<p><b>情報C</b>：社内向けの文章や図の説明など。</p>" },
  ],
  day2: [
    { id: "d2-a", title: "2日目：情報A", desc: "2日目の情報も同様に解除します。", body: "<p><b>2日目：情報A</b>：2日目コンテンツ例。</p>" },
    { id: "d2-b", title: "2日目：情報B", desc: "別の情報も用意できます。", body: "<p><b>2日目：情報B</b>：ここも自由に差し替えOK。</p>" },
  ],
};

// quiz.json からロードされる
let QUIZ_POOL = [];

async function loadQuizPool() {
  const res = await fetch("./quiz.json");
  if (!res.ok) throw new Error("quiz.json を読み込めませんでした");
  const data = await res.json();
  QUIZ_POOL = Array.isArray(data.questions) ? data.questions : [];
  if (QUIZ_POOL.length < 3) {
    console.warn("問題数が少ないため、3回の誤答で問題が枯渇する可能性があります。3問以上を推奨します。");
  }
}

function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw) return { unlocked:{}, locked:{}, attemptsLeft:{}, usedQuestions:{} };

  try{
    const parsed = JSON.parse(raw);
    return {
      unlocked: parsed.unlocked ?? {},
      locked: parsed.locked ?? {},
      attemptsLeft: parsed.attemptsLeft ?? {},
      usedQuestions: parsed.usedQuestions ?? {},
    };
  } catch {
    return { unlocked:{}, locked:{}, attemptsLeft:{}, usedQuestions:{} };
  }
}

function saveState(state){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function itemKey(route, itemId){ return `${route}:${itemId}`; }

function ensureAttemptState(state, ikey){
  if(state.attemptsLeft[ikey] == null) state.attemptsLeft[ikey] = 3;
  if(!Array.isArray(state.usedQuestions[ikey])) state.usedQuestions[ikey] = [];
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextQuestion(state, ikey){
  ensureAttemptState(state, ikey);
  const used = new Set(state.usedQuestions[ikey]);
  const candidates = QUIZ_POOL.filter(q => !used.has(q.qid));

  // 出題済みが尽きたら「残り試行」があるうちは再利用可（ただし毎回変わる要件は、十分な問題数で担保するのが理想）
  const pool = candidates.length ? candidates : QUIZ_POOL;
  const picked = pool[Math.floor(Math.random()*pool.length)];
  state.usedQuestions[ikey].push(picked.qid);
  saveState(state);
  return picked;
}

/* UI: ルーティング */
const tabs = document.querySelectorAll(".tab[data-route]");
tabs.forEach(btn => btn.addEventListener("click", () => setRoute(btn.dataset.route)));

function setRoute(route){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("is-active"));
  document.querySelectorAll(".tab[data-route]").forEach(t => t.classList.remove("is-active"));

  document.getElementById(`screen-${route}`).classList.add("is-active");
  document.querySelector(`.tab[data-route="${route}"]`).classList.add("is-active");
  render(route);
}

/* UI: カード描画 */
function render(route){
  const state = loadState();
  const list = DATA[route];
  const grid = document.getElementById(`${route}Grid`);
  grid.innerHTML = "";

  list.forEach(item => {
    const ikey = itemKey(route, item.id);
    const unlocked = !!state.unlocked[ikey];
    const locked = !!state.locked[ikey];

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__title">
        <span>${item.title}</span>
        <span class="badge ${unlocked ? "ok" : "lock"}">${unlocked ? "解除済み" : (locked ? "永久ロック" : "未解除")}</span>
      </div>
      <div class="card__desc">${item.desc}</div>
    `;
    card.addEventListener("click", () => onOpenItem(route, item));
    grid.appendChild(card);
  });
}

function onOpenItem(route, item){
  const state = loadState();
  const ikey = itemKey(route, item.id);

  if(state.unlocked[ikey]){
    openInfo(item.title, item.body);
    return;
  }
  if(state.locked[ikey]){
    openInfo(item.title, "<p><b>この情報は永久ロックされました。</b><br>（3回不正解のため）</p>");
    return;
  }
  // 未解除 → クイズ
  openQuiz(route, item);
}

/* 情報モーダル */
const infoModal = document.getElementById("infoModal");
const infoTitle = document.getElementById("infoTitle");
const infoBody = document.getElementById("infoBody");
infoModal.addEventListener("click", (e) => {
  if(e.target?.dataset?.close === "true") closeModal(infoModal);
});
function openInfo(title, html){
  infoTitle.textContent = title;
  infoBody.innerHTML = html;
  openModal(infoModal);
}

/* クイズモーダル */
const quizModal = document.getElementById("quizModal");
const quizQuestion = document.getElementById("quizQuestion");
const quizChoices = document.getElementById("quizChoices");
const quizFeedback = document.getElementById("quizFeedback");
const attemptsLabel = document.getElementById("attemptsLabel");
document.getElementById("quizCancel").addEventListener("click", () => closeModal(quizModal));

let currentContext = null;

function openQuiz(route, item){
  const state = loadState();
  const ikey = itemKey(route, item.id);
  ensureAttemptState(state, ikey);

  // 永久ロックなら出さない
  if (state.locked[ikey]) {
    openInfo(item.title, "<p><b>この情報は永久ロックされました。</b><br>（3回不正解のため）</p>");
    return;
  }

  currentContext = { route, item, ikey };

  if(state.attemptsLeft[ikey] <= 0){
    // 念のため: 0ならロック
    state.locked[ikey] = true;
    saveState(state);

    quizQuestion.textContent = "本日の挑戦回数が上限に達しました。永久ロックされました。";
    quizChoices.innerHTML = "";
    quizFeedback.textContent = "※初期化ボタンでリセットできます（デモ用）。";
    quizFeedback.className = "feedback ng";
    attemptsLabel.textContent = "残り 0 / 3";
    openModal(quizModal);
    render(route);
    return;
  }

  showNextQuestion();
  openModal(quizModal);
}

function showNextQuestion(){
  const state = loadState();
  const { ikey } = currentContext;

  const left = state.attemptsLeft[ikey];
  attemptsLabel.textContent = `残り ${left} / 3`;

  const q = pickNextQuestion(state, ikey);

  // 選択肢をシャッフルして表示（答え位置が固定にならないように）
  const indexed = q.choices.map((text, idx) => ({ text, idx }));
  const shuffled = shuffle(indexed);

  quizQuestion.textContent = q.question;
  quizFeedback.textContent = "";
  quizFeedback.className = "feedback";

  quizChoices.innerHTML = "";
  shuffled.forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = ch.text;
    btn.addEventListener("click", () => onAnswer(q, ch.idx));
    quizChoices.appendChild(btn);
  });
}

function onAnswer(questionObj, chosenOriginalIndex){
  const state = loadState();
  const { route, item, ikey } = currentContext;

  const correct = (chosenOriginalIndex === questionObj.answerIndex);

  if(correct){
    state.unlocked[ikey] = true;
    saveState(state);

    quizFeedback.textContent = "正解！解除しました。";
    quizFeedback.className = "feedback ok";

    setTimeout(() => {
      closeModal(quizModal);
      render(route);
      openInfo(item.title, item.body);
    }, 450);
    return;
  }

  // 不正解
  state.attemptsLeft[ikey] = Math.max(0, (state.attemptsLeft[ikey] ?? 3) - 1);

  // 残り0になったら永久ロック
  if (state.attemptsLeft[ikey] <= 0) {
    state.locked[ikey] = true;
  }

  saveState(state);

  const left = state.attemptsLeft[ikey];
  quizFeedback.textContent = `不正解…（残り ${left} 回）`;
  quizFeedback.className = "feedback ng";
  attemptsLabel.textContent = `残り ${left} / 3`;

  if(left <= 0){
    quizQuestion.textContent = "上限に達しました。永久ロックされました。";
    quizChoices.innerHTML = "";
    render(route);
    return;
  }

  // 次の問題へ（毎回クイズ内容を変える）
  setTimeout(() => showNextQuestion(), 520);
}

/* モーダル共通 */
function openModal(modalEl){
  modalEl.setAttribute("aria-hidden", "false");
}
function closeModal(modalEl){
  modalEl.setAttribute("aria-hidden", "true");
}

/* 初期化（デモ用） */
document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  render(getCurrentRoute());
});

function getCurrentRoute(){
  const active = document.querySelector(".tab.is-active[data-route]");
  return active?.dataset?.route || "day1";
}

(async function init(){
  try {
    await loadQuizPool();
    setRoute("day1");
  } catch (e) {
    console.error(e);
    // quiz.jsonが読めない場合でも画面は出す
    setRoute("day1");
    openInfo("エラー", "<p>quiz.json の読み込みに失敗しました。ローカルサーバーで開いているか確認してください。</p>");
  }
})();
