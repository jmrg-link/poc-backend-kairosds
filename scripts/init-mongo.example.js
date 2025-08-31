// change to init-mongo.js
db = db.getSiblingDB('imagedb');
db.tasks.createIndex({ "taskId": 1 }, { unique: true });
db.tasks.createIndex({ "status": 1, "createdAt": -1 });
db.tasks.createIndex({ "createdAt": -1 });

db.images.createIndex({ "taskId": 1 });
db.images.createIndex({ "md5": 1 });

db.createUser({
  user: 'user.example',
  pwd: 'password.example',
  roles: [
    {
      role: 'readWrite',
      db: 'imagedb'
    }
  ]
});