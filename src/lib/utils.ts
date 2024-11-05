import { Context } from 'telegraf';
import { EBotUserState, IBotUser } from '../interfaces/botUser';
import axios from 'axios';
import { IChompUser } from '../interfaces/chompUser';
import { ISubscribedUser } from '../interfaces/subscribedUser';
import * as nodeCrypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_API_KEY = process.env.BOT_API_KEY || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';

export const adaptCtx2User = (ctx: Context) => {
  const newUser: IBotUser = {
    tg_id: ctx.from?.id!,
    tg_first_name: ctx.from?.first_name!,
    tg_username: ctx.from?.username!,
    tg_is_bot: ctx.from?.is_bot!,
    tg_language_code: ctx.from?.language_code!,
    state: EBotUserState.NEW,
  };

  return newUser;
};

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

export const encodeTelegramPayload = (ctx: any) => {
  // Extract user data from the Context
  const payload = {
    authDate: Math.floor(new Date().getTime()),
    firstName: ctx.update.message.from.first_name,
    lastName: '',
    username: ctx.update.message.from.username,
    id: ctx.update.message.from.id,
    photoURL: '',
  };

  // Generate the hash for Telegram authentication
  const hash = generateTelegramHash(payload);

  // Create JWT with user data and hash
  const telegramAuthToken = jwt.sign(
    {
      ...payload,
      hash,
    },
    BOT_TOKEN, // Use the bot token to sign the JWT
    { algorithm: 'HS256' },
  );

  // URL-encode the generated JWT for safe usage in a URL
  const encodedTelegramAuthToken = encodeURIComponent(telegramAuthToken);

  return { encodedTelegramAuthToken };
};

// Get all subscribed users
export const getSubscribedUsers = async (): Promise<ISubscribedUser[] | []> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/users/getSubscribedUsers`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data.users;
  } catch (error) {
    console.error('Error fetching subscribed users:', error);
    return [];
  }
};

// Get a user profile by Telegram ID
export const getUserByTelegram = async (
  ctx: Context,
): Promise<IChompUser | null> => {
  const { encodedTelegramAuthToken } = encodeTelegramPayload(ctx);
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/user/getUserByTelegram?telegramAuthToken=${encodedTelegramAuthToken}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data.profile;
  } catch {
    return null;
  }
};

// Create a new user by Telegram ID
export const createUserByTelegram = async (
  ctx: Context,
): Promise<IChompUser | null> => {
  const { encodedTelegramAuthToken } = encodeTelegramPayload(ctx);
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/user/createUserByTelegram`,
      { telegramAuthToken: encodedTelegramAuthToken },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data.profile;
  } catch {
    return null;
  }
};

// Update user notification status
export const updateUserNotification = async (
  ctx: Context,
  isBotSubscriber: boolean,
) => {
  const { encodedTelegramAuthToken } = encodeTelegramPayload(ctx);
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/user/setUserSubscription`,
      {
        telegramAuthToken: encodedTelegramAuthToken,
        isBotSubscriber: isBotSubscriber,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response;
  } catch {
    return [];
  }
};
