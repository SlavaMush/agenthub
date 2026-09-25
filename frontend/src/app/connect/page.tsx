import { redirect } from "next/navigation";

// Old Telegram connect links (?sid=...) are superseded by /?tg=... links from the bot.
export default function Connect() {
  redirect("/");
}
