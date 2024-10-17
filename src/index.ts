import { Telegraf, Markup } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';

/*
  SETUP
*/

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';

const bot = new Telegraf(BOT_TOKEN);

const miniAppUrl = WEB_APP_URL;
const openText = 'Open the app to start CHOMPing!';
const openId = 'button.miniapp';

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);

/*
  ENTRYPOINT - START
*/
bot.start(async (ctx) => {
  ctx.reply(
    openText,
    Markup.inlineKeyboard([Markup.button.webApp(openText, miniAppUrl)]),
  );
});

bot.on('message', async (ctx) => {
  ctx.reply(
    openText,
    Markup.inlineKeyboard([Markup.button.webApp('Launch', miniAppUrl)]),
  );
});
