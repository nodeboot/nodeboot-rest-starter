function MetaHelper() {

}

MetaHelper.findAnnotationByLocationAndFunctionName = function(dependencies, location, functionName) {
  for(dependency of dependencies){

  }
};
MetaHelper.findAnnotationOfFunction = function(dependency, functionName, annotationName) {
  var annotations = dependency.functions[functionName];
  for(annotation of annotations){
    if(annotation.name == annotationName){
      return annotation;
    }
  }
};

module.exports = MetaHelper;
