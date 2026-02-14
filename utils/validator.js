class Validator {
  constructor(password) {
    this.password = password;
  }

  validatePassword(password) {
    return password === this.password;
  }

  validateEnv(botConfig, env) {
    const missing = [];
    
    for (const required of botConfig.env_required) {
      if (!env[required] || env[required].trim() === '') {
        missing.push(required);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  validateBotId(botId, botsConfig) {
    return botsConfig.some(bot => bot.id === botId);
  }

  sanitizeEnvValue(value) {
    // Enlever les caractères dangereux
    return value.replace(/[;&|`$]/g, '');
  }
}

module.exports = Validator;
