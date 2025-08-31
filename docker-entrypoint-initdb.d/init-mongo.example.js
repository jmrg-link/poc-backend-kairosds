// /docker-entrypoint-initdb.d/init-mongo.js

db = db.getSiblingDB('imagedb');

var collections = db.getCollectionNames();
if (collections.length === 0) {
  print("Inicializando base de datos por primera vez...");

  db.createCollection('tasks');
  db.tasks.createIndex({ "status": 1, "createdAt": -1 });
  db.tasks.createIndex({ "createdAt": -1 });
  db.tasks.createIndex({ "idempotencyKey": 1 }, { unique: true, sparse: true });

  print("Índices creados exitosamente");
} else {
  print("Base de datos ya inicializada, saltando creación de índices");
}