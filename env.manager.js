const fs = require('fs-extra');
const path = require('path');

class EnvManager {
  async writeEnv(instancePath, envVars) {
    const envPath = path.join(instancePath, '.env');
    
    // Convertir l'objet en format .env
    const envContent = Object.entries(envVars)
      .map(([key, value]) => {
        // Échapper les valeurs si nécessaire
        const escapedValue = value.includes(' ') ? `"${value}"` : value;
        return `${key}=${escapedValue}`;
      })
      .join('\n');
    
    await fs.writeFile(envPath, envContent);
    
    return true;
  }

  async readEnv(instancePath) {
    const envPath = path.join(instancePath, '.env');
    
    if (!await fs.pathExists(envPath)) {
      return {};
    }
    
    const content = await fs.readFile(envPath, 'utf8');
    const envVars = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) {
          let value = valueParts.join('=');
          // Enlever les guillemets si présents
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          envVars[key.trim()] = value;
        }
      }
    });
    
    return envVars;
  }

  async deleteEnv(instancePath) {
    const envPath = path.join(instancePath, '.env');
    
    if (await fs.pathExists(envPath)) {
      await fs.remove(envPath);
      return true;
    }
    
    return false;
  }

  async updateEnv(instancePath, newVars) {
    const currentEnv = await this.readEnv(instancePath);
    const updatedEnv = { ...currentEnv, ...newVars };
    
    await this.writeEnv(instancePath, updatedEnv);
    
    return updatedEnv;
  }
}

module.exports = EnvManager;
