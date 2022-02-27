function ObjectHelper() {

}

ObjectHelper.clone = function(obj) {
  let clone = {}; // the new empty object

  // let's copy all user properties into it
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
    clone[key] = obj[key];
   }
  }

  return clone;
};

module.exports = ObjectHelper;
