const fs = require('fs-extra');
const path = require('path');

class FileUtils {
  static async ensureDirectory(dirPath) {
    await fs.ensureDir(dirPath);
    return dirPath;
  }

  static async removeDirectory(dirPath) {
    if (await fs.pathExists(dirPath)) {
      await fs.remove(dirPath);
      return true;
    }
    return false;
  }

  static async listDirectories(basePath) {
    if (!await fs.pathExists(basePath)) {
      return [];
    }
    
    const items = await fs.readdir(basePath);
    const directories = [];
    
    for (const item of items) {
      const itemPath = path.join(basePath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        directories.push(item);
      }
    }
    
    return directories;
  }

  static async getDirectorySize(dirPath) {
    let size = 0;
    
    if (!await fs.pathExists(dirPath)) {
      return size;
    }
    
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        size += stat.size;
      } else if (stat.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      }
    }
    
    return size;
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

module.exports = FileUtils;
