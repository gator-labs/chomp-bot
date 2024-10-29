import { Context } from 'telegraf';
import { EBotUserState, IBotUser } from '../interfaces/botUser';
import axios from 'axios';
import { IChompUserResponse } from '../interfaces/chompUser';
import { ISubscribedUser } from '../interfaces/subscribedUser';

const BOT_API_KEY = process.env.BOT_API_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL;

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

// Get all subscribed users
export const getSubscribedUsers = async (): Promise<ISubscribedUser[] | []> => {
  try {
    const response = await axios.get(`${WEB_APP_URL}/api/notification`, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': BOT_API_KEY,
      },
    });
    return response.data.users;
  } catch (error) {
    console.error('Error fetching subscribed users:', error);
    return [];
  }
};

// Fetch user by Telegram ID
export const getUserByTelegram = async (
  telegramId: number,
): Promise<IChompUserResponse | null> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/user?telegramId=${telegramId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data;
  } catch {
    return null;
  }
};

// Create a new user by Telegram ID
export const createUserByTelegram = async (
  telegramId: number,
): Promise<IChompUserResponse | null> => {
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/user`,
      { telegramId },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data;
  } catch {
    return null;
  }
};

// Update user notification status
export const updateUserNotification = async (
  telegramId: number,
  isSubscriber: boolean,
  userId: string,
): Promise<ISubscribedUser[] | []> => {
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/notification`,
      {
        userId,
        telegramId,
        isSubscriber,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data.users;
  } catch {
    return [];
  }
};
