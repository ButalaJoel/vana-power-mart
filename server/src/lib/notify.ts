import { prisma } from "./prisma.js";
import { getSettings } from "./settings.js";
import { sendSms } from "./sms.js";
import { documentToken } from "./documents.js";

// Customer and staff messages for order events. All sends are logged in the
// Notification table and shown on the admin order page.

export type OrderEvent =
  | "PLACED"
  | "CONFIRMED"
  | "AWAITING_STOCK"
  | "PROCESSING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "RETURN_UPDATE";

const money = (value: unknown) =>
  `UGX ${Number(value ?? 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;

function siteUrl() {
  return (process.env.PUBLIC_SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

export async function notifyOrder(orderId: string, event: OrderEvent, extra?: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });
    if (!order) return;

    const settings = await getSettings();
    const store = settings.storeName;
    const first = (order.customerName ?? order.customer.firstName).split(" ")[0];
    const phone = order.customerPhone ?? order.customer.phone;
    // The token opens the order straight away, with no need to type the phone.
    const track = `${siteUrl()}/track?order=${order.orderNumber}&t=${documentToken(order.orderNumber)}`;
    const help = settings.storePhone ? ` Questions? Call ${settings.storePhone}.` : "";

    const messages: Partial<Record<OrderEvent, string>> = {
      PLACED: `${store}: Thank you ${first}! Order ${order.orderNumber} received, total ${money(order.total)}. We will call you to confirm. Track: ${track}`,
      CONFIRMED: `${store}: Your order ${order.orderNumber} is confirmed and being prepared.${help}`,
      AWAITING_STOCK: `${store}: Some items in order ${order.orderNumber} are being restocked. We will update you shortly.${help}`,
      PROCESSING: `${store}: Order ${order.orderNumber} is being processed.`,
      READY_FOR_DELIVERY:
        order.deliveryMethod === "collection"
          ? `${store}: Order ${order.orderNumber} is ready for collection${settings.collectionAddress ? ` at ${settings.collectionAddress}` : ""}.${help}`
          : `${store}: Order ${order.orderNumber} is packed and ready for delivery.`,
      OUT_FOR_DELIVERY: `${store}: Order ${order.orderNumber} is on the way${order.deliveryAssignee ? ` with ${order.deliveryAssignee}${order.deliveryAssigneePhone ? ` (${order.deliveryAssigneePhone})` : ""}` : ""}. ${order.paymentStatus === "PAID" ? "It is already paid." : `Amount to pay: ${money(order.total)}.`}`,
      DELIVERED: `${store}: Order ${order.orderNumber} has been delivered. Thank you for shopping with us! Your receipt, and returns within ${settings.returnWindowDays} days: ${track}`,
      CANCELLED: `${store}: Order ${order.orderNumber} has been cancelled.${order.cancellationReason ? ` Reason: ${order.cancellationReason}.` : ""}${help}`,
      PAYMENT_RECEIVED: `${store}: Payment of ${money(order.total)} received for order ${order.orderNumber}. Thank you!`,
      PAYMENT_FAILED: `${store}: Payment for order ${order.orderNumber} did not go through. You can try again here: ${siteUrl()}/payment/${order.orderNumber}`,
      RETURN_UPDATE: `${store}: Update on your return for order ${order.orderNumber}: ${extra ?? ""}`.trim(),
    };

    const message = messages[event];
    if (message) await sendSms(phone, message, order.id);

    if (event === "PLACED") {
      const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const staffMessage = `New order ${order.orderNumber}: ${count} item(s), ${money(order.total)}, ${order.customerName ?? first} ${phone}. Status: ${order.status.replace(/_/g, " ").toLowerCase()}. Payment: ${order.paymentMethod}.`;
      for (const staffPhone of settings.staffAlertPhones) {
        await sendSms(staffPhone, staffMessage, order.id);
      }
    }
  } catch (error) {
    console.error(`Notification for order ${orderId} (${event}) failed:`, error);
  }
}

// Map an order status to the event customers are told about.
export function eventForStatus(status: string): OrderEvent | null {
  const events: Record<string, OrderEvent> = {
    CONFIRMED: "CONFIRMED",
    AWAITING_STOCK: "AWAITING_STOCK",
    READY_FOR_DELIVERY: "READY_FOR_DELIVERY",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
  };
  return events[status] ?? null;
}
