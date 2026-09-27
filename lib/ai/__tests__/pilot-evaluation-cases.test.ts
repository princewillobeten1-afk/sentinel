import { expect, it } from 'vitest';
import cases from '../pilot/evaluation-cases.json';
import { contextSchema } from '../pilot/contracts';
import { privacyViolation } from '../pilot/privacy';
import { skills } from '../pilot/skills';

it('has forty uniquely identified representative live scenarios',()=>{
  expect(cases).toHaveLength(40);expect(new Set(cases.map(c=>c.id)).size).toBe(40);
  for(const name of Object.keys(skills)) expect(cases.some(c=>c.expectedTool===name)).toBe(true);
});
it.each(cases)('$id has a valid public context and expected privacy outcome',scenario=>{
  expect(contextSchema.safeParse(scenario.context).success).toBe(true);
  expect(privacyViolation(scenario.question)).toBe(scenario.expectBlocked);
  if(scenario.expectedTool) expect(Object.keys(skills)).toContain(scenario.expectedTool);
});
