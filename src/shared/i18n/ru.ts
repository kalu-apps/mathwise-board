export const ru = {
  common: {
    close: "Закрыть",
    loading: "Загрузка",
  },
  header: {
    openNavigation: "Открыть меню навигации",
    switchLightTheme: "Включить светлую тему",
    switchDarkTheme: "Включить тёмную тему",
    profile: "Профиль",
    login: "Войти",
    logout: "Выйти",
  },
  auth: {
    emailLoginTitle: "Вход",
    emailLabel: "Email",
    emailHint: "Email преподавателя: {email}",
    passwordLabel: "Пароль",
    passwordRequired: "Введите email и пароль",
    passwordLoginFailed: "Не удалось войти",
    loginButton: "Войти",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
  },
  connectivity: {
    offlineTitle: "Нет соединения с интернетом",
    offlineMessage:
      "Часть действий временно недоступна. Проверьте сеть и повторите попытку.",
    degradedTitle: "Сервис отвечает нестабильно",
    degradedMessage:
      "Сервер работает с задержкой. Повторите действие через несколько секунд.",
    retryOnlyTitle: "Действие не завершено",
    retryOnlyMessage:
      "Последняя операция завершилась с временной ошибкой. Можно повторить её сейчас.",
    actionTimeout:
      "Действие выполняется слишком долго. Проверьте сеть и повторите попытку.",
    recheck: "Проверить снова",
    rechecking: "Проверяем...",
    retryLastAction: "Повторить действие",
    retryingAction: "Повторяем...",
    retryHint: "Последнее действие: {action}",
    outboxPending: "Ожидает отправки: {count}",
    outboxRetryAt: "Следующая попытка: {time} (сбоев подряд: {attempts})",
    flushOutbox: "Отправить очередь",
    flushingOutbox: "Отправляем...",
  },
  performance: {
    degradedTitle: "Включен облегченный режим",
    degradedDescription:
      "Мы временно упростили анимации и эффекты, чтобы интерфейс работал стабильнее.",
    degradedReasonInp: "Причина: медленный отклик интерфейса (INP).",
    degradedReasonLongTask: "Причина: перегруженный главный поток (long tasks).",
    degradedReasonMixed: "Причина: повышенная нагрузка интерфейса.",
    restoreMode: "Вернуть стандартный режим",
  },
  route: {
    loadingPage: "Загрузка страницы...",
  },
  workbookInvite: {
    title: "Подключение к рабочей тетради",
    checkingInvite: "Проверяем приглашение...",
    invalidLink: "Некорректная ссылка приглашения.",
    resolveError: "Не удалось проверить ссылку приглашения.",
    ended:
      "Ссылка приглашения неактивна: коллективный урок завершен преподавателем.",
    inactive: "Ссылка приглашения недействительна.",
    sessionLabel: "Сессия",
    teacherLabel: "Преподаватель",
    guestNameLabel: "Ваше имя",
    guestNameHint: "Имя будет отображаться в списке участников урока.",
    guestNameRequired: "Введите имя для входа в урок.",
    join: "Подключиться",
    joinError: "Не удалось подключиться к коллективной сессии.",
  },
  whiteboardLaunch: {
    title: "Коллективный урок",
    subtitle:
      "После входа преподаватель автоматически попадает в рабочую доску урока.",
    lessonOpenError: "Не удалось открыть коллективный урок. Повторите попытку.",
    waitingStudent:
      "Вы вошли как участник. Чтобы продолжить, откройте действующую ссылку-приглашение от преподавателя.",
    loginAsTeacher: "Войти как преподаватель",
  },
} as const;
