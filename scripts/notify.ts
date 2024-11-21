import { Telegraf } from 'telegraf';
import * as readline from 'readline';
import path = require('path');
import axios from 'axios';

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';
const ENVIRONMENT =
  WEB_APP_URL === 'https://app.chomp.games' ? 'PRODUCTION' : 'DEVELOPMENT';

const bot = new Telegraf(BOT_TOKEN);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function sendNotification() {
  try {
    // Environment warning
    if (ENVIRONMENT === 'PRODUCTION') {
      console.log(
        '⚠️  WARNING: You are connected to PRODUCTION environment!\n',
      );
    } else {
      console.log('🔧 Running in DEVELOPMENT environment\n');
    }

    // Get notification text
    const message = await question(
      'Enter your notification message (emoji supported ✨): ',
    );
    console.log('\nMessage preview:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Environment confirmation
    console.log(
      `This message will be sent to all subscribed users in ${ENVIRONMENT} environment`,
    );

    const confirm = await question('\nSend notification? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('\nNotification cancelled');
      process.exit(0);
    }

    // Get subscribed users from the bot's context
    const response = await axios.get(
      `${process.env.WEB_APP_URL}/api/users/getSubscribedUsers`,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BOT_API_KEY!,
        },
      },
    );
    const subscribedUsers = response.data.users;

    if (subscribedUsers.length === 0) {
      console.log('\nNo subscribed users found');
      process.exit(0);
    }

    console.log(`\nSending notification to ${subscribedUsers.length} users...`);

    // Send messages
    let successCount = 0;
    let failCount = 0;

    for (const user of subscribedUsers) {
      try {
        await bot.telegram.sendMessage(user.telegramId, message);
        successCount++;
        process.stdout.write('.');
      } catch (error) {
        console.error(`Failed to send to user ${user.telegramId}:`, error);
        failCount++;
        process.stdout.write('x');
      }
    }

    console.log(`\n\nNotification sent successfully to ${successCount} users`);
    if (failCount > 0) {
      console.log(`Failed to send to ${failCount} users`);
    }
  } catch (error) {
    console.error('\nError sending notifications:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

sendNotification();
