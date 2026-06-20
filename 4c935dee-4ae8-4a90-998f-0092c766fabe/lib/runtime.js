'use strict';

const config = require('../config');
const { createLogger } = require('./logger');
const { VaultClient } = require('./vault-client');
const { K8sClient } = require('./k8s-client');
const { Notifier } = require('./notifier');
const store = require('./store');

function buildContext(argv) {
  const opts = argv || {};
  const profile = config.resolve({ profile: opts.profile });
  const logger = createLogger({ quiet: opts.quiet, json: opts.json });
  return {
    argv: opts,
    profile,
    logger,
    vault: new VaultClient(profile),
    k8s: new K8sClient(profile),
    notifier: new Notifier(profile.notifier || {}),
    store
  };
}

module.exports = { buildContext };
