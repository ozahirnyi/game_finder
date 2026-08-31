# Handoff: PSN, Telegram и рекомендации на главной

**Дата:** 2026-07-31  
**База:** `origin/main` на `7eea7fb`  
**Рабочая ветка:** `codex/psn-telegram-recommendations-handoff`  
**Режим:** следующий чат должен продолжить inline, без сабагентов.

## Запрос и согласованные решения

Пользователь просит:

1. Проверить оставшиеся моки и недоделанные функции.
2. Починить импорт библиотеки PlayStation.
3. Подключить **нового** Telegram-бота в production.
4. Вернуть `Recommended for you` на главную.

Подтверждённые решения:

- PSN должен принимать **XLSX, CSV и JSON**.
- Гость на месте персональных рекомендаций видит реальные популярные игры.
- Для авторизованного пользователя рекомендации персональные; без сигналов (Steam/библиотека/профиль) — честное пустое состояние, без фейковых карточек.
- Telegram-бот новый; токен, username и webhook secret хранятся исключительно в production secrets, никогда не в Git.

## Что уже установлено

### PSN: подтверждённая причина поломки

- `web/src/routes/psn-import.tsx` рекламирует и позволяет выбрать `.xlsx`, `.csv`, `.json`.
- Тот же экран содержит production-демо: `Use sample export`, `Preview empty state`, `Preview error state`.
- `app/main.py` (`POST /psn/import/preview`) жёстко отвергает всё, кроме `.xlsx`.
- `app/psn_export.py` умеет читать только Excel через `openpyxl`.

Итог: CSV/JSON, обещанные интерфейсом, гарантированно падают до парсинга. Это активный mock/несогласованность, а не проблема авторизации.

### Telegram: код есть, production-конфигурации нет

Уже реализованы:

- `/telegram/me`, `/telegram/link-url`, `/telegram/test-alert`, `/telegram/webhook/{secret}` в `app/main.py`;
- генерация deep-link и отправка сообщений в `app/telegram.py`;
- уведомления о добавлении игры и price-alert runner в `app/price_alerts.py`;
- UI подключения в профиле.

`telegram_configured()` требует одновременно `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`. При их отсутствии `POST /telegram/link-url` возвращает `configured: false`. Для реальной доставки также нужен `TELEGRAM_WEBHOOK_SECRET` и включённый `PRICE_ALERT_WATCHER_ENABLED`.

### Recommended for you: подтверждённая причина исчезновения

- Backend уже формирует `DashboardRead.recommendations` в `GET /dashboard` (`app/main.py`). Источник учитывает Steam, сохранённые игры и профиль.
- Текущая `web/src/routes/index.tsx` запрашивает только profile, library, friends, search и deals; `/dashboard` не вызывается и компонент рекомендаций не рендерится.
- Поэтому блок исчез при замене главного маршрута, а не из-за отсутствия recommendation-сервиса.

### Результат статического аудита моков

- `web/src/lib/mockData.ts` остался в репозитории, но `origin/main` не импортирует его из работающих маршрутов.
- Моки в `*.test.ts(x)` — тестовые и допустимы.
- Legacy `/dashboard` возвращает пустые `activity` и `recently_played`; это незавершённые реальные функции, но не поддельные данные. Главная сейчас `/dashboard` не использует.

## План реализации

1. Создать отдельную implementation-ветку и worktree от актуального `origin/main`.
2. Добавить общий PSN-parsing layer для XLSX, CSV и JSON: лимит размера, безопасное декодирование, поиск колонок/полей названия, нормализация, дедупликация и единые ошибки. Сохранить preview/confirm API.
3. Привести `psn-import` к реальному потоку: только выбор пользовательского файла, drop/select, понятные серверные ошибки, удаление sample/error/empty demo controls.
4. Написать сначала тесты парсера и API для трёх форматов, некорректных файлов, пустого результата и дедупликации.
5. Добавить в `web/src/lib/api.ts` типизированный `getDashboard`; на Home рендерить персональный блок для signed-in и real trending-каталог для гостя. Карточки должны открывать `/games/$gameId`; empty/error состояния не должны притворяться рекомендациями.
6. Настроить нового Telegram-бота в production:
   - создать бот через BotFather;
   - добавить `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` в secrets hosting-а;
   - включить `PRICE_ALERT_WATCHER_ENABLED=true` и разумный интервал;
   - зарегистрировать `https://<public-api>/telegram/webhook/<secret>` через Telegram `setWebhook`;
   - проверить deep-link, `/start <token>`, linked status, test alert и одну реальную доставку.
7. Добавить тесты Telegram-конфигурации/webhook и Home recommendations; выполнить backend+frontend suite, production smoke-check, PR и merge.

## Важные ограничения

- Не записывать bot token, webhook secret или production URL с секретом в документацию, git или UI-логи.
- Не возвращать демо-кнопки/синтетические данные как production-функцию.
- Текущий корневой checkout устарел; для любой работы брать `origin/main` (на момент handoff `7eea7fb`).

## Первый шаг следующего чата

Прочитать этот файл, создать implementation-worktree от `origin/main`, затем начать с failing tests для CSV/JSON PSN import. До production-настройки Telegram запросить у пользователя только созданные BotFather credentials через безопасный канал; в код и ответы их не выводить.
