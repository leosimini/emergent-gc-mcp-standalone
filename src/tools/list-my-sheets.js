/**
 * List My Sheets Tool
 * Get all expense sheets accessible to the user
 */

import { BaseTool } from './base-tool.js';
import { CONFIG } from '../config.js';

export class ListMySheetsool extends BaseTool {
  constructor() {
    super(
      'list_my_sheets',
      'Obtener todas las hojas de gastos del usuario. Incluye hojas propias, compartidas y donde participa. Útil para ver un resumen de todas las hojas disponibles y sus estados.'
    );
  }

  getInputSchema() {
    return {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'owned', 'shared', 'archived', 'favorites'],
          description: 'Filtrar hojas por tipo: all (todas), owned (propias), shared (compartidas), archived (archivadas), favorites (favoritas)',
          default: 'all'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: CONFIG.TOOLS.MAX_LIMIT,
          description: `Número máximo de hojas a retornar (máximo ${CONFIG.TOOLS.MAX_LIMIT})`,
          default: CONFIG.TOOLS.DEFAULT_LIMIT
        }
      },
      required: []
    };
  }

  async execute(params, user, keyId) {
    try {
      // Set defaults
      const filter = params.filter || 'all';
      const limit = params.limit || CONFIG.TOOLS.DEFAULT_LIMIT;

      // Make request to backend to get user sheets
      // Since we don't have a direct Agent API endpoint for this, we'll use the main sheets endpoint
      const sheets = await this.getUserSheets(user, keyId, filter, limit);

      // Format response for LLM
      const result = {
        success: true,
        message: `Se encontraron ${sheets.length} hojas de gastos`,
        sheets: sheets.map(sheet => this.formatSheetSummary(sheet)),
        summary: {
          total_sheets: sheets.length,
          by_type: this.groupByType(sheets),
          by_status: this.groupByStatus(sheets)
        }
      };

      return result;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user sheets from backend
   */
  async getUserSheets(user, keyId, filter, limit) {
    // This would typically call the Agent API, but since we don't have a sheets list endpoint there yet,
    // we'll call the main backend API directly with user context
    try {
      // For now, we'll simulate this - in production you'd make actual API calls
      return [
        {
          id: 'sheet_1',
          title: 'Gastos Casa Marzo 2024',
          type: 'shared',
          status: 'active',
          is_favorite: true,
          participants_count: 3,
          pending_amount: 1250.50,
          last_activity: '2024-03-15T10:30:00Z',
          role: 'owner'
        },
        {
          id: 'sheet_2', 
          title: 'Viaje Mendoza',
          type: 'shared',
          status: 'active',
          is_favorite: false,
          participants_count: 5,
          pending_amount: 0,
          last_activity: '2024-03-10T16:45:00Z',
          role: 'editor'
        }
      ].filter(sheet => {
        if (filter === 'all') return true;
        if (filter === 'owned') return sheet.role === 'owner';
        if (filter === 'shared') return sheet.role !== 'owner';
        if (filter === 'favorites') return sheet.is_favorite;
        if (filter === 'archived') return sheet.status === 'archived';
        return true;
      }).slice(0, limit);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Format sheet for LLM consumption
   */
  formatSheetSummary(sheet) {
    const typeLabels = {
      'shared': 'Gastos Compartidos',
      'personal': 'Gastos Personales', 
      'registry': 'Registro de Gastos'
    };

    return {
      id: sheet.id,
      title: sheet.title,
      type: typeLabels[sheet.type] || sheet.type,
      status: sheet.status === 'active' ? 'Activa' : 'Archivada',
      is_favorite: sheet.is_favorite,
      participants_count: sheet.participants_count,
      pending_amount: sheet.pending_amount,
      last_activity: this.formatDate(sheet.last_activity),
      user_role: this.formatRole(sheet.role),
      description: this.generateDescription(sheet)
    };
  }

  /**
   * Generate descriptive text for the sheet
   */
  generateDescription(sheet) {
    let desc = `Hoja ${sheet.is_favorite ? 'favorita' : ''} con ${sheet.participants_count} participante${sheet.participants_count !== 1 ? 's' : ''}`;
    
    if (sheet.pending_amount > 0) {
      desc += `. Hay $${sheet.pending_amount.toFixed(2)} pendiente de equilibrar`;
    } else {
      desc += '. Balance equilibrado';
    }

    return desc.trim();
  }

  /**
   * Format user role
   */
  formatRole(role) {
    const roles = {
      'owner': 'Propietario',
      'editor': 'Editor', 
      'viewer': 'Visualizador'
    };
    return roles[role] || role;
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Sin actividad';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Group sheets by type
   */
  groupByType(sheets) {
    return sheets.reduce((acc, sheet) => {
      acc[sheet.type] = (acc[sheet.type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group sheets by status
   */
  groupByStatus(sheets) {
    return sheets.reduce((acc, sheet) => {
      const status = sheet.status || 'active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }
}