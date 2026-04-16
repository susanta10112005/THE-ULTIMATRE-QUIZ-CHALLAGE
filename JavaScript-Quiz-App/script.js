/* ==========================================================
   QuizAI – Complete Application Logic
   Integrates with Groq API for AI-generated questions
   ========================================================== */

// ─── Constants ────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TOTAL_QUESTIONS = 30;
const TIMER_SECONDS = 30;

const SUBJECTS = [
  { id: 'math', name: 'Mathematics', icon: '📐' },
  { id: 'science', name: 'Science', icon: '🔬' },
  { id: 'history', name: 'History', icon: '🏛️' },
  { id: 'geography', name: 'Geography', icon: '🌍' },
  { id: 'programming', name: 'Programming', icon: '💻' },
  { id: 'general', name: 'General Knowledge', icon: '🧠' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'movies', name: 'Movies & TV', icon: '🎬' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'literature', name: 'Literature', icon: '📚' },
  { id: 'technology', name: 'Technology', icon: '🚀' },
  { id: 'nature', name: 'Nature', icon: '🌿' },
  { id: 'art', name: 'Art', icon: '🎨' },
  { id: 'mythology', name: 'Mythology', icon: '🐉' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'food', name: 'Food & Drink', icon: '🍔' },
  { id: 'astronomy', name: 'Astronomy', icon: '🔭' },
  { id: 'animals', name: 'Animals', icon: '🐾' },
];

// ─── State ────────────────────────────────────────────────
let state = {
  apiKey: '',
  selectedSubject: null,
  difficulty: 'medium',
  questions: [],
  currentIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  timerInterval: null,
  timeLeft: TIMER_SECONDS,
  totalTimeUsed: 0,
  questionStartTime: 0,
  answered: false,
};

// ─── DOM Refs ─────────────────────────────────────────────
const screens = {
  apikey: document.getElementById('screen-apikey'),
  subject: document.getElementById('screen-subject'),
  loading: document.getElementById('screen-loading'),
  quiz: document.getElementById('screen-quiz'),
  results: document.getElementById('screen-results'),
};

// ─── Initialization ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildSubjectGrid();
  setupToggleVisibility();

  const savedKey = localStorage.getItem('groq_api_key');
  if (savedKey) {
    state.apiKey = savedKey;
    showScreen('subject');
  } else {
    showScreen('apikey');
  }
});

// ─── Screen Navigation ────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

// ─── API Key Screen ───────────────────────────────────────
function setupToggleVisibility() {
  const btn = document.getElementById('toggle-key');
  const input = document.getElementById('api-key-input');
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
}

function saveApiKey() {
  const keyInput = document.getElementById('api-key-input');
  const errorEl = document.getElementById('api-key-error');
  const key = keyInput.value.trim();

  if (!key || !key.startsWith('gsk_')) {
    errorEl.textContent = 'Please enter a valid Groq API key (starts with gsk_)';
    keyInput.style.borderColor = 'var(--red)';
    return;
  }

  errorEl.textContent = '';
  keyInput.style.borderColor = '';
  state.apiKey = key;
  localStorage.setItem('groq_api_key', key);
  showScreen('subject');
  showToast('✅ API key saved!');
}

function showApiKeyScreen() {
  const input = document.getElementById('api-key-input');
  input.value = state.apiKey || '';
  showScreen('apikey');
}

// ─── Subject Screen ───────────────────────────────────────
function buildSubjectGrid() {
  const grid = document.getElementById('subject-grid');
  if (!grid) return;

  SUBJECTS.forEach(subject => {
    const btn = document.createElement('button');
    btn.className = 'subject-btn';
    btn.id = `subject-${subject.id}`;
    btn.setAttribute('aria-label', subject.name);
    btn.innerHTML = `
      <span class="subject-icon">${subject.icon}</span>
      <span class="subject-name">${subject.name}</span>
    `;
    btn.addEventListener('click', () => selectSubject(subject, btn));
    grid.appendChild(btn);
  });
}

function selectSubject(subject, btnEl) {
  if (btnEl.classList.contains('selected')) {
    // If clicked again, start the quiz
    startQuiz();
    return;
  }

  // Deselect all
  document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');

  state.selectedSubject = subject;

  const startBtn = document.getElementById('start-quiz-btn');
  const startText = document.getElementById('start-btn-text');
  if (startBtn && startText) {
    startBtn.disabled = false;
    startText.textContent = `Enter ${subject.name}`;
  }
}

function setDifficulty(diff) {
  state.difficulty = diff;
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.diff === diff);
  });
}

