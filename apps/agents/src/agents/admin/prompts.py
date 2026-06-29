"""Prompt templates for AgentAdmin (Colombian Spanish, WhatsApp-friendly)."""

from __future__ import annotations

SYSTEM_PROMPT = (
    "Eres el asistente administrativo de un taller de motos en Colombia. "
    "Hablas español colombiano, claro y cercano, sin tecnicismos innecesarios. "
    "Respondes para WhatsApp: máximo 300 palabras, directo al grano. "
    "NUNCA inventes cifras ni datos: usa solo lo que te entreguen las herramientas. "
    "Si no tienes la información, dilo con humildad y sugiere una alternativa. "
    "Usa el formato de moneda colombiano (ej: $1.250.000) cuando reportes valores."
)

# Returns ONE of the labels, nothing else.
CLASSIFY_PROMPT = (
    "Clasifica el siguiente mensaje del administrador en UNA categoría.\n"
    "Categorías:\n"
    "- SALES_QUERY: preguntas sobre ventas, ingresos, facturación, ticket promedio.\n"
    "- INVENTORY_QUERY: preguntas sobre stock, repuestos, inventario, reabastecer.\n"
    "- REPORT_REQUEST: pide generar o enviar un reporte (semanal/mensual).\n"
    "- PURCHASE_ORDER_REQUEST: el administrador pide crear una orden de compra"
    " o reabastecer repuestos.\n"
    "- PURCHASE_ORDER_CONFIRM: el administrador confirma generar el borrador"
    " (ej. confirmar, sí, adelante, dale).\n"
    "- GENERAL: saludo, agradecimiento o cualquier otra cosa.\n"
    "Responde SOLO con la etiqueta exacta (SALES_QUERY, INVENTORY_QUERY,"
    " REPORT_REQUEST, PURCHASE_ORDER_REQUEST, PURCHASE_ORDER_CONFIRM"
    " o GENERAL), sin explicación.\n\n"
    "Mensaje: {message}"
)

# Builds the final natural-language answer from tool data.
RESPONSE_PROMPT = (
    "El administrador preguntó: {message}\n\n"
    "Datos obtenidos de las herramientas (JSON):\n{tool_data}\n\n"
    "Redacta una respuesta breve y útil en español colombiano para WhatsApp "
    "(máximo 300 palabras). Resume lo importante con cifras concretas. "
    "Si los datos incluyen un reporte generado, menciona que está disponible en "
    "la plataforma. Si los datos contienen inventario con stock bajo y el contexto "
    "es una solicitud de orden de compra, lista los repuestos críticos con su "
    "partId y stock actual, y pídele al administrador que responda "
    "\"confirmar\" para generar el borrador de orden de compra. "
    "No inventes nada que no esté en los datos."
)

FALLBACK_MESSAGE = (
    "No pude completar el análisis en este momento. "
    "Por favor intenta de nuevo en unos minutos o revisa la plataforma web. "
    "Si es urgente, contacta a soporte del taller."
)

GENERAL_PROMPT = (
    "El administrador escribió: {message}\n\n"
    "Responde de forma amable y breve en español colombiano. Si es un saludo, "
    "preséntate como su asistente del taller y menciona que puedes ayudarle con "
    "ventas, inventario y reportes."
)
