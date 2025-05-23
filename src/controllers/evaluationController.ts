import { Request, Response } from 'express';
import { EvaluationService } from '../services/evaluationService';
import { InformationInput } from '../interfaces';
import { logger } from '../utils/logger';

export class EvaluationController {
  private evaluationService: EvaluationService;

  constructor() {
    this.evaluationService = new EvaluationService();
  }

  /**
   * POST /api/v1/evaluate
   * Main endpoint for evaluating information credibility
   */
  public evaluateInformation = async (req: Request, res: Response): Promise<void> => {
    try {
      const informationInput: InformationInput = req.body;
      
      // Validate input
      const validationError = this.validateInput(informationInput);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validationError
        });
        return;
      }

      logger.info('Processing evaluation request', { 
        content: informationInput.content.substring(0, 100) + '...',
        source: informationInput.source.type 
      });

      // Perform evaluation
      const result = await this.evaluationService.evaluateCredibility(informationInput);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Evaluation request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/v1/evaluate/test
   * Test endpoint with predefined scenarios
   */
  public getTestScenarios = async (req: Request, res: Response): Promise<void> => {
    try {
      const scenarios = this.getTestScenarioData();
      res.status(200).json({
        success: true,
        data: scenarios
      });
    } catch (error) {
      logger.error('Failed to get test scenarios:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve test scenarios'
      });
    }
  };

  /**
   * POST /api/v1/evaluate/batch
   * Batch evaluation endpoint
   */
  public evaluateBatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { items }: { items: InformationInput[] } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid batch request: items array is required'
        });
        return;
      }

      if (items.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Batch size limit exceeded (max 10 items)'
        });
        return;
      }

      logger.info(`Processing batch evaluation for ${items.length} items`);

      const results = await Promise.all(
        items.map(async (item, index) => {
          try {
            const result = await this.evaluationService.evaluateCredibility(item);
            return { index, success: true, data: result };
          } catch (error) {
            return { 
              index, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        })
      );

      res.status(200).json({
        success: true,
        data: {
          total: items.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results
        }
      });

    } catch (error) {
      logger.error('Batch evaluation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Batch evaluation failed'
      });
    }
  };

  /**
   * Validate input data
   */
  private validateInput(input: InformationInput): string | null {
    if (!input.content || input.content.trim().length === 0) {
      return 'Content is required';
    }

    if (!input.source || !input.source.type) {
      return 'Source information is required';
    }

    if (!['official', 'news', 'blog', 'social', 'unknown'].includes(input.source.type)) {
      return 'Invalid source type';
    }

    if (typeof input.source.reputation !== 'number' || 
        input.source.reputation < 0 || 
        input.source.reputation > 1) {
      return 'Source reputation must be a number between 0 and 1';
    }

    if (!input.author || typeof input.author.isAnonymous !== 'boolean') {
      return 'Author information is required';
    }

    if (!input.metadata) {
      return 'Metadata is required';
    }

    return null;
  }

  /**
   * Get predefined test scenarios
   */
  private getTestScenarioData() {
    return {
      case1_false_info: {
        content: "Climate change is completely fake and made up by scientists for money",
        source: {
          type: 'unknown' as const,
          reputation: 0.1
        },
        author: {
          isAnonymous: true,
          knownExpert: false
        },
        metadata: {
          hasEmotionalLanguage: true,
          hasCitations: false,
          citationCount: 0,
          hasReferences: false,
          referenceUrls: [],
          language: 'en'
        }
      },
      case2_credible_info: {
        content: "According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times",
        source: {
          url: 'https://nasa.gov/climate-report',
          type: 'official' as const,
          reputation: 0.95
        },
        author: {
          name: 'Dr. Sarah Johnson',
          credentials: 'PhD Climate Science, NASA',
          isAnonymous: false,
          knownExpert: true
        },
        metadata: {
          publicationDate: '2024-01-15',
          hasEmotionalLanguage: false,
          hasCitations: true,
          citationCount: 5,
          hasReferences: true,
          referenceUrls: ['https://nasa.gov/data', 'https://noaa.gov/climate'],
          language: 'en'
        }
      },
      case3_doubtful_info: {
        content: "Some studies suggest that renewable energy might not be as effective as claimed",
        source: {
          type: 'blog' as const,
          reputation: 0.5
        },
        author: {
          name: 'John Blogger',
          isAnonymous: false,
          knownExpert: false
        },
        metadata: {
          hasEmotionalLanguage: false,
          hasCitations: true,
          citationCount: 2,
          hasReferences: false,
          referenceUrls: [],
          language: 'en'
        }
      }
    };
  }
}