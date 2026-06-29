export const WHATSAPP_SENDER_PORT = Symbol('WhatsAppSenderPort');

export interface WhatsAppSenderPort {
  sendToPhone(
    tenantId: string,
    phone: string,
    customerId: string | null,
    content: string,
    sentBy: string | null,
  ): Promise<string>;
}
