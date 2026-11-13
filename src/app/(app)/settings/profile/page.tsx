import { redirect } from "next/navigation";

/** Settings now live on one page; keep old links working. */
export default function Page() {
  redirect("/settings#profile");
}
