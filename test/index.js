'use strict';

const Toys = require('toys');
const hapi = require('@hapi/hapi');
const lab = require('@hapi/lab');
const chaiAsPromised = require('chai-as-promised');

const { script, assertions } = lab;
const { describe, it } = exports.lab = script();
assertions.use(chaiAsPromised);
assertions.should();

const plugin = require('..');

describe('Plugin', () => {

    it('decorates server interface with registerServiceMethods() util', async () => {
        const server = hapi.Server();
        (server.registerServiceMethods === undefined).should.equal(true);

        await server.register(plugin);
        server.registerServiceMethods.should.be.a('function');
    });

    it('decorates server interface with services() util', async () => {
        const server = hapi.Server();
        (server.services === undefined).should.equal(true);

        await server.register(plugin);
        server.services.should.be.a('function');
    });

    it('decorates request interface with services() util', async () => {
        const server = hapi.Server();
        await server.register(plugin);
        server.route({
            method: 'GET',
            path: '/test',
            handler(request) {
                return request.services.should.be.a('function');
            },
        });
        const request = {
            method: 'GET',
            url: '/test',
        };

        await server.inject(request);
    });

    it('decorates toolkit interface with services() util', async () => {
        const server = hapi.Server();
        await server.register(plugin);
        server.route({
            method: 'GET',
            path: '/test',
            handler(request, h) {
                return h.services.should.be.a('function');
            },
        });
        const request = {
            method: 'GET',
            url: '/test',
        };

        await server.inject(request);
    });

    it('adds serviceScopeMap to server.realm once registered and can not be reassigned', async () => {
        const server = hapi.Server();
        (server.app.serviceScopeMap === undefined).should.equal(true);
        await server.register(plugin);
        const rootRealm = Toys.rootRealm(server.realm);
        rootRealm.plugins[plugin.pkg.name].serviceScopeMap.should.exist;

        const subject = async () => {
            rootRealm.plugins[plugin.pkg.name].serviceScopeMap = false;
        };
        subject().should.be.rejectedWith(Error, 'Cannot assign to read only property \'serviceScopeMap\'');
    });

    it('allows you to register plugin multiple times', async () => {
        const pluginOne = {
            pkg: { name: 'pluginOne' },
            async register(server) {
                const service = {
                    scope: 'blue',
                    services: [
                        {
                            name: 'one',
                            method: () => true,
                        },
                    ],
                };
                await server.register(plugin);

                server.registerServiceMethods(service);
            },
        };
        const pluginTwo = {
            pkg: { name: 'pluginTwo' },
            async register(server) {
                const service = {
                    scope: 'red',
                    services: [
                        {
                            name: 'one',
                            method: () => true,
                        },
                    ],
                };
                await server.register(plugin);

                server.registerServiceMethods(service);
            },
        };
        const subject = async () => {
            const server = hapi.Server();

            await server.register({
                plugin: pluginOne,
                options: { key: 'value' },
            });
            await server.register({
                plugin: pluginTwo,
                options: { key2: 'value2' },
            });
            const services = server.services();

            services.blue.one.should.exist;
            services.red.one.should.exist;
        };

        await subject().should.be.fulfilled;
    });

    describe('.registerServiceMethods()', () => {
        it('accepts a single object argument and registers methods to server under correct scope', async () => {
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        method: () => 'hello',
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            const services = server.services();

            services.sqs.init.should.be.a('function');
        });

        it('accepts a single array of objects and registers methods to server under correct scope', async () => {
            const server = hapi.Server();
            const services = [
                {
                    scope: 'sqs',
                    services: [
                        {
                            name: 'init',
                            method: () => 'hello',
                        },
                    ],
                },
                {
                    scope: 'rabbitMq',
                    services: [
                        {
                            name: 'init',
                            method: () => 'hello',
                        },
                    ],
                },
            ];
            await server.register(plugin);

            server.registerServiceMethods(services);

            const { sqs, rabbitMq } = server.services();

            sqs.init.should.be.a('function');
            rabbitMq.init.should.be.a('function');
        });

        it('by default binds hapi server to "this" context', async () => {
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        method() {
                            this.server.should.be.an('object');
                        },
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            const { sqs } = server.services();

            sqs.init();
        });

        it('by default binds the options of the registering plugin to the "this" context', async () => {
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        method() {
                            this.options.should.be.an('object');
                        },
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            const { sqs } = server.services();

            sqs.init();
        });

        it('accepts an optional context property which will be used to bind to "this" context in server methods', async () => {
            class SQS {}

            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                context: {
                    client: new SQS(),
                },
                services: [
                    {
                        name: 'init',
                        method() {
                            this.client.should.be.an('object');
                            this.client.should.be.an.instanceOf(SQS);
                        },
                    },
                ],
            };
            await server.register(plugin);

            server.registerServiceMethods(service);

            const { sqs } = server.services();

            sqs.init();
        });

        it('accepts an optional cache config object', async () => {
            const calls = [];
            const server = hapi.Server();
            const service = {
                scope: 'sqs',
                services: [
                    {
                        name: 'init',
                        async method(input) {
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
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
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
                        method: () => 'hello',
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

    it('throws when service name is not provided', async () => {
        const server = hapi.Server();
        const services = [
            {
                scope: 'scope',
                services: [
                    {
                        method: () => 'hello',
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
        }).should.throw(Error, '"method" is required');
    });

    it('throws when trying to register services that have the same scope when using array argument', async () => {
        const server = hapi.Server();
        const services = [
            {
                scope: 'thing',
                services: [
                    {
                        name: 'one',
                        method: () => true,
                    },
                ],
            },
            {
                scope: 'thing',
                services: [
                    {
                        name: 'two',
                        method: () => true,
                    },
                ],
            },
        ];
        await server.register(plugin);

        (() => {
            server.registerServiceMethods(services);
        }).should.throw(Error, 'A service scope of thing already exists');
    });

    it('throws when trying to register serices that have the same scope when using object argument', async () => {
        const server = hapi.Server();
        const service1 = {
            scope: 'thing',
            services: [
                {
                    name: 'one',
                    method: () => true,
                },
            ],
        };
        const service2 = {
            scope: 'thing',
            services: [
                {
                    name: 'two',
                    method: () => true,
                },
            ],
        };
        await server.register(plugin);

        server.registerServiceMethods(service1);

        (() => {
            server.registerServiceMethods(service2);
        }).should.throw(Error, 'A service scope of thing already exists');
    });

    it('throws when separate plugins attempt to register services that have the same scope', async () => {
        const mainServer = hapi.Server();
        const pluginOne = {
            pkg: {
                name: 'pluginOne',
            },
            register(server) {
                const service = {
                    scope: 'blue',
                    services: [
                        {
                            name: 'one',
                            method: () => true,
                        },
                    ],
                };
                server.registerServiceMethods(service);
            },
        };
        const pluginTwo = {
            pkg: {
                name: 'pluginTwo',
            },
            register(server) {
                const service = {
                    scope: 'blue',
                    services: [
                        {
                            name: 'two',
                            method: () => true,
                        },
                    ],
                };
                server.registerServiceMethods(service);
            },
        };

        const subject = async () => {
            await mainServer.register(plugin);
            await mainServer.register(pluginOne);
            await mainServer.register(pluginTwo);
        };

        return subject().should.be.rejectedWith(Error, 'A service scope of blue already exists');
    });
});
