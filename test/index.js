'use strict';

const Promise = require('bluebird');
const hapi = require('@hapi/hapi');
const lab = require('@hapi/lab');

const { script, assertions } = lab;
const { describe, it } = exports.lab = script();
assertions.should();

const plugin = require('..');

describe('Plugin', () => {

    it('decorates server interface with registerServiceMethods util', async () => {
        const server = hapi.Server();
        (server.registerServiceMethods === undefined).should.equal(true);

        await server.register(plugin);
        server.registerServiceMethods.should.be.a('function');
    });

    describe('.registerServiceMethods()', () => {
        it('accepts a single object argument and register methods to server under correct scope', async () => {
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        service: () => 'hello',
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            server.methods.sqs.init.should.be.a('function');
        });

        it('accepts a single array of objects and registers methods to server under correct scope', async () => {
            const server = hapi.Server();
            const services = [
                {
                    scope: 'sqs',
                    services: [
                        {
                            name: 'init',
                            service: () => 'hello',
                        },
                    ],
                },
                {
                    scope: 'rabbitMq',
                    services: [
                        {
                            name: 'init',
                            service: () => 'hello',
                        },
                    ],
                },
            ];
            await server.register(plugin);

            server.registerServiceMethods(services);

            server.methods.sqs.init.should.be.a('function');
            server.methods.rabbitMq.init.should.be.a('function');
        });

        it('by default binds hapi server to "this" context', async () => {
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        service() {
                            this.server.should.be.an('object');
                        },
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            server.methods.sqs.init();
        });

        it('accepts an optional context property which will be used to bind to "this" context in server methods', async () => {
            class SQS {}

            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        service() {
                            this.client.should.be.an('object');
                            this.client.should.be.an.instanceOf(SQS);
                        },
                    },
                ],
                context: {
                    client: new SQS(),
                },
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            server.methods.sqs.init();
        });

        it('accepts an optional cache config object', async () => {
            const calls = [];
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        async service(input) {
                            calls.push(input);
                            return input;
                        },
                        cache: {
                            expiresIn: 100,
                            generateTimeout: 2,
                        },
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            await server.initialize();

            // call method twice and assert that it's called once
            await server.methods.sqs.init(true);
            await server.methods.sqs.init(true);

            calls.length.should.equal(1);

            // allow cache to expire and call once more
            await Promise.delay(100);
            await server.methods.sqs.init(true);

            calls.length.should.equal(2);
        });
    });

    it('throws when scope is not provided', async () => {
        const server = hapi.Server();
        const services = [
            {
                services: [
                    {
                        name: 'init',
                        service: () => 'hello',
                    },
                ],
            },
        ];
        await server.register(plugin);

        (() => {
            server.registerServiceMethods(services);
        }).should.throw(Error, '"scope" is required');
    });

    it('throws when services is not provided', async () => {
        const server = hapi.Server();
        const services = [
            {
                scope: 'scope',
            },
        ];
        await server.register(plugin);

        (() => {
            server.registerServiceMethods(services);
        }).should.throw(Error, '"services" is required');
    });

    it('throws when service name  is not provided', async () => {
        const server = hapi.Server();
        const services = [
            {
                scope: 'scope',
                services: [
                    {
                        service: () => 'hello',
                    },
                ],
            },
        ];
        await server.register(plugin);

        (() => {
            server.registerServiceMethods(services);
        }).should.throw(Error, '"name" is required');
    });

    it('throws when service method is not provided', async () => {
        const server = hapi.Server();
        const services = [
            {
                scope: 'scope',
                services: [
                    {
                        name: 'init',
                    },
                ],
            },
        ];
        await server.register(plugin);

        (() => {
            server.registerServiceMethods(services);
        }).should.throw(Error, '"service" is required');
    });
});
