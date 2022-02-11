var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var finder = require('find-package-json');
var path = require('path');
var fs = require('fs');
const fsPromises = fs.promises;
const ConfigurationHelper = require('../configuration/ConfigurationHelper.js');

const MetaJsContextHelper = require('meta-js').MetaJsContextHelper;
const NodeInternalModulesHook = require('meta-js').NodeInternalModulesHook;
NodeInternalModulesHook._compile();
const DependencyHelper = require('meta-js').DependencyHelper;

function RestApplicationStarter(){

  this.express = express();
  this.instancedDependecies = {};
  this.allowedHttpMethods = ["get","post","delete","put",];

  this.run = async (callerDirectoryLocation) => {

    var f = finder(callerDirectoryLocation);
    var applicationRootLocation = path.dirname(f.next().filename);
    console.log("Scanning root location: "+applicationRootLocation);

    var dependencies;
    var environment = process.env.NODE_ENV
    if(environment !== 'production'){
      var headAnnotations = ["Config","Route"];
      var internalAnnotations = ["Autowire","Get","Post","Put","Delete", "Configuration"];
      dependencies = DependencyHelper.getDependecies(applicationRootLocation, [".js"], ["src/main/Index.js", ".test.js"],headAnnotations, internalAnnotations);
      console.log(JSON.stringify(dependencies, null,4 ));
      await fsPromises.writeFile('meta.json', JSON.stringify(dependencies), 'utf8');
    }else{
      dependencies = await fsPromises.readFile('meta.json', 'utf8')
    }

    //store instanced dependencies in nodeboot context
    global.NodebootContext = {
      instancedDependecies : this.instancedDependecies
    }

    this.performInstantation(dependencies, applicationRootLocation);
    this.addSpecialDependencies(applicationRootLocation);
    this.loadStarters(path.join(applicationRootLocation,"node_modules"));
    this.performInjection(dependencies);
    this.startServer();
    this.registerRoutesMethods(dependencies);
  }

  this.performInstantation = (dependencies, applicationRootLocation) => {
    console.log("Perform instantation...");
    for(let dependency of dependencies){
      console.log("Detected dependency:"+dependency.meta.location);
      if(this.instancedDependecies[dependency.meta.arguments.name]){
        console.log("dependency is already instanced");
      }else{
        var absoluteModuleLocation = path.join(applicationRootLocation, dependency.meta.location);
        var functionRequire = require(absoluteModuleLocation);
        var functionInstance = new functionRequire();
        this.instancedDependecies[dependency.meta.arguments.name] = functionInstance;
      }
    }
  }

  this.performInjection = (dependencies, applicationRootLocation) => {

    console.log("Perform autowire injection...");
    for(let dependency of dependencies){
      var functionInstance = this.instancedDependecies[dependency.meta.arguments.name];
      console.log("Dependency:"+dependency.meta.arguments.name);

      if(Object.keys(dependency.variables).length > 0 && dependency.variables.constructor === Object){
        Object.keys(dependency.variables).forEach((variableToInject,index)=> {
          for(let annotation of dependency.variables[variableToInject]){
            if(annotation.name === 'Autowire'){
              console.log(`inject: ${variableToInject} with name ${annotation.arguments.name} which is ${typeof this.instancedDependecies[annotation.arguments.name]}`);
              functionInstance[variableToInject] = this.instancedDependecies[annotation.arguments.name];
            }
          }
        });
      }
    }
  }

  this.addSpecialDependencies = (applicationRootLocation) => {
    //add custom modules to dependency context
    this.instancedDependecies["express"] = express || {};

    //add application.json
    var configurationHelper = new ConfigurationHelper();
    var configuration = configurationHelper.loadJsonFile(path.join(applicationRootLocation,"src","main","application.json"),'utf8');
    this.instancedDependecies["configuration"] = configuration || {};
  }

  this.startServer = () => {
    this.express.use(bodyParser.urlencoded({extended: false}));
    this.express.use(cors());
    let port = process.env.PORT || 8080;
    console.log("application is listening at port: "+port);
    this.express.listen(port);
  }

  this.registerRoutesMethods = (dependencies) => {
    console.log("Register routes ...");
    for(let dependency of dependencies){
      if(dependency.meta.name !== "Route") continue;

      var instanceId = dependency.meta.arguments.name;
      var globalRoutePath = dependency.meta.arguments.path;
      console.log(`analizing ${instanceId} as ${globalRoutePath}`);
      //get annotated methods
      for(let functionName in dependency.functions){
        var annotations = dependency.functions[functionName];
        for(let annotation of annotations){
          if(typeof annotation.name !== 'undefined' && typeof annotation.arguments.path !== 'undefined'){
            var method = annotation.name.toLowerCase();
            if(this.allowedHttpMethods.includes(method)<0){
              console.log(`http method not allowed: ${method} in ${functionName}`);
              continue;
            }
            this.express[method](`${globalRoutePath}${annotation.arguments.path}`,this.instancedDependecies[instanceId][functionName]);
            console.log(`registered ${instanceId}.${functionName} as ${globalRoutePath}${annotation.arguments.path} method ${method}`);
          }
        }
      }
    }
  }

  this.loadStarters = (rootNodeModulesLocation) => {
    console.log("Searching starters ...");
    try{
      if (require.resolve(rootNodeModulesLocation+'/nodeboot-database-starter')) {
         console.log("nodeboot-database-starter was detected. Configuring...");
         const DatabaseStarter = require(rootNodeModulesLocation+"/nodeboot-database-starter");
         var databaseStarter = new DatabaseStarter();
         var dbSession = databaseStarter.autoConfigure(rootNodeModulesLocation);

         if(typeof dbSession !== 'undefined'){
           this.instancedDependecies["dbSession"] = dbSession || {};
         }

      }
    }catch(err){
      console.log(err);
      if(err.code!="MODULE_NOT_FOUND"){
      }
    }
  }
}

module.exports = RestApplicationStarter;
