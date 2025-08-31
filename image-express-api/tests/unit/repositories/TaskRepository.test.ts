import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TaskRepository } from '../../../src/presentation/Task/repositories/TaskRepository';
import { getTaskModel } from '../../../src/infrastructure/schemas';
import { Connection } from 'mongoose';
import { TaskStatus } from '../../../src/domain/entities';

jest.mock('../../../src/infrastructure/schemas', () => ({
  getTaskModel: jest.fn(),
}));

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      create: jest.fn(),
      findById: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findByIdAndUpdate: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn(),
      countDocuments: jest.fn(),
    };
    (getTaskModel as jest.Mock).mockReturnValue(mockModel);
    taskRepository = new TaskRepository({} as Connection);
  });

  it('should call the create method on the model with correct data', async () => {
    const taskData = { status: TaskStatus.PENDING, price: 10, originalPath: 'path/to/image.jpg' };
    const createdTask = { ...taskData, _id: 'mockId', toObject: () => createdTask };
    mockModel.create.mockResolvedValue(createdTask);

    const result = await taskRepository.create(taskData);

    expect(mockModel.create).toHaveBeenCalledWith(taskData);
    expect(result).toEqual(createdTask);
  });

  it('should call findById and lean on the model', async () => {
    const mockTask = { _id: 'mockId', status: TaskStatus.PENDING };
    mockModel.lean.mockResolvedValue(mockTask);

    const result = await taskRepository.findById('mockId');

    expect(mockModel.findById).toHaveBeenCalledWith('mockId');
    expect(mockModel.lean).toHaveBeenCalled();
    expect(result).toEqual(mockTask);
  });

  it('should call findOne with idempotency key and lean on the model', async () => {
    const key = 'idem-key-123';
    const mockTask = { _id: 'mockId', idempotencyKey: key };
    mockModel.lean.mockResolvedValue(mockTask);

    const result = await taskRepository.findByIdempotencyKey(key);

    expect(mockModel.findOne).toHaveBeenCalledWith({ idempotencyKey: key });
    expect(mockModel.lean).toHaveBeenCalled();
    expect(result).toEqual(mockTask);
  });

  it('should call findByIdAndUpdate with the correct update payload', async () => {
    const taskId = 'mockId';
    const status = 'completed';
    const data = { some: 'data' };

    await taskRepository.updateStatus(taskId, status, data);

    expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({
        status,
        ...data,
      })
    );
  });
});
