import { NextResponse } from "next/server";
import { createPrismaClient } from "@attendance/db";
import { getCurrentUser } from "../../../../../../../lib/session";
import { isHr } from "../../../../permissions";

const db = createPrismaClient(process.env.DATABASE_URL as string);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; applicationId: string }> }
) {
  const user = await getCurrentUser();

  if (!isHr(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id, applicationId } = await params;

  const application = await db.jobApplication.findFirst({
    where: {
      id: applicationId,
      jobPostingId: id,
      jobPosting: { organizationId: user!.organizationId }
    }
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeFileName = application.cvFileName.replace(/["\r\n]/g, "");

  return new NextResponse(new Uint8Array(application.cvFileData), {
    headers: {
      "Content-Type": application.cvFileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(application.cvFileSize)
    }
  });
}
