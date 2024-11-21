# Chomp Bot

## Before you start

First rename `.env-sample` file to `.env` and fill in all necessary values.

```sh
# ChompTestBot (staging), ChompDevBot (local), and ChompDotGamesBot (prod) in 1Password
BOT_TOKEN=

# Use ngrok to expose PWA locally
# ngrok http --domain=stunning-socially-griffon.ngrok-free.app 3000
# Don't forget to add to Dynamic CORS origins
# Set webapp URL (BotFather -> /setdomain)
WEB_APP_URL=
```

## Start your local server

```
yarn
yarn dev
```

## Send notification to subscribers using script

Add the environment variables properly and make sure to maintain format of the message in shell

```sh
# Run this command in terminal and enter your message
yarn tg:notify-all
```

You need to confirm before sending notification.
