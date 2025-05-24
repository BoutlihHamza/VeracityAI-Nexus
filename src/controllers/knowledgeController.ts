import { Request, Response } from 'express';
import { PrologService } from '../services/prologService';
import { AddFactRequest } from '../interfaces';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

export class KnowledgeController {
  private prologService: PrologService;

  constructor() {
    this.prologService = PrologService.getInstance();
  }


  /**
   * GET /api/v1/knowledge/facts
   * List all facts in the knowledge base
   */
  public listFacts = async (req: Request, res: Response): Promise<void> => {
    try {
      const facts = await this.prologService.listFacts();
      res.status(200).json({
        success: true,
        count: facts.facts.length,
        data: facts.facts
      });
    } catch (error) {
      logger.error('Failed to list facts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve knowledge base facts'
      });
    }
  };
}