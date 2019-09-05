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

            internals.setServices(rootState);

            server.decorate('server', 'registerServiceMethods', internals.registerServiceMethods);

            server.decorate('server', 'services', internals.services((srv) => srv.realm));

            server.decorate('toolkit', 'services', internals.services((toolkit) => toolkit.realm));

            server.decorate('request', 'services', internals.services((request) => request.route.realm));

            rootState.setup = true;
        }
    },
};

internals.services = (getRealm) => function internal(all) {
    const realm = getRealm(this);

    return all ? internals.rootState(realm).services : internals.state(realm).services;
};

internals.setServices = (rootState) => {
    const desc = {
        value: {},
        writable: false,
        enumerable: true,
    };
    Object.defineProperty(rootState, 'services', desc);
};

internals.setInternalState = (state) => {
    const desc = {
        value: {},
        writable: false,
        enumerable: true,
    };
    Object.defineProperty(state, 'services', desc);
};

internals.rootState = (realm) => Toys.rootState(realm, pkg.name);

internals.state = (realm) => Toys.state(realm, pkg.name);

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

    const state = internals.state(this.realm);

    if (!state.setup) {
        internals.setInternalState(state);
    }

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
    if (rootState.services[scope]) {
        throw new Error(`A service scope of ${scope} already exists`);
    }
};

internals.register = (args, hapi) => (service) => {

    const { scope, context } = args;

    const rootState = internals.rootState(hapi.realm);

    const state = internals.state(hapi.realm);

    internals.checkScope(scope, rootState);

    const options = {
        bind: {
            ...context,
            server: hapi,
            options: hapi.realm.pluginOptions,
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

    state.services[scope] = {
        ...rootState.services[scope],
        [service.name]: method,
    };
};
