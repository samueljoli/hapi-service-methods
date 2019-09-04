'use strict';

const Toys = require('toys');
const joi = require('@hapi/joi');
const pkg = require('../package.json');

const internals = {};

module.exports = {
    pkg,
    multiple: true,
    register(server) {

        const rootState = internals.rootState(server.realm);

        if (!rootState.setup) {
            internals.setServiceScopeMap(rootState);

            internals.setServices(rootState);

            server.decorate('server', 'registerServiceMethods', internals.registerServiceMethods);

            server.decorate('server', 'services', internals.services);

            server.decorate('request', 'services', internals.services);

            server.decorate('toolkit', 'services', internals.services);

            rootState.setup = true;
        }
    },
};

internals.services = function services() {
    return this.realm.plugins[pkg.name].services;
};

internals.setServiceScopeMap = (rootState) => {
    const desc = {
        value: new Map(),
        writable: false,
    };
    Object.defineProperty(rootState, 'serviceScopeMap', desc);
};

internals.setServices = (rootState) => {
    const desc = {
        value: {},
        writable: false,
        enumerable: true,
    };
    Object.defineProperty(rootState, 'services', desc);
};

internals.rootState = (realm) => Toys.rootState(realm, pkg.name);

internals.schemas = joi.object({
    objConfig: joi.object().keys({
        scope: joi.string().required(),
        services: joi.array().items({
            name: joi.string().required(),
            method: joi.func().required(),
            cache: joi.object().keys({
                expiresIn: joi.number().integer(),
                generateTimeout: joi.number().integer(),
            }).optional().options({ allowUnknown: false }),
        }).required(),
        context: joi.object(),
    }),
    arrayConfig: joi.array().items(joi.lazy(() => joi.reach(internals.schemas, 'objConfig'))),
    inputs: joi.alternatives().try([
        joi.lazy(() => joi.reach(internals.schemas, 'objConfig')),
        joi.lazy(() => joi.reach(internals.schemas, 'arrayConfig')),
    ]),
});

internals.registerServiceMethods = function registerServiceMethods(inputs) {

    const { schemas, register } = internals;

    joi.assert(inputs, joi.reach(schemas, 'inputs'));

    if (Array.isArray(inputs)) {
        inputs.forEach((config) => {
            config.services.forEach(register(config, this));
        });
    } else {
        inputs.services.forEach(register(inputs, this));
    }
};

internals.checkScope = (scope, rootState) => {
    if (rootState.serviceScopeMap.get(scope)) {
        throw new Error(`A service scope of ${scope} already exists`);
    }
    rootState.serviceScopeMap.set(scope, true);
};

internals.register = (args, hapi) => (service) => {

    const { scope, context } = args;

    const rootState = internals.rootState(hapi.realm);

    internals.checkScope(scope, rootState);

    const options = {
        bind: {
            ...context,
            server: hapi,
        },
    };

    let method;
    if (service.cache) {
        const name = `${scope}.${service.name}`;
        hapi.method(name, service.method, {
            ...options,
            cache: service.cache,
        });

        method = hapi.methods[scope][service.name];
    } else {
        method = service.method.bind(options.bind);
    }

    rootState.services[scope] = {
        ...rootState.services[scope],
        [service.name]: method,
    };
};
