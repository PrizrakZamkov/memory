# Storyline Service

Storyline — веб-приложение для хранения историй и информации о людях, с которыми они связаны.

Приложение состоит из React-клиента и Node.js API. Старый `storyline.html` сохранён в репозитории для истории, но в работе текущей версии сервиса не используется.

## Возможности

* Регистрация и вход по email и паролю.
* Сессионная авторизация через `httpOnly` cookie.
* Выход из аккаунта.
* Восстановление пароля по одноразовой ссылке.
* Изоляция данных пользователей: `story`, `person` и сессии связаны с конкретным `user_id`.
* Загрузка и хранение данных в SQLite.
* Шифрование приватных данных с помощью AES-256-GCM:

  * текста истории;
  * описания человека;
  * поля `How you met`.
* Подготовка к авторизации через Google OAuth.
* Rate limiting для authentication endpoints.
* Проверка `Origin` для запросов, которые изменяют данные.
* Ограничение размера JSON-запросов.
* Security headers.
* Хеширование паролей через `scrypt`.
* Reset-токены хранятся в базе только в виде SHA-256 hash.

## Требования

Для запуска проекта локально нужен Node.js с поддержкой встроенного `node:sqlite`.

## Локальный запуск

Установите зависимости:

```bash
npm install
```

Создайте `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Для Windows можно просто скопировать файл вручную.

### Секретные ключи

Сгенерируйте ключ шифрования приложения:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

И секрет для сессий:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Добавьте полученные значения в `.env`:

```env
APP_ENCRYPTION_KEY=...
SESSION_SECRET=...
```

**Не коммитьте `.env` и не храните `APP_ENCRYPTION_KEY` вместе с резервными копиями базы данных.**

### Запуск в development

```bash
npm run dev
```

После запуска:

* приложение: `http://127.0.0.1:3000`
* API: `http://127.0.0.1:4000`

## Google OAuth

Поддержка Google OAuth подготовлена, но для работы в production нужно создать OAuth Client в Google Cloud Console.

Укажите:

* **Authorized JavaScript origin:** `https://your-domain.com`
* **Authorized redirect URI:** `https://your-domain.com/api/auth/google/callback`

И добавьте настройки в `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
PUBLIC_APP_URL=https://your-domain.com
APP_ORIGIN=https://your-domain.com
```

## Production

Соберите приложение:

```bash
npm run build
```

Запустите production-сервер:

```bash
NODE_ENV=production npm start
```

В Windows PowerShell:

```powershell
$env:NODE_ENV="production"; npm start
```

Для production рекомендуется не выставлять Node.js API напрямую в интернет. Типичная схема выглядит так:

```text
Internet
   │
   ▼
Cloudflare
   │
   ▼
Caddy / Nginx
   │
   ▼
Node.js API
127.0.0.1:4000
   │
   ▼
SQLite
```

Приложение можно разместить на VPS или PaaS, например Fly.io, Render, Railway, Hetzner или DigitalOcean.

### Reverse proxy

Например, с Caddy:

```caddyfile
your-domain.com {
  encode gzip zstd
  reverse_proxy 127.0.0.1:4000
}
```

HTTPS для production обязателен.

Базовые правила:

* Node.js должен слушать только `127.0.0.1:4000`.
* Внешний трафик должен идти через HTTPS.
* `.env` и база данных не должны попадать в Git.
* Каталог `data/` нужно регулярно резервировать.
* Прямой доступ к порту Node.js нужно закрыть firewall-ом.

## Безопасность

В приложении уже предусмотрены несколько базовых мер защиты:

* `httpOnly` cookies;
* `SameSite=Strict`;
* `Secure` cookies в production;
* проверка `Origin` для state-changing запросов;
* rate limiting для auth endpoints;
* ограничение JSON body до 128 KB;
* request timeout;
* security headers;
* `scrypt` для хеширования паролей;
* хранение reset-токенов только в виде SHA-256 hash;
* AES-256-GCM для приватных полей;
* привязка пользовательских данных к `user_id`.

Это не означает, что сервис невозможно взломать. Безопасность — это набор мер, а не абсолютная гарантия. На production также важно правильно настроить инфраструктуру и регулярно обновлять зависимости.

### Что сделать перед production

Перед публичным запуском рекомендуется:

1. Поставить Cloudflare перед доменом.
2. Включить WAF и DDoS protection.
3. Принудительно использовать HTTPS.
4. Закрыть внешний доступ к Node.js-порту через firewall.
5. Хранить `.env` только на сервере.
6. Хранить `APP_ENCRYPTION_KEY` отдельно от backup базы данных.
7. Настроить автоматические backups.
8. Регулярно обновлять Node.js и npm-зависимости.
9. Настроить SMTP-провайдера для отправки писем восстановления пароля.
10. Добавить мониторинг логов и уведомления об ошибках.

Если используется Nginx, на уровне reverse proxy также можно добавить дополнительные ограничения:

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
client_max_body_size 128k;
```

## База данных

Сейчас используется SQLite через встроенный `node:sqlite`.

Для небольшого и умеренного количества пользователей этого достаточно и не требует отдельного database-сервера.

Если проект будет существенно расти, имеет смысл перейти на PostgreSQL. Это особенно актуально для большого количества одновременных запросов, нескольких экземпляров приложения и более сложной инфраструктуры.

## Backups

База данных содержит пользовательские данные, поэтому backups должны быть регулярными.

При этом ключ шифрования нельзя хранить рядом с backup базы:

```text
Database backup
       +
APP_ENCRYPTION_KEY
       =
скомпрометированные зашифрованные данные могут стать доступными
```

Ключ должен храниться отдельно и иметь собственную политику резервного копирования и восстановления.

## Development

Установка зависимостей:

```bash
npm install
```

Запуск development-окружения:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Production start:

```bash
npm start
```

## License

Лицензия проекта пока не указана.
