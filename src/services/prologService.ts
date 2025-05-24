import { spawn, ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import { config } from "../config";
import { logger } from "../utils/logger";
import {
  PrologQuery,
  PrologResponse,
  InformationInput,
  AddFactRequest,
  PrologFact,
  FactListProps,
  EvaluationResult,
  EvaluationQuery,
} from "../interfaces";

export class PrologService {
  private static instance: PrologService;

  private constructor() {}

  public static getInstance(): PrologService {
    if (!PrologService.instance) {
      PrologService.instance = new PrologService();
    }
    return PrologService.instance;
  }

  /**
   * Execute a Prolog query with better error handling and debugging
   */
  async executeQuery(query: string): Promise<PrologResponse> {
    try {
      logger.info(`Executing Prolog query: ${query.substring(0, 100)}...`);

      const result = await this.runPrologProcess(query);

      return {
        success: true,
        result: this.parseResult(result),
      };
    } catch (error) {
      logger.error("Prolog query execution failed:", error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Evaluate information credibility with improved query structure
   */
  async evaluateInformation(info: InformationInput): Promise<PrologResponse> {
    try {
      const factsFile = await this.createTemporaryFacts(info);
      // Convert Windows path to forward slashes and properly escape it
      const normalizedPath = this.normalizePath(factsFile);

      // Read and log facts content for verification
      const factsContent = await fs.readFile(factsFile, "utf-8");
      logger.debug(`Facts content:\n${factsContent}`);

      const query = `
        consult('${normalizedPath}'),
        info_content(Content),
        evaluer_info(Content, Level, Score, Explanation),
        evaluate_source(Content, SourceScore),
        evaluate_citations(Content, CitationScore),
        evaluate_language(Content, LanguageScore),
        evaluate_contradictions(Content, ContradictionScore),
        format('RESULT:~w|~w|~w|~w|~w|~w|~w~n', 
          [Level, Score, SourceScore, CitationScore, LanguageScore, ContradictionScore, Explanation])
      `;

      logger.info(`Executing credibility evaluation query`);
      const result = await this.executeQuery(query);

      // Clean up temporary file
      await this.cleanupTempFile(factsFile);

      return result;
    } catch (error) {
      logger.error("Information evaluation failed:", error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Evaluation failed",
      };
    }
  }

  /**
   * Get detailed reasoning with improved error handling
   */
  async getDetailedEvaluation(info: InformationInput): Promise<PrologResponse> {
    try {
      const factsFile = await this.createTemporaryFacts(info);
      const normalizedPath = this.normalizePath(factsFile);
      const escapedContent = this.escapeString(info.content);

      const queryString = `
        consult('${normalizedPath}'),
        evaluer_info('${escapedContent}', Level, Score, Reasoning),
        format('DETAILED:~w|~w|~w~n', [Level, Score, Reasoning])
      `;

      const result = await this.executeQuery(queryString);

      if (result.success && result.result && result.result.data) {
        const parsedResult = this.parseDetailedResult(result.result.data);
        result.result = parsedResult;
      }

      await this.cleanupTempFile(factsFile);

      return result;
    } catch (error) {
      logger.error("Detailed evaluation failed:", error);
      return {
        success: false,
        result: null,
        error:
          error instanceof Error ? error.message : "Detailed evaluation failed",
      };
    }
  }

  /**
   * Normalize file paths for Prolog (convert backslashes to forward slashes)
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Clean up temporary files safely
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to clean up temporary file ${filePath}:`, error);
    }
  }

  /**
   * Improved Prolog process execution with better debugging
   */
  private runPrologProcess(queryString: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Normalize the knowledge base path
      const knowledgeBasePath = this.normalizePath(
        config.prolog.knowledgeBasePath
      );

      const args = [
        "-s",
        knowledgeBasePath,
        "-q",
        "-t",
        "halt",
        "--nosignals",
        "-g",
        `(${queryString.trim()}); halt(1)`,
      ];

      logger.debug(
        `Prolog command: ${config.prolog.executablePath} ${args.join(" ")}`
      );

      logger.info(`Starting Prolog process`);

      const prolog: ChildProcess = spawn(config.prolog.executablePath, args);

      let output = "";
      let errorOutput = "";

      prolog.stdout?.on("data", (data) => {
        const chunk = data.toString();
        output += chunk;
        logger.debug(`Prolog stdout: ${chunk.replace(/\n$/, "")}`);
      });

      prolog.stderr?.on("data", (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        logger.debug(`Prolog stderr: ${chunk.replace(/\n$/, "")}`);
      });

      prolog.on("close", (code) => {
        logger.info(`Prolog process closed with code: ${code}`);
        logger.debug(`Final output: "${output}"`);
        if (errorOutput) {
          logger.debug(`Final error: "${errorOutput}"`);
        }

        if (code === 0) {
          resolve(output);
        } else {
          reject(
            new Error(
              `Prolog process exited with code ${code}. Error: ${errorOutput}`
            )
          );
        }
      });

      prolog.on("error", (error) => {
        logger.error("Prolog process spawn error:", error);
        reject(new Error(`Failed to start Prolog process: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        logger.warn("Prolog query timeout, killing process");
        prolog.kill("SIGTERM");
        reject(
          new Error(`Prolog query timeout after ${config.prolog.timeout}ms`)
        );
      }, config.prolog.timeout);

      prolog.on("close", () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Create temporary facts file with validation
   */
  private async createTemporaryFacts(info: InformationInput): Promise<string> {
    const facts = this.generatePrologFacts(info);
    const fileName = `facts_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}.pl`;
    const filePath = path.join(config.prolog.tempDir, fileName);

    // Ensure temp directory exists
    await fs.mkdir(config.prolog.tempDir, { recursive: true });

    // Write facts with validation
    await fs.writeFile(filePath, facts, "utf-8");

    // Verify file was written correctly
    const writtenContent = await fs.readFile(filePath, "utf-8");
    if (writtenContent !== facts) {
      throw new Error("Facts file was not written correctly");
    }

    logger.info(
      `Created temporary facts file: ${filePath} (${facts.length} bytes)`
    );

    return filePath;
  }

  /**
   * Generate Prolog facts with proper type handling and escaping
   */
  private generatePrologFacts(info: InformationInput): string {
    const escapedContent = this.escapeString(info.content);
    const facts = [
      `% Auto-generated facts for: ${new Date().toISOString()}`,
      `source_type('${escapedContent}', ${info.source.type}).`,
      `source_reputation('${escapedContent}', ${info.source.reputation}).`,
      `author_anonymous('${escapedContent}', ${
        info.author.isAnonymous ? "true" : "false"
      }).`,
      `author_expert('${escapedContent}', ${
        info.author.knownExpert ? "true" : "false"
      }).`,
      `has_emotional_language('${escapedContent}', ${
        info.metadata.hasEmotionalLanguage ? "true" : "false"
      }).`,
      `has_citations('${escapedContent}', ${
        info.metadata.hasCitations ? "true" : "false"
      }).`,
      `citation_count('${escapedContent}', ${info.metadata.citationCount}).`,
      `has_references('${escapedContent}', ${
        info.metadata.hasReferences ? "true" : "false"
      }).`,
      "",
    ].join("\n");

    logger.debug(`Generated Prolog facts:\n${facts}`);
    return facts;
  }

  /**
   * Improved string escaping for Prolog
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\") // Escape backslashes first
      .replace(/'/g, "\\'") // Escape single quotes
      .replace(/\n/g, " ") // Replace newlines with spaces
      .replace(/\r/g, "") // Remove carriage returns
      .replace(/\t/g, " ") // Replace tabs with spaces
      .replace(/"/g, '\\"'); // Escape double quotes
  }

  /**
   * Enhanced result parsing with better error detection
   */
  // In PrologService.ts - update parseStructuredResult
  private parseStructuredResult(output: string): any {
    const resultMatch = output.match(/RESULT:(.+)/);
    if (resultMatch) {
      const parts = resultMatch[1].trim().split("|");
      if (parts.length >= 7) {
        return {
          level: parts[0],
          score: parseFloat(parts[1]),
          breakdown: {
            sourceScore: parseFloat(parts[2]),
            citationScore: parseFloat(parts[3]),
            languageScore: parseFloat(parts[4]),
            contradictionScore: parseFloat(parts[5]),
          },
          explanation: parts[6], // Add explanation field
        };
      }
    }
    return { error: "Invalid result format" };
  }

  /**
   * Enhanced detailed result parsing
   */
  private parseDetailedResult(output: string): any {
    try {
      const lines = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const errorLine = lines.find((line) => line.startsWith("ERROR:"));
      if (errorLine) {
        return { error: errorLine.replace("ERROR:", "").trim(), raw: output };
      }

      const detailedLine = lines.find((line) => line.startsWith("DETAILED:"));

      if (detailedLine) {
        const data = detailedLine.replace("DETAILED:", "").split("|");
        if (data.length >= 3) {
          return {
            level: data[0].trim(),
            score: this.parseFloat(data[1].trim()),
            reasoning: data[2].trim(),
          };
        }
      }

      return { error: "No detailed result found in output", raw: output };
    } catch (error) {
      logger.error("Failed to parse detailed Prolog result:", error);
      return { error: "Failed to parse detailed result", raw: output };
    }
  }

  /**
   * Enhanced basic result parsing
   */
  private parseResult(output: string): any {
    try {
      if (!output || output.trim().length === 0) {
        return { error: "Empty output from Prolog", data: output };
      }

      const lines = output.split("\n").filter((line) => line.trim());

      // Look for structured results first
      const resultLine = lines.find(
        (line) =>
          line.includes("RESULT:") ||
          line.includes("DETAILED:") ||
          line.includes("ERROR:")
      );

      if (resultLine) {
        if (resultLine.includes("RESULT:")) {
          return this.parseStructuredResult(output);
        }
        return { data: output, structured: true };
      }

      // Check for basic true/false responses
      const lastLine = lines[lines.length - 1];
      if (lastLine && lastLine.includes("true")) {
        return { success: true, data: output };
      } else if (lastLine && lastLine.includes("false")) {
        return { success: false, data: output };
      }

      return { data: output };
    } catch (error) {
      logger.error("Failed to parse Prolog result:", error);
      return { error: "Failed to parse result", raw: output };
    }
  }

  /**
   * Safe float parsing
   */
  private parseFloat(str: string): number {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Test connection to Prolog system
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const testQuery = "write('Prolog connection test successful'), nl";
      const result = await this.executeQuery(testQuery);

      if (result.success) {
        return {
          success: true,
          message: "Prolog connection successful",
          details: result.result,
        };
      } else {
        return {
          success: false,
          message: "Prolog connection failed",
          details: result,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Prolog connection error: ${
          error instanceof Error ? error.message : error
        }`,
      };
    }
  }

  // Add facts to the knowledge base with improved duplicate detection
  async addFacts(request: AddFactRequest): Promise<PrologResponse> {
    try {
      // Get existing facts
      const existingFacts = (await this.listFacts()).facts;

      // Filter out duplicates with improved comparison
      const uniqueFacts = request.facts.filter(
        (newFact) =>
          !existingFacts.some((existingFact) =>
            this.factsAreEqual(existingFact, newFact)
          )
      );

      if (uniqueFacts.length === 0) {
        logger.info("All facts already exist in knowledge base, skipping save");
        return {
          success: true,
          result: { addedFacts: 0, message: "All facts already exist" },
        };
      }

      logger.info(
        `Adding ${uniqueFacts.length} new facts out of ${request.facts.length} total facts`
      );

      const formattedFacts = this.formatFacts({
        ...request,
        facts: uniqueFacts,
      });
      await this.appendToKnowledgeBase(formattedFacts);

      return {
        success: true,
        result: { addedFacts: uniqueFacts.length },
      };
    } catch (error) {
      logger.error("Failed to add facts:", error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Failed to add facts",
      };
    }
  }

  /**
   * Improved fact comparison that handles Prolog string formatting
   */
  private factsAreEqual(fact1: PrologFact, fact2: PrologFact): boolean {
    // First check if predicates match
    if (fact1.predicate !== fact2.predicate) {
      return false;
    }

    // Check if argument count matches
    if (fact1.arguments.length !== fact2.arguments.length) {
      return false;
    }

    // Compare each argument with proper normalization
    for (let i = 0; i < fact1.arguments.length; i++) {
      const arg1 = this.normalizeFactArgument(fact1.arguments[i]);
      const arg2 = this.normalizeFactArgument(fact2.arguments[i]);

      if (arg1 !== arg2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize fact arguments for proper comparison
   */
  private normalizeFactArgument(arg: string): string {
    // Remove surrounding quotes (both single and triple quotes)
    let normalized = arg.trim();

    // Handle triple quotes from Prolog output
    if (normalized.startsWith("'''") && normalized.endsWith("'''")) {
      normalized = normalized.slice(3, -3);
    }
    // Handle single quotes
    else if (normalized.startsWith("'") && normalized.endsWith("'")) {
      normalized = normalized.slice(1, -1);
    }

    // Unescape any escaped quotes
    normalized = normalized.replace(/''/g, "'");

    // For numbers, normalize to consistent format
    const num = parseFloat(normalized);
    if (!isNaN(num) && isFinite(num)) {
      return num.toString();
    }

    // For booleans, normalize
    if (normalized === "true" || normalized === "false") {
      return normalized;
    }

    // For strings, normalize whitespace and case for comparison
    return normalized.trim().toLowerCase();
  }

  /**
   * Legacy method - kept for compatibility but using improved normalization
   */
  private normalizeArguments(args: string[]): string[] {
    return args.map((arg) => this.normalizeFactArgument(arg));
  }

  /**
   * List all facts from the knowledge base - FIXED to include evaluation facts only
   */
  async listFacts(): Promise<FactListProps> {
  try {
    const content = await fs.readFile(
      config.prolog.knowledgeBasePath,
      "utf-8"
    );
    
    // Parse all facts and filter only evaluations
    const allFacts = this.parseKnowledgeBase(content);
    const evaluations = allFacts.filter(fact => 
      fact.predicate === "evaluation" &&
      fact.arguments.length === 4
    );

    return { facts: evaluations };
  } catch (error) {
    logger.error("Failed to read knowledge base:", error);
    return { facts: [] };
  }
}


  private parseArguments(argsString: string): string[] {
  if (!argsString) return [];
  
  const args: string[] = [];
  let current = "";
  let quoteLevel = 0;
  let inEscape = false;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    
    if (inEscape) {
      current += char;
      inEscape = false;
      continue;
    }

    switch(char) {
      case '\\':
        inEscape = true;
        current += char;
        break;
      
      case "'":
        // Handle triple quotes
        if (argsString.substr(i, 3) === "'''") {
          quoteLevel = quoteLevel === 3 ? 0 : 3;
          current += "'''";
          i += 2;
        } else {
          quoteLevel = quoteLevel === 1 ? 0 : 1;
          current += char;
        }
        break;
      
      case ',':
        if (quoteLevel === 0) {
          args.push(current.trim());
          current = "";
        } else {
          current += char;
        }
        break;
      
      default:
        current += char;
    }
  }

  if (current.trim()) args.push(current.trim());
  
  return args.map(arg => this.cleanPrologArgument(arg));
}

// Add argument cleaning helper
private cleanPrologArgument(arg: string): string {
  // Remove triple quotes
  if (arg.startsWith("'''") && arg.endsWith("'''")) {
    return arg.slice(3, -3).replace(/''/g, "'");
  }
  // Remove single quotes
  if (arg.startsWith("'") && arg.endsWith("'")) {
    return arg.slice(1, -1).replace(/''/g, "'");
  }
  return arg;
}

// Uncomment and fix the evaluation results parsing
private parseEvaluationResults(output: string): EvaluationResult[] {
  const evaluations: EvaluationResult[] = [];
  
  if (!output || !output.trim()) {
    return evaluations;
  }

  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    if (line.startsWith('EVAL:')) {
      const evaluation = this.parseEvaluationLine(line);
      if (evaluation) {
        evaluations.push(evaluation);
      }
    }
  }

  return evaluations;
}

  private formatFacts(request: AddFactRequest): string {
    const header = `% Added at ${new Date().toISOString()}`;
    const sourceComment = request.source ? `% Source: ${request.source}\n` : "";
    const expirationComment = request.expiration
      ? `% Expires: ${request.expiration}\n`
      : "";

    const facts = request.facts
      .map((fact) => {
        const args = fact.arguments
          .map((arg) => this.escapePrologTerm(arg))
          .join(", ");
        return `${fact.predicate}(${args}).${
          fact.comment ? ` % ${fact.comment}` : ""
        }`;
      })
      .join("\n");

    return `\n\n${header}\n${sourceComment}${expirationComment}${facts}\n`;
  }

  private async appendToKnowledgeBase(content: string): Promise<void> {
    await fs.appendFile(config.prolog.knowledgeBasePath, content);
  }

  /**
   * Parse knowledge base - FIXED to only return evaluation facts
   */
  private parseKnowledgeBase(content: string): PrologFact[] {
    return content
      .split("\n")
      .map((line) => line.trim())
      // .filter((line) => this.isEvaluationFact(line)) // Only evaluation facts
      .map((line) => this.parseFact(line));
  }

  /**
   * Check if line is an evaluation fact - UPDATED to be more specific
   */
  private isEvaluationFact(line: string): boolean {
    return (
      line.length > 0 &&
      !line.startsWith("%") && // Not a comment
      line.includes("evaluation(") && // Contains evaluation predicate
      line.endsWith(".") // Ends with period
    );
  }

  /**
   * Original isFact method - kept for reference but not used for listFacts
   */
  private isFact(line: string): boolean {
    return (
      line.length > 0 &&
      !line.startsWith("%") &&
      !line.startsWith(":-") &&
      line.endsWith(".") &&
      !line.includes(":-") &&
      !line.includes("?−")
    );
  }

  private parseFact(line: string): PrologFact {
    const cleanLine = line.replace(/%.*$/, "").trim().slice(0, -1); // Remove comment and trailing .
    const [predicate, args] = cleanLine.split(/\((.*)\)/s);

    return {
      predicate: predicate.trim(),
      arguments: this.parseArguments(args),
      comment: line.includes("%") ? line.split("%")[1].trim() : undefined,
    };
  }

  // private parseArguments(argsString: string): string[] {
  //   if (!argsString) return [];

  //   // Handle complex argument parsing for evaluation facts
  //   const args: string[] = [];
  //   let current = "";
  //   let depth = 0;
  //   let inQuotes = false;
  //   let quoteChar = "";

  //   for (let i = 0; i < argsString.length; i++) {
  //     const char = argsString[i];
  //     const nextChar = argsString[i + 1];
  //     const prevChar = argsString[i - 1];

  //     if (!inQuotes) {
  //       if (
  //         char === "'" &&
  //         (prevChar !== "\\" ||
  //           (prevChar === "\\" && argsString[i - 2] === "\\"))
  //       ) {
  //         if (nextChar === "'" && argsString[i + 2] === "'") {
  //           // Triple quote start
  //           inQuotes = true;
  //           quoteChar = "'''";
  //           current += char;
  //         } else {
  //           // Single quote start
  //           inQuotes = true;
  //           quoteChar = "'";
  //           current += char;
  //         }
  //       } else if (char === "," && depth === 0) {
  //         args.push(current.trim());
  //         current = "";
  //       } else {
  //         if (char === "(") depth++;
  //         if (char === ")") depth--;
  //         current += char;
  //       }
  //     } else {
  //       current += char;
  //       if (
  //         quoteChar === "'''" &&
  //         char === "'" &&
  //         nextChar === "'" &&
  //         argsString[i + 2] === "'"
  //       ) {
  //         // Triple quote end
  //         current += nextChar + argsString[i + 2];
  //         i += 2;
  //         inQuotes = false;
  //         quoteChar = "";
  //       } else if (quoteChar === "'" && char === "'" && prevChar !== "\\") {
  //         // Single quote end
  //         inQuotes = false;
  //         quoteChar = "";
  //       }
  //     }
  //   }

  //   if (current.trim()) {
  //     args.push(current.trim());
  //   }

  //   return args.map((arg) => this.unescapePrologTerm(arg));
  // }

  private escapePrologTerm(term: string): string {
    if (/^[a-z][a-zA-Z0-9_]*$/.test(term)) return term;
    return `'${term.replace(/'/g, "''")}'`;
  }

  private unescapePrologTerm(term: string): string {
    if (term.startsWith("'") && term.endsWith("'")) {
      return term.slice(1, -1).replace(/''/g, "'");
    }
    return term;
  }

  async getEvaluations(query?: EvaluationQuery): Promise<{
    success: boolean;
    evaluations: EvaluationResult[];
    error?: string;
  }> {
    try {
      // Build Prolog query based on filters
      let prologQuery = "evaluation(Content, Level, Score, Explanation)";

      const conditions: string[] = [];

      if (query?.level) {
        conditions.push(`Level = '${query.level}'`);
      }

      if (query?.minScore !== undefined) {
        conditions.push(`Score >= ${query.minScore}`);
      }

      if (query?.maxScore !== undefined) {
        conditions.push(`Score =< ${query.maxScore}`);
      }

      if (query?.content) {
        // Escape the content for Prolog query
        const escapedContent = this.escapeString(query.content);
        conditions.push(`sub_string(Content, _, _, _, '${escapedContent}')`);
      }

      // Construct the full query
      const fullQuery =
        conditions.length > 0
          ? `${prologQuery}, ${conditions.join(
              ", "
            )}, format('EVAL:~w|~w|~w|~w~n', [Content, Level, Score, Explanation])`
          : `${prologQuery}, format('EVAL:~w|~w|~w|~w~n', [Content, Level, Score, Explanation])`;

      logger.info("Executing evaluation query:", fullQuery);

      const result = await this.executeQuery(fullQuery);

      if (!result.success) {
        return {
          success: false,
          evaluations: [],
          error: result.error || "Failed to execute query",
        };
      }

      const evaluations = this.parseEvaluationResults(
        result.result?.data || ""
      );

      return {
        success: true,
        evaluations: evaluations,
      };
    } catch (error) {
      logger.error("Failed to get evaluations:", error);
      return {
        success: false,
        evaluations: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get a specific evaluation by content
   */
  async getEvaluationByContent(content: string): Promise<{
    success: boolean;
    evaluation: EvaluationResult | null;
    error?: string;
  }> {
    try {
      const result = await this.getEvaluations({ content });

      if (!result.success) {
        return {
          success: false,
          evaluation: null,
          error: result.error,
        };
      }

      // Find exact match or closest match
      const exactMatch = result.evaluations.find((evaluation) =>
        evaluation.content.toLowerCase().includes(content.toLowerCase())
      );

      return {
        success: true,
        evaluation: exactMatch || result.evaluations[0] || null,
      };
    } catch (error) {
      logger.error("Failed to get evaluation by content:", error);
      return {
        success: false,
        evaluation: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse evaluation results from Prolog output
   */
  // private parseEvaluationResults(output: string): EvaluationResult[] {
  //   const evaluations: EvaluationResult[] = [];
  //   console.log(evaluations)

  //   if (!output || !output.trim()) {
  //     return evaluations;
  //   }

  //   const lines = output.split("\n").filter((line) => line.trim());

  //   // for (const line of lines) {
  //   //   if (line.startsWith("EVAL:")) {
  //   //     const evaluation = this.parseEvaluationLine(line);
  //   //     if (evaluation) {
  //   //       evaluations.push(evaluation);
  //   //     }
  //   //   }
  //   // }

  //   return evaluations;
  // }

  /**
   * Parse a single evaluation line
   */
  private parseEvaluationLine(line: string): EvaluationResult | null {
    try {
      // Remove 'EVAL:' prefix and split by |
      const data = line.substring(5).split("|");

      if (data.length < 4) {
        logger.warn("Invalid evaluation line format:", line);
        return null;
      }

      const [content, level, scoreStr, explanation] = data;

      // Clean up the content (remove triple quotes if present)
      const cleanContent = this.cleanPrologString(content);
      const cleanLevel = this.cleanPrologString(level) as
        | "suspect"
        | "doubtful"
        | "credible";
      const score = parseFloat(scoreStr) || 0;
      const cleanExplanation = this.cleanPrologString(explanation);

      // Parse breakdown from explanation
      const breakdown = this.parseExplanationBreakdown(cleanExplanation);

      return {
        content: cleanContent,
        level: cleanLevel,
        score: score,
        explanation: cleanExplanation,
        breakdown: breakdown,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to parse evaluation line:", error);
      return null;
    }
  }

  /**
   * Clean Prolog string output (remove quotes, unescape)
   */
  private cleanPrologString(str: string): string {
    let cleaned = str.trim();

    // Remove triple quotes
    if (cleaned.startsWith("'''") && cleaned.endsWith("'''")) {
      cleaned = cleaned.slice(3, -3);
    }
    // Remove single quotes
    else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1);
    }

    // Unescape quotes
    cleaned = cleaned.replace(/''/g, "'");
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');

    return cleaned.trim();
  }

  private parseExplanationBreakdown(explanation: string): {
    sourceScore?: number;
    citationScore?: number;
    languageScore?: number;
    contradictionScore?: number;
  } {
    const breakdown: any = {};

    try {
      // Look for score patterns in explanation
      const sourceMatch = explanation.match(/source[:\s]+(\d+(?:\.\d+)?)/i);
      const citationMatch = explanation.match(/citation[:\s]+(\d+(?:\.\d+)?)/i);
      const languageMatch = explanation.match(/language[:\s]+(\d+(?:\.\d+)?)/i);
      const contradictionMatch = explanation.match(
        /contradiction[:\s]+(\d+(?:\.\d+)?)/i
      );

      if (sourceMatch) breakdown.sourceScore = parseFloat(sourceMatch[1]);
      if (citationMatch) breakdown.citationScore = parseFloat(citationMatch[1]);
      if (languageMatch) breakdown.languageScore = parseFloat(languageMatch[1]);
      if (contradictionMatch)
        breakdown.contradictionScore = parseFloat(contradictionMatch[1]);
    } catch (error) {
      logger.debug("Failed to parse explanation breakdown:", error);
    }

    return breakdown;
  }

  
}
