const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const DeployService = require('./deploy.service');
const ProcessManager = require('./process.manager');
const EnvManager = require('./env.manager');
const LogsService = require('./logs.service');
const Validator = require('./utils/validator');
const BOTS_CONFIG = require('./bots.config');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = 'inconnuboy';

// Services
const deployService = new DeployService(BOTS_CONFIG);
const processManager = new ProcessManager();
const envManager = new EnvManager();
const logsService = new LogsService();
const validator = new Validator(PASSWORD);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware d'authentification
const authenticate = (req, res, next) => {
  const password = req.body.password || req.query.password;
  
  if (!validator.validatePassword(password)) {
    return res.status(401).json({ 
      success: false,
      error: 'Mot de passe incorrect' 
    });
  }
  
  next();
};

// ============= ROUTES PUBLIQUES =============

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    name: 'Bot Proxy Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      bots: '/bots',
      deploy: '/deploy',
      active: '/bots/active',
      stats: '/stats'
    }
  });
});

// Liste des bots disponibles
app.get('/bots', (req, res) => {
  const bots = BOTS_CONFIG.map(bot => ({
    id: bot.id,
    name: bot.name,
    description: bot.description,
    env_required: bot.env_required
  }));
  
  res.json({
    success: true,
    count: bots.length,
    bots
  });
});

// ============= ROUTES PROTÉGÉES =============

// Déployer un bot
app.post('/deploy', authenticate, async (req, res) => {
  const { bot_id, env } = req.body;
  
  try {
    // Vérifier que le bot existe
    const botConfig = BOTS_CONFIG.find(b => b.id === bot_id);
    if (!botConfig) {
      return res.status(404).json({ 
        success: false,
        error: 'Bot non trouvé' 
      });
    }
    
    // Valider les variables d'environnement
    const validation = validator.validateEnv(botConfig, env);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Variables d\'environnement manquantes',
        missing: validation.missing
      });
    }
    
    // Déployer le bot
    const deployment = await deployService.deploy(botConfig, env);
    
    // Lancer le processus
    const process = await processManager.start(deployment.id, {
      cwd: deployment.path,
      command: botConfig.start
    });
    
    // Sauvegarder les infos de l'instance
    await deployService.saveInstanceInfo(deployment.id, {
      botId: bot_id,
      name: botConfig.name,
      path: deployment.path,
      status: 'running',
      deployedAt: new Date().toISOString(),
      env: env
    });
    
    res.json({
      success: true,
      instance: {
        id: deployment.id,
        name: botConfig.name,
        status: 'running',
        path: deployment.path,
        deployedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Erreur déploiement:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Modifier les variables d'environnement
app.put('/bot/:id/env', authenticate, async (req, res) => {
  const { id } = req.params;
  const { env } = req.body;
  
  try {
    // Vérifier que l'instance existe
    const instance = await deployService.getInstance(id);
    if (!instance) {
      return res.status(404).json({ 
        success: false,
        error: 'Instance non trouvée' 
      });
    }
    
    // Trouver la config du bot
    const botConfig = BOTS_CONFIG.find(b => b.id === instance.botId);
    
    // Valider les nouvelles variables
    const validation = validator.validateEnv(botConfig, env);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Variables d\'environnement manquantes',
        missing: validation.missing
      });
    }
    
    // Écrire le nouveau .env
    await envManager.writeEnv(instance.path, env);
    
    // Mettre à jour les infos de l'instance
    instance.env = env;
    await deployService.updateInstanceInfo(id, instance);
    
    // Redémarrer le processus
    await processManager.restart(id);
    
    res.json({ 
      success: true, 
      message: 'Variables d\'environnement mises à jour, bot redémarré'
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Supprimer les variables d'environnement
app.delete('/bot/:id/env', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    const instance = await deployService.getInstance(id);
    if (!instance) {
      return res.status(404).json({ 
        success: false,
        error: 'Instance non trouvée' 
      });
    }
    
    // Supprimer le fichier .env
    await envManager.deleteEnv(instance.path);
    
    // Arrêter le processus
    await processManager.stop(id);
    
    // Mettre à jour le statut
    instance.env = {};
    instance.status = 'stopped';
    await deployService.updateInstanceInfo(id, instance);
    
    res.json({ 
      success: true, 
      message: 'Variables d\'environnement supprimées, bot arrêté' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Arrêter un bot
app.post('/bot/:id/stop', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    await processManager.stop(id);
    
    // Mettre à jour le statut
    const instance = await deployService.getInstance(id);
    if (instance) {
      instance.status = 'stopped';
      await deployService.updateInstanceInfo(id, instance);
    }
    
    res.json({ 
      success: true, 
      message: 'Bot arrêté' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Relancer un bot
app.post('/bot/:id/restart', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    await processManager.restart(id);
    
    // Mettre à jour le statut
    const instance = await deployService.getInstance(id);
    if (instance) {
      instance.status = 'running';
      await deployService.updateInstanceInfo(id, instance);
    }
    
    res.json({ 
      success: true, 
      message: 'Bot relancé' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Supprimer définitivement un bot
app.delete('/bot/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Arrêter le processus
    await processManager.stop(id);
    
    // Supprimer le dossier
    await deployService.deleteInstance(id);
    
    // Supprimer les logs
    await logsService.clearLogs(id);
    
    res.json({ 
      success: true, 
      message: 'Bot supprimé définitivement' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Voir les bots actifs
app.get('/bots/active', authenticate, async (req, res) => {
  const activeProcesses = processManager.getActiveProcesses();
  const instances = await deployService.getAllInstances();
  
  const activeBots = instances
    .filter(instance => activeProcesses.some(p => p.id === instance.id))
    .map(instance => ({
      id: instance.id,
      name: instance.name,
      status: 'running',
      deployedAt: instance.deployedAt,
      botId: instance.botId
    }));
  
  res.json({
    success: true,
    active: activeBots.length,
    bots: activeBots
  });
});

// Statistiques
app.get('/stats', authenticate, async (req, res) => {
  const instances = await deployService.getAllInstances();
  const activeProcesses = processManager.getActiveProcesses();
  
  const running = instances.filter(i => 
    activeProcesses.some(p => p.id === i.id)
  ).length;
  
  res.json({
    success: true,
    stats: {
      total: instances.length,
      running: running,
      stopped: instances.length - running
    }
  });
});

// Logs d'un bot
app.get('/logs/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { lines = 100 } = req.query;
  
  try {
    const instance = await deployService.getInstance(id);
    if (!instance) {
      return res.status(404).json({ 
        success: false,
        error: 'Instance non trouvée' 
      });
    }
    
    const logs = await logsService.getLogs(id, parseInt(lines));
    
    res.json({
      success: true,
      instance: id,
      logs
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Proxy backend démarré sur http://localhost:${PORT}`);
  console.log(`📦 Bots disponibles: ${BOTS_CONFIG.length}`);
  console.log(`🔐 Mot de passe: inconnuboy`);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('Arrêt du serveur...');
  await processManager.killAll();
  process.exit(0);
});
