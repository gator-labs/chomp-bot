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

## Production

You can fork this template and do the necessary changes you need. Then you when are done with your changes simply goto [vercel git import](https://vercel.com/import/git).

Reference to [this update](https://vercel.com/docs/security/deployment-protection#migrating-to-standard-protection), you need turn off `Vercel Authentication`, Settings => Deployment Protection

Feel free to create PR!

## Demo

You can see a working version of the bot at [@Node_api_m_bot](https://t.me/Node_api_m_bot)
