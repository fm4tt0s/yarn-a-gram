# 📡 yarn-a-gram

I was sick of missing that 80% discount on a protein bar box that lasted for 10min only! A Node.js script that monitors Telegram channels for specific keywords and sends you a notification whenever a match is found.

## Features

- Monitor multiple Telegram channels simultaneously
- Watch for multiple keywords at once
- Get notified on Telegram (via Saved Messages) when a keyword is found
- Keywords are hot-reloaded from `config.js` every 3 minutes — no restart needed
- Optionally post matched messages to an external API
- Optionally run one or multiple shell commands when a keyword is found, with `_keyword_` and `_channel_` placeholders available

## Requirements

- Node.js 16+
- A Telegram account (user login, not a bot)
- Telegram API credentials from [my.telegram.org](https://my.telegram.org)

## Setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Get your Telegram API credentials

1. Go to [my.telegram.org](https://my.telegram.org) and log in
2. Click on **API development tools**
3. Create a new application and copy your `api_id` and `api_hash`

### 3. Configure

Rename `config.js.example` to `config.js` and fill in your credentials and preferences:

```javascript
module.exports = {
  apiId: YOUR_API_ID,
  apiHash: "YOUR_API_HASH",
  stringSession: "", // leave empty on first run — see step 4
  useWSS: false, // set to true if you want to use WebSocket connection (may be more stable in some environments, but can cause issues in others - test both options to see which works better for you - usually not required)

  channelsToWatch: ["channel_name_1", "channel_name_2"], // Telegram channel usernames to monitor (without @)
                                                          // the 'username' after t.me/ — e.g. "t.me/news_channel" = "news_channel"
  keywords: ["keyword_1", "keyword_2"], // keywords to look for in messages (case-insensitive)
                                        // these are hot-reloaded every 3 minutes, no restart needed

  pollIntervalMs: 90000, // how often to check for new messages in milliseconds (default: 90s)

  apiUrl: null, // optional external API to post matches to — set to null to disable

  onKeywordCommand: null, // optional shell command(s) to run when a keyword is found
  // use _keyword_ and _channel_ as placeholders — they'll be replaced with the actual values. for example:
  // onKeywordCommand: '/opt/homebrew/bin/terminal-notifier -sound Glass -message "Keyword _keyword_ found on _channel_" -title "Yarn-A-Gram" -ignoreDnD'
  //
  // you can chain multiple commands with ; — for example:
  // onKeywordCommand: 'terminal-notifier -message "_keyword_ on _channel_" -title "Yarn-A-Gram"; curl -d "_keyword_ found!" ntfy.sh/your-topic'
  //
  // other practical examples:
  // play a sound on macOS:          "afplay /System/Library/Sounds/Ping.aiff"
  // desktop notification on Linux:  "notify-send '🔔 Keyword found on Telegram!'"
  // push via ntfy.sh:               "curl -d '_keyword_ found on _channel_!' ntfy.sh/your-topic"
  // run a custom script:            "bash /path/to/your/script.sh"
};
```

### 4. First run

On the first run you'll be prompted for your phone number and the confirmation code Telegram sends you. After authenticating, the script will print a `stringSession` string in the console — copy it into `config.js` so you won't need to log in again on future runs.

```bash
yarn start
```

## Usage

```bash
yarn start
```

Once running, the script polls the configured channels every `pollIntervalMs` milliseconds. When a message containing any of the keywords is detected, you'll receive a notification in your Telegram **Saved Messages** like this:

```
🔔 Keyword alert
📌 Keywords: keyword_1
📢 Channel: @channel_name_1
💬 Message: keyword_1 is yarned everywhere
🕒 4/12/2026, 10:32:00 AM
```

## Project Structure

```
├── index.js            # Main script
├── config.js           # Your credentials and settings (do not commit)
├── config.js.example   # Example config file — copy and rename to config.js
├── package.json
├── .gitignore
└── README.md
```

## Security

`config.js` contains sensitive credentials and is listed in `.gitignore`. **Never commit it.**