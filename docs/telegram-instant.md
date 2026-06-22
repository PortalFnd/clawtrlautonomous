# Telegram Instant Mode

Default polling checks for messages every 5 minutes. For ~1s response time, deploy this Cloudflare Worker as a Telegram webhook.

## Worker code

```js
export default {
  async fetch(request, env) {
    const { message } = await request.json();
    if (!message?.text || String(message.chat.id) !== env.TELEGRAM_CHAT_ID)
      return new Response("ignored");

    // Advance offset so polling doesn't reprocess
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${message.update_id + 1}`);

    // Trigger GitHub Actions immediately
    await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: { Authorization: `token ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({ event_type: "telegram-message", client_payload: { message: message.text } }),
    });

    return new Response("ok");
  },
};
```

## Setup

1. Create a Cloudflare Worker and paste the code above
2. Set environment variables in the Cloudflare dashboard:
   - `TELEGRAM_BOT_TOKEN` — your bot token from @BotFather
   - `TELEGRAM_CHAT_ID` — your chat ID
   - `GITHUB_REPO` — `owner/repo` format (e.g. `aaronjmars/aeon`)
   - `GITHUB_TOKEN` — a GitHub PAT with `repo` scope
3. Point your bot's webhook at the Worker URL:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-worker.workers.dev"
   ```

Messages now arrive in ~1 second instead of up to 5 minutes.
