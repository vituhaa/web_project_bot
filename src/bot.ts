import { Context, Telegraf } from 'telegraf';
import "dotenv/config";

const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');
const REGISTER_URL = 'http://localhost:3000/api/telegram/register'
const LOGIN_URL = 'http://localhost:3000/api/telegram/login'
const BOARDS_URL = 'http://localhost:3000/api/boards'

const reg_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


const log_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


const loggedInUsers = new Map<number, {
  name?:string;
  token?: string;
}>();


// const board_number_choose = new Map<number, {name?:string;}>();

const board_number_choose = new Map<number, { 
  boards: Array<{ id: string; name: string }>;
  step: 'awaiting_selection';
}>();

// команда /start
bot.start(async (ctx) => {
  await ctx.reply('Привет! Это - бот для взаимодействия с досками задач!');
});


// команда /help
bot.help(async (ctx) => {
  await ctx.reply('Доступные команды:\n/start - начать\n/help - помощь\n/registration - регистрация\n/log_in - вход\n/show_boards - посмотреть список досок\n' +
                  '/open_board - для просмотра доски'
  );
});


// команда /registration
bot.command('registration', async (ctx) => {
  const user_id = ctx.from.id;
  reg_data.set(user_id, {step: 'name'});
  await ctx.reply('Регистрация:\n 1. Введите ваше имя: ');
});


// команда /log_in
bot.command('log_in', async (ctx) => {
  const user_id = ctx.from.id;
  log_data.set(user_id, {step: 'name'});
  await ctx.reply('Вход:\n 1. Введите ваше имя: ');
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



// команда /open_board - ЗАГЛУШКА
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

    boards.forEach((board, index) => {
      message += `${index + 1}. ${board.name}\n`;
    });

    board_number_choose.set(user_id, {
      boards: boards,
      step: 'awaiting_selection'
    });

    return ctx.reply(message + `Выберите номер доски, которую хотите открыть (1 - ${boards.length}): `);
  } 
  catch (error) {
    console.error("Error fetching boards:", error);
    return ctx.reply('Произошла ошибка при получении досок.');
  }
});


bot.on('text', async (ctx) => {
  const user_id = ctx.from.id;
  const user_reg_data = reg_data.get(user_id);
  const text = ctx.message.text.trim();
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
      case 'name':
        user_log_data.name = text;
        user_log_data.step = 'password';
        await ctx.reply('Имя принято\n2. Введите ваш пароль:');
        break;

      case 'password':
        user_log_data.password = text;
        user_log_data.step = 'confirm';
        await ctx.reply('Пароль принят');
        await ctx.reply('Введите ваши данные:\n' + `Имя: ${user_log_data.name}\n` + `Пароль: ${user_log_data.password}\n` + 'Всё верно?(да/нет)');
        break;

      case 'confirm':
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
  
              if (response.ok)
              {
                const result = (await response.json()) as { telegramToken: string };
                await ctx.reply('Вход завершен успешно!');
                loggedInUsers.set(user_id, { name: user_log_data.name, token: result.telegramToken });
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
  if (board_number && board_number.step === 'awaiting_selection') {
    const text = ctx.message.text.trim();
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

    if (selectedNumber < 1 || selectedNumber > board_number.boards.length) {
      await ctx.reply(`Номер доски должен быть от 1 до ${board_number.boards.length}. Попробуйте снова:`);
      return;
    }
    const selectedBoard = board_number.boards[selectedNumber - 1];
    
    board_number_choose.delete(user_id);

    try
    {
      await ctx.reply(`Загрузка информации о доске "${selectedBoard.name}"...`);

      const response = await fetch(`${BOARDS_URL}/${selectedBoard.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        await ctx.reply(`Ошибка при загрузке доски: ${response.status} ${errorText}`);
        return;
      }

      const boardDetails = await response.json() as {
        name?: string;
        tasks?: Array<{
          title: string;
          description?: string;
          status?: string;
          assignedTo?: { name?: string };
        }>;
        members?: Array<{
          role: string;
          user: { name: string };
        }>;
      };

      let boardMessage = `**Доска: ${boardDetails.name || 'Без названия'}**\n\n`;

      if (boardDetails.tasks && Array.isArray(boardDetails.tasks)) {
        boardMessage += `\n *Задачи в доске (${boardDetails.tasks.length}):*\n`;
        
        if (boardDetails.tasks.length > 0) {
          boardDetails.tasks.forEach((task, index) => {
            boardMessage += `\n${index + 1}. ${task.title}`;
            
            if (task.description)
            {
              const shortDesc = task.description.length > 50 ? 
                task.description.substring(0, 50) + '...' : task.description;
              boardMessage += `\n    ${shortDesc}`;
            }
            
            if (task.assignedTo?.name) {
              boardMessage += `\n   Назначено: ${task.assignedTo.name}`;
            }
          });
        } else {
          boardMessage += `\nЗадач пока нет.`;
        }
      }

      await ctx.reply(boardMessage, { parse_mode: 'Markdown' });

    } 
    catch (error) {
      console.error("Error loading board details:", error);
      await ctx.reply('Произошла ошибка при загрузке информации о доске.');
    }
    
    return;
  }
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