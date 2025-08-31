import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import http from 'http';
import express from 'express';
import { createApp } from './../../src/presentation/Bootstrap/app';
import { DatabaseConnector } from './../../src/infrastructure/databases/DatabaseConnector';
import { envs } from './../../src/config/envs';
import { getTaskModel } from './../../src/infrastructure/schemas';
import { TaskStatus } from './../../src/domain/entities/TaskEntity';
import mongoose from 'mongoose';
import path from 'path';

/**
 * @fileoverview Suite de tests de integración para los endpoints de tareas
 * @module tests/integration/task.endpoints.test
 * @description Valida el flujo completo de la API de procesamiento de imágenes,
 * incluyendo creación de tareas, consulta de estado y manejo de errores.
 * Utiliza una base de datos de prueba real y un servidor HTTP completo.
 */

/**
 * @description Suite principal de tests de integración para endpoints de tareas
 * @test {TaskController} Prueba todos los endpoints expuestos por el controlador
 * @test {TaskService} Valida la integración con el servicio de tareas
 * @test {TaskRepository} Verifica la persistencia en MongoDB
 */
describe('Task Endpoints Flow', () => {
  let app: express.Application;
  let server: http.Server;
  let taskId: string;
  let TaskModel: ReturnType<typeof getTaskModel>;

  /**
   * @description Configuración inicial del entorno de pruebas
   * @async
   * @function beforeAll
   * @returns {Promise<void>}
   * @throws {Error} Si falla la conexión a la base de datos o la creación del servidor
   */
  beforeAll(async () => {
    const testMongoUri = `${envs.MONGODB_URI}-test`;
    await DatabaseConnector.initialize(testMongoUri);
    
    app = createApp();
    server = http.createServer(app).listen(0);
    
    TaskModel = getTaskModel(DatabaseConnector.getImageDb());
    
    await TaskModel.create({
      _id: new mongoose.Types.ObjectId("68b18c370856213e9529f837"),
      status: TaskStatus.COMPLETED,
      price: 17,
      originalPath: "C:\\Users\\tekno\\Desktop\\jmrg-et-kairos-api\\storage\\images\\68b18c370856213e9529f837\\original.jpg",
      images: [
        {
          resolution: "1024",
          path: "C:\\Users\\user\\Desktop\\user-test-kairos-api\\storage\\images\\68b18c370856213e9529f837\\original_1024px.jpg",
          _id: new mongoose.Types.ObjectId("68b18c3709a87a831754c830"),
        },
        {
          resolution: "800",
          path: "C:\\Users\\user\\Desktop\\user-test-kairos-api\\storage\\images\\68b18c370856213e9529f837\\original_800px.jpg",
          _id: new mongoose.Types.ObjectId("68b18c3709a87a831754c831"),
        }
      ],
      idempotencyKey: "3ec6952c-57a2-49bc-bb32-70dde0f4a6f4",
      createdAt: new Date("2025-08-29T11:17:11.707Z"),
      updatedAt: new Date("2025-08-29T11:17:11.813Z"),
    });
  });

  /**
   * @description Limpieza del entorno de pruebas
   * @async
   * @function afterAll
   * @returns {Promise<void>}
   * @ensures Cierra todas las conexiones y libera recursos
   */
  afterAll(async () => {
    await TaskModel.deleteMany({});
    
    const db = DatabaseConnector.getImageDb();
    await db.dropDatabase();
    
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    
    await DatabaseConnector.disconnect();
    
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * @description Suite de pruebas para la creación de tareas
   * @group Task Creation
   */
  describe('1. Task Creation', () => {
    /**
     * @test POST /api/v1/tasks con imagePath
     * @description Valida la creación de una tarea desde una ruta local
     * @expects Status 201 con taskId, status pending y price
     */
    it('should create a new task from imagePath and return status "pending"', async () => {
      const response = await request(server)
        .post('/api/v1/tasks')
        .send({ imagePath: '/test/sample.jpg' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
      expect(response.body).toHaveProperty('price');
      expect(typeof response.body.price).toBe('number');
      expect(response.body.price).toBeGreaterThanOrEqual(5);
      expect(response.body.price).toBeLessThanOrEqual(50);

      taskId = response.body.taskId;
    });

    /**
     * @test POST /api/v1/tasks con imageUrl
     * @description Valida la creación de una tarea desde una URL externa
     * @expects Status 201 con taskId válido
     */
    it('should create a new task from a specific imageUrl', async () => {
      const response = await request(server)
        .post('/api/v1/tasks')
        .send({ 
          imageUrl: "https://cdn.pixabay.com/photo/2023/02/12/13/16/dog-7785066_960_720.jpg" 
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    /**
     * @test POST /api/v1/tasks/upload con archivo
     * @description Valida la creación de una tarea mediante upload directo
     * @expects Status 201 con taskId válido
     */
    it('should create a new task from file upload', async () => {
      const imagePath = path.join(__dirname, '../fixtures/images/puppy_01.jpg');
      const response = await request(server)
        .post('/api/v1/tasks/upload')
        .attach('image', imagePath);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status', TaskStatus.PENDING);
      expect(mongoose.Types.ObjectId.isValid(response.body.taskId)).toBe(true);
    });
  });

  /**
   * @description Suite de pruebas para consulta de estado de tareas
   * @group Task Status Query
   */
  describe('2. Task Status Query', () => {
    /**
     * @test GET /api/v1/tasks/:taskId para tarea pendiente
     * @description Valida que una tarea pendiente no incluya array de imágenes
     * @expects Status 200 con estado pending sin campo images
     */
    it('should return a pending task without an "images" array', async () => {
      const response = await request(server).get(`/api/v1/tasks/${taskId}`);

      expect(response.status).toBe(200);
      expect(response.body.taskId).toBe(taskId);
      expect(response.body.status).toBe(TaskStatus.PENDING);
      expect(response.body).not.toHaveProperty('images');
    });

    /**
     * @test GET /api/v1/tasks/:taskId para tarea preexistente
     * @description Valida la recuperación de una tarea completada con datos de prueba
     * @expects Status 200 con estado completed e imágenes procesadas
     */
    it('should retrieve a specific pre-existing completed task', async () => {
      const specificTaskId = "68b18c370856213e9529f837";
      const response = await request(server).get(`/api/v1/tasks/${specificTaskId}`);

      expect(response.status).toBe(200);
      expect(response.body.taskId).toBe(specificTaskId);
      expect(response.body.status).toBe(TaskStatus.COMPLETED);
      expect(response.body).toHaveProperty('images');
      expect(Array.isArray(response.body.images)).toBe(true);
      expect(response.body.images.length).toBe(2);
    });

    /**
     * @test GET /api/v1/tasks/:taskId para tarea completada
     * @description Valida que una tarea completada incluya el array de imágenes procesadas
     * @expects Status 200 con estado completed y array de imágenes con resoluciones
     */
    it('should return a completed task with an "images" array', async () => {
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.COMPLETED,
        images: [
          { 
            resolution: '1024', 
            path: '/output/image_1024.jpg',
            _id: new mongoose.Types.ObjectId()
          },
          { 
            resolution: '800', 
            path: '/output/image_800.jpg',
            _id: new mongoose.Types.ObjectId()
          },
        ],
      });

      const response = await request(server).get(`/api/v1/tasks/${taskId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(TaskStatus.COMPLETED);
      expect(response.body).toHaveProperty('images');
      expect(response.body.images).toHaveLength(2);
      expect(response.body.images[0]).toHaveProperty('resolution');
      expect(response.body.images[0]).toHaveProperty('path');
    });

    /**
     * @test GET /api/v1/tasks/:taskId para tarea fallida
     * @description Valida que una tarea fallida incluya mensaje de error descriptivo
     * @expects Status 200 con estado failed y campo error
     */
    it('should return a failed task with an "error" message', async () => {
      const errorMessage = 'Processing failed: invalid format';
      
      await TaskModel.findByIdAndUpdate(taskId, {
        status: TaskStatus.FAILED,
        error: errorMessage,
      });

      const response = await request(server).get(`/api/v1/tasks/${taskId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(TaskStatus.FAILED);
      expect(response.body).toHaveProperty('error', errorMessage);
      expect(response.body).not.toHaveProperty('images');
    });
  });

  /**
   * @description Suite de pruebas para manejo de errores
   * @group Error Handling
   */
  describe('3. Error Handling', () => {
    /**
     * @test GET /api/v1/tasks/:taskId con ID inexistente
     * @description Valida el manejo de errores 404 para tareas no encontradas
     * @expects Status 404 con error NOT_FOUND y mensaje descriptivo
     */
    it('should return a 404 error for a non-existent taskId', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();
      const response = await request(server).get(`/api/v1/tasks/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'NOT_FOUND');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain(fakeId);
    });

    /**
     * @test GET /api/v1/tasks/:taskId con ID inválido
     * @description Valida el manejo de errores para IDs mal formateados
     * @expects Status 400 con error de validación
     */
    it('should return a 400 error for an invalid taskId format', async () => {
      const invalidId = 'invalid-id-format';
      const response = await request(server).get(`/api/v1/tasks/${invalidId}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});