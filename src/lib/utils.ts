import { Context } from 'telegraf';
import { EBotUserState, IBotUser } from '../interfaces/botUser';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { IChompUser, IChompUserResponse } from '../interfaces/chompUser';
import { IQuestion } from '../interfaces/question';
import { IAnswerResponse } from '../interfaces/answer';

const BOT_API_KEY = process.env.BOT_API_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL;
const DYNAMIC_TOKEN = process.env.DYNAMIC_TOKEN;
const DYNAMIC_ENVIRONMENT_ID = process.env.DYNAMIC_ENVIRONMENT_ID;

const headers = {
  Authorization: `Bearer ${DYNAMIC_TOKEN}`,
  'Content-Type': 'application/json',
};
const baseUrl = `https://app.dynamicauth.com/api/v0`;

export const adaptCtx2User = (ctx: Context) => {
  const newUser: IBotUser = {
    tg_id: ctx.from?.id!,
    tg_first_name: ctx.from?.first_name!,
    tg_username: ctx.from?.username!,
    tg_is_bot: ctx.from?.is_bot!,
    tg_language_code: ctx.from?.language_code!,
    state: EBotUserState.NEW,
    original_email_address: 'overwrite',
  };

  return newUser;
};

// Create temporary user with random uuid using Telegram ID
export const createUserByTelegram = async (
  tgId: number,
): Promise<IChompUser | null> => {
  const randomUUID = uuidv4();
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/user/telegram`,
      {
        id: randomUUID,
        telegramId: tgId.toString(),
      },
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

// Fetch user by Telegram ID
export const getUserByTelegram = async (
  tgId: number,
): Promise<IChompUserResponse | null> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/user/telegram?telegramId=${tgId.toString()}`,
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

// Fetch user by Email
export const getUserByEmail = async (
  email: string,
): Promise<IChompUser | null> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/user?email=${email}`,
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

// Get questions from daily deck and unanswered questions
export const getQuestion = async (id: string): Promise<IQuestion | null> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/question/get?userId=${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    return response.data.question;
  } catch {
    return null;
  }
};
export const getRevealQuestion = async (id: string): Promise<IQuestion | null> => {
  try {
    const response = await axios.get(
      `${WEB_APP_URL}/api/question/reveal?userId=${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    if (response.data.length === 0){
      return null
    }
    return response.data.length
  } catch {
    return null;
  }
};

// Initialize email verification process
export const initEmailAuthentication = async (email: string, ctx: Context) => {
  const emailData = {
    email,
  };

  const emailVerifyOptions = {
    method: 'POST',
    headers,
    body: JSON.stringify(emailData),
  };

  const initEmailVerifyUrl = `${baseUrl}/sdk/${DYNAMIC_ENVIRONMENT_ID}/emailVerifications/create`;
  const { verificationUUID } = await fetch(
    initEmailVerifyUrl,
    emailVerifyOptions,
  )
    .then((response) => response.json())
    .catch((err) => console.error(err));

  ctx.reply(
    'Awesome. We just sent you an email. Please respond with the code from the email.',
  );
  return verificationUUID;
};

// Verify OTP and create embedded wallet based on email as identifier
export const verifyEmail = async (
  email: string,
  verificationUUID: string,
  verificationToken: string,
  ctx: Context,
) => {
  const emailVerifyData = {
    verificationUUID,
    verificationToken,
  };

  const verifyEmailUrl = `${baseUrl}/sdk/${DYNAMIC_ENVIRONMENT_ID}/emailVerifications/signin`;

  try {
    const response = await axios.post(verifyEmailUrl, emailVerifyData, {
      headers,
    });

    ctx.reply('Email verified successfully!');

    const newUserData = {
      chain: 'SOL',
      type: 'email',
      identifier: email,
    };

    const newUserOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(newUserData),
    };

    const newUserUrl = `${baseUrl}/environments/${process.env.DYNAMIC_ENVIRONMENT_ID}/embeddedWallets`;
    const dynamicUser = await fetch(newUserUrl, newUserOptions)
      .then((response) => response.json())
      .catch((err) => console.error(err));

    return dynamicUser;
  } catch {
    ctx.reply('Email verification failed, please provide correct OTP.');
    return null;
  }
};

// Replace temporary user with dynamic user including email and wallet in the database
export const handleCreateUser = async (
  id: string,
  newId: string,
  tgId: number,
  address: string,
  email: string,
  ctx: Context,
): Promise<IChompUser | null> => {
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/user`,
      {
        existingId: id,
        newId,
        telegramId: tgId.toString(),
        email,
        address,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BOT_API_KEY,
        },
      },
    );
    ctx.reply('Wallet created successfully!');
    return response.data;
  } catch {
    return null;
  }
};

export const saveDeck = async (
  deckId: number,
  userId: string,
  questionId: number,
  questionOptionId: number,
  percentageGiven: number,
  elapsedTime: number
): Promise<IAnswerResponse | null> => {
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/answer/deck`,
      {
        deckId,
        userId,
        answers: [
          {
            questionId,
            questionOptionId,
            percentageGiven,
            percentageGivenForAnswerId: questionId,
            timeToAnswerInMiliseconds: elapsedTime,
          },
        ],
      },
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

export const saveQuestion = async (
  userId: string,
  questionId: number,
  questionOptionId: number,
  percentageGiven: number,
  elapsedTime: number
): Promise<IAnswerResponse | null> => {
  try {
    const response = await axios.post(
      `${WEB_APP_URL}/api/answer/question`,
      {
        userId,
        answer: {
          questionId,
          questionOptionId,
          percentageGiven,
          percentageGivenForAnswerId: questionId,
          timeToAnswerInMiliseconds: elapsedTime,
        },
      },
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
