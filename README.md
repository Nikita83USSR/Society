# Society

Society — социальная сеть в эстетике классического ВКонтакте 2008–2010 годов, с GitHub как системой пользовательских аккаунтов.

## Текущая реализация
- Классическая синяя шапка, левая навигация, стена профиля и центральная лента.
- GitHub OAuth через Supabase Auth (после настройки проекта).
- Автоматические профили из GitHub: login, имя, аватар, ссылка, bio.
- Посты на личной стене и общая лента.
- Вложения изображений в Supabase Storage и ссылки в постах.
- Комментарии, лайки, закладки.
- Личные сообщения между посетителями и владельцем Society.
- RLS-политики для доступа к данным.

## Публикация
GitHub Pages workflow публикует ветку `main`. Адрес: https://nikita83ussr.github.io/Society/

## Настройка Supabase (обязательно для общей работы)
1. Создайте бесплатный проект Supabase.
2. В SQL Editor выполните файл `supabase/schema.sql`.
3. В Authentication → Providers включите GitHub.
4. В настройках GitHub OAuth App укажите callback URL, который покажет Supabase в настройках GitHub provider (обычно `https://<project-ref>.supabase.co/auth/v1/callback`). В Supabase укажите Client ID и Client Secret приложения.
5. В Authentication → URL Configuration добавьте Site URL `https://nikita83ussr.github.io/Society/` и Redirect URL `https://nikita83ussr.github.io/Society/**`.
6. В `app.js` замените `SUPABASE_URL` и `SUPABASE_ANON_KEY` на Project URL и anon/public key из Supabase → Project Settings → API.
7. После этого вход через GitHub, публикации, фото, комментарии, лайки и личные сообщения будут работать с общей базой.

**Не вставляйте Service Role Key, GitHub Client Secret или PAT в публичный JavaScript.** Для браузера допустим только Supabase anon/public key; безопасность обеспечивается RLS.

## Ограничения первого этапа
- Личная стена и личные сообщения адресованы владельцу Society (GitHub login `Nikita83USSR`).
- Посетители могут публиковать записи на стене владельца, комментировать и ставить лайки.
- Личные сообщения доступны только участникам диалога.
- Для реального времени включите таблицы `posts`, `comments`, `post_likes`, `messages` в Supabase Realtime.
