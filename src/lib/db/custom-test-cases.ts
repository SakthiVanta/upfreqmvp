import { and, eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';
import { TestCase } from '../testing/types';

export async function saveCustomTestCase(userId: string, testCase: TestCase): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  await db.insert(schema.customTestCases).values({
    id: testCase.id,
    userId,
    name: testCase.name,
    description: testCase.description,
    category: testCase.category,
    environment: testCase.environment,
    durationSec: testCase.durationSec,
    commandType: testCase.commandType,
    commandParamsJson: testCase.commandParams,
    assertionsJson: testCase.assertions,
  });
}

export async function getCustomTestCase(userId: string, id: string): Promise<TestCase | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(schema.customTestCases)
    .where(and(eq(schema.customTestCases.id, id), eq(schema.customTestCases.userId, userId)));

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category as TestCase['category'],
    environment: row.environment as TestCase['environment'],
    durationSec: row.durationSec,
    commandType: row.commandType as TestCase['commandType'],
    commandParams: row.commandParamsJson as TestCase['commandParams'],
    assertions: row.assertionsJson as TestCase['assertions'],
  };
}

export async function listCustomTestCases(userId: string): Promise<TestCase[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.select().from(schema.customTestCases).where(eq(schema.customTestCases.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category as TestCase['category'],
    environment: row.environment as TestCase['environment'],
    durationSec: row.durationSec,
    commandType: row.commandType as TestCase['commandType'],
    commandParams: row.commandParamsJson as TestCase['commandParams'],
    assertions: row.assertionsJson as TestCase['assertions'],
  }));
}
