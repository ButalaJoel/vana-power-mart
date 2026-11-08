import { rateLimit } from "express-rate-limit";

// Request limits per IP address. Responses use the API's usual JSON shape.
function limiter(windowMinutes: number, limit: number, message: string) {
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });
}

export const limitAdminLogin = limiter(15, 10, "Too many login attempts. Please wait 15 minutes and try again.");
export const limitCustomerLogin = limiter(15, 10, "Too many login attempts. Please wait 15 minutes and try again.");
export const limitRegister = limiter(60, 10, "Too many sign-ups from this connection. Please try again later.");
export const limitOrders = limiter(10, 10, "Too many orders from this connection. Please wait a few minutes or call us.");
export const limitOrderLookup = limiter(10, 60, "Too many lookups. Please wait a few minutes.");
export const limitPaymentChecks = limiter(1, 60, "Too many payment checks. Please wait a moment.");
export const limitVoucherChecks = limiter(10, 30, "Too many voucher attempts. Please wait a few minutes.");
export const limitReviews = limiter(60, 20, "Too many reviews. Please try again later.");
export const limitOtp = limiter(15, 10, "Too many code requests from this connection. Please wait 15 minutes.");
