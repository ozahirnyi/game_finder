# Буквальный перенос интерфейса Lovable

## Цель

Заменить текущий presentation layer в `web/` на визуально и поведенчески
идентичный frontend из `lovable-project-cf1fe460.zip`.

## Решение

Исходник Lovable считается визуальным эталоном. В Next.js переносится его
код интерфейса без редизайна или адаптации к прежней чёрно-белой системе:

- исходные `src/styles.css` и дизайн-токены;
- `AppShell`, `GameCover`, `ThemeSelector`, `ui-bits` и используемые UI
  компоненты;
- весь набор экранов: home, search, library, wishlist, deals, friends,
  Steam, PSN, profile и game detail;
- `mockData.ts` вместе с текстами, градиентными обложками, аватарами,
  статусами и примерами данных.

## Техническая адаптация

Next.js остаётся deployment runtime. Vite/TanStack-specific entry points,
generated route tree и server bootstrap не переносятся. Их единственная
адаптация — замена TanStack route declarations на Next App Router entries
при сохранении JSX, CSS-классов, разметки и клиентского поведения экрана.

Маршруты соответствуют исходнику:

- `/`, `/search`, `/library`, `/wishlist`, `/deals`, `/friends`, `/steam`,
  `/psn`, `/profile`;
- `/games/[id]` вместо `games.$gameId`.

Для совместимости с текущими ссылками `/favorites` остаётся alias на
`/library`, а `/favorites/[id]` перенаправляет на `/games/[id]`.

## Данные и границы

На этом этапе UI намеренно использует исходные mock data. Текущие FastAPI
клиент, авторизация и production API не удаляются, но не управляют
перенесёнными экранами. Подключение реальных данных — отдельная задача,
чтобы не менять внешний вид утверждённого макета.

## Проверка

- Сравнить структуру маршрутов и ключевых компонентов с распакованным
  Lovable-исходником.
- Выполнить lint, TypeScript и production build Next.js.
- Опубликовать frontend на Railway и проверить доступность публичного URL.

## Критерий готовности

Пользователь видит на Railway интерфейс, совпадающий с архивом Lovable по
навигации, палитре, компоновке, типографике, карточкам, текстам и mock
данным, а не прежний адаптированный интерфейс.
