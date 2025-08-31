import { describe, it, expect } from '@jest/globals';
import {
  generateUUID,
  generateMD5,
  generateId,
  generateToken,
  generateSHA256,
  generateUniqueFilename,
  generateShortId,
  isValidObjectId,
} from '../../../src/core/helpers/crypto';
import { Types } from 'mongoose';

describe('Crypto Helpers', () => {
  it('should generate a valid UUID', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate a correct MD5 hash', () => {
    const data = 'hello world';
    const expectedHash = '5eb63bbbe01eeed093cb22bb8f5acdc3';
    expect(generateMD5(data)).toBe(expectedHash);
  });

  it('should generate a valid MongoDB ObjectId', () => {
    const id = generateId();
    expect(Types.ObjectId.isValid(id)).toBe(true);
  });

  it('should generate a random token of specified length', () => {
    const token = generateToken(32);
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate a correct SHA256 hash', () => {
    const data = 'hello world';
    const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    expect(generateSHA256(data)).toBe(expectedHash);
  });

  it('should generate a unique filename', () => {
    const originalName = 'image.jpg';
    const uniqueName = generateUniqueFilename(originalName);
    expect(uniqueName).not.toBe(originalName);
    expect(uniqueName).toContain('image-');
    expect(uniqueName).toContain('.jpg');
  });

  it('should generate a short ID', () => {
    const shortId = generateShortId();
    expect(shortId).toHaveLength(8);
    expect(shortId).toMatch(/^[0-9a-f]{8}$/);
  });

  describe('isValidObjectId', () => {
    it('should return true for a valid ObjectId', () => {
      const validId = new Types.ObjectId().toHexString();
      expect(isValidObjectId(validId)).toBe(true);
    });

    it('should return false for an invalid ObjectId', () => {
      expect(isValidObjectId('not-an-object-id')).toBe(false);
      expect(isValidObjectId('12345')).toBe(false);
    });
  });
});
