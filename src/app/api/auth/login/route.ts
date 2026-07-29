import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { err, handleApiError, ok } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { getRequestMeta } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  getClientIp,
  readJsonBody,
} from "@/lib/request-security";
import {
  LEGACY_SESSION_COOKIE_NAMES,
  SESSION_COOKIE_NAME,
  createRawSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "@/lib/session";
import { verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request, 16 * 1024);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten());
    }

    const { email, password } = parsed.data;
    const clientIp = getClientIp(request);

    await enforceRateLimit({
      namespace: "login-ip",
      identifier: clientIp,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    await enforceRateLimit({
      namespace: "login-account",
      identifier: `${clientIp}:${email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    const meta = await getRequestMeta();

    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      include: {
        company: true,
      },
    });

    if (!user) {
      return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);
    }

    if (!user.isActive) {
      return err("هذا الحساب غير مفعّل", 403);
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);
    }

    const rawToken = createRawSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = getSessionExpiry();

    await prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LOGIN,
        message: "تم تسجيل الدخول",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      });
    });

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
        },
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: rawToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
      priority: "high",
    });

    for (const legacyCookieName of LEGACY_SESSION_COOKIE_NAMES) {
      response.cookies.set({
        name: legacyCookieName,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
        priority: "high",
      });
    }

    return response;
  } catch (error) {
    return handleApiError(
      error,
      "LOGIN_ERROR",
      "حدث خطأ أثناء تسجيل الدخول"
    );
  }
}
