// evaluationService.ts
import { InformationInput, CredibilityResult, PrologFact } from "../interfaces";
import { PrologService } from "./prologService";
import { logger } from "../utils/logger";

export class EvaluationService {
  private prologService = PrologService.getInstance();

  async evaluateCredibility(
    info: InformationInput
  ): Promise<CredibilityResult> {
    try {
      const prologResponse = await this.prologService.evaluateInformation(info);

      if (!prologResponse.success || !prologResponse.result) {
        throw new Error(prologResponse.error || "Prolog evaluation failed");
      }

      // Validate response structure
      if (!prologResponse.result.level || !prologResponse.result.breakdown) {
        throw new Error("Invalid Prolog response structure");
      }

      return this.mapPrologResult(prologResponse.result);
    } catch (error) {
      logger.error("Credibility evaluation failed:", error);
      return this.getErrorResult(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private mapPrologResult(prologResult: any): CredibilityResult {
    // Convert scores from 0-1 to 0-100 if needed
    const score =
      prologResult.score <= 1 ? prologResult.score * 100 : prologResult.score;

    return {
      score: Number(score.toFixed(1)),
      level: this.normalizeLevel(prologResult.level),
      breakdown: {
        sourceScore: Number(
          (prologResult.breakdown.sourceScore * 100).toFixed(1)
        ),
        citationScore: Number(
          (prologResult.breakdown.citationScore * 100).toFixed(1)
        ),
        languageScore: Number(
          (prologResult.breakdown.languageScore * 100).toFixed(1)
        ),
        contradictionScore: Number(
          (prologResult.breakdown.contradictionScore * 100).toFixed(1)
        ),
      },
      reasoning: this.parseReasoning(prologResult.explanation),
      confidence: this.calculateConfidence(prologResult.breakdown),
      timestamp: new Date().toISOString(),
    };
  }

  private parseReasoning(explanation?: string): string[] {
    // Handle missing or invalid explanation
    if (!explanation || typeof explanation !== "string") {
      return ["No detailed reasoning available from the expert system"];
    }

    try {
      return explanation
        .split(". ")
        .filter((s) => s.trim().length > 0)
        .map((s) => {
          const trimmed = s.trim();
          return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
        });
    } catch (error) {
      logger.error("Failed to parse reasoning:", error);
      return ["Could not parse detailed reasoning"];
    }
  }

  private calculateConfidence(breakdown: any): number {
    // Calculate confidence based on score distribution (as defined in Prolog)
    const scores = [
      breakdown.sourceScore,
      breakdown.citationScore,
      breakdown.languageScore,
      breakdown.contradictionScore,
    ];

    const avgDeviation =
      scores.reduce(
        (sum: number, score: number) => sum + Math.abs(score - 0.5),
        0
      ) / scores.length;

    return Math.min(100, Math.round(avgDeviation * 200));
  }

  private normalizeLevel(level: string): "suspect" | "doubtful" | "credible" {
    // Match Prolog's determine_level/2 predicate
    const cleanLevel = level.toLowerCase().trim();
    if (cleanLevel === "credible") return "credible";
    if (cleanLevel === "doubtful") return "doubtful";
    return "suspect";
  }

  private getErrorResult(error: string): CredibilityResult {
    // Error result that matches predicate structure
    return {
      score: 0,
      level: "suspect",
      breakdown: {
        sourceScore: 0,
        citationScore: 0,
        languageScore: 0,
        contradictionScore: 0,
      },
      reasoning: ["Evaluation failed: " + error],
      confidence: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Validate input against Prolog fact requirements
  validateInput(info: InformationInput): void {
    if (!info.content || info.content.trim().length === 0) {
      throw new Error("Information content is required");
    }

    if (info.source.reputation < 0 || info.source.reputation > 1) {
      throw new Error("Source reputation must be between 0 and 1");
    }

    if (info.metadata.citationCount < 0) {
      throw new Error("Citation count cannot be negative");
    }
  }

  /**
   * Check if information has already been evaluated
   */
  async isInformationAlreadyEvaluated(info: InformationInput): Promise<boolean> {
    try {
      const contentIdentifier = this.generateContentIdentifier(info.content);
      const existingFacts = await this.prologService.listFacts();
      
      // Check if there's already an evaluation fact for this content
      const hasEvaluation = existingFacts.facts.some(fact => 
        fact.predicate === 'evaluation' && 
        fact.arguments.length > 0 &&
        this.normalizeContent(fact.arguments[0]) === contentIdentifier
      );

      if (hasEvaluation) {
        logger.info(`Information already evaluated: ${contentIdentifier}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error checking if information is already evaluated:", error);
      return false; // If we can't check, assume it's not evaluated to be safe
    }
  }

  /**
   * Get existing evaluation for information if it exists
   */
  async getExistingEvaluation(info: InformationInput): Promise<CredibilityResult | null> {
    try {
      const contentIdentifier = this.generateContentIdentifier(info.content);
      const existingFacts = await this.prologService.listFacts();
      
      // Find the evaluation fact for this content
      const evaluationFact = existingFacts.facts.find(fact => 
        fact.predicate === 'evaluation' && 
        fact.arguments.length >= 4 &&
        this.normalizeContent(fact.arguments[0]) === contentIdentifier
      );

      if (!evaluationFact) {
        return null;
      }

      // Parse the existing evaluation
      return {
        score: parseFloat(evaluationFact.arguments[2]) || 0,
        level: this.normalizeLevel(evaluationFact.arguments[1]),
        breakdown: await this.getBreakdownForContent(info),
        reasoning: evaluationFact.arguments[3] ? evaluationFact.arguments[3].split("; ") : [],
        confidence: 0, // Would need to be stored separately or recalculated
        timestamp: evaluationFact.comment?.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)?.[1] || new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting existing evaluation:", error);
      return null;
    }
  }

  /**
   * Get breakdown scores for existing content
   */
  private async getBreakdownForContent(info: InformationInput): Promise<CredibilityResult['breakdown']> {
    try {
      const contentIdentifier = this.generateContentIdentifier(info.content);
      const existingFacts = await this.prologService.listFacts();
      
      const getScoreFromFacts = (predicate: string): number => {
        const fact = existingFacts.facts.find(f => 
          f.predicate === predicate && 
          f.arguments.length >= 2 &&
          this.normalizeContent(f.arguments[0]) === contentIdentifier
        );
        return fact ? parseFloat(fact.arguments[1]) * 100 : 0;
      };

      return {
        sourceScore: getScoreFromFacts('source_score'),
        citationScore: getScoreFromFacts('citation_score'),
        languageScore: getScoreFromFacts('language_score'),
        contradictionScore: getScoreFromFacts('contradiction_score'),
      };
    } catch (error) {
      logger.error("Error getting breakdown for content:", error);
      return {
        sourceScore: 0,
        citationScore: 0,
        languageScore: 0,
        contradictionScore: 0,
      };
    }
  }

  /**
   * Generate a consistent identifier for content
   */
  private generateContentIdentifier(content: string): string {
    // Create a normalized version of the content for comparison
    return content
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .substring(0, 100); // Use first 100 chars as identifier
  }

  /**
   * Normalize content from Prolog facts for comparison
   */
  private normalizeContent(factContent: string): string {
    // Remove Prolog quotes and normalize
    const cleaned = factContent.replace(/^'(.*)'$/, '$1');
    return this.generateContentIdentifier(cleaned);
  }

  async evaluateAndSave(info: InformationInput): Promise<CredibilityResult> {
    try {
      // Check if this information has already been evaluated
      const alreadyEvaluated = await this.isInformationAlreadyEvaluated(info);
      
      if (alreadyEvaluated) {
        logger.info("Information already exists in knowledge base, retrieving existing evaluation");
        const existingEvaluation = await this.getExistingEvaluation(info);
        
        if (existingEvaluation) {
          return existingEvaluation;
        }
        
        // If we can't retrieve the existing evaluation, log warning but continue with new evaluation
        logger.warn("Could not retrieve existing evaluation, proceeding with new evaluation");
      }

      // Perform new evaluation
      const result = await this.evaluateCredibility(info);

      // Generate facts for the new evaluation
      const facts: PrologFact[] = [
        // Source facts
        this.createSourceFact(info, 'type', info.source.type),
        this.createSourceFact(info, 'reputation', info.source.reputation),
        
        // Author facts
        this.createAuthorFact(info, 'anonymous', info.author.isAnonymous),
        this.createAuthorFact(info, 'expert', info.author.knownExpert),
        
        // Content facts
        this.createContentFact(info, 'emotional_language', info.metadata.hasEmotionalLanguage),
        this.createContentFact(info, 'citations', info.metadata.hasCitations),
        this.createContentFact(info, 'citation_count', info.metadata.citationCount),
        this.createContentFact(info, 'references', info.metadata.hasReferences),
        
        // Store individual scores for future retrieval
        {
          predicate: 'source_score',
          arguments: [this.formatValue(info.content), this.formatValue(result.breakdown.sourceScore / 100)],
          comment: `Source score for evaluation at ${new Date().toISOString()}`
        },
        {
          predicate: 'citation_score',
          arguments: [this.formatValue(info.content), this.formatValue(result.breakdown.citationScore / 100)],
          comment: `Citation score for evaluation at ${new Date().toISOString()}`
        },
        {
          predicate: 'language_score',
          arguments: [this.formatValue(info.content), this.formatValue(result.breakdown.languageScore / 100)],
          comment: `Language score for evaluation at ${new Date().toISOString()}`
        },
        {
          predicate: 'contradiction_score',
          arguments: [this.formatValue(info.content), this.formatValue(result.breakdown.contradictionScore / 100)],
          comment: `Contradiction score for evaluation at ${new Date().toISOString()}`
        },
        
        // Main evaluation fact
        {
          predicate: 'evaluation',
          arguments: [
            this.formatValue(info.content),
            this.formatValue(result.level),
            this.formatValue(result.score),
            this.formatValue(result.reasoning.join("; "))
          ],
          comment: `Evaluation completed at ${result.timestamp}`
        }
      ].filter(Boolean) as PrologFact[];

      // Add publication date if available
      if (info.metadata.publicationDate) {
        facts.push(this.createContentFact(info, 'publication_date', info.metadata.publicationDate));
      }

      // Add URL if available
      if (info.source.url) {
        facts.push(this.createSourceFact(info, 'url', info.source.url));
      }

      // Add domain if available
      if (info.source.domain) {
        facts.push(this.createSourceFact(info, 'domain', info.source.domain));
      }

      // Save to knowledge base
      const saveResponse = await this.prologService.addFacts({
        facts,
        source: "auto-evaluation",
        expiration: this.getExpirationDate(),
      });

      if (saveResponse.success) {
        logger.info(`Successfully saved ${saveResponse.result?.addedFacts || 0} new facts to knowledge base`);
      } else {
        logger.error("Failed to save facts to knowledge base:", saveResponse.error);
      }

      return result;
    } catch (error) {
      logger.error("Error in evaluateAndSave:", error);
      throw error;
    }
  }

  // Generic formatting helper
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;  // Escape single quotes
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);  // Convert numbers/dates to simple strings
  }

  // Generic fact creators
  private createSourceFact(info: InformationInput, type: string, value: any): PrologFact {
    return {
      predicate: `source_${type}`,
      arguments: [this.formatValue(info.content), this.formatValue(value)],
      comment: `${type} for ${info.content.substring(0, 50)}...`
    };
  }

  private createAuthorFact(info: InformationInput, attribute: string, value: any): PrologFact {
    return {
      predicate: `author_${attribute}`,
      arguments: [this.formatValue(info.content), this.formatValue(value)],
      comment: `${attribute} status for ${info.content.substring(0, 50)}...`
    };
  }

  private createContentFact(info: InformationInput, attribute: string, value: any): PrologFact {
    return {
      predicate: `content_${attribute}`,
      arguments: [this.formatValue(info.content), this.formatValue(value)],
      comment: `${attribute} for ${info.content.substring(0, 50)}...`
    };
  }

  private getExpirationDate(): string {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  private escapeString(str: string): string {
    return `'${str.replace(/'/g, "''")}'`;
  }

  private escapeValue(value: any): string | number {
    if (typeof value === "string") {
      if (/^[a-z0-9_]+$/.test(value)) return value;
      return `'${value.replace(/'/g, "''")}'`;
    }
    return value; // Return numbers directly
  }

  // Example updated boolean handler
  private handleBoolean(value: boolean): string {
    return value ? "true" : "false";
  }
}