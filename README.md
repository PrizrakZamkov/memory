# Storyline Service

Новая версия приложения находится в React + Node API. Старый `storyline.html` оставлен нетронутым и больше не нужен для работы сервиса.

## Что реализовано

- Приватные аккаунты: каждый `story`, `person` и session привязаны к `user_id`.
- Регистрация по email/password.
- Вход/выход через httpOnly session cookie.
- Восстановление пароля через одноразовый token.
- Заготовка Google OAuth.
- SQLite база через встроенный `node:sqlite`.
- Шифрование приватных полей AES-256-GCM:
  - текст истории;
  - описание человека;
  - поле `How you met`.
- Rate limiting на auth endpoints.
- Проверка Origin для state-changing запросов.
- Ограничение размера JSON body.
- Security headers.

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` из `.env.example`.

3. Сгенерировать ключи:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Первый вставить в `APP_ENCRYPTION_KEY`, второй в `SESSION_SECRET`.

4. Запустить dev-режим:

```bash
npm run dev
```

Открыть:

```text
http://127.0.0.1:3000
```

API работает на:

```text
http://127.0.0.1:4000
```

## Google OAuth

В Google Cloud Console создать OAuth Client:

- Authorized JavaScript origin: `https://your-domain.com`
- Authorized redirect URI: `https://your-domain.com/api/auth/google/callback`

В `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
PUBLIC_APP_URL=https://your-domain.com
APP_ORIGIN=https://your-domain.com
```

## Сборка

```bash
npm run build
```

Production запуск:

```bash
NODE_ENV=production npm start
```

На Windows PowerShell:

```powershell
$env:NODE_ENV="production"; npm start
```

## Публикация в интернете

Рекомендуемая схема:

1. VPS или PaaS: Fly.io, Render, Railway, Hetzner, DigitalOcean.
2. Reverse proxy: Caddy или Nginx.
3. HTTPS обязательно.
4. Node-сервер слушает только `127.0.0.1:4000`.
5. Caddy/Nginx принимает внешний HTTPS и проксирует на Node.
6. БД и `.env` не коммитить.
7. Делать автоматические backups папки `data/`.

Пример Caddy:

```caddyfile
your-domain.com {
  encode gzip zstd
  reverse_proxy 127.0.0.1:4000
}
```

## Защита от DDoS и кражи данных

То, что уже есть в коде:

- auth rate limiting;
- body size limit 128 KB;
- request timeout;
- security headers;
- httpOnly cookies;
- SameSite Strict cookies;
- Secure cookies в production;
- проверка Origin;
- password hashing через `scrypt`;
- reset tokens хранятся только как SHA-256 hash;
- приватные поля шифруются перед записью в БД.

Что обязательно сделать на production:

- поставить Cloudflare перед доменом;
- включить Cloudflare WAF и DDoS protection;
- включить HTTPS only;
- закрыть прямой доступ к Node-порту firewall-ом;
- хранить `.env` только на сервере;
- хранить `APP_ENCRYPTION_KEY` отдельно от backup БД;
- регулярно обновлять Node и npm-пакеты;
- включить server snapshots/backups;
- добавить SMTP-провайдера для реальной отправки reset email;
- добавить мониторинг логов и алерты;
- добавить лимиты на reverse proxy:

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
client_max_body_size 128k;
```

Важно: абсолютной гарантии “НИКОГДА не украдут” не существует ни у одного сервиса. Но текущая архитектура снижает риск: данные приватны по `user_id`, самые чувствительные поля зашифрованы, cookies защищены, пароли не хранятся в открытом виде, а production-инструкция закрывает основные сетевые риски.

## Что стоит добавить следующим этапом

- Подтверждение email.
- Реальную SMTP-отправку reset links.
- 2FA/TOTP.
- Экспорт всех данных пользователя.
- Удаление аккаунта с полной очисткой данных.
- Audit log для входов и смены пароля.
- PostgreSQL вместо SQLite, если будет много пользователей.
