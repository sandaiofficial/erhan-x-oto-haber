import { Client, OAuth1 } from "@xdevplatform/xdk";

function isDryRun() {
  return String(process.env.DRY_RUN || "true").toLowerCase() !== "false";
}

function requireCredential(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ayarlanmadı.`);
  return value;
}

export async function publishPost(text) {
  if (isDryRun()) {
    console.log(`\n[DRY RUN — X'e gönderilmedi]\n${text}\n`);
    return { id: "dry-run", text };
  }

  const oauth1 = new OAuth1({
    apiKey: requireCredential("X_API_KEY"),
    apiSecret: requireCredential("X_API_SECRET"),
    accessToken: requireCredential("X_ACCESS_TOKEN"),
    accessTokenSecret: requireCredential("X_ACCESS_TOKEN_SECRET")
  });

  const client = new Client({ oauth1 });
  const response = await client.posts.create({ text });

  if (!response?.data?.id) {
    throw new Error("X API paylaşımı oluşturamadı.");
  }

  return response.data;
}
