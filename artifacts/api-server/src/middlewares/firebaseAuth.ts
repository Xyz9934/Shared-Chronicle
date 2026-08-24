import { getAuth } from "firebase-admin/auth";
import type { NextFunction, Request, Response } from "express";
import { getFirebaseAdminApp } from "../services/firebaseAdmin";

export async function verifyFirebaseIdToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ error: "A Firebase bearer token is required." });
    return;
  }

  try {
    const decodedToken = await getAuth(getFirebaseAdminApp()).verifyIdToken(token);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({
      error: "The Firebase bearer token is invalid or expired.",
      ...(process.env.NODE_ENV === "development" && {
        detail: error instanceof Error ? error.message : "Token verification failed",
      }),
    });
  }
}
