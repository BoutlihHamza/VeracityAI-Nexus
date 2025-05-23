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
   * POST /api/v1/knowledge/facts
   * Add new facts to the knowledge base
   */
  public addFacts = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const request: AddFactRequest = req.body;
      logger.info('Adding new facts to knowledge base', {
        count: request.facts.length,
        source: request.source
      });

      const result = await this.prologService.addFacts(request);

      res.status(201).json({
        success: true,
        message: `Successfully added ${request.facts.length} facts`,
        metadata: {
          source: request.source,
          expiration: request.expiration,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to add facts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add facts to knowledge base',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/v1/knowledge/facts
   * List all facts in the knowledge base
   */
  public listFacts = async (req: Request, res: Response): Promise<void> => {
    try {
      const facts = await this.prologService.listFacts();
      res.status(200).json({
        success: true,
        count: facts.length,
        data: facts
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