import { Telegraf, Markup, Context } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { kv } from '@vercel/kv';
import { IBotUser } from './interfaces/botUser';
import {
  adaptCtx2User,
  createUserByTelegram,
  getUserByTelegram,
  getRevealQuestion,
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
const WEB_APP_URL = process.env.WEB_APP_URL || '';

const bot = new Telegraf(BOT_TOKEN);

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);

bot.on('inline_query', (ctx) => {
  ctx.answerInlineQuery([], {
    button: { text: 'Launch', web_app: { url: WEB_APP_URL + '/bot' } },
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
    const { question, questionOptions } = questionDeck;
    const prompt = question;

    const buttons = questionOptions.map(
      (option: { id: number; option: string; isLeft: boolean }) =>
        Markup.button.callback(
          `${option.option}`,
          `answering-first-order.${option.id}`,
        ),
    );
    ctx.reply(prompt, Markup.inlineKeyboard(buttons));
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
      );
    } else {
      await saveQuestion(userId, questionId, questionOptionId, percentageGiven);
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
  GET QUESTION TO REVEALED
*/

bot.action('new.reveal', async (ctx) => {
  const user = (await kv.get(`user:${ctx?.from?.id}`)) as IChompUser;
  const questionRevealCount = await getRevealQuestion(user?.id);

  if (!questionRevealCount) {
    const prompt = `You don't have any questions to reveal. Answer more questions in order to reveal"`;

    const buttonOptions: { [k: string]: string } = {
      'new.quickstart': 'Keep Chompin',
    };
    const buttons = Object.keys(buttonOptions).map((key) =>
      Markup.button.callback(buttonOptions[key], key),
    );
    ctx.reply(prompt, Markup.inlineKeyboard(buttons));
  } else {
    const prompt = `You have ${questionRevealCount} questions available to reveal. Launch to Reveal?`;

    const buttonOptions: { [k: string]: string } = {
      'selected-reveal.no': 'Maybe Later',
      'selected-reveal.yes': 'Yes',
    };
    
    const buttons = Object.keys(buttonOptions).map((key) =>
      Markup.button.callback(buttonOptions[key], key),
    );
    ctx.reply(prompt, Markup.inlineKeyboard(buttons));
  }
});

/*
  NEW -> SELECTED REVEAL
*/
bot.action('selected-reveal.no', async (ctx) => {
  replyWithPrimaryOptions(ctx);
});

bot.action('selected-reveal.yes', async (ctx) => {
  ctx.reply(
    'Follow the link to burn BONK and reveal!',
    Markup.inlineKeyboard([
      Markup.button.webApp('Launch', WEB_APP_URL + '/bot'),
    ]),
  );
});

bot.on('message', async (ctx) => {
  const txt = ctx.text as any;
  ctx.reply('Send /start to begin');
});
