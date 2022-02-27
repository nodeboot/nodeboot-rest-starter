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

Basically if the developer add **nodeboot-database-starter** to its package.json, **nodeboot-rest-starter** will detect it and starts the auto configuration

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
