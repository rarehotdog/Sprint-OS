import { redirect } from "next/navigation";

export default function ReviewDeepenPage() {
  redirect("/review/reports?mode=quick");
}
