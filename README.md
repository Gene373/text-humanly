# Текст по-человечески

Веб-приложение, которое переписывает сложные учебные и научные тексты простым
русским языком, сохраняя факты, имена, числа и структуру оригинала
(заголовки, списки, формулы).

- **Стек:** React 19 + TypeScript + Vite + Tailwind CSS 4 · Node.js + Express 4 + Prisma 7 + PostgreSQL
- **Вход:** magic-link по email (без пароля)
- **Ввод:** текст до 10 000 знаков, PDF, DOCX, фото (OCR)
- **Лимит:** 3 обработки в сутки на пользователя
- **Язык:** только русский

---

## Быстрый старт (Docker)

```bash
cp .env.example .env      # заполните POSTGRES_PASSWORD и SESSION_SECRET
docker compose up --build
```

Приложение будет доступно на [http://localhost](http://localhost).

Если SMTP не настроен, ссылка для входа печатается в логах сервера:

```bash
docker compose logs -f server | grep "ссылк"
```

## Локальная разработка

Требуется Node.js 22+.

```bash
# 1. Зависимости
cd server && npm install
cd ../client && npm install

# 2. База данных
#    Вариант А — PostgreSQL локально (порт 5433, встроенный бинарник)
cd ../server && npm run db:start

#    Вариант Б — свой PostgreSQL: пропишите DATABASE_URL в server/.env

# 3. Миграции
cd ../server && npx prisma migrate deploy

# 4. Запуск (два терминала)
cd server && npm run dev     # API на http://localhost:4000
cd client && npm run dev     # UI на http://localhost:5173
```

UI проксирует `/api` на `http://localhost:4000` (см. `client/vite.config.ts`).

### Без ключа LLM

Если ключ нейросети не задан, работает встроенный rule-based упроститель
(`server/src/services/localSimplifier.ts`): он убирает канцелярит, дробит
длинные предложения и сохраняет структуру. Это позволяет запускать и
тестировать приложение полностью офлайн.

### Подключение GigaChat (Сбер)

Приложение умеет работать с GigaChat API напрямую: получает токен по OAuth,
кеширует его на 30 минут и перевыпускает при истечении.

**1. Получите ключ авторизации.** В личном кабинете
[developers.sber.ru](https://developers.sber.ru/portal/products/gigachat-api)
создайте проект, подключите GigaChat API и скопируйте **ключ авторизации**
(строка вида `Client ID:Client Secret`, закодированная в base64).

**2. Вставьте ключ в файл `server/.env`** — в строку `GIGACHAT_AUTH_KEY=`:

```env
GIGACHAT_AUTH_KEY=ваш_ключ_авторизации
```

Это единственное место, куда нужно вписать секрет:

- `server/.env` уже есть в `.gitignore` и в git не попадает;
- ключ читается только сервером и **никогда не логируется** (в логгере
  настроено вырезание полей `authorization`, `access_token`, `GIGACHAT_AUTH_KEY`);
- в браузер ключ не передаётся;
- для Docker ключ передаётся через переменную окружения в корневом `.env`
  (см. `docker-compose.yml`) — тот же принцип, файл в git не попадает.

**3. Проверьте подключение:**

```bash
cd server
npm run check:gigachat
```

Скрипт печатает только факт настройки ключа, scope, модель и адреса, делает
пробный запрос к модели и сообщает код ошибки, если что-то не так. Сам ключ
и токен в вывод не попадают.

**4. Запустите сервер** — в логе при старте появится строка
`llm: "GigaChat (GigaChat, GIGACHAT_API_PERS)"`.

#### Параметры GigaChat

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `GIGACHAT_AUTH_KEY` | пусто | Ключ авторизации (секрет) |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` | Тариф: `GIGACHAT_API_PERS` (физлица), `GIGACHAT_API_B2B` (предоплата), `GIGACHAT_API_CORP` (постоплата) |
| `GIGACHAT_MODEL` | `GigaChat-2` | Модель: `GigaChat-2`, `GigaChat-2-Pro`, `GigaChat-2-Max`, `GigaChat-3-Lightning`, `GigaChat-3-Pro`, `GigaChat-3-Ultra` |
| `GIGACHAT_BASE_URL` | `https://api.giga.chat/v1` | Адрес API (старый — `https://gigachat.devices.sberbank.ru/api/v1`) |
| `GIGACHAT_OAUTH_URL` | `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` | Получение токена |
| `GIGACHAT_TIMEOUT_MS` | `60000` | Таймаут запроса |
| `GIGACHAT_CA_CERT_PATH` | `server/certs/…crt` | Свой путь к сертификату НУЦ Минцифры |

#### Сертификат НУЦ Минцифры

`api.giga.chat` использует цепочку сертификатов НУЦ Минцифры, которой нет в
стандартном хранилище Node.js. Без него запрос падает с
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

Корневой сертификат уже лежит в репозитории:
`server/certs/russian_trusted_root_ca_pem.crt` (публичный, не секрет).
Сервер подключает его автоматически при первом обращении к GigaChat.
В Docker он передаётся через `NODE_EXTRA_CA_CERTS`.

Если нужен свежий сертификат:

```bash
curl -k "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt" \
  -o server/certs/russian_trusted_root_ca_pem.crt
```

#### Выбор провайдера

```env
LLM_PROVIDER=auto      # GigaChat → OpenAI-совместимый → локальный (по умолчанию)
LLM_PROVIDER=gigachat  # только GigaChat
LLM_PROVIDER=openai    # только OpenAI-совместимый API
LLM_PROVIDER=local     # без сети
```

Резервный вариант — любой OpenAI-совместимый API:

```env
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### Бот ВКонтакте (Long Poll API)

Бот сообщества присылает уведомления о запросах в приложении: кто сделал
запрос, в какое время (МСК) и сколько токенов потрачено. Также отвечает на
команды `/stats`, `/today`, `/help`.

**1. Подготовьте сообщество** (нужны права администратора):

- Управление → Сообщения → **Сообщения сообщества** — включить;
- Управление → Сообщения → Настройки для бота → **Возможности ботов** — включить;
- Управление → Дополнительно → **Работа с API** → «Создать ключ»:
  отметьте права **messages** и **groups**, подтвердите.

**2. Вставьте ключ и ID в `server/.env`:**

```env
VK_ACCESS_TOKEN=ключ_доступа_сообщества
VK_GROUP_ID=123456789
VK_NOTIFY_PEER_ID=ваш_vk_id
```

- `VK_ACCESS_TOKEN` — единственное место для секрета; файл в `.gitignore`;
- `VK_GROUP_ID` — число из адреса сообщества (`vk.com/club123456789` → `123456789`);
- `VK_NOTIFY_PEER_ID` — кому слать уведомления: ваш VK ID (узнать: `vk.com/id…`)
  или `2000000000 + номер беседы` для чата. `0` — уведомления не отправляются,
  история запросов всё равно ведётся (для `/stats`);
- `VK_ADMIN_IDS` — VK ID через запятую, кому разрешены команды. Пусто — всем.

**3. Проверьте подключение:**

```bash
cd server
npm run check:vk
```

Скрипт покажет только факт настройки ключа (длину и первые 6 символов),
ID сообщества и результат запроса `groups.getLongPollServer`. Ключ целиком
не выводится.

**4. Запустите сервер** — в логе появится `vk: "группа 123456789"`.

**Команды бота в личных сообщениях сообщества:**

| Команда | Что делает |
|---|---|
| `/stats` | Последние 10 запросов: email, время, токены |
| `/today` | Запросы за сегодня: количество, пользователи, токены |
| `/help` | Список команд |

#### Параметры ВКонтакте

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VK_BOT_ENABLED` | `true` | Выключатель бота |
| `VK_ACCESS_TOKEN` | пусто | Ключ доступа сообщества (секрет) |
| `VK_GROUP_ID` | `0` | Числовой ID сообщества |
| `VK_NOTIFY_PEER_ID` | `0` | Кому слать уведомления; `0` — только история |
| `VK_ADMIN_IDS` | пусто | Кто может использовать команды; пусто — все |
| `VK_API_VERSION` | `5.199` | Версия VK API |

#### Безопасность

- ключ читается только сервером, в браузер не передаётся;
- в логгере включено вырезание `VK_ACCESS_TOKEN`, `authorization`,
  `access_token`, `GIGACHAT_AUTH_KEY`, `LLM_API_KEY`;
- ключ не попадает в текст сообщений и в ответы API;
- при компрометации удалите ключ в кабинете сообщества — он сразу станет
  недействительным.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DATABASE_URL` | `postgresql://app:app@localhost:5433/text_app` | Подключение к PostgreSQL |
| `PORT` | `4000` | Порт API |
| `APP_URL` | `http://localhost:5173` | Базовый адрес для ссылок в письмах |
| `SESSION_SECRET` | — | Секрет для сессий (обязателен в проде) |
| `SESSION_TTL_DAYS` | `7` | Срок жизни сессии |
| `MAGIC_LINK_TTL_MINUTES` | `15` | Срок жизни ссылки входа |
| `DAILY_LIMIT` | `3` | Обработок в сутки |
| `MAX_TEXT_LENGTH` | `10000` | Лимит знаков |
| `LLM_PROVIDER` | `auto` | `auto` / `gigachat` / `openai` / `local` |
| `GIGACHAT_AUTH_KEY` | пусто | Ключ авторизации GigaChat; без него — резервный провайдер |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` | Тариф GigaChat |
| `GIGACHAT_MODEL` | `GigaChat-2` | Модель GigaChat |
| `VK_ACCESS_TOKEN` | пусто | Ключ доступа сообщества ВКонтакте (секрет) |
| `VK_GROUP_ID` | `0` | ID сообщества; `0` — бот выключен |
| `VK_NOTIFY_PEER_ID` | `0` | Кому слать уведомления; `0` — только история |
| `LLM_API_KEY` | пусто | Ключ OpenAI-совместимого API (резерв) |
| `SMTP_HOST` / `SMTP_*` | пусто | SMTP; без него ссылка пишется в лог |
| `OCR_LANG` | `rus` | Язык Tesseract |

Полный список — в `.env.example` и `server/.env.example`.

## Структура проекта

```
.
├── client/                 React SPA
│   ├── src/
│   │   ├── api/            типизированный клиент API
│   │   ├── components/     логотип, toast, 2D-иллюстрации
│   │   ├── pages/          экраны (вход, главный, результат, лимит, ошибка)
│   │   └── stores/         Zustand-стор
│   ├── Dockerfile          сборка + nginx
│   └── nginx.conf          SPA-роутинг и прокси /api
├── server/                 Express API
│   ├── certs/              корневой сертификат НУЦ Минцифры для GigaChat
│   ├── prisma/             схема и миграции
│   ├── src/
│   │   ├── middleware/     авторизация, обработка ошибок
│   │   ├── routes/         auth, simplify, upload
│   │   ├── services/       GigaChat, LLM, локальный упроститель, модерация,
│   │   │                   проверка фактов, извлечение PDF/DOCX/OCR, почта
│   │   └── utils/          токены, московские сутки
│   ├── tests/              unit + integration (Vitest + Supertest)
│   └── Dockerfile
├── docker-compose.yml
└── Docs/                   tech_spec.md, design.md, ai_prompt.md
```

## API

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/auth/request-login` | Отправить ссылку входа на email |
| `GET` | `/api/auth/verify?token=…` | Проверить ссылку, выдать cookie-сессию |
| `GET` | `/api/auth/me` | Текущий пользователь |
| `POST` | `/api/auth/logout` | Выход |
| `GET` | `/api/usage` | `{ limit, used, remaining, resetsAt }` |
| `POST` | `/api/simplify` | `{ text, level }` → `{ resultText, usage }` |
| `POST` | `/api/upload` | Файл → `{ text, kind, truncated }` |
| `GET` | `/api/health` | Проверка живости |

Коды ошибок: `401` не авторизован · `403` лимит исчерпан · `413` текст/файл
слишком большой · `415` неподдерживаемый формат · `422` запрещённый контент
или нерусский текст · `429` слишком много запросов.

## Тесты

```bash
cd server
npm run db:start        # тестам нужна БД
npm test                # 42 теста: unit + интеграционные
```

Покрыто: модерация (мат, запрещённые темы, инъекции промпта, ложные
срабатывания), сохранность фактов и структуры, локальный упроститель,
токены и границы суток по Москве, определение типов файлов, полный цикл
аутентификации, лимит 3/день, валидация входа.

## Как обеспечивается сохранность фактов

1. **Промпт** жёстко требует сохранять числа, имена, заголовки, списки и формулы.
2. **Постпроверка** (`services/facts.ts`) сравнивает оригинал и результат:
   извлекает числа и имена собственные, считает заголовки, пункты списков и
   формулы `$…$`.
3. **Повтор** — при потере выполняется вторая попытка с усиленной инструкцией;
   выбирается лучший вариант.

## Ограничения

- Только русский язык: нерусский текст отклоняется с `422`.
- Лимит считается по календарным суткам в московском времени (UTC+3).
- DOCX читается как plain text — сложное форматирование упрощается до абзацев.
- PDF со сканами без текстового слоя нужно загружать как фото (OCR).
