import { Context, Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');
const REGISTER_URL = 'http://localhost:3000/api/auth/register'
const LOGIN_URL = 'http://localhost:3000/api/auth/login'

const reg_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


const log_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


// команда /start
bot.start(async (ctx) => {
  await ctx.reply('Привет! Это - бот для взаимодействия с досками задач!');
});


// команда /help
bot.help(async (ctx) => {
  await ctx.reply('Доступные команды:\n/start - начать\n/help - помощь\n/registration - регистрация\n/log_in - вход');
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
                  password: user_log_data.password
                })
              });
  
              if (response.ok)
              {
                // const result = await response.json();
                await ctx.reply('Вход завершен успешно!');
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