// Debug tool for Prolog Service
import { PrologService } from '../services/prologService';
import { InformationInput } from '../interfaces';

export class PrologDebugger {
  private prologService: PrologService;

  constructor() {
    this.prologService = PrologService.getInstance();
  }

  /**
   * Test basic Prolog connectivity
   */
  async testBasicQuery(): Promise<void> {
    console.log('=== Testing Basic Prolog Query ===');
    
    try {
      const result = await this.prologService.executeQuery('write("Hello Prolog"), nl.');
      console.log('Basic query result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Basic query failed:', error);
    }
  }

  /**
   * Test knowledge base loading
   */
  async testKnowledgeBase(): Promise<void> {
    console.log('\n=== Testing Knowledge Base ===');
    
    try {
      // Test if we can query existing predicates
      const queries = [
        'current_predicate(query_credibility/6).',
        'current_predicate(evaluer_info/4).',
        'source_type(test, official).' // Simple fact test
      ];

      for (const query of queries) {
        const result = await this.prologService.executeQuery(query);
        console.log(`Query: ${query}`);
        console.log('Result:', JSON.stringify(result, null, 2));
        console.log('---');
      }
    } catch (error) {
      console.error('Knowledge base test failed:', error);
    }
  }

  /**
   * Test fact generation and temporary file creation
   */
  async testFactGeneration(): Promise<void> {
    console.log('\n=== Testing Fact Generation ===');

    const testInfo: InformationInput = {
      content: "Test information content",
      source: {
        type: "news",
        reputation: 0.8,
        url: "https://example.com"
      },
      author: {
        isAnonymous: false,
        knownExpert: true,
        name: "Test Author"
      },
      metadata: {
        language: "Arabic",
        hasEmotionalLanguage: false,
        hasCitations: true,
        citationCount: 3,
        hasReferences: false,
        referenceUrls: [],
        publicationDate: "2024-01-01"
      }
    };

    try {
      // Generate facts manually to see what's created
      const facts = this.generatePrologFacts(testInfo);
      console.log('Generated facts:');
      console.log(facts);
      console.log('---');
    } catch (error) {
      console.error('Fact generation failed:', error);
    }
  }

  /**
   * Test the complete evaluation pipeline step by step
   */
  async testEvaluationPipeline(): Promise<void> {
    console.log('\n=== Testing Evaluation Pipeline ===');

    const testInfo: InformationInput = {
      content: "Test information content",
      source: {
        type: "news",
        reputation: 0.8
      },
      author: {
        isAnonymous: false,
        knownExpert: true
      },
      metadata: {
        language: "Arabic",
        hasEmotionalLanguage: true,
        hasCitations: true,
        citationCount: 3,
        hasReferences: true,
        referenceUrls: ["https://google.com"],
        publicationDate: "2024-01-01"
      }
    };

    try {
      console.log('1. Testing evaluateInformation...');
      const result = await this.prologService.evaluateInformation(testInfo);
      console.log('Evaluation result:', JSON.stringify(result, null, 2));
      
      console.log('\n2. Testing getDetailedEvaluation...');
      const detailedResult = await this.prologService.getDetailedEvaluation(testInfo);
      console.log('Detailed result:', JSON.stringify(detailedResult, null, 2));
      
    } catch (error) {
      console.error('Evaluation pipeline test failed:', error);
    }
  }

