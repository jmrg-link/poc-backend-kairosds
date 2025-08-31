import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnector } from './../../src/infrastructure/databases/DatabaseConnector';
import { envs } from './../../src/config/envs';
import { getTaskModel } from './../../src/infrastructure/schemas';
import { TaskStatus } from './../../src/domain/entities/TaskEntity';

describe('Database Connector', () => {
  const testMongoUri = `${envs.MONGODB_URI}-test-db`;

  beforeAll(async () => {
    await DatabaseConnector.initialize(testMongoUri);
  });

  afterAll(async () => {
    const db = DatabaseConnector.getImageDb();
    await db.dropDatabase();
  });

  it('should connect to the test database successfully', () => {
    const db = DatabaseConnector.getImageDb();
    expect(db.readyState).toBe(1);
  });

  it('should create and retrieve a document', async () => {
    const TaskModel = getTaskModel(DatabaseConnector.getImageDb());
    const taskData = {
      status: TaskStatus.PENDING,
      price: 25.50,
      originalPath: '/test/db-test.jpg',
      images: [],
    };

    const createdTask = await TaskModel.create(taskData);
    expect(createdTask._id).toBeDefined();

    const foundTask = await TaskModel.findById(createdTask._id).lean();
    expect(foundTask).not.toBeNull();
    expect(foundTask?.price).toBe(25.50);
  });
});
