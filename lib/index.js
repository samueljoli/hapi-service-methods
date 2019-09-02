'use strict';

const joi = require('@hapi/joi');
const pkg = require('../package.json');

const internals = {};

module.exports = {
    pkg,
    register(server) {

        const serviceScopeMap = new Map();

        server.decorate('server', 'registerServiceMethods', internals.registerServiceMethods(server, serviceScopeMap));
    },
};

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

internals.register = (server, args, serviceScopeMap) => (service) => {

    const { scope, context } = args;

    if (serviceScopeMap.get(scope)) {
        throw new Error(`A service scope of ${scope} already exists`);
    }
    serviceScopeMap.set(scope, true);

    const name = `${scope}.${service.name}`;
    const options = {
        bind: {
            ...context,
            server,
        },
    };

    if (service.cache) {
        options.cache = service.cache;
    }

    server.method(name, service.method, options);
};

internals.registerServiceMethods = (server, serviceScopeMap) => (inputs) => {

    const { register, schemas } = internals;

    joi.assert(inputs, joi.reach(schemas, 'inputs'));

    if (Array.isArray(inputs)) {
        inputs.forEach((config) => {
            config.services.forEach(register(server, config, serviceScopeMap));
        });
    } else {
        inputs.services.forEach(register(server, inputs, serviceScopeMap));
    }
};
