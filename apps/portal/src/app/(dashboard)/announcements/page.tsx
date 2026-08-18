import { requireCurrentUser } from "../../../lib/session";
import { AnnouncementList } from "./_components/announcement-list";
import { AnnouncementsHeader } from "./_components/announcements-header";
import { canManageAnnouncements } from "./permissions";
import { getAnnouncements, markAnnouncementsViewed } from "./queries";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await requireCurrentUser();
  const announcements = await getAnnouncements(user.organizationId);
  await markAnnouncementsViewed(user.employeeId);
  const canManage = canManageAnnouncements(user);

  return (
    <main className="app-shell">
      <AnnouncementsHeader canManageAnnouncements={canManage} />
      <AnnouncementList announcements={announcements} canManageAnnouncements={canManage} />
    </main>
  );
}
