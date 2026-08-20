import { Router, type Response } from "express";
import { Prisma } from "@attendance/db";
import { ZodError } from "zod";
import {
  deviceEnrollmentResultSchema,
  deviceHeartbeatSchema,
  deviceScanSchema
} from "@attendance/shared";

import { prisma } from "../db.js";
import { type AuthenticatedDevice, requireDeviceAuth } from "../lib/device-auth.js";

export const deviceRouter = Router();

deviceRouter.use(requireDeviceAuth);

deviceRouter.post("/heartbeat", async (req, res) => {
  let heartbeat;

  try {
    heartbeat = deviceHeartbeatSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "invalid_request", issues: error.issues });
      return;
    }

    throw error;
  }

  try {
    const device = getAuthenticatedDevice(res);

    if (heartbeat.deviceId !== device.id) {
      res.status(400).json({ error: "device_id_mismatch" });
      return;
    }

    const now = new Date();
    const heartbeatResponse = await prisma.$transaction(async (tx) => {
      await tx.enrollmentSession.updateMany({
        data: {
          completedAt: now,
          errorMessage: "Enrollment session expired before completion",
          status: "EXPIRED"
        },
        where: {
          deviceId: device.id,
          expiresAt: { lte: now },
          status: { in: ["PENDING", "CLAIMED"] }
        }
      });

      const updatedDevice = await tx.device.update({
        data: {
          firmwareVersion: heartbeat.firmwareVersion ?? device.firmwareVersion,
          lastSeenAt: now,
          modeChangedAt: heartbeat.reportedMode === device.reportedMode ? undefined : now,
          reportedMode: heartbeat.reportedMode,
          status: "ACTIVE"
        },
        select: {
          id: true
        },
        where: {
          id: device.id
        }
      });

      const reportedSession = heartbeat.activeEnrollmentSessionId
        ? await tx.enrollmentSession.findFirst({
            select: {
              expiresAt: true,
              id: true,
              status: true,
              scannerTemplateId: true
            },
            where: {
              deviceId: device.id,
              id: heartbeat.activeEnrollmentSessionId
            }
          })
        : null;

      const reportedSessionIsActive =
        reportedSession?.status === "PENDING" || reportedSession?.status === "CLAIMED";
      const cancelEnrollmentSessionId =
        heartbeat.activeEnrollmentSessionId && !reportedSessionIsActive
          ? heartbeat.activeEnrollmentSessionId
          : null;

      let enrollmentSession = cancelEnrollmentSessionId
        ? null
        : reportedSessionIsActive
          ? reportedSession
          : await tx.enrollmentSession.findFirst({
              orderBy: { createdAt: "asc" },
              select: {
                expiresAt: true,
                id: true,
                status: true,
                scannerTemplateId: true
              },
              where: {
                deviceId: device.id,
                expiresAt: { gt: now },
                status: { in: ["PENDING", "CLAIMED"] }
              }
            });

      if (enrollmentSession?.status === "PENDING") {
        const claimed = await tx.enrollmentSession.updateMany({
          data: {
            claimedAt: now,
            status: "CLAIMED"
          },
          where: {
            id: enrollmentSession.id,
            status: "PENDING"
          }
        });

        if (claimed.count === 0) {
          enrollmentSession = null;
        }
      }

      return {
        accepted: true as const,
        cancelEnrollmentSessionId,
        desiredMode: enrollmentSession ? ("ENROLL" as const) : ("SCAN" as const),
        deviceId: updatedDevice.id,
        enrollment: enrollmentSession
          ? {
              expiresAt: enrollmentSession.expiresAt.toISOString(),
              sessionId: enrollmentSession.id,
              templateId: enrollmentSession.scannerTemplateId
            }
          : null,
        lastSeenAt: now.toISOString()
      };
    });

    res.status(202).json(heartbeatResponse);
  } catch (error) {
    console.error("❌ HEARTBEAT ERROR:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "");
    res.status(500).json({
      error: "heartbeat_processing_failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

deviceRouter.post("/scans", async (req, res) => {
  try {
    const scan = deviceScanSchema.parse(req.body);
    const device = getAuthenticatedDevice(res);

    if (scan.deviceId !== device.id) {
      res.status(400).json({ error: "device_id_mismatch" });
      return;
    }

    const enrollment = await prisma.fingerprintEnrollment.findFirst({
      select: {
        employeeId: true
      },
      where: {
        deviceId: device.id,
        scannerTemplateId: scan.scannerTemplateId,
        status: "ACTIVE"
      }
    });

    const data = {
      deviceId: device.id,
      organizationId: device.organizationId,
      deviceScanSequence: scan.deviceScanSequence,
      employeeId: enrollment?.employeeId,
      firmwareVersion: scan.firmwareVersion,
      matchConfidence:
        scan.matchConfidence === undefined ? undefined : new Prisma.Decimal(scan.matchConfidence),
      rawPayload: scan as Prisma.InputJsonValue,
      scannerTemplateId: scan.scannerTemplateId
    } satisfies Prisma.ScanEventUncheckedCreateInput;

    try {
      const createdScan = await prisma.scanEvent.create({
        data,
        select: {
          employeeId: true,
          id: true
        }
      });

      res.status(202).json({
        accepted: true,
        duplicate: false,
        employeeId: createdScan.employeeId,
        scanEventId: createdScan.id,
        scannerTemplateId: scan.scannerTemplateId
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || scan.deviceScanSequence === undefined) {
        throw error;
      }

      const existingScan = await prisma.scanEvent.findFirst({
        select: {
          employeeId: true,
          id: true
        },
        where: {
          deviceId: device.id,
          deviceScanSequence: scan.deviceScanSequence
        }
      });

      res.status(202).json({
        accepted: true,
        duplicate: true,
        employeeId: existingScan?.employeeId ?? null,
        scanEventId: existingScan?.id ?? null,
        scannerTemplateId: scan.scannerTemplateId
      });
    }
  } catch (error) {
    console.error("❌ SCAN ERROR:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "");
    res.status(500).json({
      error: "scan_processing_failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

deviceRouter.post("/enrollment-result", async (req, res) => {
  const result = deviceEnrollmentResultSchema.parse(req.body);
  const device = getAuthenticatedDevice(res);

  if (result.deviceId !== device.id) {
    res.status(400).json({ error: "device_id_mismatch" });
    return;
  }

  const updatedEnrollment = await prisma.$transaction(async (tx) => {
    const enrollmentSession = await tx.enrollmentSession.findFirst({
      select: {
        employeeId: true,
        id: true,
        status: true
      },
      where: {
        deviceId: device.id,
        id: result.enrollmentSessionId
      }
    });

    if (!enrollmentSession) {
      return null;
    }

    if (!["PENDING", "CLAIMED"].includes(enrollmentSession.status)) {
      return {
        conflict: enrollmentSession.status !== result.status,
        id: enrollmentSession.id,
        status: enrollmentSession.status
      };
    }

    if (result.status === "SUCCEEDED") {
      await tx.fingerprintEnrollment.upsert({
        create: {
          deviceId: device.id,
          employeeId: enrollmentSession.employeeId,
          scannerTemplateId: result.scannerTemplateId,
          status: "ACTIVE"
        },
        update: {
          enrolledAt: new Date(),
          revokedAt: null,
          scannerTemplateId: result.scannerTemplateId,
          status: "ACTIVE"
        },
        where: {
          employeeId_deviceId: {
            deviceId: device.id,
            employeeId: enrollmentSession.employeeId
          }
        }
      });
    }

    const completedEnrollment = await tx.enrollmentSession.update({
      data: {
        completedAt: new Date(),
        errorMessage: result.status === "SUCCEEDED" ? null : result.message,
        scannerTemplateId: result.status === "SUCCEEDED" ? result.scannerTemplateId : null,
        status: result.status
      },
      select: {
        id: true,
        status: true
      },
      where: {
        id: enrollmentSession.id
      }
    });

    return { ...completedEnrollment, conflict: false };
  });

  if (!updatedEnrollment) {
    res.status(404).json({ error: "enrollment_session_not_found" });
    return;
  }

  if (updatedEnrollment.conflict) {
    res.status(409).json({
      error: "enrollment_session_already_completed",
      enrollmentSessionId: updatedEnrollment.id,
      status: updatedEnrollment.status
    });
    return;
  }

  res.status(202).json({
    accepted: true,
    enrollmentSessionId: updatedEnrollment.id,
    status: updatedEnrollment.status
  });
});

function getAuthenticatedDevice(res: Response) {
  return res.locals.device as AuthenticatedDevice;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
