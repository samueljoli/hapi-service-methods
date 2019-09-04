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
            server.decorate('server', 'registerServiceMethods', internals.registerServiceMethods);

            rootState.setup = true;

            Object.defineProperty(rootState, 'serviceScopeMap', { value: new Map(), writable: false });
        }
    },
};

internals.rootState = (realm) => Toys.rootState(realm, 'hapi-service-methods');

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

internals.checkScope = (scope, hapi) => {
    const rootState = internals.rootState(hapi.realm);

    if (rootState.serviceScopeMap.get(scope)) {
        throw new Error(`A service scope of ${scope} already exists`);
    }
    rootState.serviceScopeMap.set(scope, true);
};

internals.register = (args, hapi) => (service) => {
    const { scope, context } = args;

    internals.checkScope(scope, hapi);

    const name = `${scope}.${service.name}`;
    const options = {
        bind: {
            ...context,
            server: hapi,
        },
    };

    if (service.cache) {
        options.cache = service.cache;
    }

    hapi.method(name, service.method, options);
};
