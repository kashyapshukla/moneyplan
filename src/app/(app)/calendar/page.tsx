import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarData } from "@/lib/calendar";
import { BillCalendar } from "@/components/calendar/bill-calendar";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0); // end of next month

  const days = await getCalendarData(session.user.id, from, to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upcoming Bills</h1>
        <p className="text-sm text-slate-500 mt-1">
          Projected recurring bills and income for the next 2 months
        </p>
      </div>
      <BillCalendar days={days} />
    </div>
  );
}
