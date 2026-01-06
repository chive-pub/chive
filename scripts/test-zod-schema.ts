import { z } from 'zod';

const testSchema = z.object({
  did: z.string().describe('Author DID'),
  name: z.string().optional(),
});

console.log('=== Testing Zod 4 native toJSONSchema ===');
console.log(JSON.stringify(z.toJSONSchema(testSchema), null, 2));