// ─── Groq API Call ────────────────────────────────────────
async function fetchQuestionsFromGroq(subject, difficulty) {
  let pastQuestions = JSON.parse(localStorage.getItem('quiz_asked_questions') || '{}');
  let subjectPast = pastQuestions[subject.id] || [];
  let doNotRepeatClause = '';
  
  if (subjectPast.length > 0) {
    const recentPast = subjectPast.slice(-150); // limit to last 150 to avoid huge prompts
    doNotRepeatClause = `\n- COMPLETELY AVOID giving any of these previously asked questions: ${recentPast.map(q => `"${q.replace(/"/g, "'")}"`).join(', ')}. Provide entirely NEW questions.`;
  }

  const prompt = `Generate exactly ${TOTAL_QUESTIONS} multiple choice quiz questions about "${subject.name}" at ${difficulty} difficulty level.

STRICT RESPONSE FORMAT — respond ONLY with a valid JSON array, no extra text:
[
  {
    "question": "Question text here?",
    "answers": [
      {"text": "Option A", "correct": true},
      {"text": "Option B", "correct": false},
      {"text": "Option C", "correct": false},
      {"text": "Option D", "correct": false}
    ]
  }
]

Rules:
- Each question must have exactly 4 answer options
- Exactly ONE answer must be correct (correct: true), the rest false
- Questions must be clear, factual, and at ${difficulty} level
- Make questions diverse and interesting
- Do NOT include any explanation, markdown, or text outside the JSON array${doNotRepeatClause}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  // Extract JSON from the response (handle markdown code fences)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI returned unexpected format. Please try again.');

  const questions = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('No questions returned. Please try again.');
  }

  // Save new questions to avoid future repeats
  questions.forEach(q => subjectPast.push(q.question));
  pastQuestions[subject.id] = subjectPast;
  localStorage.setItem('quiz_asked_questions', JSON.stringify(pastQuestions));

  return questions;
}

// ─── Start Quiz ───────────────────────────────────────────
async function startQuiz() {
  if (!state.selectedSubject) return;

  // Update loading screen
  document.getElementById('loading-subject-icon').textContent = state.selectedSubject.icon;
  document.getElementById('loading-subject-name').textContent = state.selectedSubject.name;
  document.getElementById('loading-title').textContent = `Generating Questions...`;
  document.getElementById('loading-subtitle').textContent = `Creating ${TOTAL_QUESTIONS} unique ${state.difficulty} questions for you`;

  showScreen('loading');

  try {
    const questions = await fetchQuestionsFromGroq(state.selectedSubject, state.difficulty);

    // Reset state
    state.questions = questions;
    state.currentIndex = 0;
    state.score = 0;
    state.correctCount = 0;
    state.wrongCount = 0;
    state.totalTimeUsed = 0;

    // Update quiz header badges
    document.getElementById('quiz-subject-label').textContent =
      `${state.selectedSubject.icon} ${state.selectedSubject.name}`;
    document.getElementById('quiz-difficulty-label').textContent =
      capitalize(state.difficulty);

    showScreen('quiz');
    renderQuestion();

  } catch (err) {
    console.error('Groq API error:', err);
    showScreen('subject');

    if (err.message.includes('401') || err.message.toLowerCase().includes('api key')) {
      showToast('❌ Invalid API key. Please update it.', 4000);
      showApiKeyScreen();
    } else if (err.message.includes('429')) {
      showToast('⏳ Rate limited. Wait a moment and try again.', 4000);
    } else {
      showToast(`❌ ${err.message}`, 4000);
    }
  }
}

// ─── Quiz Engine ──────────────────────────────────────────
function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  state.answered = false;

  // Progress
  const pct = ((state.currentIndex) / TOTAL_QUESTIONS) * 100;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent =
    `${state.currentIndex + 1} / ${TOTAL_QUESTIONS}`;

  // Question
  document.getElementById('question-num').textContent = `Question ${state.currentIndex + 1}`;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('live-score').textContent = state.score;

  // Answers
  const grid = document.getElementById('answers-grid');
  grid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  q.answers.forEach((ans, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.id = `answer-${i}`;
    btn.setAttribute('aria-label', ans.text);
    btn.innerHTML = `
      <span class="answer-letter">${letters[i]}</span>
      <span>${ans.text}</span>
    `;
    if (ans.correct) btn.dataset.correct = 'true';
    btn.addEventListener('click', () => selectAnswer(btn, ans.correct));
    grid.appendChild(btn);
  });

  // Hide Next button
  document.getElementById('next-question-btn').classList.add('hide');

  // Start timer
  startTimer();
  state.questionStartTime = Date.now();
}

function selectAnswer(clickedBtn, isCorrect) {
  if (state.answered) return;
  state.answered = true;

  stopTimer();

  const elapsed = (Date.now() - state.questionStartTime) / 1000;
  state.totalTimeUsed += elapsed;

  // Disable all buttons
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') {
      btn.classList.add('correct');
    }
  });

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    state.score++;
    state.correctCount++;
    showToast('✅ Correct!', 1200);
  } else {
    clickedBtn.classList.add('wrong');
    state.wrongCount++;
    showToast('❌ Wrong!', 1200);
  }

  // Show next / finish button
  const nextBtn = document.getElementById('next-question-btn');
  const nextLabel = document.getElementById('next-btn-label');
  nextBtn.classList.remove('hide');
  nextLabel.textContent =
    state.currentIndex + 1 >= TOTAL_QUESTIONS ? 'See Results' : 'Next Question';
}

function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= TOTAL_QUESTIONS) {
    showResults();
  } else {
    renderQuestion();
  }
}

// ─── Timer ────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  state.timeLeft = TIMER_SECONDS;

  const circleEl = document.getElementById('timer-circle');
  const textEl = document.getElementById('timer-text');
  const circumference = 150.8; // 2πr where r=24

  updateTimerUI(circleEl, textEl, circumference);

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerUI(circleEl, textEl, circumference);

    if (state.timeLeft <= 0) {
      stopTimer();
      timeExpired();
    }
  }, 1000);
}

function updateTimerUI(circleEl, textEl, circumference) {
  const fraction = state.timeLeft / TIMER_SECONDS;
  const offset = circumference * (1 - fraction);
  circleEl.style.strokeDashoffset = offset;
  textEl.textContent = state.timeLeft;

  circleEl.classList.remove('warning', 'danger');
  if (state.timeLeft <= 10) circleEl.classList.add('warning');
  if (state.timeLeft <= 5) circleEl.classList.add('danger');
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function timeExpired() {
  state.totalTimeUsed += TIMER_SECONDS;
  state.wrongCount++;

  // Reveal correct answer
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') btn.classList.add('correct');
    else btn.classList.add('wrong');
  });

  state.answered = true;
  showToast('⏰ Time\'s up!', 1500);

  const nextBtn = document.getElementById('next-question-btn');
  const nextLabel = document.getElementById('next-btn-label');
  nextBtn.classList.remove('hide');
  nextLabel.textContent =
    state.currentIndex + 1 >= TOTAL_QUESTIONS ? 'See Results' : 'Next Question';
}

// ─── Results ──────────────────────────────────────────────
function showResults() {
  stopTimer();
  showScreen('results');

  const pct = (state.score / TOTAL_QUESTIONS) * 100;
  const avgTime = state.totalTimeUsed / TOTAL_QUESTIONS;

  // Emoji & message
  let emoji, title, subtitle;
  if (pct === 100) {
    emoji = '🏆'; title = 'Perfect Score!'; subtitle = 'Outstanding! You nailed every question!';
  } else if (pct >= 80) {
    emoji = '🌟'; title = 'Excellent!'; subtitle = `Great job! You really know ${state.selectedSubject.name}!`;
  } else if (pct >= 60) {
    emoji = '👍'; title = 'Good Job!'; subtitle = 'Solid performance! Keep practicing!';
  } else if (pct >= 40) {
    emoji = '📖'; title = 'Keep Learning!'; subtitle = 'Not bad, but there\'s room to improve!';
  } else {
    emoji = '💪'; title = 'Keep Trying!'; subtitle = 'Don\'t give up — practice makes perfect!';
  }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-subtitle').textContent = subtitle;
  document.getElementById('final-score').textContent = state.score;
  document.getElementById('final-total').textContent = `/ ${TOTAL_QUESTIONS}`;
  document.getElementById('stat-correct').textContent = state.correctCount;
  document.getElementById('stat-wrong').textContent = state.wrongCount;
  document.getElementById('stat-time').textContent = `${avgTime.toFixed(1)}s`;

  // Animate score ring
  const circumference = 314.16; // 2πr where r=50
  const offset = circumference * (1 - pct / 100);
  setTimeout(() => {
    document.getElementById('score-ring-fill').style.strokeDashoffset = offset;
  }, 100);

  // Color ring based on score
  const ringEl = document.getElementById('score-ring-fill');
  if (pct >= 80) ringEl.style.stroke = 'var(--green-light)';
  else if (pct >= 60) ringEl.style.stroke = '#60a5fa';
  else if (pct >= 40) ringEl.style.stroke = 'var(--yellow)';
  else ringEl.style.stroke = 'var(--red-light)';
}

function playAgain() {
  showScreen('loading');

  document.getElementById('loading-subject-icon').textContent = state.selectedSubject.icon;
  document.getElementById('loading-subject-name').textContent = state.selectedSubject.name;
  document.getElementById('loading-title').textContent = `Generating Questions...`;
  document.getElementById('loading-subtitle').textContent = `Creating fresh ${state.difficulty} questions for you`;

  setTimeout(startQuiz, 300);
}

function changeSubject() {
  // Reset subject selection
  document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
  
  const startBtn = document.getElementById('start-quiz-btn');
  const startText = document.getElementById('start-btn-text');
  if (startBtn && startText) {
    startBtn.disabled = true;
    startText.textContent = 'Enter';
  }
  
  state.selectedSubject = null;

  showScreen('subject');
}

// ─── Toast Notification ───────────────────────────────────
let toastTimeout;
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── Helpers ──────────────────────────────────────────────
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Allow pressing Enter to save API key or start quiz
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (screens.apikey.classList.contains('active')) {
      saveApiKey();
    } else if (screens.subject.classList.contains('active') && state.selectedSubject) {
      startQuiz();
    }
  }
});