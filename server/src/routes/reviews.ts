import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { requireCustomer, type CustomerRequest } from "../middleware/customerAuth.js";
import { ValidationError, readBoolean, readInteger, readText } from "../lib/validation.js";
import { sendError } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { limitReviews } from "../middleware/rateLimits.js";

const reviewsRouter = Router();

async function findProduct(identifier: string) {
  return prisma.product.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], isActive: true } });
}

// GET /api/reviews/product/:identifier — visible reviews and the average.
reviewsRouter.get("/product/:identifier", async (req, res) => {
  try {
    const product = await findProduct(String(req.params.identifier));
    if (!product) throw new ValidationError("Product not found.", 404);

    const [reviews, stats] = await Promise.all([
      prisma.review.findMany({
        where: { productId: product.id, isVisible: true },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { customer: { select: { firstName: true, lastName: true } } },
      }),
      prisma.review.aggregate({ where: { productId: product.id, isVisible: true }, _avg: { rating: true }, _count: { _all: true } }),
    ]);

    res.json({
      success: true,
      data: {
        average: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null,
        count: stats._count._all,
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          title: review.title,
          body: review.body,
          isVerified: review.isVerified,
          createdAt: review.createdAt,
          author: `${review.customer.firstName} ${review.customer.lastName.charAt(0)}`.trim(),
        })),
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to load reviews.");
  }
});

// POST /api/reviews/product/:identifier — logged-in customers; one review
// per product (sending again updates it).
reviewsRouter.post("/product/:identifier", limitReviews, requireCustomer, async (req: CustomerRequest, res) => {
  try {
    const product = await findProduct(String(req.params.identifier));
    if (!product) throw new ValidationError("Product not found.", 404);

    const rating = readInteger(req.body?.rating, "Rating", { min: 1, max: 5 });
    const title = readText(req.body?.title, "Title", { max: 120 });
    const body = readText(req.body?.body, "Review", { max: 2000 });

    const delivered = await prisma.orderItem.findFirst({
      where: { productId: product.id, order: { customerId: req.customer!.id, status: "DELIVERED" } },
    });

    const review = await prisma.review.upsert({
      where: { productId_customerId: { productId: product.id, customerId: req.customer!.id } },
      create: { productId: product.id, customerId: req.customer!.id, rating, title, body, isVerified: Boolean(delivered) },
      update: { rating, title, body, isVerified: Boolean(delivered) },
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    sendError(res, error, "Unable to save your review.");
  }
});

// ---------- Admin ----------

reviewsRouter.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        product: { select: { name: true, slug: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    sendError(res, error, "Unable to load reviews.");
  }
});

reviewsRouter.patch("/admin/:id", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const review = await prisma.review.update({
      where: { id },
      data: { isVisible: readBoolean(req.body?.isVisible, "Visible") },
    });
    await audit(req.admin!.email, "review.visibility", "Review", id, req.body);
    res.json({ success: true, data: review });
  } catch (error) {
    sendError(res, error, "Unable to update the review.");
  }
});

export default reviewsRouter;
