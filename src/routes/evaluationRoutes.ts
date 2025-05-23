import { Router } from 'express';
import { EvaluationController } from '../controllers/evaluationController';

const router = Router();
const evaluationController = new EvaluationController();

// Main evaluation endpoint
router.post('/evaluate', evaluationController.evaluateInformation);

// Test scenarios endpoint
router.get('/evaluate/test', evaluationController.getTestScenarios);

// Batch evaluation endpoint
router.post('/evaluate/batch', evaluationController.evaluateBatch);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Expert System API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export { router as evaluationRoutes };