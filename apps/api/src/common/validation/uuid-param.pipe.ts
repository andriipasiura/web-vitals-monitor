import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

export const uuidParam = new ZodValidationPipe(z.uuid());
