import { Telegraf, Markup, Context } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { kv } from '@vercel/kv';
import { IBotUser } from './interfaces/botUser';
import {
  adaptCtx2User,
  createUserByTelegram,
  getUserByEmail,
  getUserByTelegram,
  getRevealQuestion,
  handleCreateUser,
  initEmailAuthentication,
  verifyEmail,
  getQuestion,
  saveDeck,
  saveQuestion,
} from './lib/utils';
import { IChompUser } from './interfaces/chompUser';
import { IQuestion } from './interfaces/question';

/*
  SETUP
*/

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

const userTimers: {
  [userId: number]: {
    timer: NodeJS.Timeout | null;
    startTime: number;
    remainingTime: number;
  };
} = {};

// Function to format milliseconds into minutes and seconds
function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;
}

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);

const WEB_APP_URL = process.env.WEB_APP_URL || '';

// Command to show the input box with a button
bot.command('webapp', (ctx) => {
  ctx.reply(
    'Click the button below to open the web app:',
    Markup.inlineKeyboard([
      Markup.button.webApp('Open Web App', `${WEB_APP_URL}/bot`),
    ]),
  );
});

bot.on('inline_query', (ctx) => {
  ctx.answerInlineQuery([], {
    button: { text: 'Launch', web_app: { url: WEB_APP_URL } },
  });
});

