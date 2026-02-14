const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const { v4: uuidv4 } = require('uuid');

class DeployService {
  constructor(botsConfig) {
    this.botsConfig = botsConfig;
    this.deploymentsPath = path.join(__dirname, 'deployments');
    this.instancesFile = path.join(this.deploymentsPath, 'instances.json');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.deploymentsPath);
    
    // Créer le fichier instances.json s'il n'existe pas
    if (!await fs.pathExists(this.instancesFile)) {
      await fs.writeJson(this.instancesFile, { instances: [] });
    }
  }

  async deploy(botConfig, envVars) {
    const timestamp = Date.now();
    const instanceId = `${botConfig.id}_${timestamp}`;
    const instancePath = path.join(this.deploymentsPath, instanceId);

    try {
      console.log(`🚀 Déploiement de ${botConfig.name} (${instanceId})`);

      // 1. Cloner le repository
      console.log('📦 Clonage du repository...');
      const git = simpleGit();
      await git.clone(botConfig.repo, instancePath);

      // 2. Installer les dépendances
      console.log('📥 Installation des dépendances...');
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm install', { cwd: instancePath }, (error, stdout, stderr) => {
          if (error) {
            console.error('Erreur npm install:', stderr);
            reject(error);
          } else {
            console.log('✅ Dépendances installées');
            resolve();
          }
        });
      });

      // 3. Créer le fichier .env
      console.log('🔧 Création du fichier .env...');
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      await fs.writeFile(path.join(instancePath, '.env'), envContent);

      // 4. Sauvegarder les infos de déploiement
      const instance = {
        id: instanceId,
        botId: botConfig.id,
        name: botConfig.name,
        path: instancePath,
        deployedAt: new Date().toISOString(),
        status: 'deployed',
        env: envVars
      };

      await this.saveInstance(instance);

      console.log(`✅ Bot ${botConfig.name} déployé avec succès`);
      return instance;

    } catch (error) {
      // Nettoyer en cas d'erreur
      await fs.remove(instancePath).catch(() => {});
      throw new Error(`Échec du déploiement: ${error.message}`);
    }
  }

  async saveInstance(instance) {
    const data = await fs.readJson(this.instancesFile);
    data.instances.push(instance);
    await fs.writeJson(this.instancesFile, data, { spaces: 2 });
  }

  async getInstance(instanceId) {
    const data = await fs.readJson(this.instancesFile);
    return data.instances.find(i => i.id === instanceId);
  }

  async getAllInstances() {
    const data = await fs.readJson(this.instancesFile);
    return data.instances;
  }

  async updateInstanceInfo(instanceId, updatedInfo) {
    const data = await fs.readJson(this.instancesFile);
    const index = data.instances.findIndex(i => i.id === instanceId);
    
    if (index !== -1) {
      data.instances[index] = { ...data.instances[index], ...updatedInfo };
      await fs.writeJson(this.instancesFile, data, { spaces: 2 });
      return true;
    }
    
    return false;
  }

  async deleteInstance(instanceId) {
    const instance = await this.getInstance(instanceId);
    
    if (instance) {
      // Supprimer le dossier
      await fs.remove(instance.path).catch(() => {});
      
      // Supprimer de la liste
      const data = await fs.readJson(this.instancesFile);
      data.instances = data.instances.filter(i => i.id !== instanceId);
      await fs.writeJson(this.instancesFile, data, { spaces: 2 });
      
      return true;
    }
    
    return false;
  }

  async saveInstanceInfo(instanceId, info) {
    await this.updateInstanceInfo(instanceId, info);
  }
}

module.exports = DeployService;
