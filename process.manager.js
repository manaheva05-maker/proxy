const { spawn } = require('child_process');
const treeKill = require('tree-kill');
const path = require('path');
const fs = require('fs-extra');
const LogsService = require('./logs.service');

class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.logsService = new LogsService();
  }

  async start(instanceId, options) {
    if (this.processes.has(instanceId)) {
      await this.stop(instanceId);
    }

    const { cwd, command } = options;
    
    // Vérifier que le dossier existe
    if (!await fs.pathExists(cwd)) {
      throw new Error(`Dossier non trouvé: ${cwd}`);
    }

    // Analyser la commande
    const [cmd, ...args] = command.split(' ');

    console.log(`▶️ Démarrage du processus ${instanceId}: ${command} dans ${cwd}`);

    // Créer les streams de logs
    const logStreams = this.logsService.createLogStreams(instanceId);

    // Lancer le processus
    const process = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, PATH: process.env.PATH }
    });

    // Rediriger les sorties vers les fichiers de logs
    process.stdout.pipe(logStreams.stdout);
    process.stderr.pipe(logStreams.stderr);

    // Garder une trace du processus
    this.processes.set(instanceId, {
      process,
      pid: process.pid,
      startTime: Date.now(),
      status: 'running',
      logStreams
    });

    // Gérer la fin du processus
    process.on('exit', (code, signal) => {
      console.log(`⏹️ Processus ${instanceId} arrêté (code: ${code}, signal: ${signal})`);
      
      const proc = this.processes.get(instanceId);
      if (proc) {
        proc.status = 'stopped';
        proc.exitCode = code;
        proc.exitSignal = signal;
        
        // Fermer les streams de logs
        proc.logStreams.stdout.end();
        proc.logStreams.stderr.end();
      }
    });

    process.on('error', (err) => {
      console.error(`❌ Erreur processus ${instanceId}:`, err);
      
      // Logger l'erreur
      if (proc) {
        proc.logStreams.stderr.write(`Process error: ${err.message}\n`);
      }
    });

    return {
      id: instanceId,
      pid: process.pid,
      status: 'running'
    };
  }

  async stop(instanceId) {
    const proc = this.processes.get(instanceId);
    
    if (proc && proc.process) {
      console.log(`⏹️ Arrêt du processus ${instanceId} (PID: ${proc.pid})`);
      
      return new Promise((resolve) => {
        // Tuer le processus et ses enfants
        treeKill(proc.pid, 'SIGTERM', (err) => {
          if (err) {
            console.error(`Erreur lors de l'arrêt:`, err);
          }
          
          // Fermer les streams de logs
          if (proc.logStreams) {
            proc.logStreams.stdout.end();
            proc.logStreams.stderr.end();
          }
          
          this.processes.delete(instanceId);
          resolve();
        });
      });
    }
    
    return false;
  }

  async restart(instanceId) {
    const proc = this.processes.get(instanceId);
    
    if (proc) {
      const { cwd, command } = proc;
      await this.stop(instanceId);
      return this.start(instanceId, { cwd, command });
    }
    
    throw new Error(`Processus ${instanceId} non trouvé`);
  }

  getProcess(instanceId) {
    return this.processes.get(instanceId);
  }

  getActiveProcesses() {
    const active = [];
    
    for (const [id, proc] of this.processes.entries()) {
      if (proc.status === 'running' && this.isProcessAlive(proc.pid)) {
        active.push({
          id,
          pid: proc.pid,
          status: 'running',
          uptime: Date.now() - proc.startTime
        });
      }
    }
    
    return active;
  }

  isProcessAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async killAll() {
    const promises = [];
    
    for (const [id, proc] of this.processes.entries()) {
      promises.push(this.stop(id));
    }
    
    await Promise.all(promises);
  }
}

module.exports = ProcessManager;
