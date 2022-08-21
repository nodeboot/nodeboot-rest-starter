"use strict";
var fs = require('fs').promises;

function ConfigurationHelper() {

  function parseObjectProperties(obj) {
      var regex = new RegExp("\\$\\{([^}\\s]*)\\}");
      for (var k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          parseObjectProperties(obj[k])
        } else if (obj.hasOwnProperty(k)) {
          var configInitialValue = "" + obj[k];
          if (regex.test(configInitialValue)) {
            var prevetLoop = 0;
            while (regex.test(configInitialValue)) {

              if(prevetLoop>10){
                console.log("Max iterations rached while this key was being extracted: "+configInitialValue);
                throw new Error("Max iterations rached while this key was being extracted: "+configInitialValue);
              }

              var startIndex = configInitialValue.indexOf("${") + 2;
              var endIndex = configInitialValue.indexOf("}");
              var environmentKey = configInitialValue.substring(startIndex , endIndex - startIndex + 2 );
              var environmentValue = process.env[environmentKey];
              if(typeof environmentValue!=='undefined'){
                configInitialValue = configInitialValue.replace("${" + environmentKey + "}" , environmentValue);
              }

              prevetLoop++;
            };
            if (configInitialValue != ("" + obj[k]) && configInitialValue!="") {
              if(configInitialValue == "true" || configInitialValue == "false"){
                var isTrueSet = (configInitialValue === "true");
                obj[k] = isTrueSet;
              }
              else{
                obj[k] = configInitialValue;
              }
            }else{
              obj[k] = null;
            }
          }
        }
      }
    }

  this.loadJsonFile = async function(jsonFileLocation, charset) {
    var rawApplicationJson = await fs.readFile(jsonFileLocation, charset);
    var jsonObject = JSON.parse(rawApplicationJson);
    parseObjectProperties(jsonObject);
    return jsonObject;
  }

}

module.exports = ConfigurationHelper;