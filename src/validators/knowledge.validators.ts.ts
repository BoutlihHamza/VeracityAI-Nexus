import { body } from 'express-validator';

export const addFactValidator = [
  body('facts').isArray().withMessage('Facts must be an array'),
  body('facts.*.predicate')
    .isString().withMessage('Predicate must be a string')
    .notEmpty().withMessage('Predicate is required'),
  body('facts.*.arguments')
    .isArray().withMessage('Arguments must be an array')
    .notEmpty().withMessage('At least one argument is required'),
  body('facts.*.arguments.*')
    .isString().withMessage('Arguments must be strings'),
  body('source').optional().isString(),
  body('expiration').optional().isISO8601()
];