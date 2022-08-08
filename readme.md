# nodeboot-rest-starter

![](./coverage/lines.svg) ![](./coverage/statements.svg) ![](./coverage/branches.svg) ![](./coverage/functions.svg)

A starter which configures a lot of stuffs(expresss, session, routes, di, databsae, oauth2, etc) for you. You just need to code the logic of your app.

## usage

Just add the following lines to have
```
const RestApplicationStarter = require("nodeboot-rest-starter").RestApplicationStarter;
const restApplicationStarter = new RestApplicationStarter();
restApplicationStarter.run({
  callerDirectoryLocation:__dirname,
  entrypointRelativeLocation:"src/main/foo/bar/index.js",
  callerDirectoryLocation:"src/main/foo/bar/application.json"
});
```

And an application.json like

```
{
  "nodeboot": {
    "database": {
      "client": "mysql",
      "connection": {
        "host": "192.168.111.222",
        "user": "root",
        "password": "secret",
        "database": "acme_db",
        "multipleStatements": true
      }
    },
    "iam_oauth2_elementary_starter":{
      "jwtSecret":"changeme",
      "jwtExpiration":"3600s"
    }
  }
}
```

Basically if the developer add **nodeboot-database-starter** to its package.json, **nodeboot-rest-starter** will detect it and auto configuration: database and oauth2 on the fly for you!! 

## declarative development vs auto-configuration

We know that code fron the scratch get us the maximum power of administration of the aplication. But what happen when there are pieces of code which are repetitive and sometimes cause errors or require googling + stackvoerflow research?

> Declarative

**some_route.js**
```
function Health(expressInstance){

  this.expressInstance = expressInstance;

  this.init = () => {
    this.expressInstance.get("/v1/health",this.findAll);
  }

  this.simpleHealth = async (req, res) => {
    return res.send({
      code:200000,
      message:"success"
    });
  }

}
module.exports = Health;
```

**index.js**
```
const path = require('path');
const app = express();
const port = process.env.PORT || 2708;
const Health = require('./routes/Health.js');
var health = new Health(app);
health.init();
app.listen(port, () => console.log(`server is listening on port ${port}`));
```

> autoconfiguration


**some_route.js**
```
@Route
function Health(){
  @Get(path = "/v1/health")

  this.simpleHealth = (req, res) => {
    return res.send({
      code:200000,
      message:"success"
    });
  }
}

module.exports = Health;
```

**index.js**

The next lines configure anything of classic rest api or microservice: any sql database, routes and simple oauth2 middleware

```
const restApplicationStarter = new RestApplicationStarter();
restApplicationStarter.run({
    callerDirectoryLocation: __dirname,
    entrypointRelativeLocation: "src/main/foo/bar/index.js",
    configRelativeLocation: "src/main/foo/bar/application.json"
});
```


## Road map

- [ ] add more databases like postgress, sqlserver, oracle
- [ ] unit test, coverage, badges
- [ ] split into: nodeboot-ssr-web-starter, nodeboot-iam-simple-starter
- [ ] publish to npm repository: https://www.npmjs.com/package/repository

## Inspiration

- [spring-data-rest](https://github.com/spring-projects/spring-data-rest)

## Contributors

<table>
  <tbody>
    <td style="text-align: center;" >
      <img src="https://avatars0.githubusercontent.com/u/3322836?s=460&v=4" width="100px;"/>
      <br />
      <label><a href="http://jrichardsz.github.io/">JRichardsz</a></label>
      <br />
    </td>    
  </tbody>
</table>

    "meta-js": "git+https://github.com/jrichardsz/meta-js.git#1.0.5-pre-alpha",
