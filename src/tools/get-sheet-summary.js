/**
 * Get Sheet Summary Tool
 * Get detailed summary of a specific expense sheet
 */

import { BaseTool } from './base-tool.js';

export class GetSheetSummaryTool extends BaseTool {
  constructor() {
    super(
      'get_sheet_summary',
      'Obtener resumen detallado de una hoja de gastos específica. Incluye información general, balance actual, participantes, últimos movimientos y próximas acciones recomendadas.'
    );
  }

  getInputSchema() {
    return {
      type: 'object',
      properties: {
        sheet_id: {
          type: 'string',
          description: 'ID único de la hoja de gastos a consultar'
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Incluir sugerencias de próximas acciones',
          default: true
        }
      },
      required: ['sheet_id']
    };
  }

  async execute(params, user, keyId) {
    try {
      this.validateParams(params, ['sheet_id']);

      // Get sheet state from Agent API
      const stateResponse = await this.makeAgentAPIRequest(
        `/sheets/${params.sheet_id}/state?include_suggestions=${params.include_suggestions}`,
        'GET',
        null,
        user,
        keyId
      );

      // Get additional details
      const [balance, participants, recentEvents] = await Promise.all([
        this.getSheetBalance(params.sheet_id, user, keyId),
        this.getSheetParticipants(params.sheet_id, user, keyId),
        this.getRecentEvents(params.sheet_id, user, keyId)
      ]);

      // Format comprehensive summary
      const summary = {
        success: true,
        message: 'Resumen de hoja obtenido exitosamente',
        sheet: {
          id: params.sheet_id,
          type: this.formatSheetType(stateResponse.type),
          status: this.formatSheetStatus(stateResponse.status),
          period_info: stateResponse.period_info,
          
          // Balance information
          balance: this.formatBalance(balance),
          
          // Participants information
          participants: this.formatParticipants(participants),
          
          // Recent activity
          recent_activity: this.formatRecentEvents(recentEvents),
          
          // Pending items
          pending_items: {
            count: stateResponse.pending_items_count,
            description: this.getPendingItemsDescription(stateResponse.pending_items_count)
          },
          
          // Next steps and recommendations
          next_steps: this.formatNextSteps(stateResponse.next_steps || []),
          
          // Summary insights
          insights: this.generateInsights(stateResponse, balance, participants, recentEvents)
        }
      };

      return summary;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get sheet balance details
   */
  async getSheetBalance(sheetId, user, keyId) {
    try {
      return await this.makeAgentAPIRequest(
        `/sheets/${sheetId}/balance`,
        'GET',
        null,
        user,
        keyId
      );
    } catch (error) {
      // Return basic structure if balance fails
      return {
        is_balanced: false,
        participants: [],
        settlements_needed: []
      };
    }
  }

  /**
   * Get sheet participants
   */
  async getSheetParticipants(sheetId, user, keyId) {
    try {
      return await this.makeAgentAPIRequest(
        `/sheets/${sheetId}/participants`,
        'GET',
        null,
        user,
        keyId
      );
    } catch (error) {
      return { participants: [], summary: { total_count: 0 } };
    }
  }

  /**
   * Get recent events
   */
  async getRecentEvents(sheetId, user, keyId) {
    try {
      return await this.makeAgentAPIRequest(
        `/sheets/${sheetId}/events?limit=5`,
        'GET',
        null,
        user,
        keyId
      );
    } catch (error) {
      return { events: [] };
    }
  }

  /**
   * Format sheet type for display
   */
  formatSheetType(type) {
    const types = {
      'shared': 'Gastos Compartidos',
      'personal': 'Gastos Personales',
      'registry': 'Registro de Gastos'
    };
    return types[type] || type;
  }

  /**
   * Format sheet status
   */
  formatSheetStatus(status) {
    const statuses = {
      'active': 'Activa',
      'archived': 'Archivada',
      'closed': 'Cerrada'
    };
    return statuses[status] || status;
  }

  /**
   * Format balance information
   */
  formatBalance(balance) {
    if (!balance) {
      return {
        status: 'No disponible',
        description: 'No se pudo obtener información de balance'
      };
    }

    const result = {
      is_balanced: balance.is_balanced,
      status: balance.is_balanced ? 'Equilibrado' : 'Desbalanceado',
      currency: balance.currency || 'ARS',
      total_expenses: balance.total_expenses || 0
    };

    if (!balance.is_balanced && balance.settlements_needed) {
      result.settlements = balance.settlements_needed.map(settlement => ({
        from: settlement.from_name,
        to: settlement.to_name,
        amount: settlement.amount,
        description: `${settlement.from_name} debe pagar $${settlement.amount.toFixed(2)} a ${settlement.to_name}`
      }));
      
      result.description = `Se necesitan ${balance.settlements_needed.length} transferencia${balance.settlements_needed.length !== 1 ? 's' : ''} para equilibrar`;
    } else {
      result.description = 'Todos los gastos están equilibrados';
    }

    return result;
  }

  /**
   * Format participants information
   */
  formatParticipants(participants) {
    if (!participants || !participants.participants) {
      return {
        count: 0,
        description: 'No se pudo obtener información de participantes'
      };
    }

    return {
      count: participants.summary?.total_count || 0,
      active_count: participants.summary?.active_count || 0,
      list: participants.participants.slice(0, 5).map(p => ({
        name: p.name,
        role: this.formatRole(p.role),
        status: p.status === 'active' ? 'Activo' : 'Inactivo',
        is_current_user: p.is_current_user
      })),
      description: `${participants.summary?.total_count || 0} participante${(participants.summary?.total_count || 0) !== 1 ? 's' : ''}`
    };
  }

  /**
   * Format recent events
   */
  formatRecentEvents(events) {
    if (!events || !events.events) {
      return {
        count: 0,
        description: 'Sin actividad reciente'
      };
    }

    return {
      count: events.events.length,
      events: events.events.map(event => ({
        type: this.formatEventType(event.event_type),
        user: event.user_name,
        description: event.description,
        time: this.formatEventTime(event.timestamp)
      })),
      description: `${events.events.length} evento${events.events.length !== 1 ? 's' : ''} reciente${events.events.length !== 1 ? 's' : ''}`
    };
  }

  /**
   * Format next steps
   */
  formatNextSteps(nextSteps) {
    return nextSteps.map(step => ({
      action: step.action,
      description: step.description,
      urgency: step.urgency,
      urgency_label: this.formatUrgency(step.urgency)
    }));
  }

  /**
   * Generate insights about the sheet
   */
  generateInsights(state, balance, participants, events) {
    const insights = [];

    // Balance insights
    if (balance?.is_balanced) {
      insights.push({
        type: 'positive',
        message: '✅ La hoja está perfectamente equilibrada'
      });
    } else if (balance?.settlements_needed?.length > 0) {
      const totalPending = balance.settlements_needed.reduce((sum, s) => sum + s.amount, 0);
      insights.push({
        type: 'warning',
        message: `⚠️ Hay $${totalPending.toFixed(2)} pendiente de equilibrar entre participantes`
      });
    }

    // Activity insights
    if (events?.events?.length === 0) {
      insights.push({
        type: 'info',
        message: '📊 No hay actividad reciente en esta hoja'
      });
    } else if (events?.events?.length > 0) {
      insights.push({
        type: 'positive',
        message: `📈 Hay ${events.events.length} eventos recientes - hoja activa`
      });
    }

    // Participation insights
    if (participants?.summary?.total_count > 1) {
      insights.push({
        type: 'info',
        message: `👥 Hoja colaborativa con ${participants.summary.total_count} participantes`
      });
    }

    return insights;
  }

  /**
   * Helper methods
   */
  formatRole(role) {
    const roles = {
      'owner': 'Propietario',
      'editor': 'Editor',
      'viewer': 'Visualizador'
    };
    return roles[role] || role;
  }

  formatEventType(type) {
    const types = {
      'expense_created': 'Gasto creado',
      'expense_edited': 'Gasto editado',
      'expense_deleted': 'Gasto eliminado',
      'comment_added': 'Comentario agregado',
      'participant_added': 'Participante agregado'
    };
    return types[type] || type;
  }

  formatEventTime(timestamp) {
    if (!timestamp) return 'Fecha desconocida';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('es-ES');
  }

  formatUrgency(urgency) {
    const urgencies = {
      'high': 'Alta',
      'medium': 'Media',
      'low': 'Baja'
    };
    return urgencies[urgency] || urgency;
  }

  getPendingItemsDescription(count) {
    if (count === 0) return 'No hay elementos pendientes';
    return `${count} elemento${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''}`;
  }
}