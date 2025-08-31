import fs from 'fs';
import path from 'path';

export const rootPath = path.join(__dirname, '../../../../');

export const readFiles = {
  readFileSync: (filePath: string): string => {
    return fs.readFileSync(filePath, 'utf8');
  },
};
