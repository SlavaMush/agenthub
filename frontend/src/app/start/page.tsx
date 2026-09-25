import { redirect } from "next/navigation";

// Onboarding moved to the home page; keep old links working.
export default function Start() {
  redirect("/");
}
