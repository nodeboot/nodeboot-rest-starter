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
const MetaHelper = require('../common/MetaHelper.js');

const MetaJsContextHelper = require('meta-js').MetaJsContextHelper;
const NodeInternalModulesHook = require('meta-js').NodeInternalModulesHook;
NodeInternalModulesHook._compile();
const DependencyHelper = require('meta-js').DependencyHelper;

function RestApplicationStarter() {

  this.express = express();
  this.instancedDependecies = {};
  this.instancedStarters = {};
  this.allowedHttpMethods = ["get", "post", "delete", "put", ];

  this.run = async (callerDirectoryLocation) => {

    var f = finder(callerDirectoryLocation);
    var applicationRootLocation = path.dirname(f.next().filename);
    console.log("Scanning root location: " + applicationRootLocation);

    var dependencies;
    var environment = process.env.NODE_ENV
    if (environment !== 'production') {
      var headAnnotations = ["Config", "Route", "Middleware", "ServerInitializer", "Service"];
      var internalAnnotations = ["Autowire", "Get", "Post", "Put", "Delete", "Configuration", "Protected"];
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
    this.addSpecialInstantations(applicationRootLocation);
    initDefaultsExpressServer();
    //load starter before injection because some starters creates special dependencies
    await this.loadStarters(path.join(applicationRootLocation, "node_modules"));
    this.performInjection(dependencies);
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

  this.addSpecialInstantations = async (applicationRootLocation) => {
    //add custom modules to dependency context
    this.instancedDependecies["express"] = express || {};

    //add application.json
    var configurationHelper = new ConfigurationHelper();

    try {
      await fsPromises.access(path.join(applicationRootLocation, "src", "main", "application.json"));
      var configuration = configurationHelper.loadJsonFile(path.join(applicationRootLocation, "src", "main", "application.json"), 'utf8');
      this.instancedDependecies["configuration"] = configuration || {};
    } catch (e) {
      if (e.code != "ENOENT") {
        console.log("application.json read failed");
        console.log(e);
      }
    }

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
  initDefaultsExpressServer = () => {
    if (ObjectHelper.hasProperty(this.instancedDependecies["configuration"], "nodeboot.session")) {
      this.configureSession();
    }
    this.express.use(bodyParser.urlencoded({
      extended: false
    }));
    this.express.use(bodyParser.json());
    this.express.use(cors());
  }

  this.registerRoutesMethods = (dependencies) => {
    console.log("[Registering routes]...");
    for (let dependency of dependencies) {
      if (dependency.meta.name !== "Route") continue;

      var instanceId = getInstanceId(dependency);
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

            var iamOauth2ElementaryStarter = this.instancedStarters["nodeboot-iam-oauth2-elementary-starter"];
            if(typeof iamOauth2ElementaryStarter!== 'undefined'){
              console.log("nodeboot-iam-oauth2-elementary-starter is ready to be use as middleware");
              var protectedAnnotation = MetaHelper.findAnnotationOfFunction(dependency, functionName, "Protected");
              if(typeof protectedAnnotation !== 'undefined'){
                var permission = protectedAnnotation.arguments.permission
                if(typeof permission !== 'undefined'){
                  var securityMiddleware = iamOauth2ElementaryStarter.getSecurityMiddleware(permission)
                  this.express[method](routeString, securityMiddleware.ensureAuthorization, this.instancedDependecies[instanceId][functionName]);
                  console.log(`registered route: ${instanceId}.${functionName} endpoint:${routeString} method:${method} protected:${permission}`);
                }
              }
            }else{
              this.express[method](routeString, this.instancedDependecies[instanceId][functionName]);
              console.log(`registered route: ${instanceId}.${functionName} endpoint:${routeString} method:${method}`);
            }
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
      await fsPromises.access(path.join(rootNodeModulesLocation, "nodeboot-database-starter"));
      console.log("nodeboot-database-starter was detected. Configuring...");
      const DatabaseStarter = require(rootNodeModulesLocation + "/nodeboot-database-starter");
      var databaseStarter = new DatabaseStarter();
      var dbSession = await databaseStarter.autoConfigure(rootNodeModulesLocation);

      if (typeof dbSession !== 'undefined') {
        console.log("dbSession is ready");
        this.instancedDependecies["dbSession"] = dbSession || {};
      }

      this.instancedStarters["nodeboot-database-starter"] = databaseStarter;
    } catch (e) {
      if (e.code != "ENOENT") {
        console.log("nodeboot-database-starter failed");
        console.log(e);
      }
    }


    try {
      await fsPromises.access(path.join(rootNodeModulesLocation, "nodeboot-web-ssr-starter"));
      console.log("nodeboot-web-ssr-starter was detected. Configuring...");
      const WebSsrStarter = require(rootNodeModulesLocation + "/nodeboot-web-ssr-starter");
      var webSsrStarter = new WebSsrStarter();
      await webSsrStarter.autoConfigure(this.express);
      this.instancedStarters["nodeboot-web-ssr-starter"] = webSsrStarter;
    } catch (e) {
      if (e.code != "ENOENT") {
        console.log("nodeboot-web-ssr-starter failed");
        console.log(e);
      }
    }

    try {
      await fsPromises.access(path.join(rootNodeModulesLocation, "nodeboot-iam-oauth2-elementary-starter"));
      console.log("nodeboot-iam-oauth2-elementary-starter was detected. Configuring...");

      if (typeof this.instancedDependecies["dbSession"] === 'undefined') {
        console.log("nodeboot-iam-oauth2-elementary-starter needs a database connection. Add this starter to do that: nodeboot-database-starter");
        return;
      }

      const IamOauth2ElementaryStarter = require(rootNodeModulesLocation + "/nodeboot-iam-oauth2-elementary-starter").IamOauth2ElementaryStarter;
      const SubjectDataService = require(rootNodeModulesLocation + "/nodeboot-iam-oauth2-elementary-starter").SubjectDataService;
      const IamDataService = require(rootNodeModulesLocation + "/nodeboot-iam-oauth2-elementary-starter").IamDataService;
      const DatabaseHelperDataService = require(rootNodeModulesLocation + "/nodeboot-iam-oauth2-elementary-starter").DatabaseHelperDataService;

      var subjectDataService = new SubjectDataService(this.instancedDependecies["dbSession"]);
      var iamDataService = new IamDataService(this.instancedDependecies["dbSession"]);
      var databaseHelperDataService = new DatabaseHelperDataService(this.instancedDependecies["dbSession"]);

      var iamOauth2ElementaryStarter = new IamOauth2ElementaryStarter(this.instancedDependecies["configuration"],
        subjectDataService, iamDataService, databaseHelperDataService, this.express);
      await iamOauth2ElementaryStarter.autoConfigure();
      this.instancedStarters["nodeboot-iam-oauth2-elementary-starter"] = iamOauth2ElementaryStarter;
    } catch (e) {
      if (e.code != "ENOENT") {
        console.log("nodeboot-iam-oauth2-elementary-starter failed");
        console.log(e);
      }
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
