const fs = require('fs-extra');
const path = require('path');
const { createWriteStream } = require('fs');

class LogsService {
  constructor() {
    this.logsPath = path.join(__dirname, 'deployments', 'logs');
    this.ensureLogsDirectory();
  }

  async ensureLogsDirectory() {
    await fs.ensureDir(this.logsPath);
  }

  createLogStreams(instanceId) {
    const stdoutPath = path.join(this.logsPath, `${instanceId}_stdout.log`);
    const stderrPath = path.join(this.logsPath, `${instanceId}_stderr.log`);
    
    const stdout = createWriteStream(stdoutPath, { flags: 'a' });
    const stderr = createWriteStream(stderrPath, { flags: 'a' });
    
    return { stdout, stderr };
  }

  async getLogs(instanceId, lines = 100) {
    const stdoutPath = path.join(this.logsPath, `${instanceId}_stdout.log`);
    const stderrPath = path.join(this.logsPath, `${instanceId}_stderr.log`);
    
    const logs = {
      stdout: [],
      stderr: []
    };
    
    // Lire stdout
    if (await fs.pathExists(stdoutPath)) {
      logs.stdout = await this.tailFile(stdoutPath, lines);
    }
    
    // Lire stderr
    if (await fs.pathExists(stderrPath)) {
      logs.stderr = await this.tailFile(stderrPath, lines);
    }
    
    return logs;
  }

  async tailFile(filePath, lines) {
    const content = await fs.readFile(filePath, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    
    // Prendre les dernières lignes
    return allLines.slice(-lines);
  }

  async clearLogs(instanceId) {
    const stdoutPath = path.join(this.logsPath, `${instanceId}_stdout.log`);
    const stderrPath = path.join(this.logsPath, `${instanceId}_stderr.log`);
    
    const promises = [];
    
    if (await fs.pathExists(stdoutPath)) {
      promises.push(fs.remove(stdoutPath));
    }
    
    if (await fs.pathExists(stderrPath)) {
      promises.push(fs.remove(stderrPath));
    }
    
    await Promise.all(promises);
    
    return true;
  }

  async getLogFiles(instanceId) {
    const files = await fs.readdir(this.logsPath);
    return files.filter(file => file.startsWith(instanceId));
  }
}

module.exports = LogsService;
