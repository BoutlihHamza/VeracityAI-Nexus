import { Router } from 'express';
import { KnowledgeController } from '../controllers/knowledgeController';
import { addFactValidator } from '../validators/knowledge.validators.ts';

const router = Router();
const controller = new KnowledgeController();

// Add facts
router.post('/facts', addFactValidator, controller.addFacts);

// List facts
router.get('/facts', controller.listFacts);

export { router as knowledgeRoutes };