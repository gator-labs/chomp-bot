import { Telegraf, Markup, Input } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import {
  createUserByTelegram,
  encodeTelegramPayload,
  getSubscribedUsers,
  getUserByTelegram,
  updateUserNotification,
} from './lib/utils';
const path = require('path');
// import welcomeImg from './img/chomp.png'

/*
  SETUP
*/

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';

const bot = new Telegraf(BOT_TOKEN);

const miniAppUrl = WEB_APP_URL + '/login';
const openText = 'welcome to CHOMP, the best place for you to play + earn $BONK! the more right you are, the more you earn. 🤑 new decks daily ⏰.';
const buttonCTA = "Open the app to start CHOMPing!";

// Production mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

// Dev mode
ENVIRONMENT !== 'production' && development(bot);

const getMiniAppButton = (ctx: any) => {
  const { encodedTelegramAuthToken } = encodeTelegramPayload(ctx);

  const url = `${miniAppUrl}?telegramAuthToken=${encodedTelegramAuthToken}`;
  console.log('[DEBUG] URL', url);

  return Markup.button.webApp(buttonCTA, url);
};

/*
  ENTRYPOINT - START
*/
bot.start(async (ctx) => {
  // Handle user sign up and get user ID
  let username: string;
  const user = await getUserByTelegram(ctx);

  if (!user) {
    const newUser = await createUserByTelegram(ctx);
    if (!newUser) {
      return ctx.reply('Failed to create user.');
    }
    username = newUser.username || '';
  } else {
    username = user.username || '';
  }

  ctx.reply(openText, Markup.inlineKeyboard([getMiniAppButton(ctx)]));
});

// Unsubscribe from notifications
bot.command('unsubscribe', async (ctx) => {
  const telegramId = ctx.from?.id;

  // Check if the user is already subscribed
  const subscribedUsers = await getSubscribedUsers();

  if (!subscribedUsers.find((user) => user.telegramId === telegramId)) {
    return ctx.reply('You are not currently subscribed to notifications.');
  }

  // Update the user's subscription status
  await updateUserNotification(ctx, false);
  ctx.reply('You have unsubscribed from notifications successfully.');
});

// Resubscribe to notifications
bot.command('resubscribe', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Check if the user is already subscribed
  const subscribedUsers = await getSubscribedUsers();
  if (subscribedUsers.find((user) => user.telegramId === telegramId)) {
    return ctx.reply('You have already subscribed to notifications.');
  }

  // Update the user's subscription status
  await updateUserNotification(ctx, true);
  ctx.reply('You have subscribed to notifications successfully.');
});

// Default message handler
bot.on('message', async (ctx) => {
  if (ctx.text?.startsWith('/')) return;
  await ctx.replyWithPhoto({ source: path.resolve(__dirname, 'img/welcome.png') });
  await ctx.reply(openText, Markup.inlineKeyboard([getMiniAppButton(ctx)]));
});
