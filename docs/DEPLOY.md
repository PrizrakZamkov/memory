# Как выложить Gamefolk в интернет

Всё бесплатно: сайт и сервер синхронизации живут на Netlify, вход через Google. Терминал не нужен, только браузер. Займёт около 20 минут.

## 1. Netlify: сайт

1. Зайди на [netlify.com](https://www.netlify.com) и войди через GitHub.
2. **Add new site** → **Import an existing project** → **GitHub** → выбери репозиторий `gamefolk` (или `memory`).
3. Настройки сборки Netlify возьмёт из файла `netlify.toml` сам. Нажми **Deploy**.
4. Через минуту сайт откроется по адресу вида `https://что-то.netlify.app`. В **Site configuration** → **Change site name** можно поменять его, например на `gamefolk-roma.netlify.app`.

Уже на этом шаге сайт полностью работает: записи хранятся в браузере. Не будет только синхронизации, пока не сделаны шаги 2 и 3.

## 2. Google: вход

1. Открой [console.cloud.google.com](https://console.cloud.google.com), вверху слева выбор проекта → **New project**, назови `Gamefolk`, переключись на него.
2. Меню → **APIs & Services** → **OAuth consent screen** → **Get started**:
   - App name: `Gamefolk`, support email: твоя почта;
   - Audience: **External**;
   - контактная почта, согласие с правилами → **Create**.
3. Вкладка **Audience**: пока приложение в режиме тестирования, войти смогут только люди из списка **Test users**. Добавь туда себя и друзей. Когда будешь готов открыть сайт всем, нажми **Publish app**. Проверка Google для нашего входа не нужна: мы просим только `openid` и `email`.
4. Вкладка **Clients** → **Create client**:
   - Application type: **Web application**;
   - Authorized redirect URIs: `https://твой-адрес.netlify.app/api/auth/google/callback` (точно так, без слеша в конце).
5. Скопируй **Client ID** и **Client secret**. Секрет показывается один раз.

## 3. Netlify: ключи

1. В Netlify: **Site configuration** → **Environment variables** → **Add a variable**:
   - `GOOGLE_CLIENT_ID` = Client ID из шага 2;
   - `GOOGLE_CLIENT_SECRET` = Client secret из шага 2;
   - `SITE_URL` = `https://твой-адрес.netlify.app`.
2. **Deploys** → **Trigger deploy** → **Deploy site**, чтобы ключи подхватились.

Готово. В разделе «Данные» появится «Войти через Google».

## Безопасность, которую стоит включить

- Двухфакторный вход на GitHub, Netlify и Google.
- Никому не показывай `GOOGLE_CLIENT_SECRET`. Если он утёк: в Google **Clients** → **Add secret**, старый удалить, новый вставить в Netlify.
- На бесплатном тарифе Netlify 300 кредитов в месяц. Если они закончатся, сайт встанет на паузу до следующего месяца, данные не пропадут. Netlify пришлёт письмо на 50%, 75% и 100%.
- Проверь, открывается ли сайт без VPN у тебя и у пары друзей: у части российских провайдеров Netlify бывает недоступен.

## Что знает сервер

Почту из Google, список устройств, время изменений и размеры записей. Сами истории, люди, картинки и ключи приходят на сервер уже зашифрованными, прочитать их там нельзя. Подробнее: [ARCHITECTURE.md](ARCHITECTURE.md).
