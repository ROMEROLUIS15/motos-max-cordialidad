import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';
import { WorkshopModule } from './workshop.module';
import { VehiclesModule } from './vehicles.module';
import { InventoryModule } from './inventory.module';
import { CommerceModule } from './commerce.module';
import { HomeServicesModule } from './home-services.module';

// AI infrastructure
import { DeepSeekAdapter } from './infrastructure/ai/deepseek.adapter';
import { GroqAdapter } from './infrastructure/ai/groq.adapter';
import { LLMProviderFactory } from './infrastructure/ai/llm-provider.factory';
import { ToolRegistry } from './infrastructure/ai/tools/tool-registry';
import { ToolExecutor } from './infrastructure/ai/tool-executor';
import { RouterAgent } from './infrastructure/ai/router-agent';
import { AgentsServiceClient } from './infrastructure/agents/agents-service.client';

// Use cases
import { ProcessIncomingMessageUseCase } from './application/use-cases/messaging/process-incoming-message.use-case';
import {
  SendManualMessageUseCase,
  ListSessionsUseCase,
  GetConversationHistoryUseCase,
} from './application/use-cases/messaging/messaging.use-cases';

// Controllers
import { WhatsAppWebhookController } from './presentation/http/controllers/whatsapp-webhook.controller';
import { MessagesController } from './presentation/http/controllers/messages.controller';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    MessagingModule,
    NotificationsModule,
    WorkshopModule,
    VehiclesModule,
    InventoryModule,
    CommerceModule,
    HomeServicesModule,
  ],
  controllers: [WhatsAppWebhookController, MessagesController],
  providers: [
    DeepSeekAdapter,
    GroqAdapter,
    LLMProviderFactory,
    ToolRegistry,
    ToolExecutor,
    RouterAgent,
    AgentsServiceClient,
    ProcessIncomingMessageUseCase,
    SendManualMessageUseCase,
    ListSessionsUseCase,
    GetConversationHistoryUseCase,
  ],
})
export class AiModule {}
