const uuid = require('uuid');
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var finder = require('find-package-json');
var path = require('path');
var fs = require('fs');
const fsPromises = fs.promises;
const ConfigurationHelper = require('../configuration/ConfigurationHelper.js');
const ObjectHelper = require('../common/ObjectHelper.js');

const MetaJsContextHelper = require('meta-js').MetaJsContextHelper;
const NodeInternalModulesHook = require('meta-js').NodeInternalModulesHook;
NodeInternalModulesHook._compile();
const DependencyHelper = require('meta-js').DependencyHelper;

function RestApplicationStarter() {

  this.express = express();
  this.instancedDependecies = {};
  this.allowedHttpMethods = ["get", "post", "delete", "put", ];

  this.run = async (callerDirectoryLocation) => {

    var f = finder(callerDirectoryLocation);
    var applicationRootLocation = path.dirname(f.next().filename);
    console.log("Scanning root location: " + applicationRootLocation);

    var dependencies;
    var environment = process.env.NODE_ENV
    if (environment !== 'production') {
      var headAnnotations = ["Config", "Route", "Middleware", "ServerInitializer", "Service"];
      var internalAnnotations = ["Autowire", "Get", "Post", "Put", "Delete", "Configuration"];
      dependencies = DependencyHelper.getDependecies(applicationRootLocation, [".js"], ["src/main/Index.js", ".test.js"], headAnnotations, internalAnnotations);
      console.log(JSON.stringify(dependencies, null, 4));
      await fsPromises.writeFile('meta.json', JSON.stringify(dependencies), 'utf8');
    } else {
      dependencies = await fsPromises.readFile('meta.json', 'utf8')
    }

    //store instanced dependencies in nodeboot context
    global.NodebootContext = {
      instancedDependecies: this.instancedDependecies
    }

    this.performInstantation(dependencies, applicationRootLocation);
    this.addSpecialDependencies(applicationRootLocation);
    await this.loadStarters(path.join(applicationRootLocation, "node_modules"));
    this.performInjection(dependencies);
    await this.registerEjsForSsrPages(applicationRootLocation);
    await this.startServer(dependencies);
    this.registerMiddlewares(dependencies);
    this.registerRoutesMethods(dependencies);
  }

  this.performInstantation = (dependencies, applicationRootLocation) => {
    console.log("[Perform instantation]...");
    for (let dependency of dependencies) {
      var instanceId = getInstanceId(dependency);
      if (this.instancedDependecies[instanceId]) {
        console.log("dependency is already instanced");
      } else {
        var absoluteModuleLocation = path.join(applicationRootLocation, dependency.meta.location);
        var functionRequire = require(absoluteModuleLocation);
        var functionInstance = new functionRequire();
        console.log("instantiating dependency: " + dependency.meta.location + " with id: " + instanceId);
        this.instancedDependecies[instanceId] = functionInstance;
      }
    }
  }

  this.performInjection = (dependencies, applicationRootLocation) => {

    console.log("[Perform autowire injection]...");
    for (let dependency of dependencies) {
      var instanceId = getInstanceId(dependency);
      var functionInstance = this.instancedDependecies[instanceId];
      console.log("Dependency:" + instanceId);

      if (Object.keys(dependency.variables).length > 0 && dependency.variables.constructor === Object) {
        Object.keys(dependency.variables).forEach((variableToInject, index) => {
          for (let annotation of dependency.variables[variableToInject]) {
            if (annotation.name === 'Autowire') {
              console.log(`inject: ${variableToInject} name: ${annotation.arguments.name} typeof: ${typeof this.instancedDependecies[annotation.arguments.name]}`);
              functionInstance[variableToInject] = this.instancedDependecies[annotation.arguments.name];
            }
          }
        });
      }
    }
  }

  this.configureSession = () => {
    var sessionConfig;
    try {
      sessionConfig = this.instancedDependecies["configuration"].nodeboot.session
    } catch (err) {
      console.log("nodeboot.session is not well configured");
      return;
    }
    console.log("Configuring session...");
    var clonedConfiguration = ObjectHelper.clone(sessionConfig);
    clonedConfiguration.secret = uuid.v4();
    const session = require('express-session');
    this.express.use(session(clonedConfiguration));
  }

  this.addSpecialDependencies = (applicationRootLocation) => {
    //add custom modules to dependency context
    this.instancedDependecies["express"] = express || {};

    //add application.json
    var configurationHelper = new ConfigurationHelper();
    var configuration = configurationHelper.loadJsonFile(path.join(applicationRootLocation, "src", "main", "application.json"), 'utf8');
    this.instancedDependecies["configuration"] = configuration || {};
    this.instancedDependecies["rootPath"] = applicationRootLocation;
  }

  this.startServer = async (dependencies) => {
    console.log("[Starting express server]...");
    var instanceId;
    for (let dependency of dependencies) {
      if (dependency.meta.name !== "ServerInitializer") continue;
      instanceId = getInstanceId(dependency);
      //just one ServerInitializer is allowed
      break;
    }
    if (typeof instanceId === 'undefined') {
      await startExpressServer();
      return;
    }
    //TODO https://blog.logrocket.com/improve-async-programming-with-javascript-promises/
    // research how to make onBeforeLoad (simple) async and promise
    console.log("Detected custom server initializer: " + instanceId);
    var serverInitializer = this.instancedDependecies[instanceId];
    if (typeof serverInitializer.onBeforeLoad !== 'undefined') {
      await serverInitializer.onBeforeLoad();
      if (typeof serverInitializer.onAfterLoad !== 'undefined') {
        await startExpressServer();
        await serverInitializer.onAfterLoad()
      } else {
        await startExpressServer();
      }
    }
  }

  startExpressServer = () => {

    return new Promise((resolve, reject) => {
      this.configureSession();
      this.express.use(bodyParser.urlencoded({
        extended: false
      }));
      this.express.use(cors());
      let port = process.env.PORT || 8080;
      if (typeof callback === 'undefined') {
        console.log("application is listening at port: " + port);
        this.express.listen(port);
        resolve();
      } else {
        this.express.listen(port, () => {
          console.log("application is listening at port: " + port);
          resolve();
        });
      }
    });
  }

  this.registerRoutesMethods = (dependencies) => {
    console.log("[Registering routes]...");
    for (let dependency of dependencies) {
      if (dependency.meta.name !== "Route") continue;

      var instanceId = dependency.meta.arguments.name;
      var globalRoutePath = dependency.meta.arguments.path;
      console.log(`candidate route: ${instanceId}`);
      //get annotated methods
      for (let functionName in dependency.functions) {
        var annotations = dependency.functions[functionName];
        for (let annotation of annotations) {
          if (typeof annotation.name !== 'undefined' && typeof annotation.arguments.path !== 'undefined') {
            var method = annotation.name.toLowerCase();
            if (this.allowedHttpMethods.includes(method) < 0) {
              console.log(`http method not allowed: ${method} in ${functionName}`);
              continue;
            }
            var routeString;
            if (typeof globalRoutePath !== 'undefined') {
              if (typeof annotation.arguments.path !== 'undefined') {
                routeString = `${globalRoutePath}${annotation.arguments.path}`;
              } else {
                routeString = `${globalRoutePath}`;
              }
            } else {
              if (typeof annotation.arguments.path !== 'undefined') {
                routeString = `${annotation.arguments.path}`;
              } else {
                console.log("route don't have path argument at module or method level. ");
                continue;
              }
            }

            this.express[method](routeString, this.instancedDependecies[instanceId][functionName]);
            console.log(`registered route: ${instanceId}.${functionName} endpoint:${routeString} method:${method}`);
          }
        }
      }
    }
  }

  this.registerMiddlewares = (dependencies) => {
    console.log("[Register middlewares]...");
    for (let dependency of dependencies) {
      if (dependency.meta.name !== "Middleware") continue;
      let instanceId = getInstanceId(dependency);
      if (typeof this.instancedDependecies[instanceId]['dispatch'] === 'undefined') {
        console.log(`Middleware ${instanceId} don't have a dispatch function. Register is skipped.`);
        continue;
      }
      this.express.use(this.instancedDependecies[instanceId]['dispatch']);
    }
  }

  this.loadStarters = async (rootNodeModulesLocation) => {
    console.log("[Searching starters]...");
    try {
      if (require.resolve(rootNodeModulesLocation + '/nodeboot-database-starter')) {
        console.log("nodeboot-database-starter was detected. Configuring...");
        const DatabaseStarter = require(rootNodeModulesLocation + "/nodeboot-database-starter");
        var databaseStarter = new DatabaseStarter();
        var dbSession = await databaseStarter.autoConfigure(rootNodeModulesLocation);

        if (typeof dbSession !== 'undefined') {
          console.log("dbSession is ready");
          this.instancedDependecies["dbSession"] = dbSession || {};
        }

      }
    } catch (err) {
      console.log(err);
      if (err.code != "MODULE_NOT_FOUND") {}
    }
  }

  //TODO: move to nodeboot-ssr-web-starter
  this.registerEjsForSsrPages = async (rootNodeModulesLocation) => {
    console.log("[Registering ejs for ssr webs]...");
    try {
      var esjPagesLocation = path.join(rootNodeModulesLocation, 'src', 'main', 'pages');
      const stats = await fs.promises.stat(esjPagesLocation);
      if (typeof stats !== 'undefined') {
        this.express.set('view engine', 'ejs');
        this.express.set('views', esjPagesLocation);
        this.express.engine('html', require('ejs').renderFile);
      } else {
        console.log("src/main/pages don't exist");
      }
    } catch (err) {
      console.log("Failed to register ssr web starter");
      console.log(err);
    }
  }

  getInstanceId = (dependency) => {
    if (typeof dependency.meta.arguments.name !== 'undefined') {
      return dependency.meta.arguments.name;
    } else {
      let fileNameWithoutExt = path.basename(dependency.meta.location).replace(".js", "").trim();
      return fileNameWithoutExt.charAt(0).toLowerCase() + fileNameWithoutExt.slice(1);
    }
  }
}

module.exports = RestApplicationStarter;
