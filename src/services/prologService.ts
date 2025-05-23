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
   * Execute a Prolog query and return the result
   */
  async executeQuery(query: PrologQuery): Promise<PrologResponse> {
    try {
      const queryString = this.formatQuery(query);
      logger.info(`Executing Prolog query: ${queryString}`);

      const result = await this.runPrologProcess(queryString);

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
   * Evaluate information credibility using Prolog
   */
  async evaluateInformation(info: InformationInput): Promise<PrologResponse> {
    try {
      // Create temporary facts file for this evaluation
      const factsFile = await this.createTemporaryFacts(info);

      // Query Prolog for evaluation
      const query: PrologQuery = {
        predicate: "evaluer_info",
        arguments: [info.content, "Level", "Score", "Reasoning"],
      };

      const result = await this.executeQuery(query);

      // Clean up temporary file
      await fs.unlink(factsFile);

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
   * Format query for Prolog execution
   */
  private formatQuery(query: PrologQuery): string {
    const args = query.arguments
      .map((arg) => {
        if (typeof arg === "string") {
          return `'${arg.replace(/'/g, "''")}'`;
        }
        return arg;
      })
      .join(", ");

    return `${query.predicate}(${args}).`;
  }

  /**
   * Run Prolog process with query
   */
  private runPrologProcess(queryString: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const prolog: ChildProcess = spawn(config.prolog.executablePath, [
        "-s",
        config.prolog.knowledgeBasePath,
        "-q",
        "-t",
        "halt",
      ]);

      let output = "";
      let errorOutput = "";

      prolog.stdout?.on("data", (data) => {
        output += data.toString();
      });

      prolog.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });

      prolog.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(
            new Error(`Prolog process exited with code ${code}: ${errorOutput}`)
          );
        }
      });

      prolog.on("error", (error) => {
        reject(error);
      });

      // Send query to Prolog
      prolog.stdin?.write(queryString + "\n");
      prolog.stdin?.end();

      // Set timeout
      setTimeout(() => {
        prolog.kill();
        reject(new Error("Prolog query timeout"));
      }, config.prolog.timeout);
    });
  }

  /**
   * Create temporary facts file for evaluation
   */
  private async createTemporaryFacts(info: InformationInput): Promise<string> {
    const facts = this.generatePrologFacts(info);
    const fileName = `facts_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}.pl`;
    const filePath = path.join(config.prolog.tempDir, fileName);

    // Ensure temp directory exists
    await fs.mkdir(config.prolog.tempDir, { recursive: true });

    await fs.writeFile(filePath, facts);
    return filePath;
  }

  /**
   * Generate Prolog facts from information input
   */
  private generatePrologFacts(info: InformationInput): string {
    const facts: string[] = [];

    // Source facts
    facts.push(`source_type('${info.content}', ${info.source.type}).`);
    facts.push(
      `source_reputation('${info.content}', ${info.source.reputation}).`
    );

    if (info.source.url) {
      facts.push(`source_url('${info.content}', '${info.source.url}').`);
    }

    // Author facts
    facts.push(
      `author_anonymous('${info.content}', ${info.author.isAnonymous}).`
    );
    facts.push(`author_expert('${info.content}', ${info.author.knownExpert}).`);

    if (info.author.name) {
      facts.push(`author_name('${info.content}', '${info.author.name}').`);
    }

    // Content metadata facts
    facts.push(
      `has_emotional_language('${info.content}', ${info.metadata.hasEmotionalLanguage}).`
    );
    facts.push(
      `has_citations('${info.content}', ${info.metadata.hasCitations}).`
    );
    facts.push(
      `citation_count('${info.content}', ${info.metadata.citationCount}).`
    );
    facts.push(
      `has_references('${info.content}', ${info.metadata.hasReferences}).`
    );

    if (info.metadata.publicationDate) {
      facts.push(
        `publication_date('${info.content}', '${info.metadata.publicationDate}').`
      );
    }

    return facts.join("\n") + "\n";
  }

  /**
   * Parse Prolog result
   */
  private parseResult(output: string): any {
    try {
      // Simple parsing - in real implementation, you'd want more robust parsing
      const lines = output.split("\n").filter((line) => line.trim());
      const lastLine = lines[lines.length - 1];

      if (lastLine.includes("true")) {
        return { success: true, data: output };
      } else if (lastLine.includes("false")) {
        return { success: false, data: output };
      }

      return { data: output };
    } catch (error) {
      logger.error("Failed to parse Prolog result:", error);
      return { error: "Failed to parse result" };
    }
  }
  async listFacts(): Promise<string[]> {
    try {
      const content = await fs.readFile(
        config.prolog.knowledgeBasePath,
        "utf-8"
      );

      return content
        .split(/\r?\n/) // Handle both Unix and Windows line endings
        .map((line) => line.trim()) // Remove whitespace and \r
        .filter(
          (line) =>
            line &&
            !line.startsWith("%") &&
            line.endsWith(".") &&
            !line.includes(":-") // Exclude rules
        );
    } catch (error) {
      logger.error("Failed to read knowledge base:", error);
      throw new Error("Failed to retrieve facts");
    }
  }

  // Add these methods to your existing class
  private validateFactStructure(predicate: string, args: string[]): void {
    if (predicate.includes(":-") || /[A-Z]/.test(predicate)) {
      throw new Error("Invalid predicate format - rules/variables not allowed");
    }
    args.forEach((arg) => {
      if (arg.startsWith("_") || arg.match(/[A-Z]/)) {
        throw new Error("Variables not allowed in fact arguments");
      }
    });
  }

  public async addFacts(request: AddFactRequest): Promise<void> {
    try {
      // Validate each fact
      request.facts.forEach((fact) =>
        this.validateFactStructure(fact.predicate, fact.arguments)
      );

      // Append to knowledge base
      const formatted = request.facts
        .map(
          (f) =>
            `${f.predicate}(${f.arguments.join(", ")}). % source:${
              request.source || "user"
            }`
        )
        .join("\n");

      await fs.appendFile(
        config.prolog.knowledgeBasePath,
        `\n\n% Added at ${new Date().toISOString()}\n${formatted}\n`
      );
    } catch (error) {
      logger.error("Fact addition failed", error);
      throw error;
    }
  }
}
