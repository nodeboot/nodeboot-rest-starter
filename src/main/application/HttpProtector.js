const schedule = require('node-schedule');

function HttpProtector() {

  const defaultMaxTimeBetweenRequestMillis = 5*1000; //10 seconds
  const defaultBlockDurationMillis = 360*1000; //5min
  const defaultSuspiciousAccessCount = 30;
  const addresses = {};
  const suspiciousAddresses = [];
  
  this.middleware = (req, res, next) => {
    var address;
    try {
      address =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress ||
      req.socket.remoteAddress || req.connection.socket.remoteAddress;
    } catch (error) { }

    if (!address) {
      console.log("remote client ip address cannot be identified. WTF?")
      return next();
    }
    
    if(addresses[address] && (addresses[address].suspicuousAccessCount>defaultSuspiciousAccessCount)){
      addresses[address].lastAccess = new Date().getTime();
      if(!suspiciousAddresses.includes(address)){
        suspiciousAddresses.push(address);
      }
      return res.status(429).send("Too many requests have been made. Try again in a couple of minutes")
    }

    this.startSuspiciousAnalysis(address);

    res.on( 'finish', () => {
        var codeStr = String( res.statusCode );
        //console.log("codeStr: "+codeStr);
    } );

    return next();
  }

  this.startSuspiciousAnalysis = async (address) => {
    return new Promise(async (resolve, reject) => {

      if(!addresses[address]){
        addresses[address] = {lastAccess : new Date().getTime(), suspicuousAccessCount:0}
        return resolve();
      }

      var addressInfo = addresses[address];
      let lastAccess = addressInfo.lastAccess;
      let thisAccess = new Date().getTime();

      if((thisAccess-lastAccess)<defaultMaxTimeBetweenRequestMillis){
        addressInfo.suspicuousAccessCount = addressInfo.suspicuousAccessCount+1;
        return resolve();
      }

      addressInfo.lastAccess = thisAccess;
      //at this point, ip is accessing in a safe rate
      return resolve();
    })
  };


  //5 * * * * *
  schedule.scheduleJob('*/5 * * * *', ()=>{
    this.clearSuspiciousAccess();
  });

  this.clearSuspiciousAccess = () => {
    for(let suspiciousAddress of suspiciousAddresses){
      if(addresses[suspiciousAddress] && addresses[suspiciousAddress].lastAccess && 
        ((new Date().getTime()-addresses[suspiciousAddress].lastAccess)>defaultBlockDurationMillis)){
        console.log("Free: "+suspiciousAddress)
        delete addresses[suspiciousAddress];
        var index = suspiciousAddresses.indexOf(suspiciousAddress);
        if (index !== -1) {
          delete suspiciousAddresses[index];
        }        
        
      }
    }
  }


}

module.exports = HttpProtector;