# API Reference

## Registration

## Decorations

### Server
**`server.registerServiceMethods(config)`**

Registers services to your hapi server.

- `config`: An object or array of objects with the following:
  - `scope`: A string representing the namespace that services will be scoped to. This needs to be unique across all registered services. Will throw if there is a scope collision.
  - `context`: An object that will be bound to the `this` context of all provided services in this config.
  - `services`: An array of objects with the following:
    - `name`: A string representing service name
    - `method`: A function representing the service implementation.
    - `cache`: An object `{ expiresIn, generateTimeout }` as detailed in the [server method options](https://github.com/hapijs/hapi/blob/master/API.md#server.method()) documentation.

**Note:** When providing a cache config, behind the scenes there will be a server.method that will be created and will replace the respective service.
which means that any service method configured for caching must be called asynchronously even if its original implementation is synchronous.

Example:
```js
  const hapi = require('@hapi/hapi');
  const hapiServiceMethods = require('hapi-service-methods');
  
  const create = async () => {
    const server = hapi.Server();
    
    const service = {
      scope: 'vendors',
      context: { models: this.server.models },
      services: [
        {
          name: 'create',
          method(payload) {
            const { Vendors } = this.models();
            
            return Vendors.query().create(payload);
          }
        },
        {
          name: 'fetchVendor',
          method(id) {
            const { Vendors } = this.models();
            
            return Vendors.query().select('*').where('id', id);
          },
          cache: {
            expiresIn: 3400000,
            generateTimeout: 2000
          }
        },
      ],
    };
    
    server.registerServiceMethods(service);
  }
```

 
**`server.services(all)`**

Returns services namespaced under their respective scopes. The service scopes that are available on this objects are only those
registered by server or any plugins for which server is an ancestor (e.g. if server has registered a plugin that registers services).

- `all`: A boolean, when truthy it will return every service registered with the hapi server– across all plugins.
