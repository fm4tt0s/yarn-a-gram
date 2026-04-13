// monitor specific Telegram channels for messages containing certain keywords
// and send notifications to yourself and an API when matches are found.
// Felipe Mattos - 2026-04
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fetch = require("node-fetch");
const { exec } = require("child_process");

// load config
const { apiId, apiHash, stringSession: sessionString,  useWSS,
  channelsToWatch, apiUrl, onKeywordCommand, pollIntervalMs, messageFetchLimit } = require("./config");
const stringSession = new StringSession(sessionString);
const CHANNELS_TO_WATCH = channelsToWatch;
const API_URL = apiUrl;
const ON_KEYWORD_COMMAND = onKeywordCommand;
const POLL_INTERVAL_MS = pollIntervalMs || 90000;
const USE_WSS = useWSS || false;
const MESSAGE_FETCH_LIMIT = messageFetchLimit || 5;
// ----------------------

// helper function to post to API
const postApi = async (body) => {
  if (!API_URL) return; // skip if no API URL is configured
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hasura-Role": "public",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return json;
};

// helper function to run a shell command
const runCommand = (command) => {
  if (!command) return;
  console.log(`Running command: ${command}`);
  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error("Command error:", err.message);
      return;
    }
    if (stdout) console.log("Command output:", stdout);
    if (stderr) console.error("Command stderr:", stderr);
  });
};


(async () => {
  console.log("Loading...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 10,
    retryDelay: 2000,
    useWSS: USE_WSS,
  });

  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  await client.connect();
  await client.getDialogs({ limit: 100 });

  console.log("Connected. Monitoring channels:", CHANNELS_TO_WATCH);

  // keywords — reloaded every 3 minutes so you can update config.js on the fly
  let KEYWORDS = require("./config").keywords;
  console.log("Watching for keywords:", KEYWORDS);
  setInterval(() => {
    delete require.cache[require.resolve("./config")];
    KEYWORDS = require("./config").keywords;
  }, 180000);

  console.log(client.session.save() + '\n');
  console.log("Starting monitoring...");

  // get your own user info to send messages to yourself
  const me = await client.getMe();

  // resolve channel entities upfront
  const channelEntities = await Promise.all(
    CHANNELS_TO_WATCH.map((username) => client.getEntity(username))
  );
  const channelIds = channelEntities.map((e) => e.id);
  console.log("Resolved channel IDs:", channelIds.map(id => id.toString()));

  // initialize last seen message IDs
  const lastMessageId = {};
  for (let i = 0; i < CHANNELS_TO_WATCH.length; i++) {
    const messages = await client.getMessages(channelEntities[i], { limit: 1 });
    lastMessageId[channelIds[i].toString()] = messages[0]?.id || 0;
    console.log(`Last message ID for ${CHANNELS_TO_WATCH[i]}: ${lastMessageId[channelIds[i].toString()]}`);
  }

  console.log(`\nPolling every ${POLL_INTERVAL_MS / 1000}s for new messages...`);

  setInterval(async () => {
    for (let i = 0; i < CHANNELS_TO_WATCH.length; i++) {
      try {
        const idKey = channelIds[i].toString();
        const messages = await client.getMessages(channelEntities[i], { limit: MESSAGE_FETCH_LIMIT });

        const newMessages = messages.filter(m => m.id > lastMessageId[idKey]);
        if (newMessages.length === 0) continue;

        // update last seen message ID
        lastMessageId[idKey] = newMessages[0].id;

        for (const message of newMessages.reverse()) {
          if (!message.text) continue;

          const matchedKeywords = KEYWORDS.filter(kw =>
            message.text.toLowerCase().includes(kw.toLowerCase())
          );

          if (matchedKeywords.length === 0) continue; // skip non-matching messages

          console.log(`[${CHANNELS_TO_WATCH[i]}] ${message.text.slice(0, 80)}`);
          console.log(`[MATCH] Keywords "${matchedKeywords.join(", ")}" found in ${CHANNELS_TO_WATCH[i]}`);
          console.log(`  Text: ${message.text}`);
          console.log(`  Date: ${new Date(message.date * 1000).toISOString()}`);

          // build the self-notification message
          const notification = [
            `🔔 <b>Keyword alert</b>`,
            `📌 Keywords: ${matchedKeywords.map(kw => `<code>${kw}</code>`).join(", ")}`,
            `📢 Channel: @${CHANNELS_TO_WATCH[i]}`,
            `💬 Message:\n${message.text}`,
            `🕒 ${new Date(message.date * 1000).toLocaleString()}`,
          ].join("\n");

          // send message to yourself
          try {
            await client.sendMessage(me, { message: notification, parseMode: "html" });
            console.log("Notification sent to yourself on Telegram.");
          } catch (err) {
            console.error("Failed to send Telegram notification:", err);
          }

          // post to your API
          try {
            const res = await postApi({
              text: message.text,
              chatId: idKey,
              date: message.date,
              messageId: message.id,
              matchedKeywords,
            });
            if (res) console.log("API response:", res);
          } catch (err) {
            console.error("Failed to post to API:", err);
          }

          // run the configured command
          if (ON_KEYWORD_COMMAND) {
            let command = ON_KEYWORD_COMMAND;
            if (command.includes("_keyword_")) {
              command = command.replace(/_keyword_/g, matchedKeywords.join(", "));
            }
            if (command.includes("_channel_")) {
              command = command.replace(/_channel_/g, CHANNELS_TO_WATCH[i]);
            }
            runCommand(command);
          }
        }
      } catch (err) {
        console.error(`Error polling ${CHANNELS_TO_WATCH[i]}:`, err.message);
      }
    }
  }, POLL_INTERVAL_MS);
})();