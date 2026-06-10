import { promises as fs } from 'node:fs';
import path from 'node:path';

// Сборщик данных платформы тестов BlockCapital Crypto Summit.
//
// В отличие от AI-хаба, здесь НЕТ парсера markdown: готовые тесты пайплайна
// выходят в разном формате от занятия к занятию, поэтому источник истины —
// верифицированные вручную структурированные файлы data/lessons/lesson-NN.json.
// Каждый такой файл = один объект "module" в терминах фронтенда.
// Скрипт просто валидирует их, сортирует по номеру и собирает course-data.json.

const siteRoot = process.cwd();
const lessonsDir = path.join(siteRoot, 'data', 'lessons');
const outputPath = path.join(siteRoot, 'data', 'course-data.json');

const REQUIRED_MODULE_FIELDS = ['id', 'number', 'title', 'questions'];
const VALID_INTERACTIONS = new Set([
  'single_choice',
  'multi_choice',
  'matching_text',
  'ordering',
  'open_text'
]);

const fail = (message) => {
  throw new Error(message);
};

const validateQuestion = (lessonId, question) => {
  const where = `${lessonId} / вопрос ${question.number ?? '?'}`;

  if (typeof question.number !== 'number') {
    fail(`${where}: отсутствует числовое поле "number"`);
  }

  if (!VALID_INTERACTIONS.has(question.interaction)) {
    fail(`${where}: некорректный interaction "${question.interaction}"`);
  }

  if (!question.promptMarkdown || !String(question.promptMarkdown).trim()) {
    fail(`${where}: пустой promptMarkdown`);
  }

  const grading = question.grading || {};

  if (question.interaction === 'single_choice') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`${where}: single_choice требует минимум 2 варианта в options`);
    }
    if (grading.mode !== 'single_choice' || !grading.correctKey) {
      fail(`${where}: single_choice требует grading.correctKey`);
    }
  }

  if (question.interaction === 'multi_choice') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`${where}: multi_choice требует минимум 2 варианта в options`);
    }
    if (grading.mode !== 'multi_choice' || !Array.isArray(grading.correctKeys) || grading.correctKeys.length === 0) {
      fail(`${where}: multi_choice требует непустой grading.correctKeys`);
    }
  }

  if (question.interaction === 'matching_text') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`${where}: matching_text требует варианты (правый столбец) в options`);
    }
    if (grading.mode !== 'matching_text' || !grading.expectedMap || Object.keys(grading.expectedMap).length === 0) {
      fail(`${where}: matching_text требует непустой grading.expectedMap`);
    }
  }

  if (question.interaction === 'ordering') {
    if (!question.ordering || !Array.isArray(question.ordering.items) || question.ordering.items.length < 2) {
      fail(`${where}: ordering требует ordering.items`);
    }
    if (grading.mode !== 'ordering' || !Array.isArray(grading.solution)) {
      fail(`${where}: ordering требует grading.solution`);
    }
  }
};

const normalizeModule = (lessonId, raw) => {
  for (const field of REQUIRED_MODULE_FIELDS) {
    if (!(field in raw)) {
      fail(`${lessonId}: отсутствует обязательное поле "${field}"`);
    }
  }

  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    fail(`${lessonId}: пустой список questions`);
  }

  raw.questions.forEach((question) => validateQuestion(lessonId, question));

  const totalQuestions = raw.questions.length;
  const passThresholdValue =
    typeof raw.passThresholdValue === 'number' ? raw.passThresholdValue : 0;

  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    testTitle: raw.testTitle || raw.title,
    sourceFile: raw.sourceFile || '',
    totalQuestions,
    estimatedTime: raw.estimatedTime || '',
    passThreshold: raw.passThreshold || '',
    passThresholdValue,
    attemptsAllowed: raw.attemptsAllowed || '',
    questions: raw.questions
  };
};

const buildData = async () => {
  let entries = [];
  try {
    entries = await fs.readdir(lessonsDir);
  } catch {
    fail(`Не найдена папка ${path.relative(siteRoot, lessonsDir)}`);
  }

  const lessonFiles = entries
    .filter((name) => /^lesson-\d+\.json$/i.test(name))
    .sort();

  if (lessonFiles.length === 0) {
    fail('Нет файлов data/lessons/lesson-NN.json');
  }

  const modules = [];
  for (const fileName of lessonFiles) {
    const filePath = path.join(lessonsDir, fileName);
    const rawText = await fs.readFile(filePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      fail(`${fileName}: невалидный JSON — ${error.message}`);
    }
    modules.push(normalizeModule(fileName, parsed));
  }

  modules.sort((a, b) => a.number - b.number);

  const payload = {
    generatedAt: new Date().toISOString(),
    siteTitle: 'Тесты курса BlockCapital Crypto Summit',
    courseTitle: 'BlockCapital Crypto Summit — криптовалютная грамотность',
    modules
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`OK: ${path.relative(siteRoot, outputPath)}`);
  console.log(`Занятий: ${modules.length}`);
  console.log(`Вопросов: ${modules.reduce((total, module) => total + module.questions.length, 0)}`);
};

buildData().catch((error) => {
  console.error(`Ошибка сборки: ${error.message}`);
  process.exitCode = 1;
});
