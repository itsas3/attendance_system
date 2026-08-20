import type { NextFunction, Request, Response } from "express";
import type { Device } from "@attendance/db";

import { env } from "../config.js";
import { prisma } from "../db.js";
import type { RequestWithRawBody } from "../server.js";
import { verifyDeviceSignature } from "./device-signature.js";

export type AuthenticatedDevice = Pick<
  Device,
  | "apiKeyHash"
  | "firmwareVersion"
  | "id"
  | "lastSeenAt"
  | "name"
  | "organizationId"
  | "reportedMode"
  | "status"
>;

export async function requireDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const deviceId = req.header("x-device-id");
  const timestamp = req.header("x-device-timestamp");
  const signature = req.header("x-device-signature");

  // console.log(deviceId);
  // console.log(timestamp);
  // console.log(signature);

  if (!deviceId || !timestamp || !signature) {
    res.status(401).json({ error: "missing_device_credentials" });
    return;
  }

  try {
    const device = await prisma.device.findUnique({
      select: {
        apiKeyHash: true,
        firmwareVersion: true,
        id: true,
        lastSeenAt: true,
        name: true,
        organizationId: true,
        reportedMode: true,
        status: true
      },
      where: {
        id: deviceId
      }
    });

    //console.log(device);

    if (!device) {
      res.status(401).json({ error: "invalid_device_credentials" });
      return;
    }

    if (device.status !== "ACTIVE") {
      res.status(403).json({ error: "device_not_active" });
      return;
    }

    if (!/^[a-f0-9]{64}$/i.test(device.apiKeyHash)) {
      res.status(403).json({ error: "device_secret_not_provisioned" });
      return;
    }

    const verification = verifyDeviceSignature(
      {
        body: (req as RequestWithRawBody).rawBody ?? Buffer.alloc(0),
        method: req.method,
        path: req.originalUrl,
        secretHash: device.apiKeyHash,
        signature,
        timestamp
      },
      { maxAgeSeconds: env.DEVICE_SIGNATURE_MAX_AGE_SECONDS }
    );

    if (!verification.ok) {
      res.status(401).json({ error: verification.reason });
      return;
    }

    res.locals.device = device;
    next();
  } catch (error) {
    next(error);
  }
}