const replyWithPrimaryOptions = async (ctx: Context) => {
  const prompt = 'What do you want to do today?';
  const buttonOptions: { [k: string]: string } = {
    'new.quickstart': 'Answer questions 🎲',
    'new.reveal': 'Reveal & claim 💵',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
};

const replyWithEmailCollection = async (ctx: Context) => {
  const moreInfoKeyboard = Markup.inlineKeyboard([
    Markup.button.callback('Why do you need my email?', 'new.email-info'),
  ]);
  ctx.reply(
    'Welcome to Chomp! 🦷\n\nPlease provide your email address so Chomp Bot can generate a Solana wallet for you.',
    moreInfoKeyboard,
  );
};

/*
  GET QUESTION TO REVEALED
*/

const replyWithReveal = async (ctx: Context) => {
  const user = (await kv.get(`user:${ctx?.from?.id}`)) as IChompUser;
  const questionReveal = await getRevealQuestion(user?.id);

  if (!questionReveal) {
    ctx.reply(
      'You have no questions available to reveal',
    );
  }

  const prompt = `You have ${questionReveal} questions available to reveal. Launch to Reveal?`;

  const buttonOptions: { [k: string]: string } = {
    'selected-reveal.no': 'Maybe Later',
    'selected-reveal.yes': 'Yes',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
};

/*
  ENTRYPOINT - START
*/
bot.start(async (ctx) => {
  const newUser: IBotUser = adaptCtx2User(ctx);
  const { tg_id: tgId } = newUser;

  // check if user exists
  const userExists = await getUserByTelegram(tgId);

  // if not, create user in DB and ask for email address
  if (!userExists) {
    const response = await createUserByTelegram(tgId);
    if (response) {
      await kv.set(`user:${tgId}`, response);
      replyWithPrimaryOptions(ctx);
    } else {
      ctx.reply('Failed to create user, please try again!');
    }
  } else {
    await kv.set(`user:${tgId}`, userExists.profile);
    replyWithPrimaryOptions(ctx);
  }
});

/*
  NEW -> ANSWERING FIRST ORDER
*/
bot.action('new.quickstart', async (ctx) => {
  const user = (await kv.get(`user:${ctx.from.id}`)) as IChompUser;
  const questionDeck = await getQuestion(user.id);

  if (questionDeck) {
    await kv.set(`question:${ctx.from.id}`, questionDeck);
    const { question, questionOptions, durationMiliseconds } = questionDeck;
    const prompt = question;

    // Clear any existing timer for the user
    if (userTimers[ctx.from.id]) {
      clearInterval(userTimers[ctx.from.id]!.timer!);
      userTimers[ctx.from.id] = { timer: null, startTime: 0, remainingTime: 0 };
    }

    // Start the timer
    let remainingTime = durationMiliseconds;
    const startTime = Date.now();
    const timerMessageId = await ctx.reply(
      `Time remaining ⏳: ${formatTime(remainingTime)}`,
    );
    const buttons = questionOptions.map(
      (option: { id: number; option: string; isLeft: boolean }) =>
        Markup.button.callback(
          `${option.option}`,
          `answering-first-order.${option.id}`,
        ),
    );
    const questionMessage = await ctx.reply(
      prompt,
      Markup.inlineKeyboard(buttons),
    );

    userTimers[ctx.from.id] = {
      timer: setInterval(async () => {
        remainingTime -= 1000;
        if (remainingTime > 0) {
          await ctx.telegram.editMessageText(
            ctx.chat?.id,
            timerMessageId.message_id,
            undefined,
            `Time remaining ⏳: ${formatTime(remainingTime)}`,
          );
        } else {
          clearInterval(userTimers[ctx.from.id]!.timer!);
          userTimers[ctx.from.id] = {
            timer: null,
            startTime: 0,
            remainingTime: 0,
          };
          await ctx.telegram.editMessageText(
            ctx.chat?.id,
            timerMessageId.message_id,
            undefined,
            `⌛️ Time's up!`,
          );
          await ctx.telegram.deleteMessage(
            ctx.chat?.id!,
            questionMessage.message_id,
          );
          replyWithPrimaryOptions(ctx);
          return;
        }
      }, 1000),
      startTime: startTime,
      remainingTime: durationMiliseconds,
    };
  } else {
    ctx.reply(
      'You have already chomp all questions. Please visit later to chomp it.',
    );
  }
});

/*
  ANSWERING SECOND ORDER
*/
bot.action(/^answering-first-order\.(.+)$/, async (ctx) => {
  const questionDeck = (await kv.get(`question:${ctx.from.id}`)) as IQuestion;
  const userAnswerId = parseInt(ctx.match[1], 10);
  const userAnswer = questionDeck?.questionOptions.find(
    (option) => option.id === userAnswerId,
  )?.option;

  // Stop the timer and calculate elapsed time
  const timerData = userTimers[ctx.from.id];
  if (timerData && timerData.timer) {
    clearInterval(timerData.timer);
    timerData.remainingTime -= Date.now() - timerData.startTime;
    userTimers[ctx.from.id] = {
      timer: null,
      startTime: 0,
      remainingTime: timerData.remainingTime,
    };
  }

  const secondPrompt = `What percentage of people do you think answered ${userAnswer}?`;

  const secondButtonOptions: { [k: string]: string } = {
    'answering-second-order.0': '0%',
    'answering-second-order.10': '10%',
    'answering-second-order.20': '20%',
    'answering-second-order.30': '30%',
    'answering-second-order.40': '40%',
    'answering-second-order.50': '50%',
    'answering-second-order.60': '60%',
    'answering-second-order.70': '70%',
    'answering-second-order.80': '80%',
    'answering-second-order.90': '90%',
    'answering-second-order.100': '100%',
  };

  const secondButtons = Object.keys(secondButtonOptions).map((key) =>
    Markup.button.callback(secondButtonOptions[key], `${key}.${userAnswerId}`),
  );

  const formattedSecondButtons = [
    secondButtons.slice(0, 5),
    secondButtons.slice(5, 6),
    secondButtons.slice(6),
  ];

  ctx.reply(secondPrompt, Markup.inlineKeyboard(formattedSecondButtons));
});

/*
  SAVING ANSWER
*/

bot.action(/^answering-second-order\.(.+)\.(.+)$/, async (ctx) => {
  const questionDeck = (await kv.get(`question:${ctx.from.id}`)) as IQuestion;
  const user = (await kv.get(`user:${ctx.from.id}`)) as IChompUser;
  const percentageGiven = Number(ctx.match[1]);
  const questionOptionId = parseInt(ctx.match[2], 10);

  // Calculate elapsed time
  const timerData = userTimers[ctx.from.id];
  const elapsedTime = timerData
    ? questionDeck.durationMiliseconds - timerData.remainingTime
    : 0;

  // Clear the timer for the user
  if (timerData && timerData.timer) {
    clearInterval(timerData.timer);
    userTimers[ctx.from.id] = { timer: null, startTime: 0, remainingTime: 0 };
  }

  if (questionDeck) {
    const { id: questionId, deckId } = questionDeck;
    const { id: userId } = user;

    if (deckId) {
      await saveDeck(
        deckId,
        userId,
        questionId,
        questionOptionId,
        percentageGiven,
        elapsedTime,
      );
    } else {
      await saveQuestion(
        userId,
        questionId,
        questionOptionId,
        percentageGiven,
        elapsedTime,
      );
    }
  }

  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'new.quickstart': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };

  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('completed-answering.home', async (ctx) => {
  replyWithPrimaryOptions(ctx);
});

/*
  NEW -> ENTERING_EMAIL
*/

bot.action('new.email-info', async (ctx) => {
  const prompt = `Chomp Bot uses your email to create a new Solana wallet for you to play\\. Your email address will be the owner and sole custodian of the wallet\\. [Learn more](https://gator\\.fyi)\\.
*Please respond with your email address to continue\\.*`;
  ctx.replyWithMarkdownV2(prompt);
});

/*
  Email Message received
*/
// https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
const emailRegex =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

bot.hears(emailRegex, async (ctx) => {
  const { match: emailAddresses } = ctx;
  const emailAddress = emailAddresses[0];
  await kv.set(`email:${ctx.from.id}`, emailAddress);

  // check if user exists
  const userExists = await getUserByEmail(emailAddress);

  if (userExists) {
    replyWithReveal(ctx);
  } else {
    const verificationUUID = await initEmailAuthentication(emailAddress, ctx);
    await kv.set(`verification:${ctx.from.id}`, verificationUUID);
    await kv.set(`isVerify:${ctx.from.id}`, true);
  }
});

/*
  Email Verification
*/
const otpRegex = /(?:\d{6})/;
bot.hears(otpRegex, async (ctx) => {
  const tgId = ctx.from.id;
  const isVerify = (await kv.get(`isVerify:${tgId}`)) as boolean;
  if (!isVerify) {
    ctx.reply('Please type /start to continue.');
    return;
  } else {
    const { match: otps } = ctx;
    const otp = otps[0];
    const emailAddress = (await kv.get(`email:${tgId}`)) as string;
    const verificationUUID = (await kv.get(`verification:${tgId}`)) as string;
    const response = await verifyEmail(
      emailAddress,
      verificationUUID,
      otp,
      ctx,
    );
    if (response) {
      await kv.set(`isVerify:${tgId}`, false);
      const user = (await kv.get(`user:${tgId}`)) as IChompUser;
      const dynamicUser = await handleCreateUser(
        user.id,
        response.user.id,
        tgId,
        response.user.walletPublicKey,
        response.user.email,
        ctx,
      );
      ctx.reply(
        'Follow the link to burn BONK and reveal!',
        Markup.inlineKeyboard([Markup.button.webApp('Launch', WEB_APP_URL)]),
      );
    }
  }
});

/*
  NEW -> SELECTED REVEAL
*/
bot.action('new.reveal', async (ctx) => {
  replyWithReveal(ctx);
});

bot.action('selected-reveal.no', async (ctx) => {
  replyWithPrimaryOptions(ctx);
});

bot.action('selected-reveal.yes', async (ctx) => {
  const user = (await kv.get(`user:${ctx.from.id}`)) as IChompUser;
  if (user.wallets.length !== 0) {
    ctx.reply(
      'Follow the link to burn BONK and reveal!',
      Markup.inlineKeyboard([Markup.button.webApp('Launch', WEB_APP_URL)]),
    );
  } else {
    replyWithEmailCollection(ctx);
  }
});

bot.on('message', async (ctx) => {
  const txt = ctx.text as any;
  ctx.reply('Send /start to begin');
});
