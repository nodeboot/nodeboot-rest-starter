function MetaHelper() {

}

MetaHelper.findAnnotationByLocationAndFunctionName = function(dependencies, location, functionName) {
  for(dependency of dependencies){

  }
};
MetaHelper.findAnnotationOfFunction = function(dependency, functionName, annotationName) {
  // console.log(dependency);
  // console.log(dependency.functions);
  var annotations = dependency.functions[functionName];
  // console.log(annotations);
  for(annotation of annotations){
    // console.log(annotation);
    if(annotation.name == annotationName){
      return annotation;
    }
  }
};

module.exports = MetaHelper;
