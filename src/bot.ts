import { Context, Telegraf } from 'telegraf';
import "dotenv/config";

const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');
const REGISTER_URL = 'http://localhost:3000/api/telegram/register'
const LOGIN_URL = 'http://localhost:3000/api/telegram/login'
const BOARDS_URL = 'http://localhost:3000/api/boards'

type BoardMemberDto = {
  userId: number;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  user: {
    id: number;
    name: string;
  };
  isCurrentUser: boolean;
};

export type TaskDto = {
  id?: number;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdBy?: {
    id: number;
    name: string;
  };
};

const create_task_data = new Map<number, {
  step: 'board_select' | 'title' | 'description' | 'confirm';
  boardId?: string;
  title?: string;
  description?: string;
}>();

const manage_member_data = new Map<number, {
  step: 'board_select' | 'action_select' | 'name' | 'role' | 'confirm';
  boardId?: string;
  action?: 'add' | 'remove';
  name?: string;
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
}>();


const task_manager_data = new Map<number, {
  step: 
    | 'board_select'
    | 'task_select'
    | 'action_select'
    | 'status_select'
    | 'confirm'
    | 'title_create'
    | 'description_create'
    | 'confirm_create';
  boardId?: string;
  tasks?: TaskDto[];
  taskIndex?: number;
  action?: 'delete' | 'update' | 'create';
  newStatus?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  title?: string;
  description?: string | undefined;
}>();





//////////////////////////////////
const create_board_data = new Map<number, {
  step: 'name_create_board' | 'description_create_board' | 'confirm_create_board';
  name?: string;
  description?: string;
}>();
//////////////////////////////////


const reg_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


const log_data = new Map<number, {step: 'name_log' | 'password_log' | 'confirm_log';
  name?:string;
  password?:string;
}>();

/////////////////////////////////////
type UserRole = 'admin' | 'editor' | 'viewer';
/////////////////////////////////////


const loggedInUsers = new Map<number, {
  name?:string;
  token?: string;
  /////////////////////////////////////
  role?: UserRole;
  /////////////////////////////////////
}>();

const userBoardsData = new Map<number, Map<number, {id: string}>>();
const board_number_choose = new Map<number, {step: 'number'; number?:string;}>();
const board_number_choose_delete = new Map<number, {step: 'number_delete'; number?:string;}>();

// команда /start
bot.start(async (ctx) => {
  await ctx.reply('Привет! Это - бот для взаимодействия с досками задач! Нажмите /help для просмотра возможных команд');
});


// команда /help
bot.help(async (ctx) => {
  await ctx.reply('Доступные команды:\n/start - начать\n/help - помощь\n/registration - регистрация\n/log_in - вход\n/show_boards - посмотреть список досок\n' +
                  '/open_board - для просмотра доски\n/create_board - создать доску\n/delete_board - удалить доску\n/create_task - создать задачу\n/manage_members - управлять участниками\n/manage_tasks - управлять существующими задачами\n/logout - выход'
  );
});


// команда /registration
bot.command('registration', async (ctx) => {
  const user_id = ctx.from.id;

  if (loggedInUsers.has(user_id)) {
    return ctx.reply('Вы уже вошли в систему. Сначала выйдите через /logout.');
  }
  reg_data.set(user_id, {step: 'name'});
  await ctx.reply('Регистрация:\n 1. Введите ваше имя: ');
});


// команда /log_in
bot.command('log_in', async (ctx) => {
  const user_id = ctx.from.id;
    if (loggedInUsers.has(user_id)) {
    return ctx.reply('Вы уже вошли в систему. Сначала выйдите через /logout.');
  }
  log_data.set(user_id, {step: 'name_log'});
  await ctx.reply('Вход:\n 1. Введите ваше имя: ');
});

bot.command('logout', async (ctx) => {
  const user_id = ctx.from.id;

  if (!loggedInUsers.has(user_id)) {
    return ctx.reply('Вы ещё не вошли в систему.');
  }

  loggedInUsers.delete(user_id);

  // очищаем все временные данные сессий
  create_task_data.delete(user_id);
  task_manager_data.delete(user_id);
  manage_member_data.delete(user_id);
  create_board_data.delete(user_id);
  board_number_choose.delete(user_id);

  await ctx.reply('Вы успешно вышли из системы.');
});


