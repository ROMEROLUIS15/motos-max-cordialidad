import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderFactory } from './llm-provider.factory';
import { ToolRegistry } from './tools/tool-registry';
import { ToolExecutor } from './tool-executor';
import { ExecutionContext, toLLMToolDefinition } from '../../application/ai/agent-tool';
import {
  LLMMessage,
  AllLLMProvidersFailedException,
} from '../../application/ports/llm-provider.port';
import {
  RouterAgentPort,
  RouterAgentInput,
  RouterAgentResult,
} from '../../application/ports/router-agent.port';

const MAX_TOOL_CALLS = 5;
const MAX_ATTEMPTS = 3;
const FALLBACK_MESSAGE =
  'Gracias por tu mensaje. En este momento no puedo resolver tu consulta automáticamente; ' +
  'un miembro de nuestro equipo te atenderá lo antes posible.';

@Injectable()
export class RouterAgent implements RouterAgentPort {
  private readonly logger = new Logger(RouterAgent.name);

  constructor(
    private readonly llmFactory: LLMProviderFactory,
    private readonly toolRegistry: ToolRegistry,
    private readonly toolExecutor: ToolExecutor,
  ) {}

  async process(input: RouterAgentInput): Promise<RouterAgentResult> {
    // Explicit human request → escalate immediately.
    if (/\b(humano|persona|asesor|recepcionista|agente real)\b/i.test(input.message)) {
      return { response: 'Te comunico con un asesor humano.', escalated: true, toolCalls: 0 };
    }

    const tools = input.isRegistered
      ? this.toolRegistry.getAllTools()
      : this.toolRegistry.getPublicTools();

    const ctx: ExecutionContext = {
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      callCount: 0,
    };

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt(input.isRegistered) },
      ...input.history,
      { role: 'user', content: input.message },
    ];

    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      try {
        const result = await this.llmFactory.complete({
          messages,
          tools: tools.map(toLLMToolDefinition),
        });

        if (!result.requiresTool) {
          return {
            response: result.response ?? FALLBACK_MESSAGE,
            escalated: false,
            toolCalls: ctx.callCount,
          };
        }

        if (ctx.callCount >= MAX_TOOL_CALLS) {
          this.logger.warn(`callCount limit (${MAX_TOOL_CALLS}) reached — escalating`);
          return { response: FALLBACK_MESSAGE, escalated: true, toolCalls: ctx.callCount };
        }

        const tool = result.toolName ? this.toolRegistry.getByName(result.toolName) : undefined;
        if (!tool || (!input.isRegistered && !tool.isPublic)) {
          return { response: FALLBACK_MESSAGE, escalated: true, toolCalls: ctx.callCount };
        }

        ctx.callCount += 1;
        const execResult = await this.toolExecutor.execute(tool, result.toolArgs ?? {}, ctx);
        messages.push({
          role: 'tool',
          toolCallId: result.toolCallId,
          content: JSON.stringify(execResult.ok ? execResult.output : { error: execResult.error }),
        });
        // Loop again so the LLM can use the tool result.
      } catch (error) {
        attempts += 1;
        if (error instanceof AllLLMProvidersFailedException) {
          this.logger.error('All LLM providers failed');
          return { response: FALLBACK_MESSAGE, escalated: true, toolCalls: ctx.callCount };
        }
        this.logger.warn(`RouterAgent attempt ${attempts} failed: ${(error as Error).message}`);
      }
    }

    return { response: FALLBACK_MESSAGE, escalated: true, toolCalls: ctx.callCount };
  }

  private systemPrompt(isRegistered: boolean): string {
    return [
      'Eres el asistente virtual de un taller de motocicletas.',
      'Responde de forma breve y cordial en el idioma del cliente.',
      'Usa las herramientas disponibles cuando necesites datos concretos.',
      isRegistered
        ? 'El cliente está registrado: puedes consultar sus órdenes, vehículos e inventario.'
        : 'El cliente NO está registrado: solo puedes ofrecer información general del negocio.',
      'Si no puedes resolver la consulta, indica que un asesor humano continuará la atención.',
    ].join(' ');
  }
}
