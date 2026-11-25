# Промпт для ИИ-агента-разработчика: «Текст по-человечески»

> Документ является рабочим заданием для автономного ИИ-агента.
> Единственный источник требований — `tech_spec.md`. При конфликте между
> этим промптом и ТЗ приоритет у ТЗ.

## Роль

Ты — senior full-stack разработчик. Твоя задача — спроектировать и полностью
реализовать веб-приложение «Текст по-человечески» согласно приведённому ниже
техническому заданию. Работай итеративно: сначала архитектура и каркас, затем
backend, frontend, интеграции, тестирование. Не пропускай ни одного пункта ТЗ.

---

## 1. Контекст проекта

- **Название:** Текст по-человечески
- **Цель:** Упрощать сложные научные и учебные тексты для студентов, сохраняя
  все факты, имена, цифры и структуру оригинала.
- **Аудитория:** Студенты вузов (лекции, статьи, учебные материалы).
- **Язык интерфейса и контента:** Только русский.

---

## 2. Технологический стек (используй строго этот)

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + TypeScript, Vite |
| UI-библиотека | Tailwind CSS + Headless UI (или Radix UI) |
| State management | Zustand |
| Backend | Node.js + Express (или Fastify) + TypeScript |
| База данных | PostgreSQL 15 + Prisma ORM |
| Аутентификация | Magic-link по email (nodemailer + JWT) |
| LLM для упрощения | Любой OpenAI-совместимый API (конфиг через env) |
| OCR | Tesseract.js (client-side) ИЛИ cloud-OCR (Google Vision / Yandex Vision) через backend-proxy |
| Парсинг PDF | pdf-parse (npm) |
| Парсинг DOCX | mammoth (npm) |
| Хранение файлов | Локальная файловая система (папка `/uploads`) с cleanup по TTL |
| Деплой | Docker Compose (frontend + backend + postgres + nginx) |

---

## 3. Архитектура

### 3.1. Структура репозитория

```
project-root/
├── docker-compose.yml
├── .env.example
├── README.md
├── design.md            ← (создать заглушку, заполняется на этапе дизайна)
├── client/              ← React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── api/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
├── server/              ← Node.js API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── db/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── uploads/
│   ├── Dockerfile
│   └── package.json
└── nginx/
    └── nginx.conf
```

### 3.2. Схема БД (Prisma)

```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  createdAt DateTime  @default(now())
  sessions  Session[]
  requests  Request[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Request {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  inputText   String   @db.Text
  level       String   // "slightly_simpler" | "beginner"
  resultText  String?  @db.Text
  status      String   // "pending" | "success" | "rejected_content"
  createdAt   DateTime @default(now())
  requestDate String   // "YYYY-MM-DD" — денормализация для лимита
}
```

### 3.3. API-эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/request-login` | Отправить magic-link на email |
| GET | `/api/auth/verify?token=...` | Проверить токен, выдать JWT |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/simplify` | Основной запрос упрощения |
| POST | `/api/upload/file` | Загрузка PDF/DOCX → парсинг → возврат текста |
| POST | `/api/upload/image` | Загрузка фото → OCR → возврат текста |
| GET | `/api/usage` | Сколько попыток использовано сегодня |

**Формат POST `/api/simplify`:**

```json
{
  "text": "string (до 10000 символов)",
  "level": "slightly_simpler" | "beginner"
}
```

**Ответ:**

```json
{
  "id": "uuid",
  "resultText": "string",
  "status": "success"
}
```

**Ошибки:**

- `401` — не авторизован
- `403` — лимит исчерпан (3/день)
- `422` — запрещённый контент
- `413` — текст превышает 10 000 знаков
- `400` — некорректный входной формат

---

## 4. Функциональные требования (детализация)

### 4.1. Аутентификация (Magic Link)

1. Пользователь вводит email → `POST /api/auth/request-login`.
2. Backend генерирует одноразовый токен (UUID, TTL 15 мин), сохраняет в БД,
   отправляет письмо с ссылкой `https://app/auth/verify?token=...`.
3. Пользователь переходит по ссылке → `GET /api/auth/verify` → backend
   валидирует токен, выдаёт JWT (access 15 мин + refresh 7 дней).
4. JWT хранится в httpOnly cookie (refresh) + память (access).
5. Middleware `requireAuth` защищает все бизнес-эндпоинты.

### 4.2. Упрощение текста (LLM)

Промпт-шаблон для LLM (backend/service):

