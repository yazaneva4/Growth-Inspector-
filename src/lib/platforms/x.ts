import crypto from "node:crypto";

/**
 * Lets the agent actually publish to X (Twitter) — not just reply to DMs.
 * Uses OAuth 1.0a user-context signing (X API v2 requires this for posting
 * as a specific account on the free/basic tiers) implemented by hand with
 * Node's crypto, so no extra dependency is needed.
 */
export const X_CONFIGURED = Boolean(
  process.env.X_API_KEY &&
    process.env.X_API_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_ACCESS_SECRET,
);

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Builds the OAuth 1.0a Authorization header for a request. Only oauth_*
 * params (and any query-string params) go into the signature base string —
 * JSON request bodies are NOT included, per the OAuth 1.0a spec and X's own
 * v2 examples for JSON endpoints like POST /2/tweets.
 */
function buildOAuthHeader(method: string, url: string): string {
  const consumerKey = process.env.X_API_KEY!;
  const consumerSecret = process.env.X_API_SECRET!;
  const token = process.env.X_ACCESS_TOKEN!;
  const tokenSecret = process.env.X_ACCESS_SECRET!;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
      .join(", ")
  );
}

/** Publishes a post to X, optionally as a reply to an existing tweet/comment. */
export async function postTweet(
  text: string,
  replyToTweetId?: string,
): Promise<{ id: string; url: string }> {
  const url = "https://api.twitter.com/2/tweets";
  const body: Record<string, unknown> = { text };
  if (replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: replyToTweetId };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuthHeader("POST", url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`X post failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { id: string } };
  return { id: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` };
}