//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// команда /create_board - создать новую доску
bot.command('create_board', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  
  if (!session) {
    return ctx.reply('Сначала войдите: /log_in');
  }
  
  create_board_data.set(user_id, { step: 'name_create_board' });
  
  await ctx.reply(
    'Создание новой доски\n\n' + '1. Введите название доски:'
  );
});
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

// команда /delete_board - удалить доску
bot.command('delete_board', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) {
    return ctx.reply('Войдите /log_in или зарегистрируйтесь /registration для просмотра');
  }

  try {
    const response = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return ctx.reply(`Ошибка: ${response.status} ${text}`);
    }

    type Board = { id: string; name: string };
    const boards = (await response.json()) as Board[];

    if (boards.length === 0) {
      return ctx.reply('У вас пока нет досок.');
    }

    let message = `Ваши доски (${boards.length}):\n\n`;
    const userBoards = new Map<number, {id: string}>();

    boards.forEach((board, index) => {
      const boardNumber = index + 1;
      message += `${boardNumber}. ${board.name}\n`;
      userBoards.set(boardNumber, {id: board.id});
    });

    userBoardsData.set(user_id, userBoards);
    board_number_choose_delete.set(user_id, {step:'number_delete'});

    return ctx.reply(message + `Выберите номер доски, которую хотите удалить (1 - ${boards.length}): `);
  } 
  catch (error) {
    console.error("Error fetching boards:", error);
    return ctx.reply('Произошла ошибка при получении досок.');
  }
});

// команда /show_boards
bot.command('show_boards', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) {
    return ctx.reply('Войдите /log_in или зарегистрируйтесь /registration для просмотра');
  }

  try {
    const response = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return ctx.reply(`Ошибка: ${response.status} ${text}`);
    }

    type Board = { id: string; name: string };
    const boards = (await response.json()) as Board[];

    if (boards.length === 0) {
      return ctx.reply('У вас пока нет досок.');
    }

    let message = `Ваши доски (${boards.length}):\n\n`;

    boards.forEach((board, index) => {
      message += `${index + 1}. ${board.name}\n`;
    });
    return ctx.reply(message);
  } catch (error) {
    console.error("Error fetching boards:", error);
    return ctx.reply('Произошла ошибка при получении досок.');
  }
});



// команда /open_board
bot.command('open_board', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) {
    return ctx.reply('Войдите /log_in или зарегистрируйтесь /registration для просмотра');
  }

  try {
    const response = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return ctx.reply(`Ошибка: ${response.status} ${text}`);
    }

    type Board = { id: string; name: string };
    const boards = (await response.json()) as Board[];

    if (boards.length === 0) {
      return ctx.reply('У вас пока нет досок.');
    }

    let message = `Ваши доски (${boards.length}):\n\n`;
    const userBoards = new Map<number, {id: string}>();

    boards.forEach((board, index) => {
      const boardNumber = index + 1;
      message += `${boardNumber}. ${board.name}\n`;
      userBoards.set(boardNumber, {id: board.id});
    });

    userBoardsData.set(user_id, userBoards);
    board_number_choose.set(user_id, {step:'number'});

    return ctx.reply(message + `Выберите номер доски, которую хотите открыть (1 - ${boards.length}): `);
  } 
  catch (error) {
    console.error("Error fetching boards:", error);
    return ctx.reply('Произошла ошибка при получении досок.');
  }
});
/*
bot.command('create_task', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);

  if (!session?.token) {
    return ctx.reply('Сначала войдите: /log_in');
  }

  try {
    // Получаем список досок
    const response = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
    });

    if (!response.ok) {
      return ctx.reply('Ошибка при получении досок.');
    }

    const boards = (await response.json()) as { id: string; name: string }[];
    if (boards.length === 0) {
      return ctx.reply('У вас пока нет досок. Создайте доску: /create_board');
    }

    let message = `Выберите доску для новой задачи:\n`;
    const userBoards = new Map<number, { id: string }>();
    boards.forEach((board, i) => {
      message += `${i + 1}. ${board.name}\n`;
      userBoards.set(i + 1, { id: board.id });
    });

    userBoardsData.set(user_id, userBoards);
    create_task_data.set(user_id, { step: 'board_select' });

    await ctx.reply(message + `\nВведите номер доски (1 - ${boards.length}):`);

  } catch (error) {
    console.error('Error fetching boards for task creation:', error);
    await ctx.reply('Произошла ошибка при получении досок.');
  }
});*/

