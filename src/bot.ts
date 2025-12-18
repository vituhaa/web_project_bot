import { Context, Telegraf } from 'telegraf';
import { Update, Message } from 'telegraf/typings/core/types/typegram';

type BotContext = Context<Update>;
const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');

// команда /start
bot.start(async (ctx) => {
  await ctx.reply('Привет! Я минимальный бот на TypeScript!');
});

// команда /help
bot.help(async (ctx) => {
  await ctx.reply('Доступные команды:\n/start - начать\n/help - помощь\n');
});



bot.on('text', async (ctx) => {
  await ctx.reply(`Вы написали: "${ctx.message.text}"`);
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