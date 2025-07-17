const consola = require("consola");
const { name: pkgName, version } = require("../package.json");
module.exports = consola.withScope(`${pkgName}@${version}`);