// Создание новой задачи
bot.command('create_task', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) return ctx.reply('Сначала войдите: /log_in');

  try {
    const res = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    const boards = await res.json() as { id: string; name: string }[];
    if (!boards.length) return ctx.reply('У вас нет досок.');

    const userBoards = new Map<number, { id: string }>();
    let msg = 'Выберите доску для новой задачи:\n';
    boards.forEach((b, i) => {
      msg += `${i + 1}. ${b.name}\n`;
      userBoards.set(i + 1, { id: b.id });
    });

    userBoardsData.set(user_id, userBoards);
    task_manager_data.set(user_id, { step: 'board_select', action: 'create' });

    await ctx.reply(msg + `\nВведите номер доски:`);

  } catch (err) {
    console.error(err);
    await ctx.reply('Ошибка при получении досок.');
  }
});

// Управление существующими задачами
bot.command('manage_tasks', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) return ctx.reply('Сначала войдите: /log_in');

  try {
    const res = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    const boards = await res.json() as { id: string; name: string }[];
    if (!boards.length) return ctx.reply('У вас нет досок.');

    const userBoards = new Map<number, { id: string }>();
    let msg = 'Выберите доску для управления задачами:\n';
    boards.forEach((b, i) => {
      msg += `${i + 1}. ${b.name}\n`;
      userBoards.set(i + 1, { id: b.id });
    });

    userBoardsData.set(user_id, userBoards);
    task_manager_data.set(user_id, { step: 'board_select', action: 'update' });

    await ctx.reply(msg + `\nВведите номер доски:`);

  } catch (err) {
    console.error(err);
    await ctx.reply('Ошибка при получении досок.');
  }
});


