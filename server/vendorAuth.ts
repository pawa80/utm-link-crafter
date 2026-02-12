import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { vendorSessions, vendorUsers } from "../shared/schema.js";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

interface VendorRequest extends Request {
  vendorUser?: {
    id: number;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  };
}

// Vendor authentication middleware
export const authenticateVendor = async (req: VendorRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Vendor authentication required' });
    }

    // Find valid session with active vendor user
    const [sessionData] = await db
      .select({
        vendorUser: vendorUsers,
        session: vendorSessions
      })
      .from(vendorSessions)
      .innerJoin(vendorUsers, eq(vendorSessions.vendorUserId, vendorUsers.id))
      .where(
        and(
          eq(vendorSessions.sessionToken, token),
          gt(vendorSessions.expiresAt, new Date()),
          eq(vendorUsers.isActive, true)
        )
      );

    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired vendor session' });
    }

    // Attach vendor user to request
    req.vendorUser = {
      id: sessionData.vendorUser.id,
      email: sessionData.vendorUser.email,
      fullName: sessionData.vendorUser.fullName,
      role: sessionData.vendorUser.role,
      isActive: sessionData.vendorUser.isActive
    };

    next();
  } catch (error) {
    console.error('Vendor authentication error:', error);
    return res.status(401).json({ error: 'Vendor authentication failed' });
  }
};

// Login function for vendor users
export const loginVendorUser = async (email: string, password: string, req: Request): Promise<{
  success: boolean;
  token?: string;
  vendorUser?: any;
  error?: string;
}> => {
  try {
    // Find vendor user by email
    const [vendorUser] = await db
      .select()
      .from(vendorUsers)
      .where(and(
        eq(vendorUsers.email, email),
        eq(vendorUsers.isActive, true)
      ));

    if (!vendorUser) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, vendorUser.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create session
    await db.insert(vendorSessions).values({
      vendorUserId: vendorUser.id,
      sessionToken,
      expiresAt,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    });

    // Update last login
    await db
      .update(vendorUsers)
      .set({ lastLogin: new Date() })
      .where(eq(vendorUsers.id, vendorUser.id));

    return {
      success: true,
      token: sessionToken,
      vendorUser: {
        id: vendorUser.id,
        email: vendorUser.email,
        fullName: vendorUser.fullName,
        role: vendorUser.role
      }
    };
  } catch (error) {
    console.error('Vendor login error:', error);
    return { success: false, error: 'Login failed' };
  }
};

// Logout function
export const logoutVendorUser = async (token: string): Promise<boolean> => {
  try {
    await db
      .delete(vendorSessions)
      .where(eq(vendorSessions.sessionToken, token));
    return true;
  } catch (error) {
    console.error('Vendor logout error:', error);
    return false;
  }
};

// Hash password utility
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};