```text
Ты — редактор, который переписывает сложные тексты простым русским языком.

Правила (ОБЯЗАТЕЛЬНЫ):
1. Сохраняй ВСЕ факты, имена собственные, числа, даты, термины в скобках.
2. Сохраняй структуру: заголовки (##), маркированные списки (-, 1.), формулы ($...$).
3. Не добавляй резюме, глоссарии, пояснения — только переписанный текст.
4. Работай ТОЛЬКО с русским языком. Если текст не на русском — верни
   {"error":"not_russian"}.
5. Уровень: {{level_description}}

Варианты уровня:
- slightly_simpler → «Заменяй канцеляризмы и пассивные конструкции на
  активные, упрощай синтаксис, но сохраняй академический тон и терминологию.»
- beginner → «Пиши максимально простым разговорно-нейтральным языком.
  Расшифровывай каждый термин при первом употреблении. Короткие предложения.
  Минимум абстракций.»

Входной текст:
---
{{text}}
---

Верни ТОЛЬКО переписанный текст, без преамбул и пояснений.
```

**Content moderation (перед отправкой в LLM):**

- Простой фильтр: список стоп-слов / нецензурной лексики → `422`.
- Опционально: отдельный вызов LLM с системным промптом-модератором.
- При отказе:

```json
{ "error": "content_rejected", "message": "Контент не может быть обработан." }
```

### 4.3. Лимит 3 попытки / день

- На каждый успешный `POST /api/simplify` инкрементируется счётчик.
- Middleware проверяет `Request.count(userId, requestDate=today) >= 3` → `403`.
- Счётчик сбрасывается по дате (UTC+3 / Москва).
- `GET /api/usage` возвращает `{ "used": 2, "remaining": 1 }` для UI.

### 4.4. Загрузка файлов

**PDF:**
- Принимает multipart/form-data (max 20 МБ, MIME `application/pdf`).
- `pdf-parse` извлекает текст → сохраняет во tmp → возвращает клиенту.
- Клиент помещает текст в textarea (пользователь может отредактировать).

**DOCX:**
- Аналогично: `mammoth.convertToHtml` → `html-to-text` → чистый текст.

**Фото (OCR):**
- Принимает JPEG/PNG/WebP (max 15 МБ).
- Google Vision API (или Tesseract.js на клиенте как fallback).
- Язык распознавания: `rus`.
- Результат → в textarea.

### 4.5. Экран обработки

- После отправки `POST /api/simplify` UI показывает:
  - спиннер + текст «Обрабатываем текст…»;
  - опционально: прогресс-бар (необязательно, т.к. время не нормировано).
- При ошибке сети / таймауте (30 с) — кнопка «Повторить».

---

## 5. UI/UX требования

### 5.1. Экран авторизации

- Логотип / название приложения.
- Одно поле: email (`type=email`, валидация формата).
- Кнопка «Войти» → отправка magic-link.
- После отправки: сообщение «Проверьте почту — мы отправили ссылку».
- Адаптив: на мобильном — full-width, вертикальная раскладка.

### 5.2. Главный экран

**Блок «Уровень простоты»**
- Radio group: «Чуть проще» / «Как для новичка».
- По умолчанию выбран «Чуть проще».

**Блок «Ввод текста» (3 вкладки)**
1. **Вставить текст** — textarea, max 10000 символов, счётчик знаков
   (остаток: «9 847 / 10 000»).
2. **Загрузить файл** — drop-zone + кнопка выбора файла. Принимает PDF, DOCX.
   Показывает имя загруженного файла.
3. **Загрузить фото** — drop-zone + кнопка «Выбрать фото / Камера».
   На мобильном: `capture="environment"` для камеры.
   Принимает JPEG, PNG, WebP.

**Кнопка «Упростить»**
- Disabled, пока textarea пуста или лимит исчерпан.
- При нажатии — отправка запроса, переход в состояние «Обработка».

**Блок «Результат»**
- Появляется после успешного ответа.
- Read-only textarea / styled div с переписанным текстом.
- Кнопки: «Копировать», «Скачать .txt».

**Индикатор лимита**
- В шапке: «Осталось попыток сегодня: 2/3».
- При 0/3 — блокировка кнопки + сообщение о лимите.

### 5.3. Экран ошибки контента

- Иконка ⚠️.
- Текст: «К сожалению, этот текст не может быть обработан. Попробуйте другой фрагмент.»
- Кнопка «Вернуться к вводу».

### 5.4. Адаптивность

- Breakpoints: mobile (<768px), tablet (768–1024), desktop (>1024).
- На mobile: вкладки → аккордеон или горизонтальный скролл.
- Textarea: min-height 200px на desktop, 150px на mobile.
- Результат под textarea (не рядом).

### 5.5. Дизайн

- Минималистичный, чистый стиль.
- Цвета: нейтральная палитра (серый, белый, акцент — синий/индиго).
- Шрифт: Inter или системный sans-serif.
- `design.md` — заглушка с placeholder-комментариями для дизайнера.

---

## 6. Нефункциональные требования

| Требование | Реализация |
|-----------|-----------|
| Безопасность | Helmet, CORS (whitelist), rate-limit (express-rate-limit), санитайзация ввода |
| Секреты | Все ключи через `.env`, не коммитить |
| Логирование | pino (backend), консоль в dev |
| Обработка ошибок | Глобальный error middleware, клиентские toast |
| Доступность | aria-labels, keyboard navigation, контраст ≥ 4.5:1 |
| Производительность | Lazy-load фото-OCR, debounce счётчика символов |
| Тестирование | Jest + Supertest (unit/integration backend), Vitest + RTL (frontend), Playwright (e2e) |
| CI | GitHub Actions: lint → test → build → docker build |

