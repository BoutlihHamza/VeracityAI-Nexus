import axios from 'axios';
import { InformationInput } from '../interfaces';

export class TestClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3000/api/v1') {
    this.baseUrl = baseUrl;
  }
  
  async testHealth(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      console.log('Health check:', response.data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }
  
  async testEvaluation(): Promise<void> {
    const testInfo: InformationInput = {
      content: "Climate change is a hoax created by scientists for funding",
      source: {
        type: 'unknown',
        reputation: 0.2
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
    };
    
    try {
      const response = await axios.post(`${this.baseUrl}/evaluate`, testInfo);
      console.log('Evaluation result:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Evaluation failed:', error);
    }
  }
  
  async testScenarios(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/evaluate/test`);
      console.log('Test scenarios:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Failed to get test scenarios:', error);
    }
  }
}