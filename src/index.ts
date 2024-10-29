import { Telegraf, Markup } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import * as jwt from 'jsonwebtoken';
import * as nodeCrypto from 'crypto';
import {
  createUserByTelegram,
  getSubscribedUsers,
  getUserByTelegram,
  updateUserNotification,
} from './lib/utils';
import { kv } from '@vercel/kv';
import { ISubscribedUser } from './interfaces/subscribedUser';

/*
  SETUP
*/

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';

const bot = new Telegraf(BOT_TOKEN);

const miniAppUrl = WEB_APP_URL + '/bot';
const openText = 'Open the app to start CHOMPing!';

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);

const getMiniAppButton = (ctx: any) => {
  // Extract user data from the context
  const userData = {
    authDate: Math.floor(new Date().getTime()),
    firstName: ctx.update.message.from.first_name,
    lastName: '',
    username: ctx.update.message.from.username,
    id: ctx.update.message.from.id,
    photoURL: '',
  };

  // Generate the hash for Telegram authentication
  const hash = generateTelegramHash(userData);

  // Create JWT with user data and hash
  const telegramAuthToken = jwt.sign(
    {
      ...userData,
      hash,
    },
    BOT_TOKEN, // Use the bot token to sign the JWT
    { algorithm: 'HS256' },
  );
  console.log('[DEBUG] JWT generated for user', userData);

  // URL-encode the generated JWT for safe usage in a URL
  const encodedTelegramAuthToken = encodeURIComponent(telegramAuthToken);

  const url = `${miniAppUrl}/?telegramAuthToken=${encodedTelegramAuthToken}`;
  console.log('[DEBUG] URL', url);

  return Markup.button.webApp(openText, url);
};

/*
  ENTRYPOINT - START
*/
bot.start(async (ctx) => {
  const telegramId = ctx.from?.id;

  // Handle user sign up and get user ID
  let userId: string;
  const user = await getUserByTelegram(telegramId);

  if (!user?.profile) {
    const newUser = await createUserByTelegram(telegramId);
    if (!newUser?.profile) {
      return ctx.reply('Failed to create user.');
    }
    userId = newUser.profile.id;
  } else {
    userId = user.profile.id;
  }

  // Set user ID in KV
  await kv.set(`user-${telegramId}`, userId);

  // Get all subscribed users
  const subscribedUsers = await getSubscribedUsers();
  await kv.set('subscribers', subscribedUsers);

  // Auto-subscribe new users
  if (
    !subscribedUsers.find((user) => user.telegramId === telegramId) &&
    userId
  ) {
    const updatedSubscribers = await updateUserNotification(
      telegramId,
      true,
      userId,
    );
    await kv.set('subscribers', updatedSubscribers);
  }

  ctx.reply(openText, Markup.inlineKeyboard([getMiniAppButton(ctx)]));
});

// Unsubscribe from notifications
bot.command('unsubscribe', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Check if the user is already subscribed
  const subscribedUsers = (await kv.get('subscribers')) as ISubscribedUser[];
  if (!subscribedUsers.find((user) => user.telegramId === telegramId)) {
    return ctx.reply('You are not currently subscribed to notifications.');
  }

  const userId = (await kv.get(`user-${telegramId}`)) as string;
  // Update the user's subscription status
  const updatedSubscribers = await updateUserNotification(
    telegramId,
    false,
    userId,
  );
  await kv.set('subscribers', updatedSubscribers);
  ctx.reply('You have unsubscribed from notifications successfully.');
});

// Resubscribe to notifications
bot.command('resubscribe', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Check if the user is already subscribed
  const subscribedUsers = (await kv.get('subscribers')) as ISubscribedUser[];
  if (subscribedUsers.find((user) => user.telegramId === telegramId)) {
    return ctx.reply('You have already subscribed to notifications.');
  }

  // Update the user's subscription status
  const userId = (await kv.get(`user-${telegramId}`)) as string;
  const updatedSubscribers = await updateUserNotification(
    telegramId,
    true,
    userId,
  );
  await kv.set('subscribers', updatedSubscribers);
  ctx.reply('You have subscribed to notifications successfully.');
});

// Default message handler
bot.on('message', async (ctx) => {
  if (ctx.text?.startsWith('/')) return;
  console.log('Got a message');
  ctx.reply(openText, Markup.inlineKeyboard([getMiniAppButton(ctx)]));
});

/**
 * Function to generate HMAC hash for Telegram authentication
 * @param {Object} data - User data to be hashed
 * @returns {string} - Generated HMAC hash
 * https://github.com/dynamic-labs/telegram-miniapp-dynamic/blob/f824c25afc7773405467110befc24263326eadc6/scripts/bot.ts
 */
const generateTelegramHash = (data: any) => {
  // Prepare the data object with required fields
  const useData = {
    auth_date: String(data.authDate),
    first_name: data.firstName,
    id: String(data.id),
    last_name: data.lastName,
    photo_url: data.photoURL,
    username: data.username,
  };

  // Filter out undefined or empty values from the data object
  const filteredUseData = Object.entries(useData).reduce(
    (acc: { [key: string]: any }, [key, value]) => {
      if (value) acc[key] = value;
      return acc;
    },
    {} as { [key: string]: any },
  );

  // Sort the entries and create the data check string
  const dataCheckArr = Object.entries(filteredUseData)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');

  // Create SHA-256 hash from the bot token
  const TELEGRAM_SECRET = nodeCrypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();

  // Generate HMAC-SHA256 hash from the data check string
  return nodeCrypto
    .createHmac('sha256', new Uint8Array(TELEGRAM_SECRET))
    .update(dataCheckArr)
    .digest('hex');
};
