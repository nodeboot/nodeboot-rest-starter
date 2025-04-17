const schedule = require('node-schedule');

function SelfMaintenance(instancedDependecies) {

  this.start = () => {
    //5 * * * * * - 5 minutes
    //*/10 * * * * * - 10 secs
    schedule.scheduleJob('5 * * * * *', () => {
      const oauth2SpecService = instancedDependecies["oauth2SpecService"];
      try{
        oauth2SpecService.clearSuspiciousAddreses();
      }catch(err){
        console.log(err)
      }
    });
  }



}

module.exports = SelfMaintenance;