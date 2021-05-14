var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var path = require('path');
const ConfigurationHelper = require('configuration/ConfigurationHelper.js');

const MetaJsContextHelper = require('meta-js').MetaJsContextHelper;
const NodeInternalModulesHook = require('meta-js').NodeInternalModulesHook;
NodeInternalModulesHook._compile();
const DependencyHelper = require('meta-js').DependencyHelper;

function RestApplicationStarter(){

  this.express = express();
  this.instancedDependecies = {};
  this.allowedHttpMethods = ["get","post","delete","put",];

  this.run = (srcLocation) => {
    var headAnnotations = ["Config","Route"];
    var internalAnnotations = ["Autowire","Get","Post","Put","Delete", "Configuration"];
    var dependencies = DependencyHelper.getDependecies(srcLocation, [".js"], ["src/main/Index.js"],headAnnotations, internalAnnotations);
    console.log(JSON.stringify(dependencies, null,4 ));

    //store instanced dependencies in nodeboot context
    global.NodebootContext = {
      instancedDependecies : this.instancedDependecies
    }

    this.performInstantation(dependencies);
    this.addSpecialDependencies(srcLocation);
    this.loadStarters(path.join(srcLocation, "..", "node_modules"));
    this.performInjection(dependencies, srcLocation);
    this.startServer();
    this.registerRoutesMethods(dependencies);
  }

  this.performInstantation = (dependencies) => {
    console.log("Perform instantation...");
    for(let dependency of dependencies){
      console.log("Detected dependency:"+dependency.meta.location);
      if(this.instancedDependecies[dependency.meta.arguments.name]){
        console.log("dependency is already instanced");
      }else{
        var functionRequire = require(dependency.meta.location);
        var functionInstance = new functionRequire();
        this.instancedDependecies[dependency.meta.arguments.name] = functionInstance;
      }
    }
  }

  this.performInjection = (dependencies, srcLocation) => {

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

  this.addSpecialDependencies = (srcLocation) => {
    //add custom modules to dependency context
    this.instancedDependecies["express"] = express || {};

    //add application.json
    var configurationHelper = new ConfigurationHelper();
    var configuration = configurationHelper.loadJsonFile(srcLocation+"/main/application.json",'utf8');
    this.instancedDependecies["configuration"] = configuration || {};
  }

  this.startServer = () => {
    this.express.use(bodyParser.urlencoded({extended: false}));
    this.express.use(cors());
    this.express.listen(process.env.PORT || 8080);
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
         var databaseCriteria = databaseStarter.autoConfigure(rootNodeModulesLocation);
         
         if(typeof databaseCriteria !== 'undefined'){
           this.instancedDependecies["databaseCriteria"] = databaseCriteria || {};
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