bot.command('manage_members', async (ctx) => {
  const user_id = ctx.from.id;
  const session = loggedInUsers.get(user_id);
  if (!session?.token) return ctx.reply('Сначала войдите: /log_in');

  try {
    // Получаем список досок
    const response = await fetch(BOARDS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${session.token}` }
    });

    if (!response.ok) return ctx.reply('Ошибка при получении досок.');

    const boards = await response.json() as { id: string; name: string }[];
    if (boards.length === 0) return ctx.reply('У вас пока нет досок.');

    let message = `Выберите доску для управления участниками:\n`;
    const userBoards = new Map<number, { id: string }>();
    boards.forEach((board, i) => {
      message += `${i + 1}. ${board.name}\n`;
      userBoards.set(i + 1, { id: board.id });
    });

    userBoardsData.set(user_id, userBoards);
    manage_member_data.set(user_id, { step: 'board_select' });

    await ctx.reply(message + `\nВведите номер доски (1 - ${boards.length}):`);

  } catch (error) {
    console.error('Error fetching boards for member management:', error);
    await ctx.reply('Произошла ошибка при получении досок.');
  }
});



bot.on('text', async (ctx) => {
  const user_id = ctx.from.id;
  const user_reg_data = reg_data.get(user_id);
  const text = ctx.message.text.trim();
  const create_board = create_board_data.get(user_id);
  if (create_board) 
  {
    switch (create_board.step) {
      case 'name_create_board':
        create_board.name = text;
        create_board.step = 'confirm_create_board';
        await ctx.reply(
          'Название принято!\n' +
          'Проверьте данные новой доски:\n\n' +
          `Название: ${create_board.name}\n\n` +
          'Всё верно? (да/нет)'
        );
        break;
            
      case 'confirm_create_board':
        const answer = text.toLowerCase();
            
        if (answer === 'да') {
          await ctx.reply('Создаю доску...');
              
          try {
            const session = loggedInUsers.get(user_id);
            if (!session?.token) {
              await ctx.reply('Сессия истекла. Войдите снова: /log_in');
              create_board_data.delete(user_id);
              return;
            }
                
            const response = await fetch(BOARDS_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
              },
              body: JSON.stringify({
                name: create_board.name,
                description: create_board.description || null
              })
            });
                
            if (response.ok) {
              const result = await response.json() as { id?: string; name?: string; message?: string };
                
              await ctx.reply(
                `Доска успешно создана!\n\n` +
                `Название: ${result.name || create_board.name}\n` +
                `Используйте /open_board чтобы открыть созданную доску.`
              );
            } else {
              const errorText = await response.text();
              console.error('Ошибка создания доски:', response.status, errorText);
                
              if (response.status === 409) {
                await ctx.reply('Доска с таким названием уже существует.');
              } else if (response.status === 401) {
                await ctx.reply('Ошибка авторизации. Войдите снова: /log_in');
              } else {
                await ctx.reply(`Ошибка создания доски (код ${response.status})`);
              }
            }
                
          } 
          catch (error) 
          {
            console.error('Ошибка при создании доски:', error);
            await ctx.reply('Произошла ошибка при создании доски.');
          }
              
        } 
        else if (answer === 'нет') 
        {
          await ctx.reply('Создание доски отменено. Используйте /create_board чтобы начать заново.');
        } 
        else {
          await ctx.reply('Пожалуйста, ответьте "да" или "нет":');
          return; 
        }
        
        create_board_data.delete(user_id);
        break;
    }
    
  }

  const taskSession = task_manager_data.get(user_id);
  if (taskSession) {
    const session = loggedInUsers.get(user_id);
    if (!session?.token) {
      await ctx.reply('Сессия истекла. Войдите снова: /log_in');
      create_task_data.delete(user_id);
      return;
    }

    switch (taskSession.step) {
      
    // Выбор доски (для создания и управления)
    case 'board_select':
  const userBoards = userBoardsData.get(user_id);
  if (!userBoards) { task_manager_data.delete(user_id); return ctx.reply('Доски не найдены'); }

  const boardNumber = parseInt(text);
  if (isNaN(boardNumber) || !userBoards.has(boardNumber))
    return ctx.reply(`Введите корректный номер доски (1 - ${userBoards.size})`);

  taskSession.boardId = userBoards.get(boardNumber)!.id;

  if (taskSession.action === 'create') {
    taskSession.step = 'title_create';
    return ctx.reply('Введите название новой задачи:');
  }

  if (taskSession.action === 'update') {
    // загрузка задач для выбранной доски
    const tasksRes = await fetch(`${BOARDS_URL}/${taskSession.boardId}/tasks`, {
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    if (!tasksRes.ok) {
      task_manager_data.delete(user_id);
      return ctx.reply('Ошибка при загрузке задач.');
    }

    const tasks = await tasksRes.json() as TaskDto[];
    if (!tasks.length) {
      task_manager_data.delete(user_id);
      return ctx.reply('На доске нет задач.');
    }

    taskSession.tasks = tasks;
    taskSession.step = 'task_select';

    let msg = 'Выберите задачу для управления:\n';
    tasks.forEach((t, i) => msg += `${i + 1}. ${t.title} [${t.status}]\n`);
    return ctx.reply(msg);
  }


    // Создание задачи — название
    case 'title_create':
      taskSession.title = text;
      taskSession.step = 'description_create';
      return ctx.reply('Введите описание задачи:');

    // Создание задачи — описание
    case 'description_create':
      taskSession.description = text || undefined;
      taskSession.step = 'confirm_create';
      return ctx.reply(`Создать задачу?\nНазвание: ${taskSession.title}\nОписание: ${taskSession.description || 'нет'}\n(да/нет)`);

    // Подтверждение создания
    case 'confirm_create':
      if (text.toLowerCase() !== 'да') {
        task_manager_data.delete(user_id);
        return ctx.reply('Создание задачи отменено.');
      }
      try {
        const res = await fetch(`${BOARDS_URL}/${taskSession.boardId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
          body: JSON.stringify({ title: taskSession.title, description: taskSession.description || null })
        });
        if (!res.ok) return ctx.reply(`Ошибка при создании задачи: ${await res.text()}`);
        const task = await res.json() as TaskDto;
        await ctx.reply(`Задача создана: ${task.title}`);
      } catch (err) {
        console.error(err);
        await ctx.reply('Ошибка при создании задачи.');
      }
      task_manager_data.delete(user_id);
      userBoardsData.delete(user_id);
      return;

    // Управление задачами — выбор задачи
    case 'task_select':
      const taskIndex = parseInt(text) - 1;
      if (!taskSession.tasks || taskIndex < 0 || taskIndex >= taskSession.tasks.length)
        return ctx.reply(`Введите корректный номер задачи (1 - ${taskSession.tasks?.length})`);
      taskSession.taskIndex = taskIndex;
      taskSession.step = 'action_select';
      return ctx.reply('Введите действие: "delete" для удаления или "update" для обновления статуса:');

    // Управление задачами — выбор действия
    case 'action_select':
      const action = text.toLowerCase();
      if (action !== 'delete' && action !== 'update') return ctx.reply('Введите "delete" или "update".');
      taskSession.action = action as 'delete' | 'update';
      if (action === 'update') {
        taskSession.step = 'status_select';
        return ctx.reply('Введите новый статус задачи: "TODO", "IN_PROGRESS", "DONE":');
      } else {
        taskSession.step = 'confirm';
        const task = taskSession.tasks![taskSession.taskIndex!];
        return ctx.reply(`Вы уверены, что хотите удалить задачу "${task.title}"? (да/нет)`);
      }

    // Управление задачами — выбор нового статуса
    case 'status_select':
      const status = text.toUpperCase() as 'TODO' | 'IN_PROGRESS' | 'DONE';
      if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status))
        return ctx.reply('Введите корректный статус: "TODO", "IN_PROGRESS", "DONE".');
      taskSession.newStatus = status;
      taskSession.step = 'confirm';
      const task = taskSession.tasks![taskSession.taskIndex!];
      return ctx.reply(`Подтвердите обновление статуса задачи "${task.title}" на "${status}"? (да/нет)`);

    // Подтверждение удаления или обновления
    case 'confirm':
      if (text.toLowerCase() !== 'да') {
        task_manager_data.delete(user_id);
        return ctx.reply('Действие отменено.');
      }

      const selectedTask = taskSession.tasks![taskSession.taskIndex!];

      try {
        if (taskSession.action === 'delete') {
          const res = await fetch(`http://localhost:3000/api/tasks/${selectedTask.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token}` }
          });
          if (res.ok) await ctx.reply(`Задача "${selectedTask.title}" удалена.`);
          else await ctx.reply(`Ошибка при удалении задачи: ${await res.text()}`);
        } else if (taskSession.action === 'update') {
          const res = await fetch(`http://localhost:3000/api/tasks/${selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
            body: JSON.stringify({ status: taskSession.newStatus })
          });
          if (res.ok) {
            const updatedTask = await res.json() as TaskDto;
            await ctx.reply(`Статус задачи "${updatedTask.title}" обновлён на [${updatedTask.status}].`);
          } else await ctx.reply(`Ошибка при обновлении задачи: ${await res.text()}`);
        }
      } catch (err) {
        console.error('Error managing task:', err);
        await ctx.reply('Произошла ошибка при выполнении действия.');
      }

      task_manager_data.delete(user_id);
      userBoardsData.delete(user_id);
      return;
  }
}

const memberSession = manage_member_data.get(user_id);
if (memberSession) {
  const session = loggedInUsers.get(user_id);
  const userBoards = userBoardsData.get(user_id);

  if (!session?.token) {
    manage_member_data.delete(user_id);
    return ctx.reply('Сессия истекла. Войдите снова: /log_in');
  }

  switch (memberSession.step) {

    /** 1. Выбор доски */
    case 'board_select': {
      if (!userBoards) {
        manage_member_data.delete(user_id);
        return ctx.reply('Доски не найдены.');
      }

      const boardNumber = parseInt(text);
      if (isNaN(boardNumber) || !userBoards.has(boardNumber)) {
        return ctx.reply(`Введите корректный номер доски (1 - ${userBoards.size})`);
      }

      memberSession.boardId = userBoards.get(boardNumber)!.id;
      memberSession.step = 'action_select';

      return ctx.reply('Введите действие:\nadd — добавить участника\nremove — удалить участника');
    }

    /** 2. Выбор действия */
    case 'action_select': {
      const action = text.toLowerCase();
      if (action !== 'add' && action !== 'remove') {
        return ctx.reply('Введите "add" или "remove".');
      }

      memberSession.action = action;
      memberSession.step = 'name';

      return ctx.reply('Введите имя пользователя:');
    }

    /** 3. Имя пользователя */
    case 'name': {
      memberSession.name = text;

      if (memberSession.action === 'add') {
        memberSession.step = 'role';
        return ctx.reply('Введите роль: ADMIN, EDITOR или VIEWER');
      }

      memberSession.step = 'confirm';
      return ctx.reply(
        `Удалить пользователя "${memberSession.name}" из доски?\n(да/нет)`
      );
    }

    /** 4. Роль (только для add) */
    case 'role': {
      const role = text.toUpperCase();
      if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
        return ctx.reply('Роль должна быть: ADMIN, EDITOR или VIEWER');
      }

      memberSession.role = role as 'ADMIN' | 'EDITOR' | 'VIEWER';
      memberSession.step = 'confirm';

      return ctx.reply(
        `Добавить пользователя "${memberSession.name}" с ролью ${memberSession.role}?\n(да/нет)`
      );
    }

    /** 5. Подтверждение */
    case 'confirm': {
      if (text.toLowerCase() !== 'да') {
        manage_member_data.delete(user_id);
        userBoardsData.delete(user_id);
        return ctx.reply('Операция отменена.');
      }

      try {
        if (memberSession.action === 'add') {
          const res = await fetch(
            `${BOARDS_URL}/${memberSession.boardId}/members`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
              },
              body: JSON.stringify({
                name: memberSession.name,
                role: memberSession.role
              })
            }
          );

          if (!res.ok) {
            return ctx.reply(`Ошибка добавления участника: ${await res.text()}`);
          }

          await ctx.reply(
            `Пользователь "${memberSession.name}" добавлен с ролью ${memberSession.role}.`
          );
        }

        if (memberSession.action === 'remove') {
          const res = await fetch(
            `${BOARDS_URL}/${memberSession.boardId}/members/${encodeURIComponent(memberSession.name!)}`,
            {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${session.token}` }
            }
          );

          if (!res.ok) {
            return ctx.reply(`Ошибка удаления участника: ${await res.text()}`);
          }

          await ctx.reply(`Пользователь "${memberSession.name}" удалён из доски.`);
        }

      } catch (err) {
        console.error('manage_members error:', err);
        await ctx.reply('Произошла ошибка при управлении участниками.');
      }

      manage_member_data.delete(user_id);
      userBoardsData.delete(user_id);
      return;
    }
  }
}


  
  if (user_reg_data)
  {
    switch(user_reg_data.step)
    {
      case 'name':
        user_reg_data.name = text;
        user_reg_data.step = 'password';
        await ctx.reply('Имя принято\n2. Придумайте пароль:');
        break;
      
      case 'password':
        user_reg_data.password = text;
        user_reg_data.step = 'confirm';
        await ctx.reply('Пароль принят');
        await ctx.reply('Ваши данные:\n' + `Имя: ${user_reg_data.name}\n` + `Пароль: ${user_reg_data.password}\n` + 'Всё верно?(да/нет)');
        break;

      case 'confirm':
        const answer = text.toLowerCase();
        if (answer === 'да')
        {
          await ctx.reply('Регистрация...');
          try
          {
            const response = await fetch(REGISTER_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: user_reg_data.name,
                password: user_reg_data.password
              })
            });

            if (response.ok)
            {
              // const result = await response.json();
              await ctx.reply('Регистрация завершена успешно!');
              loggedInUsers.set(user_id, {name: user_reg_data.name})
            }
            else
            {
              await ctx.reply('Ошибка регистрации!');
            }
          }
          catch(error)
          {
            console.error("Registration error: ", error);
          }
        }
        else if (answer === 'нет')
        {
          await ctx.reply('Ошибка регистрации! Попробуйте заново');
        }
        else
        {
          await ctx.reply('Введите да или нет');
          return;
        }
        reg_data.delete(user_id);
        break;
    }
  }

  const user_log_data = log_data.get(user_id);
  if (user_log_data)
  {
    switch(user_log_data.step)
    {
      case 'name_log':
        user_log_data.name = text;
        user_log_data.step = 'password_log';
        await ctx.reply('Имя принято\n2. Введите ваш пароль:');
        break;

      case 'password_log':
        user_log_data.password = text;
        user_log_data.step = 'confirm_log';
        await ctx.reply('Пароль принят');
        await ctx.reply('Введите ваши данные:\n' + `Имя: ${user_log_data.name}\n` + `Пароль: ${user_log_data.password}\n` + 'Всё верно?(да/нет)');
        break;

      case 'confirm_log':
        const answer = text.toLowerCase();
        if (answer === 'да')
          {
            await ctx.reply('Вход...');
            try
            {
              const response = await fetch(LOGIN_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: user_log_data.name,
                  password: user_log_data.password,
                  telegramId: ctx.from.id
                })
              });
  
              // if (response.ok)
              // {
              //   // const result = (await response.json()) as { telegramToken: string };
              //   /////////////////////////////////////////
              //   /////////////////////////////////////////
              //   const result = await response.json() as { 
              //     id?: number; 
              //     name?: string; 
              //     token?: string;
              //     role?: UserRole; // API должен возвращать роль
              //   };
              //   /////////////////////////////////////////
              //   /////////////////////////////////////////
              //   await ctx.reply('Вход завершен успешно!');
              //   // loggedInUsers.set(user_id, { name: user_log_data.name, token: result.telegramToken });

              //   /////////////////////////////////////////
              //   /////////////////////////////////////////
              //   loggedInUsers.set(user_id, {
              //     name: user_log_data.name,
              //     token: result.token || '',
              //     role: result.role || 'viewer' // по умолчанию viewer
              //   });
              //   /////////////////////////////////////////
              //   /////////////////////////////////////////
              // }
              if (response.ok) {
                const responseText = await response.text();
                console.log('Login response text:', responseText);
                
                let result;
                try {
                  result = JSON.parse(responseText);
                  console.log('Parsed login result:', result);
                } catch (e) {
                  console.error('Failed to parse login response as JSON:', e);
                  await ctx.reply('Ошибка: неверный формат ответа от сервера');
                  return;
                }
                
                const token = result.token || result.accessToken || result.telegramToken || result.jwt;
                console.log('Extracted token:', token ? token.substring(0, 20) + '...' : 'NOT FOUND');
                
                if (!token) {
                  console.log('Full response object:', result);
                  await ctx.reply('Ошибка: токен не найден в ответе сервера');
                  return;
                }
                
                await ctx.reply('Вход завершен успешно!');
                
                loggedInUsers.set(user_id, {
                  name: user_log_data.name,
                  token: token,
                  role: result.role || 'viewer'
                });
                
                console.log('Session saved for user:', user_id, 'Token set:', !!token);
              }
              else
              {
                await ctx.reply('Ошибка входа!');
              }
            }
            catch(error)
            {
              console.error("Login error: ", error);
            }
          }
          else if (answer === 'нет')
          {
            await ctx.reply('Ошибка входа! Попробуйте заново');
          }
          else
          {
            await ctx.reply('Введите да или нет');
            return;
          }
          log_data.delete(user_id);
          break;
    }
  }

  const board_number = board_number_choose.get(user_id);
  if (board_number)
  {
    switch (board_number.step)
    {
      case 'number':
        const userBoards = userBoardsData.get(user_id);
        if (!userBoards) {
          await ctx.reply('Данные о досках не найдены. Попробуйте снова: /open_board');
          board_number_choose.delete(user_id);
          return;
        }
        const selectedNumber = parseInt(text);
        const session = loggedInUsers.get(user_id);
      
        if (!session?.token) {
          await ctx.reply('Сессия истекла. Войдите снова: /log_in');
          board_number_choose.delete(user_id);
          return;
        }

        if (isNaN(selectedNumber)) {
          await ctx.reply('Пожалуйста, введите номер доски цифрами.');
          return;
        }

        if (selectedNumber < 1 || selectedNumber > userBoards.size) {
          await ctx.reply(`Номер доски должен быть от 1 до ${userBoards.size}. Попробуйте снова:`);
          return;
        }
        const selectedBoard = userBoards.get(selectedNumber);
        if (!selectedBoard) {
          await ctx.reply('Ошибка: не удалось найти выбранную доску.');
          board_number_choose.delete(user_id);
          userBoardsData.delete(user_id);
          return;
        }
      
        board_number_choose.delete(user_id);
        userBoardsData.delete(user_id);

        try {
          await ctx.reply('Загружаю данные доски…');

          const headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          };

          /** 1. Доска */
          const boardRes = await fetch(`${BOARDS_URL}/${selectedBoard.id}`, { headers });
          if (!boardRes.ok) {
            await ctx.reply(`Ошибка загрузки доски (${boardRes.status})`);
            return;
          }
          const board = await boardRes.json() as {
            id: number;
            name: string;
            createdAt: string;
          };

          /** 2. Задачи */
          const tasksRes = await fetch(
            `${BOARDS_URL}/${selectedBoard.id}/tasks`,
            { headers }
          );

          let tasks: TaskDto[] = [];
          if (tasksRes.ok) {
            tasks = (await tasksRes.json()) as TaskDto[];
          }


          /** 3. Участники (опционально) */
          const membersRes = await fetch(
            `${BOARDS_URL}/${selectedBoard.id}/members`,
            { headers }
          );

          let members: BoardMemberDto[] = [];
          if (membersRes.ok) {
            members = (await membersRes.json()) as BoardMemberDto[];
          }

          /** Формирование сообщения */
          let message = `*Доска:* ${board.name}\n`;

          if (members.length > 0) {
            message += `\n*Участники (${members.length}):*\n`;
            members.forEach(m => {
              message += `• ${m.user.name} (${m.role})\n`;
            });
          }

          message += `\n*Задачи (${tasks.length}):*\n`;

          if (tasks.length === 0) {
            message += '— задач пока нет\n';
          } else {
            tasks.forEach((task, i) => {
              message += `\n${i + 1}. ${task.title}`;
              if (task.status) message += ` [${task.status}]`;
              if (task.description) {
                const short = task.description.length > 50
                  ? task.description.slice(0, 50) + '…'
                  : task.description;
                message += `\n   ${short}`;
              }
              if (task.createdBy?.name) {
                message += `\n   Назначено: ${task.createdBy.name}`;
              }
            });
          }

          await ctx.reply(message, { parse_mode: 'Markdown' });

        } 
        catch (error) {
          console.error('[BOT] load board error:', error);
          await ctx.reply('Ошибка при загрузке данных доски.');
        }  
        break;
    }
  }

  const board_number_delete = board_number_choose_delete.get(user_id);
  if (board_number_delete)
  {
    switch (board_number_delete.step)
    {
      case 'number_delete':
        const userBoards = userBoardsData.get(user_id);
        if (!userBoards) {
          await ctx.reply('Данные о досках не найдены. Попробуйте снова: /open_board');
          board_number_choose_delete.delete(user_id);
          return;
        }
        const selectedNumber = parseInt(text);
        const session = loggedInUsers.get(user_id);
      
        if (!session?.token) {
          await ctx.reply('Сессия истекла. Войдите снова: /log_in');
          board_number_choose_delete.delete(user_id);
          return;
        }

        if (isNaN(selectedNumber)) {
          await ctx.reply('Пожалуйста, введите номер доски цифрами.');
          return;
        }

        if (selectedNumber < 1 || selectedNumber > userBoards.size) {
          await ctx.reply(`Номер доски должен быть от 1 до ${userBoards.size}. Попробуйте снова:`);
          return;
        }
        const selectedBoard = userBoards.get(selectedNumber);
        if (!selectedBoard) {
          await ctx.reply('Ошибка: не удалось найти выбранную доску.');
          board_number_choose_delete.delete(user_id);
          userBoardsData.delete(user_id);
          return;
        }
        board_number_choose_delete.delete(user_id);
        userBoardsData.delete(user_id);
        try {
          const headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          };

          /** 1. Доска */
          const boardRes = await fetch(`${BOARDS_URL}/${selectedBoard.id}`, { headers });
          if (!boardRes.ok) {
            await ctx.reply(`Ошибка загрузки доски (${boardRes.status})`);
            return;
          }
        }
        catch (error) {
          console.error('[BOT] load board error:', error);
          await ctx.reply('Ошибка при загрузке данных доски.');
        }

        await ctx.reply('Удаляю доску...');
        try {
          const headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          };

          // DELETE запрос для удаления доски
          const deleteRes = await fetch(`${BOARDS_URL}/${selectedBoard.id}`, { 
            method: 'DELETE',
            headers: headers
          }); 
          if (deleteRes.ok) {
            await ctx.reply('Доска успешно удалена!');
          }
        } catch (error) {
        console.error('[BOT] delete board error:', error);
        await ctx.reply('Ошибка при удалении доски.');
        }
        board_number_choose_delete.delete(user_id);
        userBoardsData.delete(user_id);
        break;
    }
  }
  return; // Важно: выходим после обработки
});


// обработка неизвестных команд
bot.on('message', async (ctx) => {
  if ('text' in ctx.message) 
  {
    await ctx.reply(`Не понимаю команду "${ctx.message.text}". Используйте /help`);
  } else {
    await ctx.reply('Я понимаю только текстовые сообщения. Используйте /help');
  }
});

async function startBot(): Promise<void> 
{
  try 
  {
    console.log('Бот запускается...');
    
    await bot.launch();
    
    console.log('Бот успешно запущен!');
    console.log('Бот информация:', bot.botInfo);
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } 
  catch (error) 
  {
    console.error('Ошибка при запуске бота:', error);
    process.exit(1);
  }
}

startBot();