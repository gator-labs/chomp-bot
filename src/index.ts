import { Telegraf, Markup, Context } from 'telegraf';

import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';

import { IBotUser } from './interfaces/bot-users';
import {
  adaptCtx2User,
  createUserByTelegram,
  getUserByEmail,
  getUserByTelegram,
  handleCreateUser,
  initEmailAuthentication,
  verifyEmail,
  getQuestion
} from './lib/utils';

/*
  SETUP
*/

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

let user: any;
let emailAddress: string;
let verificationUUID: string;
let isVerify: boolean;
const bot = new Telegraf(BOT_TOKEN);

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);

const WEB_APP_URL = process.env.WEB_APP_URL || '';

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

const replyWithReveal = async (ctx: Context) => {
  const prompt = 'You have 8 questions available to reveal. Reveal all?';
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
  console.log('Start command received');
  console.log(ctx.from);
  console.log(ctx.chat.id);
  const newUser: IBotUser = adaptCtx2User(ctx);
  const { tg_id: tgId } = newUser;

  // check if user exists
  const userExists = await getUserByTelegram(tgId);

  // if not, create user in DB and ask for email address
  if (!userExists) {
    const response = await createUserByTelegram(tgId);
    if (response) {
      user = response;
    }
  } else {
    user = userExists.profiles;
  }

  replyWithPrimaryOptions(ctx);
});

/*
  NEW -> ANSWERING FIRST ORDER
*/
bot.action('new.quickstart', async (ctx) => {
  try {
    const id = user?.profile?.id
    const deck = await getQuestion(id)

    const {question, questionOptions} = deck
    const prompt = question

    const buttons = questionOptions.map((option: {id: number, option: any, isLeft: boolean}, index:number)=>
      Markup.button.callback(`${option.option}`, option.option)
    )
    ctx.reply(prompt, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Error making API call:', error);
    ctx.reply('Failed to fetch data from API.');
  }

});
/*
  ANSWERING FIRST ORDER -> ANSWERING SECOND ORDER
*/
const secondPrompt = 'What percentage of people do you think answered Raydium?';
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
  Markup.button.callback(secondButtonOptions[key], key),
);
const formattedSecondButtons = [
  secondButtons.slice(0, 5), // Elements 0-4
  secondButtons.slice(5, 6), // Element 5
  secondButtons.slice(6), // Elements 6 and beyond
];

bot.action('answering-first-order.1', async (ctx) => {
  ctx.reply(secondPrompt, Markup.inlineKeyboard(formattedSecondButtons));
});

bot.action('answering-first-order.2', async (ctx) => {
  ctx.reply(secondPrompt, Markup.inlineKeyboard(formattedSecondButtons));
});

bot.action('answering-first-order.3', async (ctx) => {
  ctx.reply(secondPrompt, Markup.inlineKeyboard(formattedSecondButtons));
});

bot.action('answering-first-order.4', async (ctx) => {
  ctx.reply(secondPrompt, Markup.inlineKeyboard(formattedSecondButtons));
});

/*
  COMPLETED ANSWERING
*/

bot.action('answering-second-order.0', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.10', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.20', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.30', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.40', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.50', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.60', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.70', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.80', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.90', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('answering-second-order.100', async (ctx) => {
  const prompt =
    'Well done! You just chomped a question.\n\nWhat do you want to do next?';
  const buttonOptions: { [k: string]: string } = {
    'completed-answering.more': 'Answer more 🎲',
    'completed-answering.home': 'Go home 🏡',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('completed-answering.more', async (ctx) => {
  const prompt = 'Which of the following is NOT a DEX?';
  const buttonOptions: { [k: string]: string } = {
    'answering-first-order.1': 'Jupiter',
    'answering-first-order.2': 'Raydium',
    'answering-first-order.3': 'Orca',
    'answering-first-order.4': 'Phoenix',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('completed-answering.home', async (ctx) => {
  const prompt = 'What do you want to do today?';
  const buttonOptions: { [k: string]: string } = {
    'new.quickstart': 'Answer questions 🎲',
    'new.reveal': 'Reveal & claim 💵',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
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
  emailAddress = emailAddresses[0];

  // check if user exists
  const userExists = await getUserByEmail(emailAddress);

  if (userExists) {
    replyWithReveal(ctx);
  } else {
    verificationUUID = await initEmailAuthentication(emailAddress, ctx);
    isVerify = true;
  }
});

/*
  Email Verification
*/
const otpRegex = /(?:\d{6})/;
bot.hears(otpRegex, async (ctx) => {
  const newUser: IBotUser = adaptCtx2User(ctx);
  const { tg_id: tgId } = newUser;
  if (!isVerify) {
    ctx.reply('Please type /start to continue.');
    return;
  } else {
    const { match: otps } = ctx;
    const otp = otps[0];
    const response = await verifyEmail(
      emailAddress,
      verificationUUID,
      otp,
      ctx,
    );
    if (response) {
      isVerify = false;
      const dynamicUser = await handleCreateUser(
        user.id,
        response.user.id,
        tgId,
        response.user.walletPublicKey,
        response.user.email,
        ctx,
      );
      replyWithReveal(ctx);
    }
  }
});

/*
  NEW -> SELECTED REVEAL
*/
bot.action('new.reveal', async (ctx) => {
  if (user?.wallets) {
    replyWithReveal(ctx);
  } else {
    replyWithEmailCollection(ctx);
  }
});

bot.action('selected-reveal.no', async (ctx) => {
  const prompt = 'What do you want to do today?';
  const buttonOptions: { [k: string]: string } = {
    'new.quickstart': 'Start answering 🎲',
    'new.reveal': 'Reveal Answers 💵',
  };
  const buttons = Object.keys(buttonOptions).map((key) =>
    Markup.button.callback(buttonOptions[key], key),
  );
  ctx.reply(prompt, Markup.inlineKeyboard(buttons));
});

bot.action('revealed.0', async (ctx) => {
  ctx.reply('Congratulations you just claimed 37,292 BONK!');

  replyWithPrimaryOptions(ctx);
});

bot.action('selected-reveal.yes', async (ctx) => {
  ctx.reply(
    'Follow the link to burn BONK and reveal!',
    Markup.inlineKeyboard([Markup.button.webApp('Launch', WEB_APP_URL)]),
  );
});

bot.on('message', async (ctx) => {
  const txt = ctx.text as any;
  ctx.reply('Send /start to begin');
});
