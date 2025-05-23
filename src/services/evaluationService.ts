import { InformationInput, CredibilityResult } from '../interfaces';
import { PrologService } from './prologService';
import { logger } from '../utils/logger';

export class EvaluationService {
  private prologService: PrologService;
  
  constructor() {
    this.prologService = PrologService.getInstance();
  }

  /**
   * Main evaluation method
   */
  async evaluateCredibility(info: InformationInput): Promise<CredibilityResult> {
    try {
      logger.info('Starting credibility evaluation');
      
      // Get evaluation from Prolog
      const prologResult = await this.prologService.evaluateInformation(info);
      
      if (!prologResult.success) {
        throw new Error(prologResult.error || 'Prolog evaluation failed');
      }

      // Calculate multi-criteria scores
      const breakdown = this.calculateScoreBreakdown(info);
      
      // Calculate final score
      const finalScore = this.calculateFinalScore(breakdown);
      
      // Determine credibility level
      const level = this.determineCredibilityLevel(finalScore);
      
      // Generate reasoning
      const reasoning = this.generateReasoning(info, breakdown, level);
      
      const result: CredibilityResult = {
        score: Math.round(finalScore * 100) / 100,
        level,
        breakdown: {
          sourceScore: Math.round(breakdown.sourceScore * 100) / 100,
          citationScore: Math.round(breakdown.citationScore * 100) / 100,
          languageScore: Math.round(breakdown.languageScore * 100) / 100,
          contradictionScore: Math.round(breakdown.contradictionScore * 100) / 100
        },
        reasoning,
        confidence: this.calculateConfidence(breakdown),
        timestamp: new Date().toISOString()
      };

      logger.info(`Evaluation completed. Score: ${result.score}, Level: ${result.level}`);
      return result;
      
    } catch (error) {
      logger.error('Credibility evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate individual score components
   */
  private calculateScoreBreakdown(info: InformationInput) {
    // Source Score (0.4 weight)
    let sourceScore = info.source.reputation * 100;
    if (info.source.type === 'official') sourceScore += 20;
    else if (info.source.type === 'news') sourceScore += 10;
    else if (info.source.type === 'social') sourceScore -= 20;
    else if (info.source.type === 'unknown') sourceScore -= 30;
    
    // Citation Score (0.3 weight)
    let citationScore = 0;
    if (info.metadata.hasCitations) {
      citationScore = Math.min(100, info.metadata.citationCount * 20);
    }
    if (info.metadata.hasReferences) {
      citationScore += 20;
    }
    
    // Language Score (0.2 weight)
    let languageScore = 100;
    if (info.metadata.hasEmotionalLanguage) {
      languageScore -= 40;
    }
    if (!info.metadata.publicationDate) {
      languageScore -= 20;
    }
    
    // Author credibility
    if (info.author.knownExpert) {
      languageScore += 20;
    } else if (info.author.isAnonymous) {
      languageScore -= 30;
    }
    
    // Contradiction Score (0.1 weight) - simplified for now
    let contradictionScore = 80; // Default assumption
    
    // Normalize scores to 0-100 range
    return {
      sourceScore: Math.max(0, Math.min(100, sourceScore)),
      citationScore: Math.max(0, Math.min(100, citationScore)),
      languageScore: Math.max(0, Math.min(100, languageScore)),
      contradictionScore: Math.max(0, Math.min(100, contradictionScore))
    };
  }

  /**
   * Calculate final weighted score
   */
  private calculateFinalScore(breakdown: any): number {
    const weights = {
      source: 0.4,
      citation: 0.3,
      language: 0.2,
      contradiction: 0.1
    };
    
    return (
      breakdown.sourceScore * weights.source +
      breakdown.citationScore * weights.citation +
      breakdown.languageScore * weights.language +
      breakdown.contradictionScore * weights.contradiction
    );
  }

  /**
   * Determine credibility level based on score
   */
  private determineCredibilityLevel(score: number): 'suspect' | 'doubtful' | 'credible' {
    if (score <= 30) return 'suspect';
    if (score <= 60) return 'doubtful';
    return 'credible';
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(info: InformationInput, breakdown: any, level: string): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(`Information classified as ${level} based on multi-criteria analysis.`);
    
    // Source reasoning
    if (breakdown.sourceScore > 70) {
      reasoning.push(`Source appears reliable (${info.source.type} source with good reputation).`);
    } else if (breakdown.sourceScore < 40) {
      reasoning.push(`Source credibility is questionable (${info.source.type} source with limited reputation).`);
    }
    
    // Citation reasoning
    if (info.metadata.hasCitations && info.metadata.citationCount > 0) {
      reasoning.push(`Information includes ${info.metadata.citationCount} citations, supporting credibility.`);
    } else {
      reasoning.push(`No citations found, reducing credibility assessment.`);
    }
    
    // Language analysis
    if (info.metadata.hasEmotionalLanguage) {
      reasoning.push(`Emotional language detected, which may indicate bias.`);
    }
    
    // Author analysis
    if (info.author.knownExpert) {
      reasoning.push(`Author appears to be a recognized expert in the field.`);
    } else if (info.author.isAnonymous) {
      reasoning.push(`Anonymous authorship raises credibility concerns.`);
    }
    
    return reasoning;
  }

  /**
   * Calculate confidence in the assessment
   */
  private calculateConfidence(breakdown: any): number {
    // Higher confidence when scores are more extreme (closer to 0 or 100)
    const scores = Object.values(breakdown) as number[];
    const avgDeviation = scores.reduce((sum, score) => {
      return sum + Math.abs(score - 50);
    }, 0) / scores.length;
    
    return Math.min(100, (avgDeviation / 50) * 100);
  }
}