---

## 7. Docker Compose

```yaml
version: "3.9"
services:
  client:
    build: ./client
    ports: ["3000:80"]
  server:
    build: ./server
    env_file: .env
    depends_on: [db]
    volumes: ["./server/uploads:/app/uploads"]
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: text_app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes: ["pgdata:/var/lib/postgresql/data"]
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes: ["./nginx/nginx.conf:/etc/nginx/nginx.conf"]
    depends_on: [client, server]
volumes:
  pgdata:
```

---

## 8. .env.example

```env
# App
APP_URL=http://localhost
PORT=4000

# DB
DATABASE_URL=postgresql://app:${DB_PASS}@db:5432/text_app
DB_PASS=change_me

# Auth
JWT_SECRET=super_secret_change_me
JWT_REFRESH_SECRET=another_secret_change_me

# LLM (OpenAI-compatible)
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=app@example.com
SMTP_PASS=app_password

# OCR (optional, cloud)
GOOGLE_VISION_API_KEY=...
```

---

## 9. Критерии готовности (Definition of Done)

Убедись, что ВСЕ пункты выполнены:

- [ ] Вход по email (magic-link) работает: письмо → клик → сессия.
- [ ] 3 состояния кнопки «Упростить»: disabled / active / processing.
- [ ] Textarea: ввод, вставка из файла, вставка из OCR.
- [ ] PDF и DOCX парсятся без ошибок (тест на файлах 10+ и 100+ страниц).
- [ ] OCR фото: загрузка → распознавание → текст в поле.
- [ ] Лимит 3/день: 4-я попытка → 403 + UI-сообщение.
- [ ] Content filter: нецензурный/запрещённый текст → 422 + UI-экран.
- [ ] Результат сохраняет структуру (заголовки, списки, формулы).
- [ ] Все факты, имена и цифры оригинала сохранены в упрощённой версии.
- [ ] Мобильная вёрстка (375px, 768px, 1440px) без горизонтального скролла.
- [ ] Загрузка фото с камеры телефона (`capture="environment"`).
- [ ] Копирование и скачивание результата.
- [ ] Все тесты проходят, покрытие backend ≥ 80%.
- [ ] `docker-compose up` поднимает всё приложение.
- [ ] README с инструкцией по запуску.

---

## 10. Порядок работы (итерации)

Выполняй строго по порядку. После каждой итерации — коммит с осмысленным
message.

### Итерация 1 — Каркас
- Инициализация проектов (Vite, Express, Prisma, Docker).
- Пустые роуты, страницы, layouts.
- `.env`, конфиги.

### Итерация 2 — Аутентификация
- Модели User + Session.
- Magic-link: генерация, отправка, верификация.
- JWT middleware.
- UI: экран логина + redirect.

### Итерация 3 — Упрощение (ядро)
- Сервис LLM (call + prompt template).
- Content moderation.
- `POST /api/simplify`.
- UI: textarea, radio, кнопка, лоадер, результат.

### Итерация 4 — Файлы и OCR
- Upload PDF/DOCX → парсинг → текст.
- Upload фото → OCR → текст.
- UI: вкладки, drop-zone, мобильная камера.

### Итерация 5 — Лимиты и состояния
- Middleware лимита (3/день).
- `GET /api/usage`.
- UI: индикатор, экран лимита, экран ошибки.

### Итерация 6 — Адаптив и polish
- Responsive layout.
- Toast-уведомления, skeleton-загрузка.
- Копирование, скачивание.
- Favicon, meta, title.

### Итерация 7 — Тесты и деплой
- Unit + integration tests.
- E2E: happy path + лимит + ошибка контента.
- Dockerfile, docker-compose, nginx.conf.
- README, .env.example.

---

## 11. Стиль кода

- TypeScript strict mode.
- Именование: camelCase (переменные), PascalCase (компоненты/классы), kebab-case (файлы CSS).
- Комментарии на русском (в ключевых местах), код на английском.
- ESLint + Prettier (конфиги в репо).
- Функциональные компоненты React, хуки.
- Чистая архитектура: controller → service → repository.

---

## 12. Что НЕ делать

- Не добавляй регистрацию по паролю — только magic-link.
- Не делай мультиязычность.
- Не сохраняй историю обработок в UI (без «личного кабинета с историей»).
- Не добавляй платёжную систему, подписки, тарифы.
- Не используй Redux (Zustand достаточно).
- Не добавляй SSR/Next.js — SPA + API.
- Не создавай admin-panel.

---

## 13. Прикрепленное ТЗ

Полное ТЗ «Текст по-человечески» — см. `tech_spec.md`. Оно является
единственным источником требований. При конфликте между этим промптом и ТЗ —
приоритет у ТЗ.
