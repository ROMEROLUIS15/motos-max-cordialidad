export const AGENTS_SERVICE_PORT = Symbol('AgentsServicePort');

export interface AgentsServicePort {
  routeAdminMessage(input: {
    tenantId: string;
    phoneNumber: string;
    message: string;
  }): Promise<boolean>;
}
