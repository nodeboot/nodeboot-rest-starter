# nodeboot-rest-starter

![](./coverage/lines.svg) ![](./coverage/statements.svg) ![](./coverage/branches.svg) ![](./coverage/functions.svg)

A starter which configures a lot of stuffs(expresss, session, routes, di, etc) for us and give a rest starter ready to use on any development.

## usage

Just add the following lines to have
```
const RestApplicationStarter = require("nodeboot-rest-starter").RestApplicationStarter;
const restApplicationStarter = new RestApplicationStarter();
restApplicationStarter.run(__dirname);
```

An application.json like

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

And the starters:

```
"dependencies": {
  "...",
  "nodeboot-database-starter": "file:../nodeboot-database-starter",
  "nodeboot-iam-oauth2-elementary-starter": "file:../../../../../../home/jrichardsz/Github/nodeboot-iam-oauth2-elementary-starter",
  "nodeboot-rest-starter": "file:../nodeboot-rest-starter"
},
```

Basically if the developer add **nodeboot-database-starter** to its package.json, **nodeboot-rest-starter** will detect it and auto configuration: database and oauth2 on the fly for you!!

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