  /**
   * Test individual query components
   */
  async testQueryComponents(): Promise<void> {
    console.log('\n=== Testing Query Components ===');

    const testContent = "test_content";
    const escapedContent = this.escapeString(testContent);

    // Test individual predicates that should exist in your knowledge base
    const testQueries = [
      `source_type('${escapedContent}', news).`,
      `source_reputation('${escapedContent}', 0.8).`,
      `query_credibility('${escapedContent}', Level, Score, SS, CS, LS, ContS), write(Level-Score).`,
      `evaluer_info('${escapedContent}', Level, Score, Reasoning), write(Level-Score-Reasoning).`
    ];

    for (const query of testQueries) {
      try {
        console.log(`\nTesting query: ${query}`);
        const result = await this.prologService.executeQuery(query);
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`Query failed: ${query}`, error);
      }
    }
  }

  /**
   * Debug the exact query being sent to Prolog
   */
  async debugActualQuery(): Promise<void> {
    console.log('\n=== Debugging Actual Query ===');

    const testInfo: InformationInput = {
      content: "Test content",
      source: { type: "news", reputation: 0.8 },
      author: { isAnonymous: false, knownExpert: true },
      metadata: {
        language: "Arabic",
        hasEmotionalLanguage: false,
        hasCitations: true,
        citationCount: 3,
        hasReferences: false,
        referenceUrls: [],
        publicationDate: "2024-01-01"
      }
    };

    try {
      // Simulate the exact process from evaluateInformation
      const factsFile = await this.createTemporaryFacts(testInfo);
      console.log('Temporary facts file created:', factsFile);

      // Show the query that would be executed
      const queryString = `
        consult('${factsFile}'),
        query_credibility('${this.escapeString(testInfo.content)}', Level, Score, SourceScore, CitationScore, LanguageScore, ContradictionScore),
        write('RESULT:'), write(Level), write('|'), write(Score), write('|'), 
        write(SourceScore), write('|'), write(CitationScore), write('|'), 
        write(LanguageScore), write('|'), write(ContradictionScore), nl.
      `;

      console.log('\nQuery to be executed:');
      console.log(queryString);

      // Try to execute it
      const result = await this.prologService.executeQuery(queryString);
      console.log('\nQuery result:', JSON.stringify(result, null, 2));

      // Clean up
      await require('fs').promises.unlink(factsFile).catch(() => {});

    } catch (error) {
      console.error('Debug query failed:', error);
    }
  }

  // Helper methods (copied from your PrologService)
  private generatePrologFacts(info: InformationInput): string {
    const facts: string[] = [];
    const escapedContent = this.escapeString(info.content);
    
    facts.push(`source_type('${escapedContent}', ${info.source.type}).`);
    facts.push(`source_reputation('${escapedContent}', ${info.source.reputation}).`);
    
    if (info.source.url) {
      facts.push(`source_url('${escapedContent}', '${this.escapeString(info.source.url)}').`);
    }
    
    facts.push(`author_anonymous('${escapedContent}', ${info.author.isAnonymous}).`);
    facts.push(`author_expert('${escapedContent}', ${info.author.knownExpert}).`);
    
    if (info.author.name) {
      facts.push(`author_name('${escapedContent}', '${this.escapeString(info.author.name)}').`);
    }
    
    facts.push(`has_emotional_language('${escapedContent}', ${info.metadata.hasEmotionalLanguage}).`);
    facts.push(`has_citations('${escapedContent}', ${info.metadata.hasCitations}).`);
    facts.push(`citation_count('${escapedContent}', ${info.metadata.citationCount}).`);
    facts.push(`has_references('${escapedContent}', ${info.metadata.hasReferences}).`);
    
    
    
    return facts.join('\n') + '\n';
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  private async createTemporaryFacts(info: InformationInput): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    const config = require('../config').config; // Adjust import as needed
    
    const facts = this.generatePrologFacts(info);
    const fileName = `debug_facts_${Date.now()}.pl`;
    const filePath = path.join(config.prolog.tempDir, fileName);
    
    await fs.mkdir(config.prolog.tempDir, { recursive: true });
    await fs.writeFile(filePath, facts);
    
    return filePath;
  }

  /**
   * Run all debug tests
   */
  async runAllTests(): Promise<void> {
    console.log('🔍 Starting Prolog Debug Session\n');
    
    await this.testBasicQuery();
    await this.testKnowledgeBase();
    await this.testFactGeneration();
    await this.testQueryComponents();
    await this.debugActualQuery();
    await this.testEvaluationPipeline();
    
    console.log('\n✅ Debug session complete');
  }
}

// Usage example:
/*
const debugger = new PrologDebugger();
debugger.runAllTests().catch(console.error);
*/